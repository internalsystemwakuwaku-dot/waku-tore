"use server";

/**
 * 遶ｶ鬥ｬ繝ｻ繧ｬ繝√Ε Server Actions
 * - 繝ｬ繝ｼ繧ｹ縺ｯJST縺ｮ繧ｹ繧ｱ繧ｸ繝･繝ｼ繝ｫ縺ｧ閾ｪ蜍慕函謌・
 * - 謚慕･ｨ/霑秘≡/謇墓綾縺ｯ繝医Λ繝ｳ繧ｶ繧ｯ繧ｷ繝ｧ繝ｳ縺ｧ謨ｴ蜷域€ｧ繧呈球菫・
 */

import { db } from "@/lib/db/client";
import { gameData, keibaRaces, keibaTransactions, gachaRecords, users } from "@/lib/db/schema";
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
    { h: 1, m: 10 }, { h: 2, m: 0 },
    { h: 9, m: 55 }, { h: 10, m: 55 }, { h: 11, m: 55 }, { h: 12, m: 30 },
    { h: 13, m: 55 }, { h: 14, m: 55 }, { h: 15, m: 55 }, { h: 16, m: 55 },
    { h: 17, m: 55 }, { h: 21, m: 30 }, { h: 23, m: 30 }, { h: 23, m: 40 },
];

function getJstParts(date: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const get = (type: string, fallback: string) => parts.find(p => p.type === type)?.value || fallback;
    return {
        y: get("year", "1970"),
        m: get("month", "01"),
        d: get("day", "01"),
        h: Number(get("hour", "0")),
        min: Number(get("minute", "0")),
    };
}

export async function getActiveRace(userId: string): Promise<{ activeRace: Race; lastFinishedRace: Race | null; myBets: Bet[]; lastFinishedRaceBets: Bet[] }> {
    const now = new Date();
    const nowJstParts = getJstParts(now);
    const currentH = nowJstParts.h;
    const currentM = nowJstParts.min;

    // 1. 直近の終了レースを取得
    //    常に取得し、フロントエンドが "本日の結果" タブで使えるようにする
    let lastFinishedRace: Race | null = null;
    const lastRaceData = await db
        .select()
        .from(keibaRaces)
        .where(eq(keibaRaces.status, "finished"))
        .orderBy(desc(keibaRaces.finishedAt))
        .limit(1)
        .then((res) => res[0]);

    if (lastRaceData) {
        let lastRanking: number[] | undefined;
        try {
            lastRanking = lastRaceData.resultsJson ? JSON.parse(lastRaceData.resultsJson) : undefined;
        } catch { }

        lastFinishedRace = {
            id: lastRaceData.id,
            name: lastRaceData.name,
            horses: JSON.parse(lastRaceData.horsesJson),
            status: "finished",
            startedAt: lastRaceData.scheduledAt,
            winnerId: lastRaceData.winnerId,
            ranking: lastRanking,
        };
    }

    // additional: lastFinishedRace に対するベットも取得
    let lastFinishedRaceBets: Bet[] = [];
    if (lastFinishedRace) {
        const betsData = await db
            .select()
            .from(keibaTransactions)
            .where(and(eq(keibaTransactions.raceId, lastFinishedRace.id), eq(keibaTransactions.userId, userId)));

        lastFinishedRaceBets = betsData.map((b) => ({
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
    }

    // 2. ActiveRace (投票対象) の決定
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
        const baseParts = getJstParts(baseDate);
        const y = baseParts.y;
        const m = baseParts.m;
        const d = baseParts.d;
        const hh = String(config.h).padStart(2, "0");
        const mm = String(config.m).padStart(2, "0");
        const correctIsoWithOffset = `${y}-${m}-${d}T${hh}:${mm}:00+09:00`;
        const scheduledTime = new Date(correctIsoWithOffset);
        const raceId = `${y}${m}${d}_${hh}${mm}`;
        return { raceId, scheduledTime };
    };

    const today = new Date(`${nowJstParts.y}-${nowJstParts.m}-${nowJstParts.d}T00:00:00+09:00`);
    let targetRaceId: string | null = null;
    let targetScheduledTime: Date | null = null;

    if (!currentRaceConfig) {
        // 朝一番より前 -> 今日の最初のレース
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
        // Fallback
        const meta = buildRaceMeta(new Date(today.getTime() + 24 * 60 * 60 * 1000), RACE_SCHEDULE[0]);
        targetRaceId = meta.raceId;
        targetScheduledTime = meta.scheduledTime;
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

    // Waiting -> Calculating/Finished 遷移処理
    if (raceData.status === "waiting" && currentTime >= raceScheduledTime) {
        const resolved = await resolveRace(targetRaceId);
        if (resolved) {
            raceData = resolved;
            // いま終わったばかりなら lastFinishedRace も更新
            if (raceData.status === "finished") {
                let lastRanking: number[] | undefined;
                try { lastRanking = raceData.resultsJson ? JSON.parse(raceData.resultsJson) : undefined; } catch { }
                lastFinishedRace = {
                    id: raceData.id,
                    name: raceData.name,
                    horses: JSON.parse(raceData.horsesJson),
                    status: "finished",
                    startedAt: raceData.scheduledAt,
                    winnerId: raceData.winnerId,
                    ranking: lastRanking,
                };
                // lastFinishedRaceBets も更新が必要
                const betsData = await db
                    .select()
                    .from(keibaTransactions)
                    .where(and(eq(keibaTransactions.raceId, lastFinishedRace.id), eq(keibaTransactions.userId, userId)));

                lastFinishedRaceBets = betsData.map((b) => ({
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
            }
        } else {
            // 処理中の可能性があるので少し待って再取得
            let retryCount = 0;
            while (retryCount < 3) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const refetched = await db.select().from(keibaRaces).where(eq(keibaRaces.id, targetRaceId)).limit(1);
                if (refetched[0]) {
                    raceData = refetched[0];
                    if (raceData.status === "finished") break;
                }
                retryCount++;
            }
        }
    }

    // Calculating 待機
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

    // もしターゲットとしていたレースが finished なら、activeRace は「次のレース」にする。
    // Betting タブでは常に「次に賭けられるレース」を表示したい。
    if (raceData.status === "finished") {
        let nextMeta: { raceId: string; scheduledTime: Date } | null = null;

        // currentRaceConfig が今のレースだったので、その次が必要
        // まず、配列上での位置を探す
        // (currentRaceConfig may actully represent the just-finished one if we are just past the time)
        let idx = -1;
        if (currentRaceConfig) {
            idx = RACE_SCHEDULE.findIndex(s => s.h === currentRaceConfig?.h && s.m === currentRaceConfig?.m);
        }

        if (idx >= 0 && idx < RACE_SCHEDULE.length - 1) {
            nextMeta = buildRaceMeta(today, RACE_SCHEDULE[idx + 1]);
        } else {
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
            nextMeta = buildRaceMeta(tomorrow, RACE_SCHEDULE[0]);
        }

        // 念のため、見つけた nextMeta がさっきの targetRaceId と同じならさらに次へ (同じなら意味がない)
        if (nextMeta && nextMeta.raceId === targetRaceId) {
            if (idx >= 0 && idx < RACE_SCHEDULE.length - 2) {
                nextMeta = buildRaceMeta(today, RACE_SCHEDULE[idx + 2]);
            } else {
                const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                nextMeta = buildRaceMeta(tomorrow, RACE_SCHEDULE[0]);
            }
        }

        if (nextMeta) {
            targetRaceId = nextMeta.raceId;
            targetScheduledTime = nextMeta.scheduledTime;

            let nextRaceData = await db
                .select()
                .from(keibaRaces)
                .where(eq(keibaRaces.id, targetRaceId))
                .limit(1)
                .then((res) => res[0]);

            if (!nextRaceData) {
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
                nextRaceData = {
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
            raceData = nextRaceData;
        }
    }

    const myBetsData = await db
        .select()
        .from(keibaTransactions)
        .where(and(eq(keibaTransactions.raceId, raceData.id), eq(keibaTransactions.userId, userId)));

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

    const activeRace: Race = {
        id: raceData.id,
        name: raceData.name,
        horses: JSON.parse(raceData.horsesJson),
        status: raceData.status as Race["status"],
        startedAt: raceData.scheduledAt,
        winnerId: raceData.winnerId,
        ranking,
    };

    return { activeRace, lastFinishedRace, myBets, lastFinishedRaceBets };
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
            if (race.status !== "waiting") return { success: false, error: "賭けは締め切られました" };

            const deadline = new Date(race.scheduledAt!);
            deadline.setMinutes(deadline.getMinutes() - 1);
            if (new Date() > deadline) {
                return { success: false, error: "締切後のため賭けられません" };
            }

            if (!bets || bets.length === 0) {
                return { success: false, error: "賭け内容が空です" };
            }
            for (const b of bets) {
                if (!Number.isFinite(b.amount) || b.amount < 100) {
                    return { success: false, error: "賭け金は100G以上で指定してください" };
                }
                if ((b.type === "WIN" || b.type === "PLACE") && !b.horseId) {
                    return { success: false, error: "対象の馬を選択してください" };
                }
                if (b.details) {
                    try {
                        const details = JSON.parse(b.details);
                        const tickets: number[][] = Array.isArray(details.tickets) ? details.tickets : [];
                        const baseAmount = Number(details.baseAmount);
                        if (tickets.length > 0 && Number.isFinite(baseAmount)) {
                            const expected = baseAmount * tickets.length;
                            if (expected !== b.amount) {
                                return { success: false, error: "賭け金の合計が一致しません" };
                            }
                        }
                    } catch {
                        return { success: false, error: "賭け情報の形式が不正です" };
                    }
                }
            }

            const totalAmount = bets.reduce((sum, b) => sum + b.amount, 0);
            if (totalAmount <= 0) {
                return { success: false, error: "賭け金が不正です" };
            }

            const txResult = await transactMoney(userId, -totalAmount, `遶ｶ鬥ｬ謚慕･ｨ: ${race.name}`, "BET", tx);
            if (!txResult.success) {
                throw new Error(txResult.error || "賭け処理に失敗しました");
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

            await logActivity(userId, `競馬ベット: ${race.name} (${totalAmount}G)`, null, tx);
            return { success: true, newBalance: txResult.newBalance };
        });
    } catch (e) {
        console.error("[placeBet] Transaction failed:", e);
        return { success: false, error: e instanceof Error ? e.message : "賭け処理に失敗しました" };
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
                return { success: false, error: "賭けが見つかりません" };
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
                return { success: false, error: "締切後はキャンセルできません" };
            }

            const deadline = new Date(race.scheduledAt!);
            deadline.setMinutes(deadline.getMinutes() - 1);
            if (new Date() > deadline) {
                return { success: false, error: "締切後はキャンセルできません" };
            }

            await tx.delete(keibaTransactions).where(eq(keibaTransactions.id, Number(betId)));

            const refundAmount = betRecord.betAmount;
            const txResult = await transactMoney(userId, refundAmount, `遶ｶ鬥ｬ繧ｭ繝｣繝ｳ繧ｻ繝ｫ霑秘≡: ${race.name}`, "REFUND", tx);
            if (!txResult.success) {
                throw new Error("返金処理に失敗しました");
            }

            await logActivity(userId, `競馬キャンセル: ${race.name} (${refundAmount}G)`, null, tx);
            return { success: true, newBalance: txResult.newBalance };
        });
    } catch (e) {
        console.error("[cancelBet] Error:", e);
        return { success: false, error: e instanceof Error ? e.message : "キャンセルに失敗しました" };
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
                .where(and(eq(keibaRaces.id, raceId), or(eq(keibaRaces.status, "waiting"), eq(keibaRaces.status, "calculating"))))
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

        // Recovery: Reset to waiting and log error
        try {
            await db.transaction(async (tx) => {
                await tx.update(keibaRaces)
                    .set({ status: "waiting" })
                    .where(eq(keibaRaces.id, raceId));

                // Log to activity_logs is not directly available via tx? 
                // We can use the imported db or tx if available. logActivity uses db.
                // We'll separate logActivity from this short tx.
            });
            await logActivity("SYSTEM", `Race resolution failed ${raceId}: ${error instanceof Error ? error.message : String(error)}`);
        } catch (recoveryError) {
            console.error("[resolveRace] Recovery failed:", recoveryError);
        }

        throw error;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    const horseOdds = new Map<number, number>();
    for (const h of horses) horseOdds.set(h.id, h.odds || 2.0);

    const horseIds = horses.map(h => h.id);
    const frameMap: Record<number, number[]> = {
        1: [horseIds[0], horseIds[1]],
        2: [horseIds[2], horseIds[3]],
        3: [horseIds[4], horseIds[5]],
        4: [horseIds[6], horseIds[7]],
    };
    const frameOfHorse = (horseId: number) => {
        for (const [frame, ids] of Object.entries(frameMap)) {
            if (ids.includes(horseId)) return Number(frame);
        }
        return 0;
    };

    const typeMultiplier: Record<string, number> = {
        FRAME: 3,
        QUINELLA: 5,
        EXACTA: 10,
        WIDE: 3,
        TRIO: 15,
        TRIFECTA: 50,
        WIN5: 100,
    };

    const calcAvgOdds = (ids: number[], isFrame: boolean) => {
        if (ids.length === 0) return 0;
        let targets: number[] = [];
        if (isFrame) {
            for (const f of ids) {
                const list = frameMap[f] || [];
                targets = targets.concat(list);
            }
        } else {
            targets = ids;
        }
        if (targets.length === 0) return 0;
        const sum = targets.reduce((s, id) => s + (horseOdds.get(id) || 2.0), 0);
        return sum / targets.length;
    };

    const isWinForTicket = (betType: string, ticket: number[], isFrame: boolean) => {
        if (betType === "WIN") {
            return ticket[0] === r1;
        }
        if (betType === "PLACE") {
            return ticket[0] && top3Set.has(ticket[0]);
        }
        if (betType === "FRAME") {
            const f1 = frameOfHorse(r1);
            const f2 = frameOfHorse(r2);
            const t1 = ticket[0];
            const t2 = ticket[1];
            return (t1 === f1 && t2 === f2) || (t1 === f2 && t2 === f1);
        }
        if (betType === "QUINELLA") {
            const t1 = ticket[0];
            const t2 = ticket[1];
            return (t1 === r1 && t2 === r2) || (t1 === r2 && t2 === r1);
        }
        if (betType === "EXACTA") {
            return ticket[0] === r1 && ticket[1] === r2;
        }
        if (betType === "WIDE") {
            return ticket.length >= 2 && top3Set.has(ticket[0]) && top3Set.has(ticket[1]);
        }
        if (betType === "TRIO") {
            const betSet = new Set(ticket.slice(0, 3));
            return betSet.has(r1) && betSet.has(r2) && betSet.has(r3);
        }
        if (betType === "TRIFECTA") {
            return ticket[0] === r1 && ticket[1] === r2 && ticket[2] === r3;
        }
        return false;
    };

    const getWin5Winners = async (baseDate: string) => {
        const y = baseDate.slice(0, 4);
        const m = baseDate.slice(4, 6);
        const d = baseDate.slice(6, 8);
        const ids = RACE_SCHEDULE.slice(0, 5).map(s => {
            const hh = String(s.h).padStart(2, "0");
            const mm = String(s.m).padStart(2, "0");
            return `${y}${m}${d}_${hh}${mm}`;
        });
        const races = await queryBuilder
            .select()
            .from(keibaRaces)
            .where(or(...ids.map(id => eq(keibaRaces.id, id))));
        const byId = new Map<string, typeof keibaRaces.$inferSelect>(
            races.map((r: typeof keibaRaces.$inferSelect) => [r.id, r])
        );
        const winners: number[] = [];
        for (const id of ids) {
            const r = byId.get(id);
            if (!r || r.status !== "finished" || !r.resultsJson) return null;
            try {
                const ranking = JSON.parse(r.resultsJson) as number[];
                winners.push(ranking[0]);
            } catch {
                return null;
            }
        }
        return winners;
    };

    for (const bet of bets) {
        if (bet.payout > 0 || bet.isWin) continue;

        let isWin = false;
        let payout = 0;

        const betType = (bet.type || "WIN").toUpperCase();
        let betOdds: number | null = null;
        let tickets: number[][] = [];
        let baseAmount = 0;

        if (bet.details) {
            try {
                const details = JSON.parse(bet.details);
                if (typeof details.odds === "number" && details.odds > 0) {
                    betOdds = details.odds;
                }
                if (Array.isArray(details.tickets)) {
                    tickets = details.tickets;
                }
                if (Number.isFinite(details.baseAmount)) {
                    baseAmount = Number(details.baseAmount);
                }
            } catch { }
        }

        if (tickets.length === 0) {
            if (bet.horseId) tickets = [[bet.horseId]];
        }

        if (!baseAmount) {
            baseAmount = tickets.length > 0 ? Math.floor(bet.betAmount / tickets.length) : bet.betAmount;
        }

        if (betType === "WIN5") {
            const dateKey = raceId.slice(0, 8);
            const fifthId = `${dateKey}_${String(RACE_SCHEDULE[4].h).padStart(2, "0")}${String(RACE_SCHEDULE[4].m).padStart(2, "0")}`;
            if (raceId !== fifthId) continue;
            const winners = await getWin5Winners(dateKey);
            if (!winners || tickets.length === 0) continue;
            const ticket = tickets[0];
            if (ticket.length === 5 && ticket.every((v, idx) => v === winners[idx])) {
                isWin = true;
                payout = Math.floor(baseAmount * (typeMultiplier.WIN5 || 100));
            }
        } else {
            const isFrame = betType === "FRAME";
            for (const ticket of tickets) {
                if (!isWinForTicket(betType, ticket, isFrame)) continue;
                isWin = true;
                if (betType === "WIN") {
                    const horse = horses.find(h => h.id === ticket[0]);
                    const effectiveOdds = betOdds !== null ? betOdds : (horse?.odds || 2.0);
                    payout += Math.floor(baseAmount * effectiveOdds);
                } else if (betType === "PLACE") {
                    const horse = horses.find(h => h.id === ticket[0]);
                    const effectiveOdds = betOdds !== null ? betOdds : Math.max(1.0, (horse?.odds || 3.0) / 3);
                    payout += Math.floor(baseAmount * effectiveOdds);
                } else {
                    const avgOdds = calcAvgOdds(ticket, isFrame);
                    const mult = typeMultiplier[betType] || 1;
                    const effectiveOdds = betOdds !== null ? betOdds : avgOdds * mult;
                    payout += Math.floor(baseAmount * effectiveOdds);
                }
            }
        }

        if (isWin && payout > 0) {
            const updated = await queryBuilder
                .update(keibaTransactions)
                .set({ payout, isWin: true })
                .where(and(eq(keibaTransactions.id, bet.id), eq(keibaTransactions.payout, 0)))
                .returning({ id: keibaTransactions.id });

            if (updated.length === 0) continue;

            await transactMoney(bet.userId, payout, `遶ｶ鬥ｬ謇墓綾 ${raceId} (${bet.type})`, "PAYOUT", tx);
            await earnXp(bet.userId, "race_win", 1, tx);
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

// ========== 繧ｬ繝√Ε ==========

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

export async function getGachaHistory(userId: string, limit: number = 50): Promise<GachaRecord[]> {
    const records = await db
        .select()
        .from(gachaRecords)
        .where(eq(gachaRecords.userId, userId))
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
    const prefixes = ["霧島", "大河", "蒼天", "烈火", "雷鳴"];
    const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const types = ["ステークス", "スプリント", "マイルC", "グランプリ", "ダービー"];

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

    if (item.id.includes("xp") || item.id === "n_cookie") {
        const amounts: Record<string, number> = {
            n_xp_s: 50,
            n_xp_m: 100,
            r_xp_m: 150,
            r_xp_l: 200,
            sr_xp_l: 300,
            sr_xp_xl: 400,
            ssr_mega_xp: 1000,
            n_cookie: 10,
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

    const inventoryPatterns = ["theme", "booster", "decoration", "special", "ticket", "facility", "deco"];
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
        userName?: string;
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

        // Use local time strings with offset for comparison to match DB format (ISO-like with +09:00)
        // Start: today 00:00:00+09:00
        const startStr = `${y}-${m}-${d}T00:00:00+09:00`;

        // End: tomorrow 00:00:00+09:00
        const jstDate = new Date(`${y}-${m}-${d}T00:00:00+09:00`);
        jstDate.setDate(jstDate.getDate() + 1);
        const nextParts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Tokyo",
            year: "numeric", month: "2-digit", day: "2-digit"
        }).formatToParts(jstDate);
        const ny = nextParts.find(p => p.type === "year")?.value;
        const nm = nextParts.find(p => p.type === "month")?.value;
        const nd = nextParts.find(p => p.type === "day")?.value;
        const endStr = `${ny}-${nm}-${nd}T00:00:00+09:00`;

        // 縺ｾ縺壽悽譌･蛻・・繝ｬ繝ｼ繧ｹ繧貞叙蠕励＠縲∵凾蛻ｻ繧帝℃縺弱◆waiting/calculating繝ｬ繝ｼ繧ｹ縺後≠繧後・遒ｺ螳壼・逅・ｒ襍ｰ繧峨○繧・
        // calculating縺ｧ豐｡縺｣縺ｦ縺・ｋﾂ・騾・↑縺ｮ繧ゅΜ繧ｫ繝舌Μ蟇ｾ雎｡縺ｫ縺吶ｋ
        const todayRaces = await db
            .select()
            .from(keibaRaces)
            .where(or(
                and(gte(keibaRaces.scheduledAt, startStr), lt(keibaRaces.scheduledAt, endStr)),
                like(keibaRaces.id, todayPrefix)
            ))
            .orderBy(desc(keibaRaces.scheduledAt));

        for (const r of todayRaces) {
            // Status check: waiting OR calculating (recovery)
            if ((r.status === "waiting" || r.status === "calculating") && r.scheduledAt) {
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

        // 遒ｺ螳壽ｸ医∩繧貞・蜿門ｾ・
        const races = await db
            .select()
            .from(keibaRaces)
            .where(and(
                eq(keibaRaces.status, "finished"),
                or(
                    and(gte(keibaRaces.scheduledAt, startStr), lt(keibaRaces.scheduledAt, endStr)),
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
                userName?: string;
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
                    return h ? `${h.name} (オッズ${h.odds.toFixed(1)})` : `ID:${hid}`;
                });
            } catch {
                results = ["結果の取得に失敗しました"];
            }

            const betRows = await db
                .select()
                .from(keibaTransactions)
                .where(eq(keibaTransactions.raceId, r.id));

            const userIds = Array.from(new Set(betRows.map(b => b.userId)));
            const userMap = new Map<string, string>();
            if (userIds.length > 0) {
                const userRows = await db
                    .select({ id: users.id, name: users.name, email: users.email })
                    .from(users)
                    .where(or(...userIds.map(uid => eq(users.id, uid))));
                for (const u of userRows) {
                    userMap.set(u.id, u.name || u.email || u.id);
                }
            }

            const betsByUser = new Map<string, {
                userId: string;
                userName?: string;
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
                    userName: userMap.get(b.userId),
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
