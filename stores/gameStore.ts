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
];

interface GameState {
    // データ
    data: GameData;
    isLoading: boolean;
    error: string | null;

    // ランキング
    xpRanking: RankingEntry[];
    moneyRanking: RankingEntry[];

    // UI状態
    showLevelUp: boolean;
    levelUpReward: { money: number; unlock?: string } | null;
    showXpGain: { amount: number; x: number; y: number } | null;

    // アクション
    setData: (data: GameData) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    setRankings: (xp: RankingEntry[], money: RankingEntry[]) => void;

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
}

export const useGameStore = create<GameState>((set, get) => ({
    data: DEFAULT_GAME_DATA,
    isLoading: false,
    error: null,
    xpRanking: [],
    moneyRanking: [],
    showLevelUp: false,
    levelUpReward: null,
    showXpGain: null,

    setData: (data) => set({ data }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setRankings: (xp, money) => set({ xpRanking: xp, moneyRanking: money }),

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

    canAfford: (price) => get().data.money >= price,
    getOwnedCount: (itemId) => get().data.inventory[itemId] || 0,
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
