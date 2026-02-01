"use server";

import { db } from "@/lib/db/client";
import { activityLogs } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * ユーザー行動をログに記録
 */
export async function logActivity(userId: string, action: string, cardId?: string | null) {
    try {
        await db.insert(activityLogs).values({
            userId,
            action,
            cardId: cardId || null,
        });
    } catch (e) {
        console.error("logActivity error:", e);
    }
}

/**
 * ユーザーの最近の行動ログを取得
 */
export async function getUserLogs(userId: string, limit: number = 50) {
    return await db.select()
        .from(activityLogs)
        .where(eq(activityLogs.userId, userId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
}

/**
 * 全体の行動ログを取得
 */
export async function getGlobalLogs(limit: number = 50) {
    return await db.select()
        .from(activityLogs)
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
}
