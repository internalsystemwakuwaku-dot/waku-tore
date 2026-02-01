"use client";

import { useState } from "react";
import { useGameStore } from "@/stores/gameStore";

/**
 * ゲームステータスバー - GAS風のXP/レベル/コイン表示
 * クッキークリッカー、競馬/ガチャボタン付き
 */
export function GameStatusBar() {
    const { data, getLevelProgress, addXP, addMoney } = useGameStore();
    const progress = getLevelProgress();
    const [showModal, setShowModal] = useState<string | null>(null);

    // クッキークリック（+2 XP）
    const handleCookieClick = () => {
        addXP(2);
    };

    // ランク名を取得
    const getRankName = (level: number): string => {
        if (level >= 100) return "神";
        if (level >= 80) return "伝説";
        if (level >= 60) return "達人";
        if (level >= 40) return "熟練者";
        if (level >= 25) return "ベテラン";
        if (level >= 15) return "中堅";
        if (level >= 8) return "若手";
        if (level >= 3) return "新人";
        return "見習い";
    };

    return (
        <>
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                {/* クッキークリッカー */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCookieClick}
                        className="text-2xl hover:scale-110 active:scale-90 transition-transform cursor-pointer select-none"
                        title="クリックしてXPゲット！"
                    >
                        🍪
                    </button>
                    <div className="text-xs text-gray-500 hidden sm:block">
                        <div>Click: +2 XP</div>
                    </div>
                </div>

                {/* 区切り */}
                <div className="w-px h-8 bg-gray-200" />

                {/* レベル・XP */}
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                            Lv.{data.level}
                        </span>
                        <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                            {getRankName(data.level)}
                        </span>

                        {/* ミニボタン群 */}
                        <div className="flex gap-1 ml-1">
                            <button
                                onClick={() => setShowModal("shop")}
                                className="p-1 hover:bg-gray-200 rounded text-gray-600 text-sm"
                                title="ショップ"
                            >
                                🛒
                            </button>
                            <button
                                onClick={() => setShowModal("ranking")}
                                className="p-1 hover:bg-gray-200 rounded text-gray-600 text-sm"
                                title="ランキング"
                            >
                                🏆
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
                                style={{ width: `${progress.percent}%` }}
                            />
                        </div>
                        <span className="text-xs text-gray-500 hidden sm:inline">
                            {progress.current} / {progress.required}
                        </span>
                    </div>
                </div>

                {/* 区切り */}
                <div className="w-px h-8 bg-gray-200" />

                {/* コイン */}
                <div className="flex items-center gap-1">
                    <span className="text-lg">💰</span>
                    <span className="font-bold text-yellow-600 text-sm">
                        {data.money.toLocaleString()}
                    </span>
                </div>

                {/* 競馬・ガチャボタン */}
                <div className="flex gap-1 ml-1">
                    <button
                        onClick={() => setShowModal("keiba")}
                        className="px-2 py-1 bg-gradient-to-b from-green-500 to-green-600 text-white text-xs font-bold rounded shadow hover:from-green-400 hover:to-green-500 transition-colors"
                        title="競馬"
                    >
                        🏇
                    </button>
                    <button
                        onClick={() => setShowModal("gacha")}
                        className="px-2 py-1 bg-gradient-to-b from-purple-500 to-purple-600 text-white text-xs font-bold rounded shadow hover:from-purple-400 hover:to-purple-500 transition-colors"
                        title="ガチャ"
                    >
                        🎰
                    </button>
                </div>
            </div>

            {/* シンプルモーダル */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setShowModal(null)}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl p-4 min-w-[300px] max-w-md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800">
                                {showModal === "shop" && "🛒 ショップ"}
                                {showModal === "ranking" && "🏆 ランキング"}
                                {showModal === "keiba" && "🏇 競馬"}
                                {showModal === "gacha" && "🎰 ガチャ"}
                            </h3>
                            <button
                                onClick={() => setShowModal(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="text-gray-600 text-sm">
                            {showModal === "shop" && (
                                <p>自動XP獲得などのアップグレードを購入できます。（準備中）</p>
                            )}
                            {showModal === "ranking" && (
                                <p>ユーザーランキングを表示します。（準備中）</p>
                            )}
                            {showModal === "keiba" && (
                                <div>
                                    <p>馬を選んで賭けよう！（準備中）</p>
                                    <p className="mt-2 text-xs text-gray-400">開催時間: 12:00〜24:00</p>
                                </div>
                            )}
                            {showModal === "gacha" && (
                                <div>
                                    <p>1回500円でガチャを回そう！（準備中）</p>
                                    <button
                                        className="mt-3 w-full py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                                        onClick={() => {
                                            if (data.money >= 500) {
                                                addMoney(-500);
                                                // ガチャ結果（仮）
                                                alert("ガチャ結果: ☆3 レアアイテム！");
                                            } else {
                                                alert("お金が足りません...");
                                            }
                                        }}
                                    >
                                        ガチャを回す（500円）
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
