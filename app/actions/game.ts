"use server";

/**
 * ゲーム Server Actions
 * GASの GameSystem を置き換ぁE
 */

import { db } from "@/lib/db/client";
import { gameData, transactions, keibaTransactions, users } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import type { GameData, XpEventType, RankingEntry } from "@/types/game";
import { XP_REWARDS, LEVEL_TABLE, LEVEL_REWARDS, DEFAULT_GAME_DATA } from "@/types/game";
import { getBoosterDurationMs, getMoneyMultiplier, getXpFlatBonus, getXpMultiplier } from "@/lib/gameEffects";

/**
 * ゲームチE�Eタを取得（なければ作�E�E�E
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

    // 新規作�E
    const newData = { ...DEFAULT_GAME_DATA, userId };
    // queryBuilder is already defined at top of function
    await queryBuilder.insert(gameData).values({
        userId,
        dataJson: JSON.stringify(newData),
    });

    // M-12: 初期所持E��の記録
    try {
        await queryBuilder.insert(transactions).values({
            userId,
            type: 'INITIAL',
            amount: Math.floor(newData.money),
            description: '初期所持E��',
            balanceAfter: Math.floor(newData.money),
        });
    } catch (e) {
        console.error("[getGameData] Failed to insert initial transaction:", e);
    }

    return newData;
}

/**
 * ゲームチE�Eタを保孁E
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
 * XPを獲得してレベルアチE�EをチェチE��
 */
export async function earnXp(
    userId: string,
    eventType: XpEventType,
    multiplier: number = 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any
): Promise<{
    success: boolean;
    xpGained: number;
    levelUp: boolean;
    newLevel?: number;
    reward?: { money: number; unlock?: string };
}> {
    try {
        let data = await getGameData(userId, tx);
        const baseXp = XP_REWARDS[eventType] || 0;
        const inventory = data.inventory || {};
        const activeBoosts = data.activeBoosts || {};
        const xpMultiplier = getXpMultiplier(inventory, activeBoosts);
        const xpFlatBonus = getXpFlatBonus(inventory, activeBoosts);
        const xpGained = Math.floor((baseXp + xpFlatBonus) * multiplier * xpMultiplier);

        // レベルアチE�EチェチE��
        let levelUp = false;
        let newLevel: number | undefined;
        let reward: { money: number; unlock?: string } | undefined;

        // 現在のXP + 獲得XP で判宁E
        const currentTotalXp = data.xp + xpGained;
        const nextLevel = data.level + 1;
        const requiredXp = LEVEL_TABLE[nextLevel] || (LEVEL_TABLE[20] + (nextLevel - 20) * 3000);

        if (currentTotalXp >= requiredXp) {
            // レベル報酬をチェチE��
            const levelReward = LEVEL_REWARDS.find((r) => r.level === nextLevel);

            if (levelReward && levelReward.reward.money > 0) {
                // M-12: お��付与を Ledger 経由で実衁E
                await transactMoney(userId, levelReward.reward.money, `レベルアチE�E報酬 (Lv.${nextLevel})`, "LEVEL_UP", tx);
                // チE�Eタ再取征E(お��更新征E
                data = await getGameData(userId, tx);
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

        // XP加箁E
        data.xp += xpGained;

        // 統計更新
        if (eventType === "card_move") data.stats.cardsMoved++;
        if (eventType === "card_complete") data.stats.cardsCompleted++;
        if (eventType === "memo_create") data.stats.memosCreated++;
        if (eventType === "gacha_play") data.stats.gachaPlayed++;

        await saveGameData(userId, data, tx);

        return { success: true, xpGained, levelUp, newLevel, reward };
    } catch {
        return { success: false, xpGained: 0, levelUp: false };
    }
}

/**
 * 所持E��を増渁E
 * M-10: 日次借��制陁E(1日10,000Gまで) 対忁E
 * M-12: 取引台帳 (transactions) への記録対忁E
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
            return { success: false, error: "ユーザーIDが忁E��でぁE };
        }

        const data = await getGameData(userId, tx);

        const inventory = data.inventory || {};
        const activeBoosts = data.activeBoosts || {};
        const moneyMultiplier = getMoneyMultiplier(inventory, activeBoosts);
        const boostableTypes = new Set(["LEVEL_UP", "DAILY_BONUS", "GACHA_ITEM", "PAYOUT", "GENERAL"]);
        const adjustedAmount = (amount > 0 && moneyMultiplier !== 1 && boostableTypes.has(type))
            ? Math.floor(amount * moneyMultiplier)
            : amount;

        // 借��上限 (-10,000G) チェチE��
        const DEBT_LIMIT = -10000;
        if (amount < 0 && data.money + amount < DEBT_LIMIT) {
            return { success: false, error: `賁E��不足でぁE(借��上限: ${DEBT_LIMIT.toLocaleString()}G)` };
        }

        // 日次借��制限チェチE�� (LOANの場合�Eみ)
        // GASでは type === 'LOAN' で判定してぁE��が、借��(マイナス)全般に適用すべきか�E�E
        // M-10実裁E��は「借�߁E��Eイナス amount�E��E場合」としてぁE��、E
        // typeパラメータが来た�Eで、�E示皁E��LOAN以外でも�EイナスならチェチE��する方針�E維持しつつ、E
        // ログは正確に残す、E
        if (amount < 0 && data.money + amount < 0) {
            const DAILY_LOAN_LIMIT = 10000;
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            // 日付が変わってぁE��らリセチE��
            if (data.lastLoanDate !== today) {
                data.lastLoanDate = today;
                data.todayLoanAmount = 0;
            }

            // 実際に借�Eとなる増�Eだけを計箁E
            const prevDebt = Math.max(0, -data.money);
            const nextDebt = Math.max(0, -(data.money + amount));
            const actualLoan = Math.max(0, nextDebt - prevDebt);
            const todayTotal = (data.todayLoanAmount || 0) + actualLoan;

            if (todayTotal > DAILY_LOAN_LIMIT) {
                const remaining = DAILY_LOAN_LIMIT - (data.todayLoanAmount || 0);
                return {
                    success: false,
                    error: `本日の借�E限度額を趁E��てぁE��ぁE(残り: ${Math.max(0, remaining).toLocaleString()}G / 上限: ${DAILY_LOAN_LIMIT.toLocaleString()}G)`
                };
            }

            // 借�E額を記録
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
 * アイチE��を購入
 */
export async function purchaseItem(
    userId: string,
    itemId: string,
    price: number
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. お��を引き落とぁE(Transaction Ledger経由)
        const tx = await transactMoney(userId, -price, `アイチE��購入: ${itemId}`, "ITEM_PURCHASE");
        if (!tx.success) {
            return { success: false, error: tx.error || "所持E��が不足してぁE��ぁE };
        }

        // 2. チE�Eタを�E取得してインベントリ更新 (お��は更新済み)
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
 * チE��リーログインボ�Eナス
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

        // 連続ログインチェチE��
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

        // XP獲得（ストリークボ�Eナス付き�E�E
        const baseXp = XP_REWARDS.daily_login;
        const streakBonus = XP_REWARDS.streak_bonus * Math.min(data.streak, 7);
        const xpGained = baseXp + streakBonus;
        data.xp += xpGained;

        const moneyGained = Math.min(data.streak, 7) * 10;

        // 所持E��付与を TransactMoney 経由で実衁E(M-12 Ledger対忁E
        // 先にメモリ上�E日仁Eストリークを更新してから、お金を処琁E��、最後に全て保孁E..
        // ぁE��、transactMoneyで保存が発生する�Eで、E��E��に注意、E

        // 1. お��以外を先に処琁E��てしまぁE��、transactMoneyで上書きされる可能性がある、E
        // なので、まずお金を付与、E
        await transactMoney(userId, moneyGained, "チE��リーボ�Eナス", "DAILY_BONUS");

        // 2. チE�Eタを�E取征E(お��更新征E
        const updatedData = await getGameData(userId);

        // 3. ストリークなどの惁E��を更新
        updatedData.lastDailyBonus = today;
        updatedData.stats.logins++; // これは単純加算でよいか！Estreak判定�E允E��ータ`data`で行ったが...
        // streak判定ロジチE��は変えず、updatedDataに適用する
        updatedData.streak = data.streak; // 事前に計算したstreak値をセチE��

        // XP獲征E
        updatedData.xp += xpGained;

        await saveGameData(userId, updatedData);

        return { success: true, xpGained, moneyGained, streak: updatedData.streak };
    } catch {
        return { success: false };
    }
}

/**
 * ランキング取得！EP頁E��E
 */
export async function getXpRanking(limit: number = 20): Promise<RankingEntry[]> {
    const allData = await db
        .select()
        .from(gameData)
        .leftJoin(users, eq(users.id, gameData.userId));

    const entries = allData
        .map((row) => {
            const data = JSON.parse(row.game_data.dataJson) as GameData;
            const userName = row.users?.name || row.users?.email || row.game_data.userId;
            return {
                userId: row.game_data.userId,
                userName,
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
 * ランキング取得（所持E��頁E��E
 */
export async function getMoneyRanking(limit: number = 20): Promise<RankingEntry[]> {
    const allData = await db
        .select()
        .from(gameData)
        .leftJoin(users, eq(users.id, gameData.userId));

    const entries = allData
        .map((row) => {
            const data = JSON.parse(row.game_data.dataJson) as GameData;
            const userName = row.users?.name || row.users?.email || row.game_data.userId;
            return {
                userId: row.game_data.userId,
                userName,
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
 * 残高整合性チェチE�� (Gap M-8対忁E
 * keibaTransactions から残高を再計算し、gameData.money と照吁E
 */
// 348行目の重複importは削除
// import { keibaTransactions } from "@/lib/db/schema"; <-- Remove this line in replacement or just ignore if valid?
// Better to just reimplement the function cleanly.

export async function reconcileBalance(
    userId: string
): Promise<{ success: boolean; balance: number; mismatch?: boolean; reconciled?: boolean; message?: string }> {
    try {
        const data = await getGameData(userId);

        // M-12: transactionsチE�Eブルから雁E��E
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

        // レガシーチE�Eタ対忁E INITIAL取引がなく、かつ残高が整合しなぁE��吁E
        // 取引履歴が途中から始まってぁE��ユーザーへの簡易対忁E
        // (厳寁E��は「不�E」だが、�E期��10000G + 履歴 と仮定して比輁E��ることも可能)
        if ((!result.hasInitial || result.hasInitial === 0) && result.count > 0) {
            // 履歴はあるが�E期��レコードがなぁE-> 移行ユーザーの可能性
            // ここでは「不整合」として報告するが、メチE��ージを付丁E
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
            // オプション: 自動修正 (こ�E実裁E��はログのみ)
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
 * 借��ランキング�E�所持E��マイナス頁E��E
 */
export async function getDebtRanking(limit: number = 20): Promise<RankingEntry[]> {
    const allData = await db
        .select()
        .from(gameData)
        .leftJoin(users, eq(users.id, gameData.userId));

    const entries = allData
        .map((row) => {
            const data = JSON.parse(row.game_data.dataJson) as GameData;
            const userName = row.users?.name || row.users?.email || row.game_data.userId;
            return {
                userId: row.game_data.userId,
                userName,
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
 * 高額�E当ランキング
 */
export async function getPayoutRanking(limit: number = 20): Promise<RankingEntry[]> {
    const records = await db
        .select()
        .from(keibaTransactions)
        .leftJoin(users, eq(users.id, keibaTransactions.userId))
        .where(eq(keibaTransactions.isWin, true))
        .orderBy(desc(keibaTransactions.payout))
        .limit(limit);

    return records.map((r, i) => ({
        userId: r.keiba_transactions.userId,
        userName: r.users?.name || r.users?.email || r.keiba_transactions.userId,
        value: r.keiba_transactions.payout,
        rank: i + 1,
    }));
}

