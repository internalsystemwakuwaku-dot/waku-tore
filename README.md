# わく☆とれ (WAKU-TORE)

Trelloボード管理とゲーミフィケーションを組み合わせたNext.jsアプリケーション。

## 技術スタック

- **Framework**: Next.js 15 (App Router)
- **Database**: Turso (SQLite)
- **Auth**: Better Auth
- **State**: Zustand
- **Styling**: Tailwind CSS

## 機能

### ボード管理
- Trelloボードの表示・フィルタリング
- カード担当者の設定
- メモ・操作ログ

### ゲーミフィケーション
- XP・レベルシステム
- ショップ（テーマ・アイテム購入）
- ランキング

### ミニゲーム
- 競馬ゲーム
- ガチャシステム

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env.local` にコピーして設定:

```bash
cp .env.example .env.local
```

### 3. データベースの準備

```bash
npm run db:generate
npm run db:push
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

## デプロイ

### Vercel

1. GitHubリポジトリをVercelに接続
2. 環境変数を設定:
   - `TRELLO_API_KEY`
   - `TRELLO_API_TOKEN`
   - `TRELLO_BOARD_ID`
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL`
   - `NEXT_PUBLIC_APP_URL`

3. デプロイ

## スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー |
| `npm run lint` | ESLint |
| `npm run db:generate` | マイグレーション生成 |
| `npm run db:push` | DB同期 |
| `npm run db:studio` | Drizzle Studio |

## ライセンス

MIT
