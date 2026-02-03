/**
 * 競馬・ガチャ関連の型定義
 */

// ========== 競馬 ==========

export interface Horse {
    id: number;
    name: string;
    odds: number;    // オッズ（倍率）
    color: string;
    winRate: number; // 勝率（重み）
}

export interface Race {
    id: string;
    name: string;
    horses: Horse[];
    status: "waiting" | "racing" | "calculating" | "finished";
    winnerId: number | null;
    startedAt: string | null;
    ranking?: number[];
}

export type BetType = "WIN" | "PLACE" | "QUINELLA" | "EXACTA" | "TRIO" | "TRIFECTA";
export type BetMode = "NORMAL" | "BOX" | "NAGASHI";

export interface Bet {
    id?: string;
    raceId?: string;
    userId?: string;
    type: BetType;
    mode: BetMode;
    horseId?: number;
    details?: string;
    amount: number;
    payout?: number;
    createdAt?: string;
}

export interface RaceResult {
    raceId: string;
    winnerId: number;
    winnerName: string;
    userBets: Bet[];
    totalPayout: number;
    isWin: boolean;
}

export interface KeibaTransaction {
    id: number;
    raceId: string;
    userId: string;
    type: string;
    mode: string;
    horseId?: number;
    details?: string;
    betAmount: number;
    payout: number;
    isWin: boolean;
    createdAt: string;
}

// ========== ガチャ ==========

export type GachaRarity = "N" | "R" | "SR" | "SSR" | "UR";

export interface GachaItem {
    id: string;
    name: string;
    rarity: GachaRarity;
    description: string;
    icon: string;
    dropRate: number;
}

export interface GachaPool {
    id: string;
    name: string;
    description: string;
    cost: number;
    items: GachaItem[];
    banner: string;
    isPermanent: boolean;
    endDate?: string;
}

export interface GachaResult {
    item: GachaItem;
    isNew: boolean;
    duplicate: number;
}

export interface GachaRecord {
    id: number;
    poolId: string;
    itemId: string;
    rarity: GachaRarity;
    createdAt: string;
}

// ========== デフォルト ==========

export const DEFAULT_HORSES: Horse[] = [
    { id: 1, name: "サンダーボルト", odds: 2.5, color: "#FFD700", winRate: 25 },
    { id: 2, name: "スターライト", odds: 3.2, color: "#C0C0C0", winRate: 20 },
    { id: 3, name: "ブラックダイヤ", odds: 4.0, color: "#333333", winRate: 18 },
    { id: 4, name: "クリムゾンロード", odds: 5.0, color: "#DC143C", winRate: 15 },
    { id: 5, name: "エメラルドウィンド", odds: 6.5, color: "#50C878", winRate: 12 },
    { id: 6, name: "ミッドナイトブルー", odds: 8.0, color: "#191970", winRate: 10 },
];

export const RARITY_CONFIG: Record<GachaRarity, { color: string; label: string; rate: number }> = {
    N: { color: "#9CA3AF", label: "ノーマル", rate: 50 },
    R: { color: "#3B82F6", label: "レア", rate: 30 },
    SR: { color: "#A855F7", label: "スーパーレア", rate: 15 },
    SSR: { color: "#F59E0B", label: "SSレア", rate: 4.5 },
    UR: { color: "#EF4444", label: "ウルトラレア", rate: 0.5 },
};

export const DEFAULT_GACHA_POOL: GachaPool = {
    id: "standard",
    name: "スタンダードガチャ",
    description: "基本報酬が中心の常設ガチャ",
    cost: 100,
    banner: "🎁",
    isPermanent: true,
    items: [
        { id: "n_coin_s", name: "コイン小", rarity: "N", description: "50コイン獲得", icon: "🪙", dropRate: 20 },
        { id: "n_coin_m", name: "コイン中", rarity: "N", description: "100コイン獲得", icon: "🪙", dropRate: 15 },
        { id: "n_xp_s", name: "XP小", rarity: "N", description: "50XP獲得", icon: "⭐", dropRate: 15 },
        { id: "r_coin_l", name: "コイン大", rarity: "R", description: "300コイン獲得", icon: "🪙", dropRate: 12 },
        { id: "r_xp_m", name: "XP中", rarity: "R", description: "150XP獲得", icon: "⭐", dropRate: 10 },
        { id: "r_ticket", name: "ガチャチケット", rarity: "R", description: "次回無料ガチャ1回", icon: "🎫", dropRate: 8 },
        { id: "sr_coin_xl", name: "コイン特大", rarity: "SR", description: "500コイン獲得", icon: "🪙", dropRate: 8 },
        { id: "sr_xp_l", name: "XP大", rarity: "SR", description: "300XP獲得", icon: "⭐", dropRate: 5 },
        { id: "sr_theme", name: "限定テーマ", rarity: "SR", description: "特別テーマを獲得", icon: "🎨", dropRate: 2 },

        { id: "booster_xp2", name: "XP2??????", rarity: "R", description: "30?XP2?", icon: "??", dropRate: 4 },
        { id: "booster_money", name: "??1.5?", rarity: "R", description: "20???1.5?", icon: "??", dropRate: 3 },
        { id: "booster_gacha", name: "?????", rarity: "SR", description: "10??????", icon: "??", dropRate: 2 },
        { id: "booster_lucky", name: "??????", rarity: "SR", description: "10???????", icon: "??", dropRate: 1.5 },
        { id: "booster_xp3", name: "XP3??????", rarity: "SSR", description: "30?XP3?", icon: "??", dropRate: 0.8 },
        { id: "booster_lucky2", name: "??????+", rarity: "SSR", description: "10??????????", icon: "??", dropRate: 0.5 },
        { id: "ssr_jackpot", name: "ジャックポット", rarity: "SSR", description: "1000コイン獲得", icon: "💰", dropRate: 3 },
        { id: "ssr_mega_xp", name: "メガXP", rarity: "SSR", description: "1000XP獲得", icon: "✨", dropRate: 1.5 },
        { id: "ur_golden", name: "ゴールデン", rarity: "UR", description: "3000コイン獲得", icon: "🏆", dropRate: 0.5 },
    ],
};
