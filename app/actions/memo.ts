"use server";

import { db } from "@/lib/db/client";
import { memos } from "@/lib/db/schema";
import { eq, and, desc, lt, isNotNull } from "drizzle-orm";
import { addTrelloComment, deleteTrelloComment } from "./trello";
import { logActivity } from "./log";

export type MemoType = "personal" | "shared" | "card";

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
    createdAt: string | null;
}

import { getCardComments } from "@/lib/trello/client";

/**
 * カードに関連するメモを取得 (Trelloコメントとのハイドレーション対応)
 */
export async function getCardMemos(cardId: string): Promise<Memo[]> {
    try {
        // 1. DBメモとTrelloコメントを並行取得
        const [dbMemos, trelloComments] = await Promise.all([
            db
                .select()
                .from(memos)
                .where(
                    and(
                        eq(memos.type, "card"),
                        eq(memos.cardId, cardId)
                    )
                )
                .orderBy(desc(memos.createdAt)),
            getCardComments(cardId).catch(() => []), // Trello API失敗時は空配列
        ]);

        // 2. DBメモを整形
        const formattedDbMemos: Memo[] = dbMemos.map(row => ({
            ...row,
            type: row.type as MemoType,
            relatedUsers: row.relatedUsers ? row.relatedUsers.split(",") : [],
            isFinished: row.isFinished || false,
        }));

        // 3. DBに既に登録されているTrelloコメントIDのSet
        const knownTrelloIds = new Set(
            formattedDbMemos.filter(m => m.trelloCommentId).map(m => m.trelloCommentId)
        );

        // 4. Trelloにのみ存在するコメントをMemo形式に変換
        const trelloOnlyMemos: Memo[] = trelloComments
            .filter(c => !knownTrelloIds.has(c.id))
            .map(c => ({
                id: `trello-${c.id}`, // 一時ID (DB未登録)
                type: "card" as MemoType,
                userId: c.memberCreator?.fullName || "Trello User",
                content: c.data.text,
                notifyTime: null,
                cardId: cardId,
                relatedUsers: [],
                isFinished: false,
                trelloCommentId: c.id,
                createdAt: c.date,
            }));

        // 5. マージして返却 (DBメモ優先、新着順)
        const merged = [...formattedDbMemos, ...trelloOnlyMemos];
        merged.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA; // desc
        });

        return merged;
    } catch (e) {
        console.error("getCardMemos error:", e);
        return [];
    }
}

/**
 * カードメモを追加 (Trelloコメント同期)
 */
export async function addCardMemo(
    cardId: string,
    userId: string,
    content: string,
    notifyTime?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Trelloにコメント投稿
        const userHeader = `【${userId}からのメモ】\n`;
        const commentText = `${userHeader}${content}`;
        const trelloResult = await addTrelloComment(cardId, commentText);

        if (!trelloResult.success) {
            console.warn("Trello comment sync failed:", trelloResult.error);
        }

        // 2. DBに保存
        const id = crypto.randomUUID();
        await db.insert(memos).values({
            id,
            type: "card",
            userId,
            content,
            notifyTime: notifyTime || null,
            cardId,
            relatedUsers: "", // TODO: メンション機能実装時に対応
            isFinished: false,
            trelloCommentId: trelloResult.commentId || null,
        });

        // M-16: ログ記録
        await logActivity(userId, "メモ作成", cardId);

        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * メモの完了状態をトグル
 */
export async function toggleMemoStatus(memoId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const memo = await db.select().from(memos).where(eq(memos.id, memoId)).limit(1);
        if (memo.length === 0) {
            return { success: false, error: "Memo not found" };
        }

        const newStatus = !memo[0].isFinished;
        await db.update(memos)
            .set({ isFinished: newStatus })
            .where(eq(memos.id, memoId));

        // M-16: ログ記録
        await logActivity(memo[0].userId, `メモ${newStatus ? "完了" : "未完了"}`, memo[0].cardId);

        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * カードメモを削除 (Trelloコメント削除同期)
 */
export async function deleteCardMemo(memoId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. 対象メモを取得してTrelloコメントIDを確認
        const memo = await db.select().from(memos).where(eq(memos.id, memoId)).limit(1);
        if (memo.length === 0) {
            return { success: false, error: "Memo not found" };
        }

        const trelloCommentId = memo[0].trelloCommentId;

        // 2. Trelloコメント削除
        if (trelloCommentId) {
            await deleteTrelloComment(trelloCommentId);
        }

        // 3. DBから削除
        await db.delete(memos).where(eq(memos.id, memoId));

        // M-16: ログ記録
        await logActivity(memo[0].userId, "メモ削除", memo[0].cardId);

        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * 期限切れメモがあるカードIDを取得 (M-14)
 */
export async function getOverdueMemoCardIds(): Promise<string[]> {
    try {
        const now = new Date().toISOString();

        const overdueMemos = await db
            .select({ cardId: memos.cardId })
            .from(memos)
            .where(
                and(
                    eq(memos.type, "card"),
                    eq(memos.isFinished, false),
                    isNotNull(memos.notifyTime),
                    lt(memos.notifyTime, now)
                )
            );

        const ids = new Set(overdueMemos.map(m => m.cardId).filter(id => id !== null));
        return Array.from(ids) as string[];
    } catch (e) {
        console.error("getOverdueMemoCardIds error:", e);
        return [];
    }
}
