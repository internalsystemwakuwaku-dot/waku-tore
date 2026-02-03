"use server";

/**
 * 繧ｲ繝ｼ繝 Server Actions
 * GAS縺ｮ GameSystem 繧堤ｽｮ縺肴鋤縺・
 */

import { db } from "@/lib/db/client";
import { gameData, transactions, keibaTransactions, users } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import type { GameData, XpEventType, RankingEntry } from "@/types/game";
import { XP_REWARDS, LEVEL_TABLE, LEVEL_REWARDS, DEFAULT_GAME_DATA } from "@/types/game";
import { getBoosterDurationMs, getMoneyMultiplier, getXpFlatBonus, getXpMultiplier } from "@/lib/gameEffects";

/**
 * 繧ｲ繝ｼ繝繝・・繧ｿ繧貞叙蠕暦ｼ医↑縺代ｌ縺ｰ菴懈・・・
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

    // 譁ｰ隕丈ｽ懈・
    const newData = { ...DEFAULT_GAME_DATA, userId };
    // queryBuilder is already defined at top of function
    await queryBuilder.insert(gameData).values({
        userId,
        dataJson: JSON.stringify(newData),
    });

    // M-12: 蛻晄悄謇謖・≡縺ｮ險倬鹸
    try {
        await queryBuilder.insert(transactions).values({
            userId,
            type: 'INITIAL',
            amount: Math.floor(newData.money),
            description: '蛻晄悄謇謖・≡',
            balanceAfter: Math.floor(newData.money),
        });
    } catch (e) {
        console.error("[getGameData] Failed to insert initial transaction:", e);
    }

    return newData;
}

/**
 * 繧ｲ繝ｼ繝繝・・繧ｿ繧剃ｿ晏ｭ・
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
 * XP繧堤佐蠕励＠縺ｦ繝ｬ繝吶Ν繧｢繝・・繧偵メ繧ｧ繝・け
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

        // 繝ｬ繝吶Ν繧｢繝・・繝√ぉ繝・け
        let levelUp = false;
        let newLevel: number | undefined;
        let reward: { money: number; unlock?: string } | undefined;

        // 迴ｾ蝨ｨ縺ｮXP + 迯ｲ蠕郵P 縺ｧ蛻､螳・
        const currentTotalXp = data.xp + xpGained;
        const nextLevel = data.level + 1;
        const requiredXp = LEVEL_TABLE[nextLevel] || (LEVEL_TABLE[20] + (nextLevel - 20) * 3000);

        if (currentTotalXp >= requiredXp) {
            // 繝ｬ繝吶Ν蝣ｱ驟ｬ繧偵メ繧ｧ繝・け
            const levelReward = LEVEL_REWARDS.find((r) => r.level === nextLevel);

            if (levelReward && levelReward.reward.money > 0) {
                // M-12: 縺企≡莉倅ｸ弱ｒ Ledger 邨檎罰縺ｧ螳溯｡・
                await transactMoney(userId, levelReward.reward.money, `繝ｬ繝吶Ν繧｢繝・・蝣ｱ驟ｬ (Lv.${nextLevel})`, "LEVEL_UP");
                // 繝・・繧ｿ蜀榊叙蠕・(縺企≡譖ｴ譁ｰ蠕・
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

        // XP蜉邂・
        data.xp += xpGained;

        // 邨ｱ險域峩譁ｰ
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
 * 謇謖・≡繧貞｢玲ｸ・
 * M-10: 譌･谺｡蛟滄≡蛻ｶ髯・(1譌･10,000G縺ｾ縺ｧ) 蟇ｾ蠢・
 * M-12: 蜿門ｼ募床蟶ｳ (transactions) 縺ｸ縺ｮ險倬鹸蟇ｾ蠢・
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
            return { success: false, error: "繝ｦ繝ｼ繧ｶ繝ｼID縺悟ｿ・ｦ√〒縺・ };
        }

        const data = await getGameData(userId, tx);

        const inventory = data.inventory || {};
        const activeBoosts = data.activeBoosts || {};
        const moneyMultiplier = getMoneyMultiplier(inventory, activeBoosts);
        const boostableTypes = new Set(["LEVEL_UP", "DAILY_BONUS", "GACHA_ITEM", "PAYOUT", "GENERAL"]);
        const adjustedAmount = (amount > 0 && moneyMultiplier !== 1 && boostableTypes.has(type))
            ? Math.floor(amount * moneyMultiplier)
            : amount;

        // 蛟滄≡荳企剞 (-10,000G) 繝√ぉ繝・け
        const DEBT_LIMIT = -10000;
        if (amount < 0 && data.money + amount < DEBT_LIMIT) {
            return { success: false, error: `雉・≡荳崎ｶｳ縺ｧ縺・(蛟滄≡荳企剞: ${DEBT_LIMIT.toLocaleString()}G)` };
        }

        // 譌･谺｡蛟滄≡蛻ｶ髯舌メ繧ｧ繝・け (LOAN縺ｮ蝣ｴ蜷医・縺ｿ)
        // GAS縺ｧ縺ｯ type === 'LOAN' 縺ｧ蛻､螳壹＠縺ｦ縺・ｋ縺後∝滄≡(繝槭う繝翫せ)蜈ｨ闊ｬ縺ｫ驕ｩ逕ｨ縺吶∋縺阪°・・
        // M-10螳溯｣・〒縺ｯ縲悟滄≡・医・繧､繝翫せ amount・峨・蝣ｴ蜷医阪→縺励※縺・ｋ縲・
        // type繝代Λ繝｡繝ｼ繧ｿ縺梧擂縺溘・縺ｧ縲∵・遉ｺ逧・↑LOAN莉･螟悶〒繧ゅ・繧､繝翫せ縺ｪ繧峨メ繧ｧ繝・け縺吶ｋ譁ｹ驥昴・邯ｭ謖√＠縺､縺､縲・
        // 繝ｭ繧ｰ縺ｯ豁｣遒ｺ縺ｫ谿九☆縲・
        if (amount < 0 && data.money + amount < 0) {
            const DAILY_LOAN_LIMIT = 10000;
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            // 譌･莉倥′螟峨ｏ縺｣縺ｦ縺・◆繧峨Μ繧ｻ繝・ヨ
            if (data.lastLoanDate !== today) {
                data.lastLoanDate = today;
                data.todayLoanAmount = 0;
            }

            // 螳滄圀縺ｫ蛟溷・縺ｨ縺ｪ繧句｢怜・縺縺代ｒ險育ｮ・
            const prevDebt = Math.max(0, -data.money);
            const nextDebt = Math.max(0, -(data.money + amount));
            const actualLoan = Math.max(0, nextDebt - prevDebt);
            const todayTotal = (data.todayLoanAmount || 0) + actualLoan;

            if (todayTotal > DAILY_LOAN_LIMIT) {
                const remaining = DAILY_LOAN_LIMIT - (data.todayLoanAmount || 0);
                return {
                    success: false,
                    error: `譛ｬ譌･縺ｮ蛟溷・髯仙ｺｦ鬘阪ｒ雜・∴縺ｦ縺・∪縺・(谿九ｊ: ${Math.max(0, remaining).toLocaleString()}G / 荳企剞: ${DAILY_LOAN_LIMIT.toLocaleString()}G)`
                };
            }

            // 蛟溷・鬘阪ｒ險倬鹸
            data.todayLoanAmount = todayTotal;
        }

        data.money += adjustedAmount;
        if (adjustedAmount > 0) {
            data.totalEarned += adjustedAmount;
        }

        await saveGameData(userId, data, tx);

        // M-12: 蜿門ｼ募床蟶ｳ縺ｸ險倬鹸
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
 * 繧｢繧､繝・Β繧定ｳｼ蜈･
 */
export async function purchaseItem(
    userId: string,
    itemId: string,
    price: number
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. 縺企≡繧貞ｼ輔″關ｽ縺ｨ縺・(Transaction Ledger邨檎罰)
        const tx = await transactMoney(userId, -price, `繧｢繧､繝・Β雉ｼ蜈･: ${itemId}`, "ITEM_PURCHASE");
        if (!tx.success) {
            return { success: false, error: tx.error || "謇謖・≡縺御ｸ崎ｶｳ縺励※縺・∪縺・ };
        }

        // 2. 繝・・繧ｿ繧貞・蜿門ｾ励＠縺ｦ繧､繝ｳ繝吶Φ繝医Μ譖ｴ譁ｰ (縺企≡縺ｯ譖ｴ譁ｰ貂医∩)
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
 * 繝・う繝ｪ繝ｼ繝ｭ繧ｰ繧､繝ｳ繝懊・繝翫せ
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

        // 譌｢縺ｫ蜿励￠蜿悶ｊ貂医∩
        if (data.lastDailyBonus === today) {
            return { success: true, already: true };
        }

        // 騾｣邯壹Ο繧ｰ繧､繝ｳ繝√ぉ繝・け
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

        // XP迯ｲ蠕暦ｼ医せ繝医Μ繝ｼ繧ｯ繝懊・繝翫せ莉倥″・・
        const baseXp = XP_REWARDS.daily_login;
        const streakBonus = XP_REWARDS.streak_bonus * Math.min(data.streak, 7);
        const xpGained = baseXp + streakBonus;
        data.xp += xpGained;

        const moneyGained = Math.min(data.streak, 7) * 10;

        // 謇謖・≡莉倅ｸ弱ｒ TransactMoney 邨檎罰縺ｧ螳溯｡・(M-12 Ledger蟇ｾ蠢・
        // 蜈医↓繝｡繝｢繝ｪ荳翫・譌･莉・繧ｹ繝医Μ繝ｼ繧ｯ繧呈峩譁ｰ縺励※縺九ｉ縲√♀驥代ｒ蜃ｦ逅・＠縲∵怙蠕後↓蜈ｨ縺ｦ菫晏ｭ・..
        // 縺・ｄ縲》ransactMoney縺ｧ菫晏ｭ倥′逋ｺ逕溘☆繧九・縺ｧ縲・・分縺ｫ豕ｨ諢上・

        // 1. 縺企≡莉･螟悶ｒ蜈医↓蜃ｦ逅・＠縺ｦ縺励∪縺・→縲》ransactMoney縺ｧ荳頑嶌縺阪＆繧後ｋ蜿ｯ閭ｽ諤ｧ縺後≠繧九・
        // 縺ｪ縺ｮ縺ｧ縲√∪縺壹♀驥代ｒ莉倅ｸ弱・
        await transactMoney(userId, moneyGained, "繝・う繝ｪ繝ｼ繝懊・繝翫せ", "DAILY_BONUS");

        // 2. 繝・・繧ｿ繧貞・蜿門ｾ・(縺企≡譖ｴ譁ｰ蠕・
        const updatedData = await getGameData(userId);

        // 3. 繧ｹ繝医Μ繝ｼ繧ｯ縺ｪ縺ｩ縺ｮ諠・ｱ繧呈峩譁ｰ
        updatedData.lastDailyBonus = today;
        updatedData.stats.logins++; // 縺薙ｌ縺ｯ蜊倡ｴ泌刈邂励〒繧医＞縺具ｼ・streak蛻､螳壹・蜈・ョ繝ｼ繧ｿ`data`縺ｧ陦後▲縺溘′...
        // streak蛻､螳壹Ο繧ｸ繝・け縺ｯ螟峨∴縺壹「pdatedData縺ｫ驕ｩ逕ｨ縺吶ｋ
        updatedData.streak = data.streak; // 莠句燕縺ｫ險育ｮ励＠縺殱treak蛟､繧偵そ繝・ヨ

        // XP迯ｲ蠕・
        updatedData.xp += xpGained;

        await saveGameData(userId, updatedData);

        return { success: true, xpGained, moneyGained, streak: updatedData.streak };
    } catch {
        return { success: false };
    }
}

/**
 * 繝ｩ繝ｳ繧ｭ繝ｳ繧ｰ蜿門ｾ暦ｼ・P鬆・ｼ・
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

    // 繝ｩ繝ｳ繧ｯ莉倥￠
    entries.forEach((entry, index) => {
        entry.rank = index + 1;
    });

    return entries;
}

/**
 * 繝ｩ繝ｳ繧ｭ繝ｳ繧ｰ蜿門ｾ暦ｼ域園謖・≡鬆・ｼ・
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
 * 繧ｲ繝ｼ繝險ｭ螳壹ｒ譖ｴ譁ｰ
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
 * 谿矩ｫ俶紛蜷域ｧ繝√ぉ繝・け (Gap M-8蟇ｾ蠢・
 * keibaTransactions 縺九ｉ谿矩ｫ倥ｒ蜀崎ｨ育ｮ励＠縲“ameData.money 縺ｨ辣ｧ蜷・
 */
// 348陦檎岼縺ｮ驥崎､㌍mport縺ｯ蜑企勁
// import { keibaTransactions } from "@/lib/db/schema"; <-- Remove this line in replacement or just ignore if valid?
// Better to just reimplement the function cleanly.

export async function reconcileBalance(
    userId: string
): Promise<{ success: boolean; balance: number; mismatch?: boolean; reconciled?: boolean; message?: string }> {
    try {
        const data = await getGameData(userId);

        // M-12: transactions繝・・繝悶Ν縺九ｉ髮・ｨ・
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

        // 繝ｬ繧ｬ繧ｷ繝ｼ繝・・繧ｿ蟇ｾ蠢・ INITIAL蜿門ｼ輔′縺ｪ縺上√°縺､谿矩ｫ倥′謨ｴ蜷医＠縺ｪ縺・ｴ蜷・
        // 蜿門ｼ募ｱ･豁ｴ縺碁比ｸｭ縺九ｉ蟋九∪縺｣縺ｦ縺・ｋ繝ｦ繝ｼ繧ｶ繝ｼ縺ｸ縺ｮ邁｡譏灘ｯｾ蠢・
        // (蜴ｳ蟇・↓縺ｯ縲御ｸ肴・縲阪□縺後∝・譛滄≡10000G + 螻･豁ｴ 縺ｨ莉ｮ螳壹＠縺ｦ豈碑ｼ・☆繧九％縺ｨ繧ょ庄閭ｽ)
        if ((!result.hasInitial || result.hasInitial === 0) && result.count > 0) {
            // 螻･豁ｴ縺ｯ縺ゅｋ縺悟・譛滄≡繝ｬ繧ｳ繝ｼ繝峨′縺ｪ縺・-> 遘ｻ陦後Θ繝ｼ繧ｶ繝ｼ縺ｮ蜿ｯ閭ｽ諤ｧ
            // 縺薙％縺ｧ縺ｯ縲御ｸ肴紛蜷医阪→縺励※蝣ｱ蜻翫☆繧九′縲√Γ繝・そ繝ｼ繧ｸ繧剃ｻ倅ｸ・
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
            // 繧ｪ繝励す繝ｧ繝ｳ: 閾ｪ蜍穂ｿｮ豁｣ (縺薙・螳溯｣・〒縺ｯ繝ｭ繧ｰ縺ｮ縺ｿ)
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
 * 蛟滄≡繝ｩ繝ｳ繧ｭ繝ｳ繧ｰ・域園謖・≡繝槭う繝翫せ鬆・ｼ・
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
 * 鬮倬｡埼・蠖薙Λ繝ｳ繧ｭ繝ｳ繧ｰ
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

