"use server";

/**
 * 競馬・ガチャ Server Actions (Global Multiplayer Version)
 * GASのKeiba/Gachaを置き換え
 * - Lazy Creationによるグローバルレース生成
 * - 複雑なベット対応
 */

import { db } from "@/lib/db/client";
import { keibaRaces, keibaTransactions, gachaRecords, gameData } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type {
    Race,
    Bet,
    RaceResult,
    Horse,
    GachaResult,
    GachaItem,
    KeibaTransaction,
    GachaRecord,
    BetType,
    BetMode
} from "@/types/keiba";
import { DEFAULT_HORSES, DEFAULT_GACHA_POOL, RARITY_CONFIG } from "@/types/keiba";
import { transactMoney, earnXp } from "./game";

/**
 * 現在の有効なレースを取得（なければ作成）- グローバル版
 */
export async function getActiveRace(userId: string): Promise<{ race: Race; myBets: Bet[] }> {
    const now = new Date();
    // スケジュール: 毎時00分発走
    const currentHour = now.getHours();
    const nextHour = currentHour + 1;

    // レースIDは "YYYYMMDD_HH00" 形式
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(nextHour).padStart(2, "0");
    const raceId = `${y}${m}${d}_${h}00`;

    // 発走予定時刻
    const scheduledTime = new Date(now);
    scheduledTime.setHours(nextHour, 0, 0, 0);

    // DB確認
    let raceData = await db
        .select()
        .from(keibaRaces)
        .where(eq(keibaRaces.id, raceId))
        .limit(1)
        .then((res) => res[0]);

    // なければ作成 (Lazy Creation)
    if (!raceData) {
        const horses: Horse[] = DEFAULT_HORSES.map((h) => ({
            ...h,
            odds: Math.round((h.odds + (Math.random() - 0.5) * 0.5) * 10) / 10,
            winRate: h.winRate // 型定義にある通り
        }));

        const name = generateRaceName();

        // System race (userId is null)
        await db.insert(keibaRaces).values({
            id: raceId,
            userId: null,
            name,
            horsesJson: JSON.stringify(horses),
            status: "waiting",
            scheduledAt: scheduledTime.toISOString(),
            resultsJson: null,
        });

        raceData = {
            id: raceId,
            userId: null,
            name,
            horsesJson: JSON.stringify(horses),
            status: "waiting",
            scheduledAt: scheduledTime.toISOString(),
            winnerId: null,
            resultsJson: null,
            finishedAt: null,
            createdAt: now.toISOString(),
        };
    }

    // 遅延解決: もし予定時間を過ぎていて、まだ waiting なら結果を生成
    if (raceData.status === "waiting" && new Date() >= new Date(raceData.scheduledAt!)) {
        raceData = await resolveRace(raceId);
    }

    // 自分のベットを取得
    const myBetsData = await db
        .select()
        .from(keibaTransactions)
        .where(
            and(
                eq(keibaTransactions.raceId, raceId),
                eq(keibaTransactions.userId, userId)
            )
        );

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

    const race: Race = {
        id: raceData.id,
        name: raceData.name,
        horses: JSON.parse(raceData.horsesJson),
        status: raceData.status as any,
        startedAt: raceData.scheduledAt,
        winnerId: raceData.winnerId,
    };

    return { race, myBets };
}

/**
 * ベットする
 */
export async function placeBet(
    userId: string,
    raceId: string,
    bets: { type: BetType; mode: BetMode; horseId?: number; details?: string; amount: number }[]
): Promise<{ success: boolean; error?: string }> {
    // レース状態確認
    const race = await db
        .select()
        .from(keibaRaces)
        .where(eq(keibaRaces.id, raceId))
        .limit(1)
        .then((res) => res[0]);

    if (!race) return { success: false, error: "レースが見つかりません" };
    if (race.status !== "waiting") return { success: false, error: "投票は締め切られました" };

    // 締切時刻チェック (発走1分前まで)
    const deadline = new Date(race.scheduledAt!);
    deadline.setMinutes(deadline.getMinutes() - 1);
    if (new Date() > deadline) {
        return { success: false, error: "発走1分前のため投票は締め切られました" };
    }

    // 合計金額計算
    const totalAmount = bets.reduce((sum, b) => sum + b.amount, 0);

    // 所持金チェック & 引き落とし
    const tx = await transactMoney(userId, -totalAmount, `競馬投票: ${race.name}`);
    if (!tx.success) return { success: false, error: tx.error };

    // ベット保存
    for (const bet of bets) {
        await db.insert(keibaTransactions).values({
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

    return { success: true };
}

/**
 * レース結果を確定（Server-Side Resolution）
 */
async function resolveRace(raceId: string) {
    const race = await db
        .select()
        .from(keibaRaces)
        .where(eq(keibaRaces.id, raceId))
        .limit(1)
        .then((res) => res[0]);

    if (!race || race.status !== "waiting") return race!;

    const horses: Horse[] = JSON.parse(race.horsesJson);

    // 全順位を決定
    const ranking = determineRanking(horses);
    const winnerId = ranking[0];

    // DB更新
    await db
        .update(keibaRaces)
        .set({
            status: "finished",
            winnerId,
            resultsJson: JSON.stringify(ranking),
            finishedAt: new Date().toISOString(),
        })
        .where(eq(keibaRaces.id, raceId));

    // 結果が確定したので、このレースに対する全ユーザーの配当を処理
    await processPayouts(raceId, ranking, horses);

    return { ...race, status: "finished", winnerId, resultsJson: JSON.stringify(ranking), finishedAt: new Date().toISOString() };
}

/**
 * 配当処理（バッチ）
 */
async function processPayouts(raceId: string, ranking: number[], horses: Horse[]) {
    // このレースの全ベット取得
    const bets = await db
        .select()
        .from(keibaTransactions)
        .where(eq(keibaTransactions.raceId, raceId));

    const winnerId = ranking[0];
    const top3 = ranking.slice(0, 3);
    const winner = horses.find(h => h.id === winnerId);
    if (!winner) return;

    for (const bet of bets) {
        let isWin = false;
        let payout = 0;

        // WIN (単勝)
        if (bet.type === "WIN") {
            if (bet.horseId === winnerId) {
                isWin = true;
                payout = Math.floor(bet.betAmount * winner.odds);
            }
        }
        // PLACE (複勝) - 3着以内
        else if (bet.type === "PLACE") {
            if (bet.horseId && top3.includes(bet.horseId)) {
                isWin = true;
                // 簡易配当計算: オッズ/3
                // 本来は (プール - 控除) / 的中数 だが、ここでは固定オッズ制の簡易版
                const horse = horses.find(h => h.id === bet.horseId);
                const odds = horse ? horse.odds : 3.0;
                payout = Math.floor(bet.betAmount * Math.max(1.0, odds / 3));
            }
        }

        // Complex Bets (BOX/NAGASHI) would be handled here if expanded into types
        // OR checks against 'details' json. But for now Client expands to WIN/PLACE bets.

        if (isWin && payout > 0) {
            // トランザクション更新
            await db
                .update(keibaTransactions)
                .set({
                    payout,
                    isWin: true
                })
                .where(eq(keibaTransactions.id, bet.id));

            // ユーザーに払い戻し
            await transactMoney(bet.userId, payout, `競馬配当: ${raceId} (${bet.type})`);

            // Only earn XP once per race? Or per win? 
            if (isWin) {
                await earnXp(bet.userId, "race_win");
            }
        }
    }
}

// Helper to determine ranking based on winRate
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


/**
 * 競馬履歴を取得 (互換性用)
 */
export async function getKeibaHistory(
    userId: string,
    limit: number = 20
): Promise<KeibaTransaction[]> {
    // ユーザーの全トランザクションを取得
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

// ========== ガチャ (既存のまま) ==========

export async function pullGacha(
    userId: string,
    poolId: string = "standard",
    count: number = 1
): Promise<{
    success: boolean;
    results?: GachaResult[];
    error?: string;
}> {
    const pool = DEFAULT_GACHA_POOL;
    const totalCost = pool.cost * count;

    // 費用を差し引く
    const deductResult = await transactMoney(userId, -totalCost, "ガチャ");
    if (!deductResult.success) {
        return { success: false, error: deductResult.error };
    }

    // ガチャを実行
    const results: GachaResult[] = [];

    for (let i = 0; i < count; i++) {
        const item = selectGachaItem(pool.items);

        // 既存の記録を確認
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

        // 記録を保存
        await db.insert(gachaRecords).values({
            poolId,
            itemId: item.id,
            rarity: item.rarity,
        });

        // XP獲得
        await earnXp(userId, "gacha_play");

        // アイテム効果を適用
        await applyGachaItemEffect(userId, item);
    }

    return { success: true, results };
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

// ========== ヘルパー関数 ==========

function generateRaceName(): string {
    const prefixes = ["第", ""];
    const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const types = ["わくわく杯", "スプリント", "マイルCS", "グランプリ", "ダービー"];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = numbers[Math.floor(Math.random() * numbers.length)];
    const type = types[Math.floor(Math.random() * types.length)];

    return `${prefix}${number}回 ${type}`;
}

// Legacy helper kept just in case, but determineRanking is preferred
function selectWinner(horses: Horse[]): number {
    const totalRate = horses.reduce((sum, h) => sum + h.winRate, 0);
    let random = Math.random() * totalRate;

    for (const horse of horses) {
        random -= horse.winRate;
        if (random <= 0) {
            return horse.id;
        }
    }

    return horses[0].id;
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
    if (item.id.includes("coin")) {
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
            await transactMoney(userId, amount, `ガチャ獲得: ${item.name}`);
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
}
