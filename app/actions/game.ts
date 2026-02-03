"use server";

/**
 * ゲーム Server Actions
 * GASの GameSystem を置き換え
 */

import { db } from "@/lib/db/client";
import { gameData, transactions, keibaTransactions } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import type { GameData, XpEventType, RankingEntry } from "@/types/game";
import { XP_REWARDS, LEVEL_TABLE, LEVEL_REWARDS, DEFAULT_GAME_DATA } from "@/types/game";
import { getBoosterDurationMs, getMoneyMultiplier, getXpFlatBonus, getXpMultiplier } from "@/lib/gameEffects";

/**
 * ゲームデータを取得（なければ作成）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getGameData(userId: string, tx?: any): Promise<GameData> {
    const queryBuilder = tx || db;
    const existing = await queryBuilder
        .select()
        .from(gameData)
        .where(eq(gameData.userId, userId))
        .limit(1);

    if (existing.length > 0) {
        const data = JSON.parse(existing[0].dataJson) as GameData;
        data.userId = userId; // Ensure userId is present
        if (!data.activeBoosts) data.activeBoosts = {};
        return data;
    }

    // 新規作成
    const newData = { ...DEFAULT_GAME_DATA, userId };
    // queryBuilder is already defined at top of function
    await queryBuilder.insert(gameData).values({
        userId,
        dataJson: JSON.stringify(newData),
    });

    // M-12: 初期所持金の記録
    try {
        await queryBuilder.insert(transactions).values({
            userId,
            type: 'INITIAL',
            amount: Math.floor(newData.money),
            description: '初期所持金',
            balanceAfter: Math.floor(newData.money),
        });
    } catch (e) {
        console.error("[getGameData] Failed to insert initial transaction:", e);
    }

    return newData;
}

/**
 * ゲームデータを保存
 */
export async function saveGameData(
    userId: string,
    data: GameData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any
): Promise<{ success: boolean }> {
    try {
        const now = new Date().toISOString();

        const queryBuilder = tx || db;

        await queryBuilder
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
        let data = await getGameData(userId);
        const baseXp = XP_REWARDS[eventType] || 0;
        const inventory = data.inventory || {};
        const activeBoosts = data.activeBoosts || {};
        const xpMultiplier = getXpMultiplier(inventory, activeBoosts);
        const xpFlatBonus = getXpFlatBonus(inventory, activeBoosts);
        const xpGained = Math.floor((baseXp + xpFlatBonus) * multiplier * xpMultiplier);

        // レベルアップチェック
        let levelUp = false;
        let newLevel: number | undefined;
        let reward: { money: number; unlock?: string } | undefined;

        // 現在のXP + 獲得XP で判定
        const currentTotalXp = data.xp + xpGained;
        const nextLevel = data.level + 1;
        const requiredXp = LEVEL_TABLE[nextLevel] || (LEVEL_TABLE[20] + (nextLevel - 20) * 3000);

        if (currentTotalXp >= requiredXp) {
            // レベル報酬をチェック
            const levelReward = LEVEL_REWARDS.find((r) => r.level === nextLevel);

            if (levelReward && levelReward.reward.money > 0) {
                // M-12: お金付与を Ledger 経由で実行
                await transactMoney(userId, levelReward.reward.money, `レベルアップ報酬 (Lv.${nextLevel})`, "LEVEL_UP");
                // データ再取得 (お金更新後)
                data = await getGameData(userId);
                reward = levelReward.reward;
            } else if (levelReward) {
                reward = levelReward.reward;
            }

            if (levelReward?.reward.items?.length) {
                data.inventory = data.inventory || {};
                for (const item of levelReward.reward.items) {
                    data.inventory[item.itemId] = (data.inventory[item.itemId] || 0) + item.count;
                }
            }

            data.level = nextLevel;
            levelUp = true;
            newLevel = nextLevel;
        }

        // XP加算
        data.xp += xpGained;

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
 * M-10: 日次借金制限 (1日10,000Gまで) 対応
 * M-12: 取引台帳 (transactions) への記録対応
 */
export async function transactMoney(
    userId: string,
    amount: number,
    description: string,
    type: string = "GENERAL",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
        if (!userId) {
            console.error("[transactMoney] Error: userId is missing");
            return { success: false, error: "ユーザーIDが必要です" };
        }

        const data = await getGameData(userId, tx);

        const inventory = data.inventory || {};
        const activeBoosts = data.activeBoosts || {};
        const moneyMultiplier = getMoneyMultiplier(inventory, activeBoosts);
        const boostableTypes = new Set(["LEVEL_UP", "DAILY_BONUS", "GACHA_ITEM", "PAYOUT", "GENERAL"]);
        const adjustedAmount = (amount > 0 && moneyMultiplier !== 1 && boostableTypes.has(type))
            ? Math.floor(amount * moneyMultiplier)
            : amount;

        // 借金上限 (-10,000G) チェック
        const DEBT_LIMIT = -10000;
        if (amount < 0 && data.money + amount < DEBT_LIMIT) {
            return { success: false, error: `資金不足です (借金上限: ${DEBT_LIMIT.toLocaleString()}G)` };
        }

        // 日次借金制限チェック (LOANの場合のみ)
        // GASでは type === 'LOAN' で判定しているが、借金(マイナス)全般に適用すべきか？
        // M-10実装では「借金（マイナス amount）の場合」としている。
        // typeパラメータが来たので、明示的なLOAN以外でもマイナスならチェックする方針は維持しつつ、
        // ログは正確に残す。
        if (amount < 0 && data.money + amount < 0) {
            const DAILY_LOAN_LIMIT = 10000;
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            // 日付が変わっていたらリセット
            if (data.lastLoanDate !== today) {
                data.lastLoanDate = today;
                data.todayLoanAmount = 0;
            }

            // 実際に借入となる増分だけを計算
            const prevDebt = Math.max(0, -data.money);
            const nextDebt = Math.max(0, -(data.money + amount));
            const actualLoan = Math.max(0, nextDebt - prevDebt);
            const todayTotal = (data.todayLoanAmount || 0) + actualLoan;

            if (todayTotal > DAILY_LOAN_LIMIT) {
                const remaining = DAILY_LOAN_LIMIT - (data.todayLoanAmount || 0);
                return {
                    success: false,
                    error: `本日の借入限度額を超えています (残り: ${Math.max(0, remaining).toLocaleString()}G / 上限: ${DAILY_LOAN_LIMIT.toLocaleString()}G)`
                };
            }

            // 借入額を記録
            data.todayLoanAmount = todayTotal;
        }

        data.money += adjustedAmount;
        if (adjustedAmount > 0) {
            data.totalEarned += adjustedAmount;
        }

        await saveGameData(userId, data, tx);

        // M-12: 取引台帳へ記録
        // data.money has already been updated above
        try {
            const queryBuilder = tx || db;
            await queryBuilder.insert(transactions).values({
                userId,
                type,
                amount: Math.floor(adjustedAmount),
                description,
                balanceAfter: Math.floor(data.money),
            });
        } catch (insertError) {
            console.error("[transactMoney] Failed to insert transaction log:", insertError);
            // Transaction log failure shouldn't stop the main flow, or should it?
            // Proceeding because money is already updated in gameData.
        }

        return { success: true, newBalance: data.money };
    } catch (e) {
        console.error("[transactMoney] Error:", e);
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
        // 1. お金を引き落とす (Transaction Ledger経由)
        const tx = await transactMoney(userId, -price, `アイテム購入: ${itemId}`, "ITEM_PURCHASE");
        if (!tx.success) {
            return { success: false, error: tx.error || "所持金が不足しています" };
        }

        // 2. データを再取得してインベントリ更新 (お金は更新済み)
        const data = await getGameData(userId);
        data.inventory[itemId] = (data.inventory[itemId] || 0) + 1;

        await saveGameData(userId, data);

        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
}


/**
 * ???????????????????
 */
export async function activateBooster(
    userId: string,
    boosterId: string
): Promise<{ success: boolean; error?: string; activeBoosts?: Record<string, number>; inventory?: Record<string, number> }> {
    try {
        const data = await getGameData(userId);
        const durationMs = getBoosterDurationMs(boosterId);
        if (!durationMs) {
            return { success: false, error: "??????????" };
        }

        const inventory = data.inventory || {};
        const owned = inventory[boosterId] || 0;
        if (owned <= 0) {
            return { success: false, error: "???????????" };
        }

        const now = Date.now();
        const expiresAt = now + durationMs;
        const activeBoosts = { ...(data.activeBoosts || {}), [boosterId]: expiresAt };

        inventory[boosterId] = owned - 1;

        data.inventory = inventory;
        data.activeBoosts = activeBoosts;

        await saveGameData(userId, data);

        return { success: true, activeBoosts, inventory };
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

        const moneyGained = Math.min(data.streak, 7) * 10;

        // 所持金付与を TransactMoney 経由で実行 (M-12 Ledger対応)
        // 先にメモリ上の日付/ストリークを更新してから、お金を処理し、最後に全て保存...
        // いや、transactMoneyで保存が発生するので、順番に注意。

        // 1. お金以外を先に処理してしまうと、transactMoneyで上書きされる可能性がある。
        // なので、まずお金を付与。
        await transactMoney(userId, moneyGained, "デイリーボーナス", "DAILY_BONUS");

        // 2. データを再取得 (お金更新後)
        const updatedData = await getGameData(userId);

        // 3. ストリークなどの情報を更新
        updatedData.lastDailyBonus = today;
        updatedData.stats.logins++; // これは単純加算でよいか？ streak判定は元データ`data`で行ったが...
        // streak判定ロジックは変えず、updatedDataに適用する
        updatedData.streak = data.streak; // 事前に計算したstreak値をセット

        // XP獲得
        updatedData.xp += xpGained;

        await saveGameData(userId, updatedData);

        return { success: true, xpGained, moneyGained, streak: updatedData.streak };
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

/**
 * 残高整合性チェック (Gap M-8対応)
 * keibaTransactions から残高を再計算し、gameData.money と照合
 */
// 348行目の重複importは削除
// import { keibaTransactions } from "@/lib/db/schema"; <-- Remove this line in replacement or just ignore if valid?
// Better to just reimplement the function cleanly.

export async function reconcileBalance(
    userId: string
): Promise<{ success: boolean; balance: number; mismatch?: boolean; reconciled?: boolean; message?: string }> {
    try {
        const data = await getGameData(userId);

        // M-12: transactionsテーブルから集計
        const result = await db
            .select({
                total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
                count: sql<number>`COUNT(${transactions.id})`,
                hasInitial: sql<number>`SUM(CASE WHEN ${transactions.type} = 'INITIAL' THEN 1 ELSE 0 END)`
            })
            .from(transactions)
            .where(eq(transactions.userId, userId))
            .then(res => res[0]);

        const calculatedBalance = result.total;

        // レガシーデータ対応: INITIAL取引がなく、かつ残高が整合しない場合
        // 取引履歴が途中から始まっているユーザーへの簡易対応
        // (厳密には「不明」だが、初期金10000G + 履歴 と仮定して比較することも可能)
        if ((!result.hasInitial || result.hasInitial === 0) && result.count > 0) {
            // 履歴はあるが初期金レコードがない -> 移行ユーザーの可能性
            // ここでは「不整合」として報告するが、メッセージを付与
            return {
                success: true,
                balance: data.money,
                mismatch: data.money !== calculatedBalance,
                message: "Legacy user: Missing INITIAL transaction"
            };
        }

        const calculatedBalanceFinal = result.total;

        const currentBalance = data.money;
        const mismatch = currentBalance !== calculatedBalanceFinal;

        if (mismatch) {
            console.warn(`[reconcileBalance] User ${userId}: mismatch detected. Current: ${currentBalance}, Calculated: ${calculatedBalanceFinal}`);
            // オプション: 自動修正 (この実装ではログのみ)
            // data.money = calculatedBalance;
            // await saveGameData(userId, data);
        }

        return { success: true, balance: calculatedBalance, mismatch, reconciled: false };
    } catch (e) {
        console.error("reconcileBalance error:", e);
        return { success: false, balance: 0 };
    }
}


/**
 * 借金ランキング（所持金マイナス順）
 */
export async function getDebtRanking(limit: number = 20): Promise<RankingEntry[]> {
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
        .filter(entry => entry.value < 0)
        .sort((a, b) => a.value - b.value) // Ascending (Example: -10000 < -100 works for negative numbers? -10000 - (-100) = -9900. Ascending order means smallest first, i.e. largest debt first. Correct.)
        .slice(0, limit);

    entries.forEach((entry, index) => {
        entry.rank = index + 1;
    });

    return entries;
}

/**
 * 高額配当ランキング
 */
export async function getPayoutRanking(limit: number = 20): Promise<RankingEntry[]> {
    const records = await db
        .select()
        .from(keibaTransactions)
        .where(eq(keibaTransactions.isWin, true))
        .orderBy(desc(keibaTransactions.payout))
        .limit(limit);

    return records.map((r, i) => ({
        userId: r.userId,
        userName: r.userId,
        value: r.payout,
        rank: i + 1,
    }));
}
