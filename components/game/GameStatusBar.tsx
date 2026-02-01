"use client";

import { useGameStore } from "@/stores/gameStore";

export function GameStatusBar() {
    const { data, getLevelProgress } = useGameStore();
    const progress = getLevelProgress();

    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="flex items-center justify-between gap-4">
                {/* レベル表示 */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {data.level}
                    </div>
                    <div>
                        <p className="text-xs text-white/60">レベル</p>
                        <p className="font-semibold text-white">Lv.{data.level}</p>
                    </div>
                </div>

                {/* XPバー */}
                <div className="flex-1 max-w-xs">
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                        <span>XP</span>
                        <span>
                            {progress.current.toLocaleString()} /{" "}
                            {progress.required.toLocaleString()}
                        </span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                </div>

                {/* 所持金 */}
                <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-2 rounded-lg">
                    <span className="text-xl">💰</span>
                    <div>
                        <p className="text-xs text-yellow-400/80">所持金</p>
                        <p className="font-bold text-yellow-400">
                            {data.money.toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* 総獲得XP */}
                <div className="hidden md:flex items-center gap-2 text-white/60">
                    <span className="text-lg">⭐</span>
                    <div className="text-xs">
                        <p>総XP</p>
                        <p className="text-white">{data.xp.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
