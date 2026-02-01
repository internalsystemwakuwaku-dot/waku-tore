import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { headers } from "next/headers";

// ビルド時にはページデータ収集をスキップ
export const dynamic = "force-dynamic";

// メインページ - セッション確認後にボードまたはログインへリダイレクト
export default async function HomePage() {
  // セッション確認
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // 未認証の場合はログインへ
  if (!session) {
    redirect("/login");
  }

  // 認証済みの場合はボードページを表示
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
      {/* ヘッダー */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🫡</span>
              わく☆とれ
              <span className="text-xs font-normal text-white/50 ml-2">
                v2.0.0
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* ユーザー情報 */}
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-sm">{session.user.name || session.user.email}</span>
            </div>

            {/* ログアウトボタン */}
            <form action="/api/auth/sign-out" method="POST">
              <button
                type="submit"
                className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ウェルカムメッセージ */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-2">
            ようこそ、{session.user.name || "ユーザー"}さん！
          </h2>
          <p className="text-white/60">
            Trelloボードの管理を始めましょう。環境変数にTrello APIキーを設定してください。
          </p>
        </div>

        {/* セットアップ手順 */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">
            📋 セットアップ手順
          </h3>
          <ol className="space-y-3 text-white/70">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                1
              </span>
              <span>
                <code className="bg-white/10 px-2 py-0.5 rounded">.env.example</code> を{" "}
                <code className="bg-white/10 px-2 py-0.5 rounded">.env.local</code> にコピー
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                2
              </span>
              <span>Trello API Key/Token を設定</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                3
              </span>
              <span>Turso データベースURL/トークンを設定</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                4
              </span>
              <span>
                <code className="bg-white/10 px-2 py-0.5 rounded">npm run db:push</code>{" "}
                でDBスキーマを適用
              </span>
            </li>
          </ol>
        </div>

        {/* 機能カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-6 border border-blue-500/30">
            <div className="text-3xl mb-3">📊</div>
            <h4 className="text-lg font-semibold text-white mb-2">ボード管理</h4>
            <p className="text-sm text-white/60">
              Trelloカードの表示・フィルター・担当者設定
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-6 border border-purple-500/30">
            <div className="text-3xl mb-3">🎮</div>
            <h4 className="text-lg font-semibold text-white mb-2">ゲーミフィケーション</h4>
            <p className="text-sm text-white/60">
              XP・レベル・ランキング・ショップ機能
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl p-6 border border-green-500/30">
            <div className="text-3xl mb-3">🏇</div>
            <h4 className="text-lg font-semibold text-white mb-2">競馬ゲーム</h4>
            <p className="text-sm text-white/60">
              馬券購入・レース観戦・配当金獲得
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
