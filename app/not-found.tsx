import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
            <div className="text-center">
                <div className="text-8xl font-bold text-white/10 mb-4">404</div>
                <div className="text-6xl mb-4">🔍</div>
                <h2 className="text-2xl font-bold text-white mb-2">
                    ページが見つかりません
                </h2>
                <p className="text-white/60 mb-6">
                    お探しのページは存在しないか、移動した可能性があります。
                </p>
                <Link
                    href="/"
                    className="inline-block px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                >
                    ホームへ戻る
                </Link>
            </div>
        </div>
    );
}
