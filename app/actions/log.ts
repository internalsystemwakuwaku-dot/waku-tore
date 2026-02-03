"use server";

import { db } from "@/lib/db/client";
import { activityLogs } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

/**
 * ユーザー行動をログに記録
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logActivity(userId: string, action: string, cardId?: string | null, tx?: any) {
    try {
        const queryBuilder = tx || db;
        // Drizzleのtransaction object (tx) と db client はAPIが少し違う場合があるが、
        // run/execute は共通して使えることが多い。
        // ただし、drizzle-orm/sqlite-core の場合、tx.run() がある。
        // 安全のため、raw SQLではなくdrizzle-ormのクエリビルダーを使う方が良いが、
        // ここでは既存のsql``を活かすため、実行メソッドを統一する。

        await queryBuilder.run(sql`
            INSERT INTO "activity_logs" (user_id, action, card_id)
            VALUES (${userId}, ${action}, ${cardId || null})
        `);
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
