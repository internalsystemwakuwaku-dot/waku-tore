"use server";

/**
 * 競馬・ガチャ Server Actions
 * GASのKeiba/Gachaを置き換え
 */

import { db } from "@/lib/db/client";
import { keibaRaces, keibaTransactions, gachaRecords, gameData } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type {
    Race,
    Bet,
    RaceResult,
    Horse,
    GachaResult,
    GachaItem,
    KeibaTransaction,
    GachaRecord,
} from "@/types/keiba";
import { DEFAULT_HORSES, DEFAULT_GACHA_POOL, RARITY_CONFIG } from "@/types/keiba";
import { transactMoney, earnXp } from "./game";

/**
 * 新しいレースを作成
 */
export async function createRace(userId: string): Promise<Race> {
    const raceId = crypto.randomUUID();

    // ランダムにオッズを少し変動させる
    const horses: Horse[] = DEFAULT_HORSES.map((h) => ({
        ...h,
        odds: Math.round((h.odds + (Math.random() - 0.5) * 0.5) * 10) / 10,
    }));

    const race: Race = {
        id: raceId,
        name: generateRaceName(),
        horses,
        status: "waiting",
        winnerId: null,
        startedAt: null,
    };

    await db.insert(keibaRaces).values({
        id: raceId,
        userId,
        name: race.name,
        horsesJson: JSON.stringify(horses),
        status: "waiting",
    });

    return race;
}

/**
 * レースを実行して結果を取得
 */
export async function runRace(
    userId: string,
    raceId: string,
    bet: Bet
): Promise<RaceResult> {
    // レースを取得
    const existing = await db
        .select()
        .from(keibaRaces)
        .where(eq(keibaRaces.id, raceId))
        .limit(1);

    if (existing.length === 0) {
        throw new Error("レースが見つかりません");
    }

    const race = existing[0];
    if (race.status !== "waiting") {
        throw new Error("レースは既に終了しています");
    }

    const horses: Horse[] = JSON.parse(race.horsesJson);

    // 賭け金を差し引く
    const deductResult = await transactMoney(userId, -bet.amount, "競馬賭け");
    if (!deductResult.success) {
        throw new Error(deductResult.error || "所持金が不足しています");
    }

    // 勝者を決定（winRateに基づく抽選）
    const winnerId = selectWinner(horses);
    const winner = horses.find((h) => h.id === winnerId)!;

    // 配当計算
    const isWin = bet.horseId === winnerId;
    const betHorse = horses.find((h) => h.id === bet.horseId)!;
    const payout = isWin ? Math.floor(bet.amount * betHorse.odds) : 0;

    // 配当を付与
    if (payout > 0) {
        await transactMoney(userId, payout, "競馬配当");
        await earnXp(userId, "race_win");
    }

    // レース結果を保存
    await db
        .update(keibaRaces)
        .set({
            status: "finished",
            winnerId,
            finishedAt: new Date().toISOString(),
        })
        .where(eq(keibaRaces.id, raceId));

    // トランザクション記録
    await db.insert(keibaTransactions).values({
        raceId,
        horseId: bet.horseId,
        betAmount: bet.amount,
        payout,
        isWin,
    });

    return {
        raceId,
        winnerId,
        winnerName: winner.name,
        userBet: bet,
        payout,
        isWin,
    };
}

/**
 * 競馬履歴を取得
 */
export async function getKeibaHistory(
    userId: string,
    limit: number = 20
): Promise<KeibaTransaction[]> {
    // レースIDからユーザーを絞り込み
    const races = await db
        .select({ id: keibaRaces.id })
        .from(keibaRaces)
        .where(eq(keibaRaces.userId, userId));

    const raceIds = races.map((r) => r.id);

    if (raceIds.length === 0) return [];

    const transactions = await db
        .select()
        .from(keibaTransactions)
        .orderBy(desc(keibaTransactions.createdAt))
        .limit(limit);

    // ユーザーのレースのみフィルタ
    return transactions
        .filter((t) => raceIds.includes(t.raceId))
        .map((t) => ({
            id: t.id,
            raceId: t.raceId,
            horseId: t.horseId,
            betAmount: t.betAmount,
            payout: t.payout,
            isWin: t.isWin ?? false,
            createdAt: t.createdAt || "",
        }));
}

/**
 * ガチャを回す
 */
export async function pullGacha(
    userId: string,
    poolId: string = "standard",
    count: number = 1
): Promise<{
    success: boolean;
    results?: GachaResult[];
    error?: string;
}> {
    const pool = DEFAULT_GACHA_POOL; // TODO: poolIdでプールを取得

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

/**
 * ガチャ履歴を取得
 */
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

/**
 * レース名を生成
 */
function generateRaceName(): string {
    const prefixes = ["第", ""];
    const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const types = ["わくわく杯", "スプリント", "マイルCS", "グランプリ", "ダービー"];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = numbers[Math.floor(Math.random() * numbers.length)];
    const type = types[Math.floor(Math.random() * types.length)];

    return `${prefix}${number}回 ${type}`;
}

/**
 * 勝者を選択
 */
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

/**
 * ガチャアイテムを選択
 */
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

/**
 * ガチャアイテム効果を適用
 */
async function applyGachaItemEffect(userId: string, item: GachaItem): Promise<void> {
    // アイテムIDに基づいて効果を適用
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
        // XPはgameDataを直接更新
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
