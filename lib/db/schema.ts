import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ユーザー管理（Better Auth統合）
export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    email: text("email").unique().notNull(),
    name: text("name"),
    emailVerified: integer("email_verified", { mode: "boolean" }),
    image: text("image"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Better Auth セッション
export const sessions = sqliteTable("sessions", {
    id: text("id").primaryKey(),
    expiresAt: text("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
});

// Better Auth アカウント
export const accounts = sqliteTable("accounts", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: text("access_token_expires_at"),
    refreshTokenExpiresAt: text("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Better Auth 検証トークン
export const verifications = sqliteTable("verifications", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// カード担当者マッピング
export const assignments = sqliteTable("assignments", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cardId: text("card_id").notNull().unique(), // Trello shortLink
    construction: text("construction"), // 構築担当
    system: text("system"), // 予約システム担当
    sales: text("sales"), // 商談担当
    mtg: text("mtg"), // MTG担当
    systemType: text("system_type"), // システム種別1
    systemType2: text("system_type2"), // システム種別2
    customLink: text("custom_link"), // カスタムリンク
    constructionNumber: text("construction_number"), // 構築番号
    memo1: text("memo1"),
    memo2: text("memo2"),
    memo3: text("memo3"),
    isPinned: integer("is_pinned", { mode: "boolean" }).default(false),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// メンバー設定
export const members = sqliteTable("members", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    role: text("role").notNull(), // construction/system/sales/mtg
    name: text("name").notNull(),
});

// メモ
export const memos = sqliteTable("memos", {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // personal/shared/card
    userId: text("user_id").notNull(),
    content: text("content").notNull(),
    notifyTime: text("notify_time"),
    cardId: text("card_id"), // カードメモの場合
    relatedUsers: text("related_users"), // カンマ区切り
    isFinished: integer("is_finished", { mode: "boolean" }).default(false),
    trelloCommentId: text("trello_comment_id"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// 操作ログ
export const activityLogs = sqliteTable("activity_logs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),
    cardId: text("card_id"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ゲームデータ
export const gameData = sqliteTable("game_data", {
    userId: text("user_id").primaryKey(),
    dataJson: text("data_json").notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// 競馬レース
export const keibaRaces = sqliteTable("keiba_races", {
    id: text("id").primaryKey(),
    userId: text("user_id"),                             // null = System/Global race
    name: text("name").notNull(),
    horsesJson: text("horses_json").notNull(),
    status: text("status").notNull().default("waiting"), // waiting, open, closed, finished
    winnerId: integer("winner_id"),
    resultsJson: text("results_json"), // 1着〜3着等の結果配列
    scheduledAt: text("scheduled_at"),                   // 発走予定時刻
    finishedAt: text("finished_at"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// 競馬取引記録（兼ベット情報）
export const keibaTransactions = sqliteTable("keiba_transactions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),                   // ユーザーID (追加)
    raceId: text("race_id").notNull(),

    // ベット詳細
    type: text("type").default("WIN"),                   // WIN, PLACE, TRIFECTA etc.
    mode: text("mode").default("NORMAL"),                // NORMAL, BOX etc.
    horseId: integer("horse_id"),                        // 単勝等はこれを使用
    details: text("details"),                            // 複雑な買い目 (JSON)

    betAmount: integer("bet_amount").notNull(),
    payout: integer("payout").notNull().default(0),
    isWin: integer("is_win", { mode: "boolean" }).default(false),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ガチャ記録
export const gachaRecords = sqliteTable("gacha_records", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(), // ユーザーID (M-11対応)
    poolId: text("pool_id").notNull(),
    itemId: text("item_id").notNull(),
    rarity: text("rarity").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

