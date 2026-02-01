"use client";

import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // エラーログ（本番環境では外部サービスに送信）
        console.error("Application error:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center border border-red-500/30">
                <div className="text-6xl mb-4">😵</div>
                <h2 className="text-2xl font-bold text-white mb-2">
                    エラーが発生しました
                </h2>
                <p className="text-white/60 mb-6 text-sm">
                    {error.message || "予期しないエラーが発生しました。"}
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => reset()}
                        className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                    >
                        再試行
                    </button>
                    <button
                        onClick={() => window.location.href = "/"}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg font-medium transition-colors"
                    >
                        ホームへ
                    </button>
                </div>
                {error.digest && (
                    <p className="text-white/30 text-xs mt-4">
                        エラーID: {error.digest}
                    </p>
                )}
            </div>
        </div>
    );
}
