export default function Loading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
            <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                    {/* 外側リング */}
                    <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full animate-pulse" />
                    {/* 内側スピナー */}
                    <div className="absolute inset-2 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" />
                    {/* 中央アイコン */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl">⭐</span>
                    </div>
                </div>
                <p className="text-white/70 text-sm">読み込み中...</p>
            </div>
        </div>
    );
}
