"use server";

/**
 * メモ Server Actions
 * GASの getMemos, addMemo, deleteMemo 等を置き換え
 */

import { db } from "@/lib/db/client";
import { memos, activityLogs } from "@/lib/db/schema";
import { eq, and, or, lt, desc } from "drizzle-orm";
import { postCardComment, deleteComment, getCardComments } from "@/lib/trello/client";
import type { Memo, CreateMemoRequest, ActivityLog } from "@/types/memo";

/**
 * メモ一覧を取得（個人・共有・カード紐付け）
 */
export async function getMemos(
    userId: string,
    type?: "personal" | "shared" | "card",
    cardId?: string
): Promise<Memo[]> {
    let query = db.select().from(memos);

    // フィルター条件を構築
    const conditions = [];

    if (type) {
        conditions.push(eq(memos.type, type));
    }

    if (type === "personal") {
        // 個人メモは自分のものだけ
        conditions.push(eq(memos.userId, userId));
    } else if (type === "shared") {
        // 共有メモは全員分を表示
        // （relatedUsersに含まれるか確認は後でフィルタ）
    }

    if (cardId) {
        conditions.push(eq(memos.cardId, cardId));
    }

    // M-25: プライバシーフィルター (他人の個人メモを除外)
    // 自分が作成したもの OR 共有メモ OR カードメモ(全員公開) のみ取得
    conditions.push(
        or(
            eq(memos.userId, userId),      // 自分のメモ (personal/shared/card)
            eq(memos.type, "shared"),      // 共有メモ
            eq(memos.type, "card")         // カードメモ
        )
    );

    const result = await db
        .select()
        .from(memos)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(memos.createdAt));

    return result.map((m) => ({
        id: m.id,
        type: m.type as Memo["type"],
        userId: m.userId,
        content: m.content,
        notifyTime: m.notifyTime,
        cardId: m.cardId,
        relatedUsers: m.relatedUsers ? m.relatedUsers.split(",") : [],
        isFinished: m.isFinished || false,
        trelloCommentId: m.trelloCommentId,
        createdAt: m.createdAt || "",
    }));
}

/**
 * カードの統合タイムラインを取得 (M-26: Trelloコメント + アプリ内メモ)
 */
export async function getCardTimeline(
    userId: string,
    cardId: string
): Promise<Memo[]> {
    try {
        // 1. DBメモを取得
        const dbMemos = await getMemos(userId, "card", cardId);

        // 2. Trelloコメントを取得
        let trelloComments: any[] = [];
        try {
            trelloComments = await getCardComments(cardId);
        } catch (e) {
            console.warn("Trello timeline sync failed:", e);
        }

        // 3. DBに既に登録されているTrelloコメントIDのSet
        const knownTrelloIds = new Set(
            dbMemos.filter(m => m.trelloCommentId).map(m => m.trelloCommentId)
        );

        // 4. Trelloにのみ存在するコメントをMemo形式に変換
        const trelloOnlyMemos: Memo[] = trelloComments
            .filter((c: any) => !knownTrelloIds.has(c.id))
            .map((c: any) => ({
                id: `trello-${c.id}`, // 一時ID
                type: "card",
                userId: c.memberCreator?.fullName || "Trello User", // 表示名として使用
                content: c.data.text,
                notifyTime: null,
                cardId: cardId,
                relatedUsers: [],
                isFinished: true, // Trelloコメントは完了扱いとするか、操作不可とする
                trelloCommentId: c.id,
                createdAt: c.date,
            }));

        // 5. マージしてソート (新しい順)
        const merged = [...dbMemos, ...trelloOnlyMemos];
        merged.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });

        return merged;
    } catch (e) {
        console.error("getCardTimeline error:", e);
        return [];
    }
}

/**
 * メモを追加
 */
export async function addMemo(
    userId: string,
    request: CreateMemoRequest
): Promise<{ success: boolean; memo?: Memo; error?: string }> {
    try {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        let trelloCommentId: string | null = null;

        // カードメモの場合、Trelloにもコメントを投稿
        if (request.type === "card" && request.cardId) {
            try {
                // メモ内容にプレフィックスを付けて投稿
                const commentText = `📝 [わく☆とれメモ]\n${request.content}`;
                const result = await postCardComment(request.cardId, commentText);
                trelloCommentId = result.id;
            } catch (e) {
                console.warn("Trelloコメント投稿失敗:", e);
                // Trelloへの投稿が失敗してもメモは保存する
            }
        }

        await db.insert(memos).values({
            id,
            type: request.type,
            userId,
            content: request.content,
            notifyTime: request.notifyTime || null,
            cardId: request.cardId || null,
            relatedUsers: request.relatedUsers?.join(",") || null,
            isFinished: false,
            trelloCommentId,
            createdAt: now,
        });

        const memo: Memo = {
            id,
            type: request.type,
            userId,
            content: request.content,
            notifyTime: request.notifyTime || null,
            cardId: request.cardId || null,
            relatedUsers: request.relatedUsers || [],
            isFinished: false,
            trelloCommentId,
            createdAt: now,
        };

        return { success: true, memo };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * メモを削除
 */
export async function deleteMemo(
    memoId: string,
    deleteTrelloComment: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        // 先にメモを取得してTrelloコメントIDを確認
        const existing = await db
            .select()
            .from(memos)
            .where(eq(memos.id, memoId))
            .limit(1);

        if (existing.length === 0) {
            return { success: false, error: "メモが見つかりません" };
        }

        const memo = existing[0];

        // Trelloコメントも削除
        if (deleteTrelloComment && memo.trelloCommentId) {
            try {
                await deleteComment(memo.trelloCommentId);
            } catch (e) {
                console.warn("Trelloコメント削除失敗:", e);
            }
        }

        // DBから削除
        await db.delete(memos).where(eq(memos.id, memoId));

        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * メモの完了状態を切り替え
 */
export async function toggleMemoStatus(
    memoId: string
): Promise<{ success: boolean; isFinished?: boolean; error?: string }> {
    try {
        const existing = await db
            .select()
            .from(memos)
            .where(eq(memos.id, memoId))
            .limit(1);

        if (existing.length === 0) {
            return { success: false, error: "メモが見つかりません" };
        }

        const newStatus = !existing[0].isFinished;

        await db
            .update(memos)
            .set({ isFinished: newStatus })
            .where(eq(memos.id, memoId));

        return { success: true, isFinished: newStatus };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * メモを更新
 */
export async function updateMemo(
    memoId: string,
    updates: Partial<Pick<Memo, "content" | "notifyTime">>
): Promise<{ success: boolean; error?: string }> {
    try {
        await db
            .update(memos)
            .set(updates)
            .where(eq(memos.id, memoId));

        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * 期限切れメモを持つカードIDを取得
 */
export async function getOverdueMemoCardIds(): Promise<string[]> {
    const now = new Date().toISOString();

    const overdue = await db
        .select({ cardId: memos.cardId })
        .from(memos)
        .where(
            and(
                eq(memos.type, "card"),
                eq(memos.isFinished, false),
                lt(memos.notifyTime, now)
            )
        );

    return overdue
        .filter((m) => m.cardId !== null)
        .map((m) => m.cardId as string);
}

/**
 * カードのメモをTrelloコメントと同期
 */
export async function syncCardMemos(
    cardId: string,
    userId: string
): Promise<{ success: boolean; memos: Memo[]; error?: string }> {
    try {
        // DBのメモを取得
        const dbMemos = await getMemos(userId, "card", cardId);

        // Trelloコメントを取得
        let trelloComments: Awaited<ReturnType<typeof getCardComments>> = [];
        try {
            trelloComments = await getCardComments(cardId);
        } catch (e) {
            console.warn("Trelloコメント取得失敗:", e);
        }

        // わく☆とれメモのプレフィックスがついたコメントをフィルタ
        const wakuToreComments = trelloComments.filter((c) =>
            c.data.text.includes("[わく☆とれメモ]")
        );

        // Trelloにあるがローカルにないメモを追加
        for (const comment of wakuToreComments) {
            const alreadySynced = dbMemos.some(
                (m) => m.trelloCommentId === comment.id
            );
            if (!alreadySynced) {
                // ローカルに追加
                const content = comment.data.text
                    .replace("📝 [わく☆とれメモ]", "")
                    .trim();

                await db.insert(memos).values({
                    id: crypto.randomUUID(),
                    type: "card",
                    userId: "trello-sync", // Trello側から同期されたもの
                    content,
                    cardId,
                    trelloCommentId: comment.id,
                    createdAt: comment.date,
                });
            }
        }

        // 更新されたメモリストを返す
        const updatedMemos = await getMemos(userId, "card", cardId);
        return { success: true, memos: updatedMemos };
    } catch (e) {
        return {
            success: false,
            memos: [],
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

/**
 * 操作ログを記録
 */
export async function logActivity(
    userId: string,
    action: string,
    cardId?: string
): Promise<{ success: boolean }> {
    try {
        await db.insert(activityLogs).values({
            userId,
            action,
            cardId: cardId || null,
        });
        return { success: true };
    } catch {
        return { success: false };
    }
}

/**
 * カードの操作ログを取得
 */
export async function getCardActivityLogs(
    cardId: string,
    limit: number = 50
): Promise<ActivityLog[]> {
    const logs = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.cardId, cardId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);

    return logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        cardId: log.cardId,
        createdAt: log.createdAt || "",
    }));
}

/**
 * ユーザーの操作ログを取得
 */
export async function getUserActivityLogs(
    userId: string,
    limit: number = 100
): Promise<ActivityLog[]> {
    const logs = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.userId, userId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);

    return logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        cardId: log.cardId,
        createdAt: log.createdAt || "",
    }));
}
