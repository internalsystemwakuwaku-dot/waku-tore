/**
 * ゲーミフィケーション関連の型定義
 * GASプロジェクトのGameSystemを再現
 */

// ゲームデータ
export interface GameData {
    xp: number;
    level: number;
    money: number;
    totalEarned: number;
    inventory: Record<string, number>;  // アイテムID -> 個数
    settings: GameSettings;
    stats: GameStats;
    lastDailyBonus: string | null;
    streak: number;
}

// ゲーム設定
export interface GameSettings {
    bgmVolume: number;
    seVolume: number;
    theme: string;
    enableNotifications: boolean;
    enableAnimations: boolean;
}

// ゲーム統計
export interface GameStats {
    cardsCompleted: number;
    cardsMoved: number;
    memosCreated: number;
    logins: number;
    gachaPlayed: number;
    racesParticipated: number;
}

// レベルアップ報酬
export interface LevelReward {
    level: number;
    xpRequired: number;
    reward: {
        money: number;
        items?: { itemId: string; count: number }[];
        unlock?: string;  // アンロック機能名
    };
}

// ショップアイテム
export interface ShopItem {
    id: string;
    name: string;
    description: string;
    price: number;
    category: "theme" | "decoration" | "booster" | "special" | "facility";
    icon: string;
    maxOwn?: number;       // 最大所持数（undefinedなら無制限）
    effect?: string;       // 効果説明
}

// ランキングエントリ
export interface RankingEntry {
    userId: string;
    userName: string;
    value: number;
    rank: number;
}

// XP獲得イベント
export type XpEventType =
    | "card_move"
    | "card_complete"
    | "memo_create"
    | "daily_login"
    | "streak_bonus"
    | "gacha_play"
    | "race_win";

export const XP_REWARDS: Record<XpEventType, number> = {
    card_move: 5,
    card_complete: 20,
    memo_create: 3,
    daily_login: 10,
    streak_bonus: 5,  // 連続ログイン日数ごと
    gacha_play: 2,
    race_win: 15,
};

// レベルテーブル（レベル -> 必要累計XP）
export const LEVEL_TABLE: Record<number, number> = {
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
    // レベル20以降は+3000ずつ
};

// レベル報酬
export const LEVEL_REWARDS: LevelReward[] = [
    { level: 2, xpRequired: 100, reward: { money: 100 } },
    { level: 5, xpRequired: 700, reward: { money: 500, unlock: "ショップ" } },
    { level: 10, xpRequired: 3200, reward: { money: 1000, unlock: "競馬" } },
    { level: 15, xpRequired: 9200, reward: { money: 2000, unlock: "ガチャ" } },
    { level: 20, xpRequired: 20200, reward: { money: 5000, unlock: "特別テーマ" } },
];

// デフォルトゲームデータ
export const DEFAULT_GAME_DATA: GameData = {
    xp: 0,
    level: 1,
    money: 0,
    totalEarned: 0,
    inventory: {},
    settings: {
        bgmVolume: 0.5,
        seVolume: 0.7,
        theme: "default",
        enableNotifications: true,
        enableAnimations: true,
    },
    stats: {
        cardsCompleted: 0,
        cardsMoved: 0,
        memosCreated: 0,
        logins: 0,
        gachaPlayed: 0,
        racesParticipated: 0,
    },
    lastDailyBonus: null,
    streak: 0,
};
