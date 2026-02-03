"use server";

/**
 * 競馬・ガチャ Server Actions
 * - レースはJSTのスケジュールで自動生成
 * - 投票/返金/払戻はトランザクションで整合性を担保
 */

import { db } from "@/lib/db/client";
import { gameData, keibaRaces, keibaTransactions, gachaRecords } from "@/lib/db/schema";
import { eq, desc, and, like, or, gte, lt } from "drizzle-orm";
import { logActivity } from "./log";
import type {
    Race,
    Bet,
    Horse,
    GachaResult,
    GachaItem,
    KeibaTransaction,
    GachaRecord,
    BetType,
    BetMode,
} from "@/types/keiba";
import { DEFAULT_HORSES, DEFAULT_GACHA_POOL } from "@/types/keiba";
import { getGachaDiscountRate, getGachaRerolls, pickBetterGachaItem } from "@/lib/gameEffects";
import { transactMoney, earnXp, getGameData } from "./game";

const RACE_SCHEDULE = [
    { h: 9, m: 55 }, { h: 10, m: 55 }, { h: 11, m: 55 }, { h: 12, m: 30 },
    { h: 13, m: 55 }, { h: 14, m: 55 }, { h: 15, m: 55 }, { h: 16, m: 55 },
    { h: 17, m: 55 }, { h: 21, m: 30 }, { h: 23, m: 30 }, { h: 23, m: 40 },
];

export async function getActiveRace(userId: string): Promise<{ race: Race; myBets: Bet[] }> {
    const now = new Date();
    const nowJstStr = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
    const nowJst = new Date(nowJstStr);

    const currentH = nowJst.getHours();
    const currentM = nowJst.getMinutes();

    let currentRaceConfig: { h: number; m: number } | null = null;
    let nextRaceConfig: { h: number; m: number } | null = null;

    for (const s of RACE_SCHEDULE) {
        if (s.h < currentH || (s.h === currentH && s.m <= currentM)) {
            currentRaceConfig = s;
        } else if (!nextRaceConfig) {
            nextRaceConfig = s;
        }
    }

    const buildRaceMeta = (baseDate: Date, config: { h: number; m: number }) => {
        const raceDate = new Date(baseDate);
        raceDate.setHours(config.h, config.m, 0, 0);
        const y = raceDate.getFullYear();
        const m = String(raceDate.getMonth() + 1).padStart(2, "0");
        const d = String(raceDate.getDate()).padStart(2, "0");
        const hh = String(config.h).padStart(2, "0");
        const mm = String(config.m).padStart(2, "0");
        const correctIsoWithOffset = `${y}-${m}-${d}T${hh}:${mm}:00+09:00`;
        const scheduledTime = new Date(correctIsoWithOffset);
        const raceId = `${y}${m}${d}_${hh}${mm}`;
        return { raceId, scheduledTime };
    };

    const today = new Date(nowJst);
    let targetRaceId: string | null = null;
    let targetScheduledTime: Date | null = null;

    if (!currentRaceConfig) {
        // Before the first race of the day
        if (!nextRaceConfig) nextRaceConfig = RACE_SCHEDULE[0];
        const meta = buildRaceMeta(today, nextRaceConfig);
        targetRaceId = meta.raceId;
        targetScheduledTime = meta.scheduledTime;
    } else {
        const currentMeta = buildRaceMeta(today, currentRaceConfig);
        targetRaceId = currentMeta.raceId;
        targetScheduledTime = currentMeta.scheduledTime;
    }

    if (!targetRaceId || !targetScheduledTime) {
        throw new Error("Race schedule not found");
    }

    let raceData = await db
        .select()
        .from(keibaRaces)
        .where(eq(keibaRaces.id, targetRaceId))
        .limit(1)
        .then((res) => res[0]);

    if (!raceData) {
        const horses: Horse[] = DEFAULT_HORSES.map((h) => ({
            ...h,
            odds: Math.round((h.odds + (Math.random() - 0.5) * 0.5) * 10) / 10,
        }));

        const name = generateRaceName();
        try {
            await db.insert(keibaRaces).values({
                id: targetRaceId,
                userId: null,
                name,
                horsesJson: JSON.stringify(horses),
                status: "waiting",
                scheduledAt: targetScheduledTime.toISOString(),
                resultsJson: null,
            });

            raceData = {
                id: targetRaceId,
                userId: null,
                name,
                horsesJson: JSON.stringify(horses),
                status: "waiting",
                scheduledAt: targetScheduledTime.toISOString(),
                winnerId: null,
                resultsJson: null,
                finishedAt: null,
                createdAt: now.toISOString(),
            };
        } catch (e) {
            const retry = await db.select().from(keibaRaces).where(eq(keibaRaces.id, targetRaceId)).limit(1);
            if (retry[0]) raceData = retry[0];
            else throw e;
        }
    }

    const raceScheduledTime = new Date(raceData.scheduledAt!);
    const currentTime = new Date();

    if (raceData.status === "waiting" && currentTime >= raceScheduledTime) {
        const resolved = await resolveRace(targetRaceId);
        if (resolved) {
            raceData = resolved;
        } else {
            let retryCount = 0;
            const maxRetries = 3;
            const retryDelay = 500;

            while (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                const refetched = await db.select().from(keibaRaces).where(eq(keibaRaces.id, targetRaceId)).limit(1);
                if (refetched[0]) {
                    raceData = refetched[0];
                    if (raceData.status === "finished") break;
                }
                retryCount++;
            }
        }
    }

    if (raceData.status === "calculating") {
        let retryCount = 0;
        const maxRetries = 5;
        const retryDelay = 300;

        while (retryCount < maxRetries && raceData.status === "calculating") {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            const refetched = await db.select().from(keibaRaces).where(eq(keibaRaces.id, targetRaceId)).limit(1);
            if (refetched[0]) raceData = refetched[0];
            retryCount++;
        }
    }

    // If current race already finished, but user has bets on it, keep showing it.
    if (raceData.status === "finished") {
        const hasMyBets = await db
            .select({ id: keibaTransactions.id })
            .from(keibaTransactions)
            .where(and(eq(keibaTransactions.raceId, raceData.id), eq(keibaTransactions.userId, userId)))
            .limit(1)
            .then((res) => res.length > 0);

        if (!hasMyBets) {
            // Move to next race (today or tomorrow)
            let nextMeta: { raceId: string; scheduledTime: Date } | null = null;
            if (nextRaceConfig) {
                nextMeta = buildRaceMeta(today, nextRaceConfig);
            } else {
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                nextMeta = buildRaceMeta(tomorrow, RACE_SCHEDULE[0]);
            }

            if (nextMeta) {
                targetRaceId = nextMeta.raceId;
                targetScheduledTime = nextMeta.scheduledTime;
                raceData = await db
                    .select()
                    .from(keibaRaces)
                    .where(eq(keibaRaces.id, targetRaceId))
                    .limit(1)
                    .then((res) => res[0]);

                if (!raceData) {
                    const horses: Horse[] = DEFAULT_HORSES.map((h) => ({
                        ...h,
                        odds: Math.round((h.odds + (Math.random() - 0.5) * 0.5) * 10) / 10,
                    }));

                    const name = generateRaceName();
                    await db.insert(keibaRaces).values({
                        id: targetRaceId,
                        userId: null,
                        name,
                        horsesJson: JSON.stringify(horses),
                        status: "waiting",
                        scheduledAt: targetScheduledTime.toISOString(),
                        resultsJson: null,
                    });

                    raceData = {
                        id: targetRaceId,
                        userId: null,
                        name,
                        horsesJson: JSON.stringify(horses),
                        status: "waiting",
                        scheduledAt: targetScheduledTime.toISOString(),
                        winnerId: null,
                        resultsJson: null,
                        finishedAt: null,
                        createdAt: now.toISOString(),
                    };
                }
            }
        }
    }

    const myBetsData = await db
        .select()
        .from(keibaTransactions)
        .where(and(eq(keibaTransactions.raceId, targetRaceId), eq(keibaTransactions.userId, userId)));

    const myBets: Bet[] = myBetsData.map((b) => ({
        id: String(b.id),
        raceId: b.raceId,
        userId: b.userId,
        type: (b.type as BetType) || "WIN",
        mode: (b.mode as BetMode) || "NORMAL",
        horseId: b.horseId || undefined,
        details: b.details || undefined,
        amount: b.betAmount,
        payout: b.payout,
        createdAt: b.createdAt || "",
    }));

    let ranking: number[] | undefined;
    if (raceData.resultsJson) {
        try {
            ranking = JSON.parse(raceData.resultsJson) as number[];
        } catch {
            ranking = undefined;
        }
    }

    const race: Race = {
        id: raceData.id,
        name: raceData.name,
        horses: JSON.parse(raceData.horsesJson),
        status: raceData.status as Race["status"],
        startedAt: raceData.scheduledAt,
        winnerId: raceData.winnerId,
        ranking,
    };

    return { race, myBets };
}

export async function placeBet(
    userId: string,
    raceId: string,
    bets: { type: BetType; mode: BetMode; horseId?: number; details?: string; amount: number }[]
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    if (!userId) {
        return { success: false, error: "ユーザーIDが不正です" };
    }

    try {
        return await db.transaction(async (tx) => {
            const race = await tx
                .select()
                .from(keibaRaces)
                .where(eq(keibaRaces.id, raceId))
                .limit(1)
                .then((res) => res[0]);

            if (!race) return { success: false, error: "レースが見つかりません" };
            if (race.status !== "waiting") return { success: false, error: "投票は締め切られました" };

            const deadline = new Date(race.scheduledAt!);
            deadline.setMinutes(deadline.getMinutes() - 1);
            if (new Date() > deadline) {
                return { success: false, error: "締切1分前のため投票できません" };
            }

            if (!bets || bets.length === 0) {
                return { success: false, error: "投票内容が空です" };
            }
            for (const b of bets) {
                if (!Number.isFinite(b.amount) || b.amount < 100) {
                    return { success: false, error: "投票金額は100以上で指定してください" };
                }
                if ((b.type === "WIN" || b.type === "PLACE") && !b.horseId) {
                    return { success: false, error: "対象の馬が未選択です" };
                }
            }

            const totalAmount = bets.reduce((sum, b) => sum + b.amount, 0);
            if (totalAmount <= 0) {
                return { success: false, error: "投票金額が不正です" };
            }

            const txResult = await transactMoney(userId, -totalAmount, `競馬投票: ${race.name}`, "BET", tx);
            if (!txResult.success) {
                throw new Error(txResult.error || "投票の処理に失敗しました");
            }

            for (const bet of bets) {
                await tx.insert(keibaTransactions).values({
                    userId,
                    raceId,
                    type: bet.type,
                    mode: bet.mode,
                    horseId: bet.horseId,
                    details: bet.details,
                    betAmount: bet.amount,
                    isWin: false,
                });
            }

            await logActivity(userId, `競馬投票: ${race.name} (計${totalAmount}G)`, null, tx);
            return { success: true, newBalance: txResult.newBalance };
        });
    } catch (e) {
        console.error("[placeBet] Transaction failed:", e);
        return { success: false, error: e instanceof Error ? e.message : "投票の処理に失敗しました" };
    }
}

export async function cancelBet(
    userId: string,
    betId: string
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    if (!userId) {
        return { success: false, error: "ユーザーIDが不正です" };
    }

    try {
        return await db.transaction(async (tx) => {
            const betRecord = await tx
                .select()
                .from(keibaTransactions)
                .where(and(eq(keibaTransactions.id, Number(betId)), eq(keibaTransactions.userId, userId)))
                .limit(1)
                .then((res) => res[0]);

            if (!betRecord) {
                return { success: false, error: "対象の投票が見つかりません" };
            }

            const race = await tx
                .select()
                .from(keibaRaces)
                .where(eq(keibaRaces.id, betRecord.raceId))
                .limit(1)
                .then((res) => res[0]);

            if (!race) {
                return { success: false, error: "レース情報が見つかりません" };
            }

            if (race.status !== "waiting") {
                return { success: false, error: "レースが開始されたためキャンセルできません" };
            }

            const deadline = new Date(race.scheduledAt!);
            deadline.setMinutes(deadline.getMinutes() - 1);
            if (new Date() > deadline) {
                return { success: false, error: "締切1分前のためキャンセルできません" };
            }

            await tx.delete(keibaTransactions).where(eq(keibaTransactions.id, Number(betId)));

            const refundAmount = betRecord.betAmount;
            const txResult = await transactMoney(userId, refundAmount, `競馬キャンセル返金: ${race.name}`, "REFUND", tx);
            if (!txResult.success) {
                throw new Error("返金処理に失敗しました");
            }

            await logActivity(userId, `競馬キャンセル: ${race.name} (返金 ${refundAmount}G)`, null, tx);
            return { success: true, newBalance: txResult.newBalance };
        });
    } catch (e) {
        console.error("[cancelBet] Error:", e);
        return { success: false, error: e instanceof Error ? e.message : "キャンセル処理に失敗しました" };
    }
}

async function resolveRace(raceId: string) {
    try {
        return await db.transaction(async (tx) => {
            const updatedRows = await tx
                .update(keibaRaces)
                .set({
                    status: "calculating",
                    finishedAt: new Date().toISOString(),
                })
                .where(and(eq(keibaRaces.id, raceId), eq(keibaRaces.status, "waiting")))
                .returning();

            if (updatedRows.length === 0) return null;

            const race = updatedRows[0];
            const horses: Horse[] = JSON.parse(race.horsesJson);
            const ranking = determineRanking(horses);
            const winnerId = ranking[0];

            const finalizingRows = await tx
                .update(keibaRaces)
                .set({
                    status: "finished",
                    winnerId,
                    resultsJson: JSON.stringify(ranking),
                })
                .where(eq(keibaRaces.id, raceId))
                .returning();

            await processPayouts(raceId, ranking, horses, tx);
            return finalizingRows[0];
        });
    } catch (error) {
        console.error(`[resolveRace] Error resolving race ${raceId}:`, error);
        throw error;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processPayouts(raceId: string, ranking: number[], horses: Horse[], tx: any) {
    const queryBuilder = tx || db;
    const bets = await queryBuilder
        .select()
        .from(keibaTransactions)
        .where(eq(keibaTransactions.raceId, raceId));

    const r1 = ranking[0];
    const r2 = ranking[1];
    const r3 = ranking[2];
    const top3Set = new Set([r1, r2, r3]);

    for (const bet of bets) {
        if (bet.payout > 0 || bet.isWin) continue;

        let isWin = false;
        let payout = 0;

        let betHorses: number[] = [];
        let betOdds: number | null = null;
        if (bet.details) {
            try {
                const details = JSON.parse(bet.details);
                betHorses = details.horses || [];
                if (typeof details.odds === "number" && details.odds > 0) {
                    betOdds = details.odds;
                }
            } catch { }
        }
        if (bet.horseId && betHorses.length === 0) {
            betHorses = [bet.horseId];
        }

        const betType = (bet.type || "WIN").toUpperCase();

        if (betType === "WIN" || betType === "TANSHO" || betType === "単勝") {
            if (betHorses[0] === r1) {
                isWin = true;
                const horse = horses.find(h => h.id === r1);
                const effectiveOdds = betOdds !== null ? betOdds : (horse?.odds || 2.0);
                payout = Math.floor(bet.betAmount * effectiveOdds);
            }
        } else if (betType === "PLACE" || betType === "FUKUSHO" || betType === "複勝") {
            if (betHorses[0] && top3Set.has(betHorses[0])) {
                isWin = true;
                const horse = horses.find(h => h.id === betHorses[0]);
                const effectiveOdds = betOdds !== null ? betOdds : Math.max(1.0, (horse?.odds || 3.0) / 3);
                payout = Math.floor(bet.betAmount * effectiveOdds);
            }
        } else if (betType === "UMAREN" || betType === "QUINELLA" || betType === "馬連") {
            if (betHorses.length >= 2) {
                const h1 = betHorses[0];
                const h2 = betHorses[1];
                if ((h1 === r1 && h2 === r2) || (h1 === r2 && h2 === r1)) {
                    isWin = true;
                    const effectiveOdds = betOdds !== null ? betOdds : 5.0;
                    payout = Math.floor(bet.betAmount * effectiveOdds);
                }
            }
        } else if (betType === "UMATAN" || betType === "EXACTA" || betType === "馬単") {
            if (betHorses.length >= 2 && betHorses[0] === r1 && betHorses[1] === r2) {
                isWin = true;
                const effectiveOdds = betOdds !== null ? betOdds : 10.0;
                payout = Math.floor(bet.betAmount * effectiveOdds);
            }
        } else if (betType === "SANRENPUKU" || betType === "TRIO" || betType === "三連複") {
            if (betHorses.length >= 3) {
                const betSet = new Set(betHorses.slice(0, 3));
                if (betSet.has(r1) && betSet.has(r2) && betSet.has(r3)) {
                    isWin = true;
                    const effectiveOdds = betOdds !== null ? betOdds : 15.0;
                    payout = Math.floor(bet.betAmount * effectiveOdds);
                }
            }
        } else if (betType === "SANRENTAN" || betType === "TRIFECTA" || betType === "三連単") {
            if (betHorses.length >= 3 && betHorses[0] === r1 && betHorses[1] === r2 && betHorses[2] === r3) {
                isWin = true;
                const effectiveOdds = betOdds !== null ? betOdds : 50.0;
                payout = Math.floor(bet.betAmount * effectiveOdds);
            }
        }

        if (isWin && payout > 0) {
            await queryBuilder
                .update(keibaTransactions)
                .set({ payout, isWin: true })
                .where(eq(keibaTransactions.id, bet.id));

            await transactMoney(bet.userId, payout, `競馬払戻 ${raceId} (${bet.type})`, "PAYOUT", tx);
            await earnXp(bet.userId, "race_win");
        }
    }
}

function determineRanking(horses: Horse[]): number[] {
    let candidates = [...horses];
    const ranking: number[] = [];

    while (candidates.length > 0) {
        const totalRate = candidates.reduce((sum, h) => sum + h.winRate, 0);
        let random = Math.random() * totalRate;
        let selected = candidates[0];

        for (const horse of candidates) {
            random -= horse.winRate;
            if (random <= 0) {
                selected = horse;
                break;
            }
        }

        ranking.push(selected.id);
        candidates = candidates.filter(h => h.id !== selected.id);
    }
    return ranking;
}

export async function getKeibaHistory(
    userId: string,
    limit: number = 20
): Promise<KeibaTransaction[]> {
    const transactions = await db
        .select()
        .from(keibaTransactions)
        .where(eq(keibaTransactions.userId, userId))
        .orderBy(desc(keibaTransactions.createdAt))
        .limit(limit);

    return transactions.map((t) => ({
        id: t.id,
        raceId: t.raceId,
        userId: t.userId,
        type: t.type || "WIN",
        mode: t.mode || "NORMAL",
        horseId: t.horseId || undefined,
        details: t.details || undefined,
        betAmount: t.betAmount,
        payout: t.payout,
        isWin: t.isWin ?? false,
        createdAt: t.createdAt || "",
    }));
}

// ========== ガチャ ==========

export async function pullGacha(
    userId: string,
    poolId: string = "standard",
    count: number = 1
): Promise<{ success: boolean; results?: GachaResult[]; error?: string }> {
    const pool = DEFAULT_GACHA_POOL;
    const data = await getGameData(userId);
    const inventory = data.inventory || {};
    const activeBoosts = data.activeBoosts || {};
    const discountRate = getGachaDiscountRate(inventory, activeBoosts);
    const totalCost = Math.floor(pool.cost * count * discountRate);

    const deductResult = await transactMoney(userId, -totalCost, "ガチャ", "GACHA");
    if (!deductResult.success) {
        return { success: false, error: deductResult.error };
    }

    const results: GachaResult[] = [];

    try {
        for (let i = 0; i < count; i++) {
            let item = selectGachaItem(pool.items);
            const rerolls = getGachaRerolls(inventory, activeBoosts);
            for (let r = 0; r < rerolls; r++) {
                const candidate = selectGachaItem(pool.items);
                item = pickBetterGachaItem(item, candidate);
            }

            const existing = await db
                .select()
                .from(gachaRecords)
                .where(eq(gachaRecords.itemId, item.id));

            const duplicate = existing.length;

            results.push({
                item,
                isNew: duplicate === 0,
                duplicate,
            });

            await db.insert(gachaRecords).values({
                userId,
                poolId,
                itemId: item.id,
                rarity: item.rarity,
            });

            await earnXp(userId, "gacha_play");
            await logActivity(userId, `ガチャ獲得: ${item.name} (${item.rarity})`);
            await applyGachaItemEffect(userId, item);
        }

        return { success: true, results };
    } catch (e) {
        console.error("pullGacha error:", e);
        return { success: false, error: "ガチャ処理に失敗しました" };
    }
}

export async function getGachaHistory(limit: number = 50): Promise<GachaRecord[]> {
    const records = await db
        .select()
        .from(gachaRecords)
        .orderBy(desc(gachaRecords.createdAt))
        .limit(limit);

    return records.map((r) => ({
        id: r.id,
        poolId: r.poolId,
        itemId: r.itemId,
        rarity: r.rarity as GachaRecord["rarity"],
        createdAt: r.createdAt || "",
    }));
}

function generateRaceName(): string {
    const prefixes = ["朝日", "秋華", "桜花", "皐月", "天皇"];
    const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const types = ["記念", "スプリント", "マイルC", "グランプリ", "ダービー"];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = numbers[Math.floor(Math.random() * numbers.length)];
    const type = types[Math.floor(Math.random() * types.length)];

    return `${prefix}${number} ${type}`;
}

function selectGachaItem(items: GachaItem[]): GachaItem {
    const totalRate = items.reduce((sum, i) => sum + i.dropRate, 0);
    let random = Math.random() * totalRate;

    for (const item of items) {
        random -= item.dropRate;
        if (random <= 0) {
            return item;
        }
    }
    return items[0];
}

async function applyGachaItemEffect(userId: string, item: GachaItem): Promise<void> {
    if (item.id.includes("coin") || item.id.includes("jackpot") || item.id.includes("golden")) {
        const amounts: Record<string, number> = {
            n_coin_s: 50,
            n_coin_m: 100,
            r_coin_l: 300,
            sr_coin_xl: 500,
            ssr_jackpot: 1000,
            ur_golden: 3000,
        };
        const amount = amounts[item.id] || 0;
        if (amount > 0) {
            await transactMoney(userId, amount, `ガチャ獲得: ${item.name}`, "GACHA_ITEM");
        }
    }

    if (item.id.includes("xp")) {
        const amounts: Record<string, number> = {
            n_xp_s: 50,
            r_xp_m: 150,
            sr_xp_l: 300,
            ssr_mega_xp: 1000,
        };
        const amount = amounts[item.id] || 0;
        if (amount > 0) {
            const existing = await db
                .select()
                .from(gameData)
                .where(eq(gameData.userId, userId))
                .limit(1);

            if (existing.length > 0) {
                const data = JSON.parse(existing[0].dataJson);
                data.xp += amount;
                await db
                    .update(gameData)
                    .set({
                        dataJson: JSON.stringify(data),
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(gameData.userId, userId));
            }
        }
    }

    const inventoryPatterns = ["theme", "booster", "decoration", "special", "ticket"];
    const isInventoryItem = inventoryPatterns.some(pattern => item.id.toLowerCase().includes(pattern));

    if (isInventoryItem && !item.id.includes("coin") && !item.id.includes("xp")) {
        const existing = await db
            .select()
            .from(gameData)
            .where(eq(gameData.userId, userId))
            .limit(1);

        if (existing.length > 0) {
            const data = JSON.parse(existing[0].dataJson);
            data.inventory = data.inventory || {};
            data.inventory[item.id] = (data.inventory[item.id] || 0) + 1;
            await db
                .update(gameData)
                .set({
                    dataJson: JSON.stringify(data),
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(gameData.userId, userId));
        }
    }
}

export async function getTodayRaceResults(): Promise<{
    race: Race;
    results: string[];
    ranking: number[];
    bets: {
        userId: string;
        totalBet: number;
        totalPayout: number;
        items: {
            type: string;
            horseId?: number;
            amount: number;
            payout: number;
            isWin: boolean;
        }[];
    }[];
}[]> {
    try {
        const now = new Date();
        const jstParts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Tokyo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(now);
        const y = jstParts.find(p => p.type === "year")?.value || "1970";
        const m = jstParts.find(p => p.type === "month")?.value || "01";
        const d = jstParts.find(p => p.type === "day")?.value || "01";
        const todayPrefix = `${y}${m}${d}_%`;
        const jstStart = new Date(`${y}-${m}-${d}T00:00:00+09:00`);
        const jstEnd = new Date(jstStart);
        jstEnd.setDate(jstEnd.getDate() + 1);
        const startIso = jstStart.toISOString();
        const endIso = jstEnd.toISOString();

        // まず本日分のレースを取得し、時刻を過ぎたwaitingレースがあれば確定処理を走らせる
        const todayRaces = await db
            .select()
            .from(keibaRaces)
            .where(or(
                and(gte(keibaRaces.scheduledAt, startIso), lt(keibaRaces.scheduledAt, endIso)),
                like(keibaRaces.id, todayPrefix)
            ))
            .orderBy(desc(keibaRaces.scheduledAt));

        for (const r of todayRaces) {
            if (r.status === "waiting" && r.scheduledAt) {
                const scheduled = new Date(r.scheduledAt);
                if (Number.isFinite(scheduled.getTime()) && now >= scheduled) {
                    try {
                        await resolveRace(r.id);
                    } catch (err) {
                        console.error(`[getTodayRaceResults] Failed to resolve race ${r.id}:`, err);
                    }
                }
            }
        }

        // 確定済みを再取得
        const races = await db
            .select()
            .from(keibaRaces)
            .where(and(
                eq(keibaRaces.status, "finished"),
                or(
                    and(gte(keibaRaces.scheduledAt, startIso), lt(keibaRaces.scheduledAt, endIso)),
                    like(keibaRaces.id, todayPrefix)
                )
            ))
            .orderBy(desc(keibaRaces.scheduledAt));

        const output: {
            race: Race;
            results: string[];
            ranking: number[];
            bets: {
                userId: string;
                totalBet: number;
                totalPayout: number;
                items: {
                    type: string;
                    horseId?: number;
                    amount: number;
                    payout: number;
                    isWin: boolean;
                }[];
            }[];
        }[] = [];
        for (const r of races) {
            let results: string[] = [];
            let resultIds: number[] = [];
            try {
                resultIds = JSON.parse(r.resultsJson || "[]") as number[];
                const horses = JSON.parse(r.horsesJson) as Horse[];
                results = resultIds.map(hid => {
                    const h = horses.find(h => h.id === hid);
                    return h ? `${h.name} (${h.odds.toFixed(1)}倍)` : `ID:${hid}`;
                });
            } catch {
                results = ["結果の取得に失敗しました"];
            }

            const betRows = await db
                .select()
                .from(keibaTransactions)
                .where(eq(keibaTransactions.raceId, r.id));

            const betsByUser = new Map<string, {
                userId: string;
                totalBet: number;
                totalPayout: number;
                items: {
                    type: string;
                    horseId?: number;
                    amount: number;
                    payout: number;
                    isWin: boolean;
                }[];
            }>();

            for (const b of betRows) {
                const entry = betsByUser.get(b.userId) || {
                    userId: b.userId,
                    totalBet: 0,
                    totalPayout: 0,
                    items: [],
                };

                entry.totalBet += b.betAmount;
                entry.totalPayout += b.payout;
                entry.items.push({
                    type: b.type || "WIN",
                    horseId: b.horseId || undefined,
                    amount: b.betAmount,
                    payout: b.payout,
                    isWin: b.isWin ?? false,
                });

                betsByUser.set(b.userId, entry);
            }

            output.push({
                race: {
                    id: r.id,
                    name: r.name,
                    status: r.status as Race["status"],
                    horses: JSON.parse(r.horsesJson),
                    startedAt: r.scheduledAt || r.createdAt || "",
                    winnerId: r.winnerId,
                    ranking: resultIds,
                },
                results,
                ranking: resultIds,
                bets: Array.from(betsByUser.values()),
            });
        }

        return output;
    } catch {
        return [];
    }
}
