import { create } from "zustand";
import type { GameData, RankingEntry, ShopItem } from "@/types/game";
import { DEFAULT_GAME_DATA } from "@/types/game";
import { getXpMultiplier, getXpFlatBonus, getClickPower, getAutoXpMultiplier } from "@/lib/gameEffects";
import { toast } from "@/components/ui/Toast";

export const GROWTH_UPGRADES = {
    click: {
        id: "growth_click",
        name: "クリック強化",
        baseCost: 150,
        costGrowth: 1.35,
        maxLevel: 25,
        effectLabel: "+1 XP/クリック",
    },
    auto: {
        id: "growth_auto",
        name: "放置強化",
        baseCost: 300,
        costGrowth: 1.4,
        maxLevel: 20,
        effectLabel: "+10% 放置XP",
    },
    keiba: {
        id: "growth_keiba",
        name: "競馬強化",
        baseCost: 800,
        costGrowth: 1.45,
        maxLevel: 20,
        effectLabel: "+5% 払い戻し",
    },
} as const;

type GrowthUpgradeKey = keyof typeof GROWTH_UPGRADES;

// ショップアイテム定義
export const SHOP_ITEMS: ShopItem[] = [
    {
        id: "theme_dark",
        name: "ダークテーマ",
        description: "目に優しいダークモード",
        price: 500,
        category: "theme",
        icon: "🌙",
        maxOwn: 1,
    },
    {
        id: "theme_sakura",
        name: "桜テーマ",
        description: "春の桜をイメージしたピンク色",
        price: 800,
        category: "theme",
        icon: "🌸",
        maxOwn: 1,
    },
    {
        id: "theme_space",
        name: "宇宙テーマ",
        description: "銀河を旅するデザイン",
        price: 1500,
        category: "theme",
        icon: "🌌",
        maxOwn: 1,
    },
    {
        id: "deco_star",
        name: "スター装飾",
        description: "カードに星マークを追加",
        price: 200,
        category: "decoration",
        icon: "⭐",
    },
    {
        id: "deco_fire",
        name: "炎エフェクト",
        description: "期限切れカードに炎を追加",
        price: 300,
        category: "decoration",
        icon: "🔥",
    },
    {
        id: "booster_xp2",
        name: "XP2倍ブースター",
        description: "1時間XP獲得量2倍",
        price: 1500,
        category: "booster",
        icon: "⚡",
    },
    {
        id: "booster_lucky",
        name: "ラッキーチケット",
        description: "次回ガチャで高レア確率UP",
        price: 2300,
        category: "booster",
        icon: "🍀",
    },
    {
        id: "special_title_1",
        name: "称号：わく☆マスター",
        description: "プロフィールに表示される称号",
        price: 2000,
        category: "special",
        icon: "👑",
        maxOwn: 1,
    },

    // --- テーマ ---
    {
        id: "theme_cafe",
        name: "カフェテーマ",
        description: "落ち着いたコーヒーの香りが漂うような色合い",
        price: 600,
        category: "theme",
        icon: "☕",
        maxOwn: 1,
    },
    {
        id: "theme_spring_fes",
        name: "春祭りテーマ",
        description: "春の陽気と祭りの賑わいを感じるデザイン",
        price: 900,
        category: "theme",
        icon: "🏮",
        maxOwn: 1,
    },
    {
        id: "theme_library",
        name: "図書館テーマ",
        description: "静寂と知性を感じるシックなデザイン",
        price: 700,
        category: "theme",
        icon: "📚",
        maxOwn: 1,
    },
    {
        id: "theme_ocean",
        name: "オーシャンテーマ",
        description: "爽やかな海と波の音を感じるブルー",
        price: 1000,
        category: "theme",
        icon: "🌊",
        maxOwn: 1,
    },
    {
        id: "theme_carnival",
        name: "カーニバルテーマ",
        description: "弾ける楽しさとカラフルな色彩",
        price: 1200,
        category: "theme",
        icon: "🎪",
        maxOwn: 1,
    },
    {
        id: "theme_tea",
        name: "ティーパーティ",
        description: "優雅な午後のひとときをイメージ",
        price: 650,
        category: "theme",
        icon: "🫖",
        maxOwn: 1,
    },
    {
        id: "theme_forest",
        name: "深緑の森",
        description: "心安らぐ深い緑と自然の息吹",
        price: 800,
        category: "theme",
        icon: "🌲",
        maxOwn: 1,
    },
    {
        id: "theme_nightmarket",
        name: "ナイトマーケット",
        description: "煌びやかな夜市の熱気を感じるデザイン",
        price: 1300,
        category: "theme",
        icon: "🍜",
        maxOwn: 1,
    },
    {
        id: "theme_cloud",
        name: "空の旅",
        description: "フワフワした雲の上を歩くような心地よさ",
        price: 750,
        category: "theme",
        icon: "☁️",
        maxOwn: 1,
    },

    // --- 装飾 ---
    {
        id: "deco_lantern",
        name: "提灯デコ",
        description: "カードに温かい提灯の灯りをともす",
        price: 200,
        category: "decoration",
        icon: "🏮",
    },
    {
        id: "deco_bubbles",
        name: "シャボン玉",
        description: "フワフワ飛ぶシャボン玉のエフェクト",
        price: 250,
        category: "decoration",
        icon: "🫧",
    },
    {
        id: "deco_ribbons",
        name: "リボン飾り",
        description: "可愛らしいリボンでカードを装飾",
        price: 220,
        category: "decoration",
        icon: "🎀",
    },
    {
        id: "deco_spark",
        name: "スパーク",
        description: "パチパチ弾ける火花のエフェクト",
        price: 260,
        category: "decoration",
        icon: "🎇",
    },
    {
        id: "deco_paper",
        name: "紙吹雪",
        description: "お祝いの紙吹雪が舞い散る",
        price: 180,
        category: "decoration",
        icon: "🎊",
    },
    {
        id: "deco_confetti",
        name: "クラッカー",
        description: "派手なクラッカーで勝利を祝福",
        price: 280,
        category: "decoration",
        icon: "🎉",
    },

    // --- ブースター ---
    {
        id: "booster_xp3",
        name: "XP3倍ブースター",
        description: "30分間、獲得XPが3倍になる",
        price: 2500,
        category: "booster",
        icon: "⚡⚡",
    },
    {
        id: "booster_money",
        name: "コインラッシュ",
        description: "30分間、獲得コインが1.5倍になる",
        price: 2200,
        category: "booster",
        icon: "💰",
    },
    {
        id: "booster_combo",
        name: "コンボマスター",
        description: "コンボ発生時のXPが+5される",
        price: 1200,
        category: "booster",
        icon: "🤜🤛",
    },
    {
        id: "booster_focus",
        name: "集中力アップ",
        description: "作業完了時のXPが+3される",
        price: 1000,
        category: "booster",
        icon: "🎯",
    },
    {
        id: "booster_gacha",
        name: "ガチャチケット",
        description: "ガチャのコストが20%OFF（30分間）",
        price: 1800,
        category: "booster",
        icon: "🎫",
    },
    {
        id: "booster_lucky2",
        name: "大吉おみくじ",
        description: "次回の運試しで最高の結果が出やすくなる",
        price: 3000,
        category: "booster",
        icon: "⛩️",
    },

    // --- 特別 ---
    {
        id: "special_title_master",
        name: "称号：伝説の職人",
        description: "プロフィールに輝く伝説の証",
        price: 2000,
        category: "special",
        icon: "🎖️",
        maxOwn: 1,
    },
    {
        id: "special_ui_gold",
        name: "黄金のUI",
        description: "ショップ全体の枠が黄金に輝くスキン",
        price: 2500,
        category: "special",
        icon: "⚜️",
        maxOwn: 1,
    },
    {
        id: "special_pet",
        name: "マスコット召喚",
        description: "画面の隅で応援してくれるペットを表示",
        price: 3000,
        category: "special",
        icon: "🐶",
        maxOwn: 1,
    },

    // --- 生産施設 ---
    {
        id: "facility_cursor",
        name: "強化カーソル",
        description: "10秒ごとに1XPを自動獲得",
        price: 100,
        category: "facility",
        icon: "👆",
        effect: "auto_xp_0.1",
    },
    {
        id: "facility_grandma",
        name: "グランマ",
        description: "1秒ごとに1XPを自動獲得",
        price: 500,
        category: "facility",
        icon: "👵",
        effect: "auto_xp_1",
    },
    {
        id: "facility_farm",
        name: "わくわく農場",
        description: "1秒ごとに5XPを自動獲得",
        price: 2000,
        category: "facility",
        icon: "🚜",
        effect: "auto_xp_5",
    },
    {
        id: "facility_mine",
        name: "プログラミング鉱山",
        description: "1秒ごとに15XPを自動獲得",
        price: 8000,
        category: "facility",
        icon: "⛏️",
        effect: "auto_xp_15",
    },
    {
        id: "facility_factory",
        name: "機能実装工場",
        description: "1秒ごとに50XPを自動獲得",
        price: 30000,
        category: "facility",
        icon: "🏭",
        effect: "auto_xp_50",
    },

    {
        id: "facility_lantern",
        name: "街灯",
        description: "1秒ごとに0.2XPを自動獲得",
        price: 150,
        category: "facility",
        icon: "💡",
        effect: "auto_xp_0.2",
    },
    {
        id: "facility_streetmusician",
        name: "ストリート演奏",
        description: "1秒ごとに0.5XPを自動獲得",
        price: 300,
        category: "facility",
        icon: "🎸",
        effect: "auto_xp_0.5",
    },
    {
        id: "facility_bakery",
        name: "焼きたてパン屋",
        description: "1秒ごとに2XPを自動獲得",
        price: 900,
        category: "facility",
        icon: "🥐",
        effect: "auto_xp_2",
    },
    {
        id: "facility_flowerstall",
        name: "花屋さん",
        description: "1秒ごとに3XPを自動獲得",
        price: 1400,
        category: "facility",
        icon: "💐",
        effect: "auto_xp_3",
    },
    {
        id: "facility_fountain",
        name: "願いの泉",
        description: "1秒ごとに8XPを自動獲得",
        price: 3500,
        category: "facility",
        icon: "⛲",
        effect: "auto_xp_8",
    },
    {
        id: "facility_teahouse",
        name: "峠の茶屋",
        description: "1秒ごとに12XPを自動獲得",
        price: 5000,
        category: "facility",
        icon: "🍡",
        effect: "auto_xp_12",
    },
    {
        id: "facility_cafe",
        name: "おしゃれカフェ",
        description: "1秒ごとに20XPを自動獲得",
        price: 8000,
        category: "facility",
        icon: "☕",
        effect: "auto_xp_20",
    },
    {
        id: "facility_yatai",
        name: "賑わい屋台",
        description: "1秒ごとに30XPを自動獲得",
        price: 12000,
        category: "facility",
        icon: "🐙",
        effect: "auto_xp_30",
    },
    {
        id: "facility_fireworks",
        name: "打ち上げ花火",
        description: "1秒ごとに40XPを自動獲得",
        price: 18000,
        category: "facility",
        icon: "🎆",
        effect: "auto_xp_40",
    },
    {
        id: "facility_carousel",
        name: "メリーゴーランド",
        description: "1秒ごとに60XPを自動獲得",
        price: 26000,
        category: "facility",
        icon: "🎠",
        effect: "auto_xp_60",
    },
    {
        id: "facility_festival_plaza",
        name: "お祭り広場",
        description: "1秒ごとに80XPを自動獲得",
        price: 36000,
        category: "facility",
        icon: "🏮",
        effect: "auto_xp_80",
    },
    {
        id: "facility_parade",
        name: "ドリームパレード",
        description: "1秒ごとに100XPを自動獲得",
        price: 48000,
        category: "facility",
        icon: "🎺",
        effect: "auto_xp_100",
    },
    {
        id: "facility_castle",
        name: "ワクワク城",
        description: "1秒ごとに120XPを自動獲得",
        price: 65000,
        category: "facility",
        icon: "🏰",
        effect: "auto_xp_120",
    },
    {
        id: "facility_skygarden",
        name: "天空の庭園",
        description: "1秒ごとに150XPを自動獲得",
        price: 85000,
        category: "facility",
        icon: "🌤️",
        effect: "auto_xp_150",
    },
    {
        id: "facility_waku_dome",
        name: "ワクワクドーム",
        description: "1秒ごとに200XPを自動獲得",
        price: 110000,
        category: "facility",
        icon: "🏟️",
        effect: "auto_xp_200",
    },

];

interface GameState {
    // データ
    data: GameData;
    isLoading: boolean;
    error: string | null;
    isDirty: boolean; // データが変更されたかどうか
    lastSavedAt: number; // 最後に保存した時刻

    // ランキング
    xpRanking: RankingEntry[];
    moneyRanking: RankingEntry[];

    // UI状態
    showLevelUp: boolean;
    levelUpReward: { money: number; unlock?: string } | null;
    showXpGain: { amount: number; x: number; y: number } | null;

    // アクション
    setData: (data: GameData, fromServer?: boolean) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    setRankings: (xp: RankingEntry[], money: RankingEntry[]) => void;
    markDirty: () => void;
    markClean: () => void;

    // レベルアップ演出
    showLevelUpModal: (reward: { money: number; unlock?: string }) => void;
    hideLevelUpModal: () => void;

    // XP獲得アニメーション
    showXpAnimation: (amount: number, x: number, y: number) => void;
    hideXpAnimation: () => void;

    // ヘルパー
    getLevelProgress: () => { current: number; required: number; percent: number };
    canAfford: (price: number) => boolean;
    getOwnedCount: (itemId: string) => number;
    getClickPower: () => number;
    getAutoXpPerSecond: () => number;
    getGrowthUpgradeLevel: (key: GrowthUpgradeKey) => number;
    getGrowthUpgradeCost: (key: GrowthUpgradeKey) => number;

    // ゲームアクション
    addXP: (amount: number) => void;
    addClickXP: () => void;
    addMoney: (amount: number) => void;
    purchaseItem: (itemId: string) => { success: boolean; message?: string };
    purchaseGrowthUpgrade: (key: GrowthUpgradeKey) => { success: boolean; message?: string };

    // オートクリッカー処理 (1秒ごとに呼び出し)
    tick: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
    data: DEFAULT_GAME_DATA,
    isLoading: false,
    error: null,
    isDirty: false,
    lastSavedAt: Date.now(),
    xpRanking: [],
    moneyRanking: [],
    showLevelUp: false,
    levelUpReward: null,
    showXpGain: null,

    setData: (data, fromServer = false) => set({
        data,
        isDirty: fromServer ? false : get().isDirty,
        lastSavedAt: fromServer ? Date.now() : get().lastSavedAt
    }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setRankings: (xp, money) => set({ xpRanking: xp, moneyRanking: money }),
    markDirty: () => set({ isDirty: true }),
    markClean: () => set({ isDirty: false, lastSavedAt: Date.now() }),

    showLevelUpModal: (reward) =>
        set({ showLevelUp: true, levelUpReward: reward }),
    hideLevelUpModal: () => set({ showLevelUp: false, levelUpReward: null }),

    showXpAnimation: (amount, x, y) =>
        set({ showXpGain: { amount, x, y } }),
    hideXpAnimation: () => set({ showXpGain: null }),

    getLevelProgress: () => {
        const { data } = get();
        const currentLevel = data.level;
        const nextLevel = currentLevel + 1;

        // レベルテーブル計算
        const currentXpRequired =
            currentLevel <= 20
                ? getLevelXp(currentLevel)
                : getLevelXp(20) + (currentLevel - 20) * 3000;
        const nextXpRequired =
            nextLevel <= 20
                ? getLevelXp(nextLevel)
                : getLevelXp(20) + (nextLevel - 20) * 3000;

        const levelXp = data.xp - currentXpRequired;
        const required = nextXpRequired - currentXpRequired;
        const percent = Math.min(100, Math.floor((levelXp / required) * 100));

        return { current: levelXp, required, percent };
    },

    canAfford: (price) => get().data.money - price >= -10000,
    getOwnedCount: (itemId) => get().data.inventory[itemId] || 0,
    getClickPower: () => getClickPower(get().data.inventory || {}),
    getAutoXpPerSecond: () => {
        const { data } = get();
        const inventory = data.inventory || {};
        const activeBoosts = data.activeBoosts || {};
        const xpMultiplier = getXpMultiplier(inventory, activeBoosts);
        const autoMultiplier = getAutoXpMultiplier(inventory);

        let autoXp = 0;
        SHOP_ITEMS.forEach((item) => {
            if (item.category === "facility" && item.effect?.startsWith("auto_xp_")) {
                const count = data.inventory[item.id] || 0;
                if (count > 0) {
                    const xpPerSec = parseFloat(item.effect.replace("auto_xp_", ""));
                    autoXp += xpPerSec * count;
                }
            }
        });

        return autoXp * xpMultiplier * autoMultiplier;
    },
    getGrowthUpgradeLevel: (key) => {
        const upgrade = GROWTH_UPGRADES[key];
        return get().data.inventory[upgrade.id] || 0;
    },
    getGrowthUpgradeCost: (key) => {
        const upgrade = GROWTH_UPGRADES[key];
        const level = get().data.inventory[upgrade.id] || 0;
        const raw = upgrade.baseCost * Math.pow(upgrade.costGrowth, level);
        return Math.floor(raw);
    },

    // XP追加（レベルアップチェック付き）
    addXP: (amount) => {
        const { data } = get();
        const inventory = data.inventory || {};
        const activeBoosts = data.activeBoosts || {};
        const now = Date.now();
        const prunedBoosts: Record<string, number> = {};
        const expiredBoosts: string[] = [];
        let boostsChanged = false;
        for (const [id, expiresAt] of Object.entries(activeBoosts)) {
            if (expiresAt > now) {
                prunedBoosts[id] = expiresAt;
            } else {
                boostsChanged = true;
                if (expiresAt > now - 2000) {
                    expiredBoosts.push(id);
                }
            }
        }
        if (boostsChanged) {
            set((state) => ({
                data: { ...state.data, activeBoosts: prunedBoosts },
                isDirty: true,
            }));
            for (const id of expiredBoosts) {
                const label = SHOP_ITEMS.find((i) => i.id === id)?.name || id;
                toast.info(`${label} ?????????`);
            }
        }
        const xpMultiplier = getXpMultiplier(inventory, prunedBoosts);
        const xpFlatBonus = getXpFlatBonus(inventory, activeBoosts);
        const totalAdd = Math.max(0, Math.floor((amount + xpFlatBonus) * xpMultiplier));
        const newXp = data.xp + totalAdd;

        // レベルアップ判定
        const newLevel = calculateLevel(newXp);
        const didLevelUp = newLevel > data.level;

        set({
            data: {
                ...data,
                xp: newXp,
                level: newLevel,
                money: didLevelUp ? data.money + 100 : data.money, // レベルアップ報酬
            },
            isDirty: true, // データが変更された
        });

        if (didLevelUp) {
            get().showLevelUpModal({ money: 100 });
        }
    },

    // お金追加
    addClickXP: () => {
        const { data } = get();
        const power = getClickPower(data.inventory || {});
        get().addXP(power);
    },

    addMoney: (amount) => {
        const { data } = get();
        set({
            data: {
                ...data,
                money: Math.max(0, data.money + amount),
            },
            isDirty: true, // データが変更された
        });
    },

    // アイテム購入
    purchaseItem: (itemId) => {
        const { data, addMoney } = get();
        const item = SHOP_ITEMS.find((i) => i.id === itemId);

        if (!item) return { success: false, message: "アイテムが存在しません" };
        if (data.money < item.price) return { success: false, message: "お金が足りません" };

        // 最大所持数チェック
        const currentCount = data.inventory[itemId] || 0;
        if (item.maxOwn && currentCount >= item.maxOwn) {
            return { success: false, message: "これ以上所持できません" };
        }

        // 購入処理
        addMoney(-item.price);

        set((state) => ({
            data: {
                ...state.data,
                inventory: {
                    ...state.data.inventory,
                    [itemId]: currentCount + 1,
                },
            },
            isDirty: true, // データが変更された
        }));

        return { success: true };
    },

    purchaseGrowthUpgrade: (key) => {
        const { data } = get();
        const upgrade = GROWTH_UPGRADES[key];
        const currentLevel = data.inventory[upgrade.id] || 0;
        if (currentLevel >= upgrade.maxLevel) {
            return { success: false, message: "これ以上強化できません" };
        }
        const cost = get().getGrowthUpgradeCost(key);
        if (data.money < cost) {
            return { success: false, message: "お金が足りません" };
        }

        get().addMoney(-cost);
        set((state) => ({
            data: {
                ...state.data,
                inventory: {
                    ...state.data.inventory,
                    [upgrade.id]: currentLevel + 1,
                },
            },
            isDirty: true,
        }));

        return { success: true };
    },

    // 定期実行 (オートクリッカー等)
    tick: () => {
        const { data } = get();
        const inventory = data.inventory || {};
        const activeBoosts = data.activeBoosts || {};
        const now = Date.now();
        const prunedBoosts: Record<string, number> = {};
        const expiredBoosts: string[] = [];
        let boostsChanged = false;
        for (const [id, expiresAt] of Object.entries(activeBoosts)) {
            if (expiresAt > now) {
                prunedBoosts[id] = expiresAt;
            } else {
                boostsChanged = true;
                if (expiresAt > now - 2000) {
                    expiredBoosts.push(id);
                }
            }
        }
        if (boostsChanged) {
            set((state) => ({
                data: { ...state.data, activeBoosts: prunedBoosts },
                isDirty: true,
            }));
            for (const id of expiredBoosts) {
                const label = SHOP_ITEMS.find((i) => i.id === id)?.name || id;
                toast.info(`${label} ?????????`);
            }
        }
        const xpMultiplier = getXpMultiplier(inventory, prunedBoosts);
        const autoMultiplier = getAutoXpMultiplier(inventory);
        let autoXp = 0;

        SHOP_ITEMS.forEach((item) => {
            if (item.category === "facility" && item.effect?.startsWith("auto_xp_")) {
                const count = data.inventory[item.id] || 0;
                if (count > 0) {
                    const xpPerSec = parseFloat(item.effect.replace("auto_xp_", ""));
                    autoXp += xpPerSec * count;
                }
            }
        });

        if (autoXp > 0) {
            autoXp *= xpMultiplier * autoMultiplier;
            // 小数点は確率で処理するか、内部で保持するか。今回は確率で処理
            // 例: 0.1XP -> 10%の確率で1XP
            const intXp = Math.floor(autoXp);
            const floatXp = autoXp - intXp;

            let totalAdd = intXp;
            if (Math.random() < floatXp) {
                totalAdd += 1;
            }

            if (totalAdd > 0) {
                // 自動獲得の場合はアニメーションなしで静かに追加
                const newXp = data.xp + totalAdd;
                const newLevel = calculateLevel(newXp);
                const didLevelUp = newLevel > data.level;

                set((state) => ({
                    data: {
                        ...state.data,
                        xp: newXp,
                        level: newLevel,
                        // レベルアップ時はお金も増える
                        money: didLevelUp ? state.data.money + 100 : state.data.money
                    },
                    isDirty: true, // データが変更された
                }));

                if (didLevelUp) {
                    get().showLevelUpModal({ money: 100 });
                }
            }
        }
    },
}));

// レベルに必要なXPを取得
function getLevelXp(level: number): number {
    const table: Record<number, number> = {
        1: 0,
        2: 100,
        3: 250,
        4: 450,
        5: 700,
        6: 1000,
        7: 1400,
        8: 1900,
        9: 2500,
        10: 3200,
        11: 4000,
        12: 5000,
        13: 6200,
        14: 7600,
        15: 9200,
        16: 11000,
        17: 13000,
        18: 15200,
        19: 17600,
        20: 20200,
    };
    return table[level] || 0;
}

// XPからレベルを計算
function calculateLevel(xp: number): number {
    let level = 1;
    while (level <= 20 && getLevelXp(level + 1) <= xp) {
        level++;
    }
    if (level > 20) {
        // レベル21以降は線形増加
        const xpAfter20 = xp - getLevelXp(20);
        level = 20 + Math.floor(xpAfter20 / 3000);
    }
    return level;
}
