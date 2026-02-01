/**
 * 競馬・ガチャ関連の型定義
 * GASプロジェクトのKeiba/Gachaを再現
 */

// ========== 競馬 ==========

// 競走馬
export interface Horse {
    id: number;
    name: string;
    odds: number;         // オッズ（倍率）
    color: string;        // 表示色
    winRate: number;      // 勝率（内部値 0-100）
}

// レース
export interface Race {
    id: string;
    name: string;
    horses: Horse[];
    status: "waiting" | "racing" | "finished";
    winnerId: number | null;
    startedAt: string | null;
}

// 賭けの種類・モード
export type BetType = "WIN" | "PLACE" | "QUINELLA" | "EXACTA" | "TRIO" | "TRIFECTA";
export type BetMode = "NORMAL" | "BOX" | "NAGASHI";

// 賭け
export interface Bet {
    id?: string;
    raceId?: string;
    userId?: string; // 履歴表示用
    type: BetType;
    mode: BetMode;
    horseId?: number; // 単勝・複勝用
    details?: string; // 複雑な買い目 (JSON)
    amount: number;
    payout?: number;
    createdAt?: string;
}

// レース結果
export interface RaceResult {
    raceId: string;
    winnerId: number;
    winnerName: string;
    userBets: Bet[]; // 複数ベット対応
    totalPayout: number;
    isWin: boolean;
}

// 競馬トランザクション（兼ベット履歴）
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

// レアリティ
export type GachaRarity = "N" | "R" | "SR" | "SSR" | "UR";

// ガチャアイテム
export interface GachaItem {
    id: string;
    name: string;
    rarity: GachaRarity;
    description: string;
    icon: string;
    dropRate: number;     // 排出率（%）
}

// ガチャプール
export interface GachaPool {
    id: string;
    name: string;
    description: string;
    cost: number;
    items: GachaItem[];
    banner: string;
    isPermanent: boolean;
    endDate?: string;     // 期間限定の場合
}

// ガチャ結果
export interface GachaResult {
    item: GachaItem;
    isNew: boolean;       // 初入手か
    duplicate: number;    // 重複数（0なら初）
}

// ガチャ記録
export interface GachaRecord {
    id: number;
    poolId: string;
    itemId: string;
    rarity: GachaRarity;
    createdAt: string;
}

// ========== 定数 ==========

// デフォルト競走馬リスト
export const DEFAULT_HORSES: Horse[] = [
    { id: 1, name: "サンダーボルト", odds: 2.5, color: "#FFD700", winRate: 25 },
    { id: 2, name: "スターライト", odds: 3.2, color: "#C0C0C0", winRate: 20 },
    { id: 3, name: "ブラックダイヤ", odds: 4.0, color: "#333333", winRate: 18 },
    { id: 4, name: "クリムゾンロード", odds: 5.0, color: "#DC143C", winRate: 15 },
    { id: 5, name: "エメラルドウィンド", odds: 6.5, color: "#50C878", winRate: 12 },
    { id: 6, name: "ミッドナイトブルー", odds: 8.0, color: "#191970", winRate: 10 },
];

// レアリティ設定
export const RARITY_CONFIG: Record<GachaRarity, { color: string; label: string; rate: number }> = {
    N: { color: "#9CA3AF", label: "ノーマル", rate: 50 },
    R: { color: "#3B82F6", label: "レア", rate: 30 },
    SR: { color: "#A855F7", label: "スーパーレア", rate: 15 },
    SSR: { color: "#F59E0B", label: "SSレア", rate: 4.5 },
    UR: { color: "#EF4444", label: "ウルトラレア", rate: 0.5 },
};

// デフォルトガチャプール
export const DEFAULT_GACHA_POOL: GachaPool = {
    id: "standard",
    name: "スタンダードガチャ",
    description: "基本的なアイテムが手に入るガチャ",
    cost: 100,
    banner: "🎰",
    isPermanent: true,
    items: [
        { id: "n_coin_s", name: "コイン袋（小）", rarity: "N", description: "50コイン獲得", icon: "💰", dropRate: 20 },
        { id: "n_coin_m", name: "コイン袋（中）", rarity: "N", description: "100コイン獲得", icon: "💰", dropRate: 15 },
        { id: "n_xp_s", name: "経験値の書（小）", rarity: "N", description: "50XP獲得", icon: "📘", dropRate: 15 },
        { id: "r_coin_l", name: "コイン袋（大）", rarity: "R", description: "300コイン獲得", icon: "💎", dropRate: 12 },
        { id: "r_xp_m", name: "経験値の書（中）", rarity: "R", description: "150XP獲得", icon: "📙", dropRate: 10 },
        { id: "r_ticket", name: "ガチャチケット", rarity: "R", description: "無料ガチャ1回", icon: "🎫", dropRate: 8 },
        { id: "sr_coin_xl", name: "宝箱", rarity: "SR", description: "500コイン獲得", icon: "📦", dropRate: 8 },
        { id: "sr_xp_l", name: "経験値の書（大）", rarity: "SR", description: "300XP獲得", icon: "📕", dropRate: 5 },
        { id: "sr_theme", name: "限定テーマ", rarity: "SR", description: "特別なテーマをアンロック", icon: "🎨", dropRate: 2 },
        { id: "ssr_jackpot", name: "ジャックポット", rarity: "SSR", description: "1000コイン獲得", icon: "🏆", dropRate: 3 },
        { id: "ssr_mega_xp", name: "伝説の書", rarity: "SSR", description: "1000XP獲得", icon: "📖", dropRate: 1.5 },
        { id: "ur_golden", name: "黄金の像", rarity: "UR", description: "全ステータス+永続3000コイン", icon: "🗿", dropRate: 0.5 },
    ],
};
