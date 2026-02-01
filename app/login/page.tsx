"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth/client";

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    // ログイン処理
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await signIn.email({
                email,
                password,
            });

            if (result.error) {
                setError(result.error.message || "ログインに失敗しました");
            } else {
                router.push("/");
                router.refresh();
            }
        } catch {
            setError("ログインに失敗しました");
        } finally {
            setLoading(false);
        }
    };

    // 新規登録処理
    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await signUp.email({
                email,
                password,
                name,
            });

            if (result.error) {
                setError(result.error.message || "登録に失敗しました");
            } else {
                router.push("/");
                router.refresh();
            }
        } catch {
            setError("登録に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900">
            {/* 背景装飾 */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md px-4">
                {/* ヘッダー */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">
                        🫡 わく☆とれ
                    </h1>
                    <p className="text-blue-200 text-sm">Trello タスク管理システム</p>
                </div>

                {/* ログインボックス */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
                    {/* タブ切り替え */}
                    <div className="flex mb-6 bg-white/10 rounded-lg p-1">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${isLogin
                                    ? "bg-white text-indigo-900"
                                    : "text-white/70 hover:text-white"
                                }`}
                        >
                            ログイン
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${!isLogin
                                    ? "bg-white text-indigo-900"
                                    : "text-white/70 hover:text-white"
                                }`}
                        >
                            新規登録
                        </button>
                    </div>

                    <form onSubmit={isLogin ? handleLogin : handleSignUp}>
                        {/* 名前入力（新規登録時のみ） */}
                        {!isLogin && (
                            <div className="mb-4">
                                <label className="block text-white/80 text-sm mb-2">
                                    ニックネーム
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                                    placeholder="表示名を入力"
                                    required={!isLogin}
                                />
                            </div>
                        )}

                        {/* メールアドレス */}
                        <div className="mb-4">
                            <label className="block text-white/80 text-sm mb-2">
                                メールアドレス
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                                placeholder="email@example.com"
                                required
                            />
                        </div>

                        {/* パスワード */}
                        <div className="mb-6">
                            <label className="block text-white/80 text-sm mb-2">
                                パスワード
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        {/* エラーメッセージ */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
                                {error}
                            </div>
                        )}

                        {/* 送信ボタン */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg
                                        className="animate-spin h-5 w-5"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    処理中...
                                </span>
                            ) : isLogin ? (
                                "ログイン"
                            ) : (
                                "アカウント作成"
                            )}
                        </button>
                    </form>
                </div>

                {/* フッター */}
                <p className="text-center text-white/40 text-xs mt-6">
                    © 2026 わく☆とれ - Powered by Next.js
                </p>
            </div>
        </div>
    );
}
