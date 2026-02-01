"use client";

import { useGameStore } from "@/stores/gameStore";

export function LevelUpModal() {
    const { showLevelUp, levelUpReward, data, hideLevelUpModal } = useGameStore();

    if (!showLevelUp) return null;

    return (
        <div className="modal-overlay">
            <div
                className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-bounce-in"
            >
                {/* 紙吹雪エフェクト */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="confetti"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 2}s`,
                            }}
                        />
                    ))}
                </div>

                <div className="relative p-8 text-center">
                    {/* タイトル */}
                    <div className="text-6xl mb-4 animate-pulse">🎉</div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        レベルアップ！
                    </h2>
                    <p className="text-4xl font-black text-white mb-6">
                        Lv.{data.level}
                    </p>

                    {/* 報酬 */}
                    {levelUpReward && (
                        <div className="bg-white/20 rounded-xl p-4 mb-6">
                            <p className="text-sm text-white/80 mb-2">報酬獲得！</p>
                            <div className="flex justify-center gap-4">
                                {levelUpReward.money > 0 && (
                                    <div className="flex items-center gap-2 text-yellow-200">
                                        <span className="text-xl">💰</span>
                                        <span className="font-bold">
                                            +{levelUpReward.money.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {levelUpReward.unlock && (
                                    <div className="flex items-center gap-2 text-green-200">
                                        <span className="text-xl">🔓</span>
                                        <span className="font-bold">{levelUpReward.unlock}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 閉じるボタン */}
                    <button
                        onClick={hideLevelUpModal}
                        className="px-8 py-3 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-white/90 transition-colors shadow-lg"
                    >
                        やったー！
                    </button>
                </div>
            </div>
        </div>
    );
}

// XP獲得アニメーション
export function XpGainAnimation() {
    const { showXpGain, hideXpAnimation } = useGameStore();

    if (!showXpGain) return null;

    return (
        <div
            className="fixed pointer-events-none z-50 text-2xl font-bold text-yellow-400 animate-xp-float"
            style={{
                left: showXpGain.x,
                top: showXpGain.y,
            }}
            onAnimationEnd={hideXpAnimation}
        >
            +{showXpGain.amount} XP
        </div>
    );
}
