import { create } from "zustand";
import type { GameData, RankingEntry, ShopItem } from "@/types/game";
import { DEFAULT_GAME_DATA } from "@/types/game";

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
        price: 400,
        category: "booster",
        icon: "⚡",
    },
    {
        id: "booster_lucky",
        name: "ラッキーチケット",
        description: "次回ガチャで高レア確率UP",
        price: 600,
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

    // ゲームアクション
    addXP: (amount: number) => void;
    addMoney: (amount: number) => void;
    purchaseItem: (itemId: string) => { success: boolean; message?: string };

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

    // XP追加（レベルアップチェック付き）
    addXP: (amount) => {
        const { data } = get();
        const newXp = data.xp + amount;

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

    // 定期実行 (オートクリッカー等)
    tick: () => {
        const { data, addXP } = get();
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
