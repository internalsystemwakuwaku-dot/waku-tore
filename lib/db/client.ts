import { createClient, Client } from "@libsql/client";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

// 遅延初期化用のグローバル変数
let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

// クライアントを取得（遅延初期化）
function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error("TURSO_DATABASE_URL is not defined");
    }
    _client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

// Drizzle ORM インスタンスを取得（遅延初期化）
export function getDb(): LibSQLDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

// 後方互換性のためのエクスポート（ただしビルド時にはエラーになる可能性あり）
// 新しいコードではgetDb()を使うべき
export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    return getDb()[prop as keyof LibSQLDatabase<typeof schema>];
  },
});

