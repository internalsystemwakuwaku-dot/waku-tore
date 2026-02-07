import type { GameData } from "@/types/game";
import type { GachaItem, GachaRarity } from "@/types/keiba";

type Inventory = GameData["inventory"];
type ActiveBoosts = GameData["activeBoosts"];

const BOOSTER_DURATIONS_MS: Record<string, number> = {
    booster_xp2: 30 * 60 * 1000,
    booster_xp3: 30 * 60 * 1000,
    booster_combo: 30 * 60 * 1000,
    booster_focus: 30 * 60 * 1000,
    booster_money: 20 * 60 * 1000,
    booster_gacha: 10 * 60 * 1000,
    booster_lucky: 10 * 60 * 1000,
    booster_lucky2: 10 * 60 * 1000,
};

export function getInventoryCount(inventory: Inventory, itemId: string): number {
    return inventory?.[itemId] || 0;
}

export function getBoosterDurationMs(boosterId: string): number | null {
    return BOOSTER_DURATIONS_MS[boosterId] || null;
}

export function isBoostActive(activeBoosts: ActiveBoosts, boosterId: string, nowMs: number = Date.now()): boolean {
    const expiresAt = activeBoosts?.[boosterId];
    return typeof expiresAt === "number" && expiresAt > nowMs;
}

export function getXpMultiplier(inventory: Inventory, activeBoosts: ActiveBoosts): number {
    let base = 1;
    if (isBoostActive(activeBoosts, "booster_xp3")) {
        base = 3;
    } else if (isBoostActive(activeBoosts, "booster_xp2")) {
        base = 2;
    }

    let bonus = 0;
    if (getInventoryCount(inventory, "special_title_master") > 0) bonus += 0.10;
    if (getInventoryCount(inventory, "special_title_1") > 0) bonus += 0.05;

    return base * (1 + bonus);
}

export function getXpFlatBonus(inventory: Inventory, activeBoosts: ActiveBoosts): number {
    let bonus = 0;
    if (isBoostActive(activeBoosts, "booster_combo")) bonus += 5;
    if (isBoostActive(activeBoosts, "booster_focus")) bonus += 3;
    return bonus;
}

export function getMoneyMultiplier(inventory: Inventory, activeBoosts: ActiveBoosts): number {
    let mult = 1;
    if (isBoostActive(activeBoosts, "booster_money")) mult *= 1.5;
    if (getInventoryCount(inventory, "special_ui_gold") > 0) mult *= 1.1;
    return mult;
}

export function getClickPower(inventory: Inventory): number {
    const base = 2;
    const bonus = getInventoryCount(inventory, "growth_click");
    return base + bonus;
}

export function getAutoXpMultiplier(inventory: Inventory): number {
    const level = getInventoryCount(inventory, "growth_auto");
    return 1 + level * 0.1;
}

export function getKeibaPayoutMultiplier(inventory: Inventory): number {
    const level = getInventoryCount(inventory, "growth_keiba");
    return 1 + level * 0.05;
}

export function getGachaDiscountRate(inventory: Inventory, activeBoosts: ActiveBoosts): number {
    return isBoostActive(activeBoosts, "booster_gacha") ? 0.8 : 1;
}

export function getGachaRerolls(inventory: Inventory, activeBoosts: ActiveBoosts): number {
    let rerolls = 0;
    if (isBoostActive(activeBoosts, "booster_lucky")) rerolls = Math.max(rerolls, 1);
    if (isBoostActive(activeBoosts, "booster_lucky2")) rerolls = Math.max(rerolls, 2);
    if (getInventoryCount(inventory, "special_pet") > 0) rerolls = Math.max(rerolls, 1);
    return rerolls;
}

const RARITY_ORDER: Record<GachaRarity, number> = {
    N: 0,
    R: 1,
    SR: 2,
    SSR: 3,
    UR: 4,
};

export function pickBetterGachaItem(a: GachaItem, b: GachaItem): GachaItem {
    return RARITY_ORDER[a.rarity] >= RARITY_ORDER[b.rarity] ? a : b;
}
