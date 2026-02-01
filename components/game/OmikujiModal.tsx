"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";

interface OmikujiModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// おみくじ結果定義
const OMIKUJI_RESULTS = [
    { result: "大吉", color: "text-red-600", bonus: 50 },
    { result: "吉", color: "text-orange-600", bonus: 30 },
    { result: "中吉", color: "text-yellow-600", bonus: 20 },
    { result: "小吉", color: "text-green-600", bonus: 10 },
    { result: "末吉", color: "text-blue-600", bonus: 5 },
    { result: "凶", color: "text-gray-600", bonus: 0 },
];

// ラッキーアイテム
const LUCKY_ITEMS = [
    "🍀 四葉のクローバー", "🌟 流れ星", "🎯 ダーツ", "🎲 サイコロ",
    "🎪 サーカス", "🎠 メリーゴーラウンド", "🎡 観覧車", "🎢 ジェットコースター",
    "☕ コーヒー", "🍵 抹茶", "🍩 ドーナツ", "🍰 ケーキ",
    "📱 スマートフォン", "💻 ノートパソコン", "🎧 ヘッドフォン", "⌚ 腕時計",
];

/**
 * おみくじモーダル - GAS完全再現版
 */
export function OmikujiModal({ isOpen, onClose }: OmikujiModalProps) {
    const { addXP } = useGameStore();
    const [result, setResult] = useState<typeof OMIKUJI_RESULTS[0] | null>(null);
    const [luckyItem, setLuckyItem] = useState("");
    const [isDrawing, setIsDrawing] = useState(false);

    // モーダルを開いたときに今日の運勢を決定
    useEffect(() => {
        if (isOpen && !result) {
            // 今日の日付をシードにして結果を固定
            const today = new Date().toDateString();
            const hash = today.split("").reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);

            const resultIndex = Math.abs(hash) % OMIKUJI_RESULTS.length;
            const itemIndex = Math.abs(hash >> 4) % LUCKY_ITEMS.length;

            setResult(OMIKUJI_RESULTS[resultIndex]);
            setLuckyItem(LUCKY_ITEMS[itemIndex]);
        }
    }, [isOpen, result]);

    // おみくじを引く（アニメーション付き）
    const drawOmikuji = () => {
        setIsDrawing(true);
        setTimeout(() => {
            setIsDrawing(false);
            if (result && result.bonus > 0) {
                addXP(result.bonus);
            }
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl w-[350px] text-center overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3">
                    <h3 className="font-bold text-white text-lg">🔮 今日の運勢</h3>
                </div>

                {/* コンテンツ */}
                <div className="p-6">
                    {isDrawing ? (
                        <div className="py-8">
                            <div className="text-4xl animate-bounce">🎴</div>
                            <p className="mt-4 text-gray-500">おみくじを引いています...</p>
                        </div>
                    ) : result ? (
                        <>
                            {/* 運勢結果 */}
                            <div className={`text-5xl font-bold mb-4 ${result.color}`}>
                                {result.result}
                            </div>

                            {/* ラッキーアイテム */}
                            <p className="text-gray-600 mb-4">
                                ラッキーアイテム: {luckyItem}
                            </p>

                            {/* ボーナスXP */}
                            {result.bonus > 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                    <p className="text-yellow-700 font-bold">
                                        🎉 ボーナスXP: +{result.bonus} XP
                                    </p>
                                </div>
                            )}

                            {/* メッセージ */}
                            <p className="text-sm text-gray-500">
                                {result.result === "大吉" && "素晴らしい！今日は最高の1日になりそうです！"}
                                {result.result === "吉" && "良い日になりそうです。頑張りましょう！"}
                                {result.result === "中吉" && "まあまあ良い日です。コツコツ進めましょう。"}
                                {result.result === "小吉" && "悪くない日です。無理せず進めましょう。"}
                                {result.result === "末吉" && "少し注意が必要かも。慎重に行動しましょう。"}
                                {result.result === "凶" && "今日は慎重に。でも明日は良い日かも！"}
                            </p>
                        </>
                    ) : (
                        <div className="py-8">
                            <div className="text-6xl mb-4">🎴</div>
                            <button
                                onClick={drawOmikuji}
                                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors"
                            >
                                おみくじを引く
                            </button>
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="px-4 py-3 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
