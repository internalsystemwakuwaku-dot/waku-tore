/**
 * Trello関連の型定義
 * GASプロジェクトのデータ構造を再現
 */

// カード担当者情報
export interface CardRoles {
    construction: string;      // 構築担当
    system: string;            // 予約システム担当
    sales: string;             // 商談担当
    mtg: string;               // MTG担当
    systemType: string;        // システム種別1
    systemType2: string;       // システム種別2
    customLink: string;        // カスタムリンク
    constructionNumber: string; // 構築番号
    memo1: string;
    memo2: string;
    memo3: string;
    isPinned: boolean;
    updatedAt: string;
}

// ラベル
export interface CardLabel {
    name: string;
    color: string;
}

// 処理済みカード（フロントエンド用）
export interface ProcessedCard {
    id: string;           // shortLink
    realId: string;       // Trello内部ID
    name: string;
    idList: string;
    url: string;
    due: string | null;
    dueComplete: boolean;
    industries: string[];  // 業種チェックリストから
    prefectures: string[]; // 都道府県チェックリストから
    trelloLabels: CardLabel[];
    roles: CardRoles;
    desc: string;
}

// リスト
export interface TrelloListInfo {
    id: string;
    name: string;
}

// メンバーリスト
export interface MemberLists {
    construction: string[];
    system: string[];
    sales: string[];
    mtg: string[];
}

// フィルターオプション
export interface FilterOptions {
    industries: string[];
    prefectures: string[];
    trelloLabels: string[];
    roles: {
        construction: string[];
        system: string[];
        sales: string[];
        mtg: string[];
    };
    systemTypes: string[];
}

// ボード全体データ
export interface BoardData {
    lists: TrelloListInfo[];
    cards: ProcessedCard[];
    members: MemberLists;
    overdueMemoCardIds: string[];
    filterOptions: FilterOptions;
}

// API応答
export interface TrelloDataResponse {
    data: BoardData | null;
    error: string | null;
}
