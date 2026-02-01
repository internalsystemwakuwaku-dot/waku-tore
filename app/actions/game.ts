"use server";

/**
 * ゲーム Server Actions
 * GASの GameSystem を置き換え
 */

import { db } from "@/lib/db/client";
import { gameData } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { GameData, XpEventType, RankingEntry } from "@/types/game";
import { XP_REWARDS, LEVEL_TABLE, LEVEL_REWARDS, DEFAULT_GAME_DATA } from "@/types/game";

/**
 * ゲームデータを取得（なければ作成）
 */
export async function getGameData(userId: string): Promise<GameData> {
    const existing = await db
        .select()
        .from(gameData)
        .where(eq(gameData.userId, userId))
        .limit(1);

    if (existing.length > 0) {
        const data = JSON.parse(existing[0].dataJson) as GameData;
        data.userId = userId; // Ensure userId is present
        return data;
    }

    // 新規作成
    const newData = { ...DEFAULT_GAME_DATA, userId };
    await db.insert(gameData).values({
        userId,
        dataJson: JSON.stringify(newData),
    });

    return newData;
}

/**
 * ゲームデータを保存
 */
export async function saveGameData(
    userId: string,
    data: GameData
): Promise<{ success: boolean }> {
    try {
        const now = new Date().toISOString();

        await db
            .update(gameData)
            .set({
                dataJson: JSON.stringify(data),
                updatedAt: now,
            })
            .where(eq(gameData.userId, userId));

        return { success: true };
    } catch {
        return { success: false };
    }
}

/**
 * XPを獲得してレベルアップをチェック
 */
export async function earnXp(
    userId: string,
    eventType: XpEventType,
    multiplier: number = 1
): Promise<{
    success: boolean;
    xpGained: number;
    levelUp: boolean;
    newLevel?: number;
    reward?: { money: number; unlock?: string };
}> {
    try {
        const data = await getGameData(userId);
        const baseXp = XP_REWARDS[eventType] || 0;
        const xpGained = Math.floor(baseXp * multiplier);

        data.xp += xpGained;

        // レベルアップチェック
        let levelUp = false;
        let newLevel: number | undefined;
        let reward: { money: number; unlock?: string } | undefined;

        const nextLevel = data.level + 1;
        const requiredXp = LEVEL_TABLE[nextLevel] || (LEVEL_TABLE[20] + (nextLevel - 20) * 3000);

        if (data.xp >= requiredXp) {
            data.level = nextLevel;
            levelUp = true;
            newLevel = nextLevel;

            // レベル報酬をチェック
            const levelReward = LEVEL_REWARDS.find((r) => r.level === nextLevel);
            if (levelReward) {
                data.money += levelReward.reward.money;
                data.totalEarned += levelReward.reward.money;
                reward = levelReward.reward;
            }
        }

        // 統計更新
        if (eventType === "card_move") data.stats.cardsMoved++;
        if (eventType === "card_complete") data.stats.cardsCompleted++;
        if (eventType === "memo_create") data.stats.memosCreated++;
        if (eventType === "gacha_play") data.stats.gachaPlayed++;

        await saveGameData(userId, data);

        return { success: true, xpGained, levelUp, newLevel, reward };
    } catch {
        return { success: false, xpGained: 0, levelUp: false };
    }
}

/**
 * 所持金を増減
 */
export async function transactMoney(
    userId: string,
    amount: number,
    description: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
        const data = await getGameData(userId);

        // 借金上限 (-10,000G) チェック
        const DEBT_LIMIT = -10000;
        if (amount < 0 && data.money + amount < DEBT_LIMIT) {
            return { success: false, error: `資金不足です (借金上限: ${DEBT_LIMIT.toLocaleString()}G)` };
        }

        data.money += amount;
        if (amount > 0) {
            data.totalEarned += amount;
        }

        await saveGameData(userId, data);

        return { success: true, newBalance: data.money };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
}

/**
 * アイテムを購入
 */
export async function purchaseItem(
    userId: string,
    itemId: string,
    price: number
): Promise<{ success: boolean; error?: string }> {
    try {
        const data = await getGameData(userId);

        if (data.money < price) {
            return { success: false, error: "所持金が不足しています" };
        }

        data.money -= price;
        data.inventory[itemId] = (data.inventory[itemId] || 0) + 1;

        await saveGameData(userId, data);

        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
}

/**
 * デイリーログインボーナス
 */
export async function claimDailyBonus(
    userId: string
): Promise<{
    success: boolean;
    already?: boolean;
    xpGained?: number;
    moneyGained?: number;
    streak?: number;
}> {
    try {
        const data = await getGameData(userId);
        const today = new Date().toISOString().split("T")[0];

        // 既に受け取り済み
        if (data.lastDailyBonus === today) {
            return { success: true, already: true };
        }

        // 連続ログインチェック
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        if (data.lastDailyBonus === yesterdayStr) {
            data.streak++;
        } else {
            data.streak = 1;
        }

        data.lastDailyBonus = today;
        data.stats.logins++;

        // XP獲得（ストリークボーナス付き）
        const baseXp = XP_REWARDS.daily_login;
        const streakBonus = XP_REWARDS.streak_bonus * Math.min(data.streak, 7);
        const xpGained = baseXp + streakBonus;
        data.xp += xpGained;

        // 所持金ボーナス（7日連続で増加）
        const moneyGained = Math.min(data.streak, 7) * 10;
        data.money += moneyGained;
        data.totalEarned += moneyGained;

        await saveGameData(userId, data);

        return { success: true, xpGained, moneyGained, streak: data.streak };
    } catch {
        return { success: false };
    }
}

/**
 * ランキング取得（XP順）
 */
export async function getXpRanking(limit: number = 20): Promise<RankingEntry[]> {
    const allData = await db.select().from(gameData);

    const entries = allData
        .map((row) => {
            const data = JSON.parse(row.dataJson) as GameData;
            return {
                userId: row.userId,
                userName: row.userId, // TODO: ユーザー名取得
                value: data.xp,
                rank: 0,
            };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);

    // ランク付け
    entries.forEach((entry, index) => {
        entry.rank = index + 1;
    });

    return entries;
}

/**
 * ランキング取得（所持金順）
 */
export async function getMoneyRanking(limit: number = 20): Promise<RankingEntry[]> {
    const allData = await db.select().from(gameData);

    const entries = allData
        .map((row) => {
            const data = JSON.parse(row.dataJson) as GameData;
            return {
                userId: row.userId,
                userName: row.userId,
                value: data.money,
                rank: 0,
            };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);

    entries.forEach((entry, index) => {
        entry.rank = index + 1;
    });

    return entries;
}

/**
 * ゲーム設定を更新
 */
export async function updateGameSettings(
    userId: string,
    settings: Partial<GameData["settings"]>
): Promise<{ success: boolean }> {
    try {
        const data = await getGameData(userId);
        data.settings = { ...data.settings, ...settings };
        await saveGameData(userId, data);
        return { success: true };
    } catch {
        return { success: false };
    }
}
