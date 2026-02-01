/**
 * メモ関連の型定義
 */

// メモタイプ
export type MemoType = "personal" | "shared" | "card";

// メモ
export interface Memo {
    id: string;
    type: MemoType;
    userId: string;
    content: string;
    notifyTime: string | null;
    cardId: string | null;
    relatedUsers: string[];
    isFinished: boolean;
    trelloCommentId: string | null;
    createdAt: string;
}

// メモ作成リクエスト
export interface CreateMemoRequest {
    type: MemoType;
    content: string;
    notifyTime?: string;
    cardId?: string;
    relatedUsers?: string[];
}

// 操作ログ
export interface ActivityLog {
    id: number;
    userId: string;
    action: string;
    cardId: string | null;
    createdAt: string;
}
