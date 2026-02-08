"use client";

import { useEffect, useState, useTransition } from "react";
import { pullGacha } from "@/app/actions/keiba";
import { useGameStore } from "@/stores/gameStore";
import { DEFAULT_GACHA_POOL, RARITY_CONFIG } from "@/types/keiba";
import { getGachaDiscountRate, isBoostActive } from "@/lib/gameEffects";
import type { GachaResult } from "@/types/keiba";

interface GachaModalProps {
    isOpen: boolean;
    userId: string;
    onClose: () => void;
}

export function GachaModal({ isOpen, userId, onClose }: GachaModalProps) {
    if (!isOpen) return null;

    const { data, setData } = useGameStore();
    const [results, setResults] = useState<GachaResult[]>([]);
    const [showResult, setShowResult] = useState(false);
    const [showPoolList, setShowPoolList] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [nowMs, setNowMs] = useState(() => Date.now());

    const pool = DEFAULT_GACHA_POOL;

    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    const activeBoosts = data.activeBoosts || {};
    const discountRate = getGachaDiscountRate(data.inventory || {}, activeBoosts);
    const activeGachaBoosts = [
        { id: "booster_gacha", label: "Gacha Discount", icon: "G" },
        { id: "booster_lucky", label: "Lucky", icon: "L" },
        { id: "booster_lucky2", label: "Lucky+", icon: "L+" },
    ].map((b) => {
        const expiresAt = activeBoosts[b.id];
        const remainingMs = typeof expiresAt === "number" ? Math.max(0, expiresAt - nowMs) : 0;
        return { ...b, remainingMs, active: isBoostActive(activeBoosts, b.id, nowMs) };
    }).filter((b) => b.active);

    const formatRemaining = (ms: number) => {
        const totalSec = Math.max(0, Math.floor(ms / 1000));
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${String(sec).padStart(2, "0")}`;
    };

    // 履歴を取得
    const fetchHistory = async () => {
        try {
            const { getGachaHistory } = await import("@/app/actions/keiba");
            const records = await getGachaHistory(userId);
            setHistory(records);
            setShowHistory(true);
            setShowPoolList(false);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    };

    // ガチャを回す
    const handlePull = (count: number) => {
        const cost = Math.floor(pool.cost * count * discountRate);
        if (data.money < cost) {
            alert("所持金が不足しています");
            return;
        }

        setIsRolling(true);

        startTransition(async () => {
            const result = await pullGacha(userId, pool.id, count);

            // アニメーション待ち
            await new Promise((resolve) => setTimeout(resolve, 1500));

            if (result.success && result.results) {
                setResults(result.results);
                setShowResult(true);
                setData({ ...data, money: data.money - cost });
            } else {
                alert("エラー: " + result.error);
            }

            setIsRolling(false);
        });
    };

    // 結果をリセット
    const handleContinue = () => {
        setShowResult(false);
        setResults([]);
    };

    const getRarityStyle = (rarity: string) => {
        const config = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG];
        return {
            backgroundColor: `${config?.color}20` || "",
            borderColor: config?.color || "",
            color: config?.color || "",
        };
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🎰</span>
                        <div>
                            <h2 className="text-lg font-bold text-white max-w-[200px] truncate">{pool.name}</h2>
                            <p className="text-sm text-white/70">
                                💰 {data.money.toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isRolling && !showResult && (
                            <>
                                <button
                                    onClick={() => {
                                        if (showHistory) {
                                            setShowHistory(false);
                                        } else {
                                            fetchHistory();
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs text-white transition-colors"
                                >
                                    {showHistory ? "戻る" : "履歴"}
                                </button>
                                <button
                                    onClick={() => setShowPoolList(!showPoolList)}
                                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs text-white transition-colors"
                                >
                                    {showPoolList ? "戻る" : "提供割合"}
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* コンテンツ */}
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {showHistory ? (
                        // 履歴リスト
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-white text-center mb-6">
                                📜 ガチャ履歴 (直近50件)
                            </h3>
                            <div className="space-y-2">
                                {history.map((record) => {
                                    const item = pool.items.find((i) => i.id === record.itemId);
                                    const date = new Date(record.createdAt).toLocaleString("ja-JP");
                                    const rarityConfig = RARITY_CONFIG[record.rarity as keyof typeof RARITY_CONFIG];

                                    return (
                                        <div key={record.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{item?.icon || "❓"}</span>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white text-sm">
                                                            {item?.name || record.itemId}
                                                        </span>
                                                        <span
                                                            className="text-xs px-1.5 py-0.5 rounded border"
                                                            style={{
                                                                color: rarityConfig?.color,
                                                                borderColor: rarityConfig?.color,
                                                                backgroundColor: `${rarityConfig?.color}20`
                                                            }}
                                                        >
                                                            {record.rarity}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-white/40">{date}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {history.length === 0 && (
                                    <p className="text-center text-white/50 py-8">履歴がありません</p>
                                )}
                            </div>
                            <button
                                onClick={() => setShowHistory(false)}
                                className="w-full mt-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors"
                            >
                                戻る
                            </button>
                        </div>
                    ) : showPoolList ? (
                        // 提供割合リスト
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-white text-center mb-6">
                                📊 提供割合一覧
                            </h3>
                            {["UR", "SSR", "SR", "R", "N"].map((rarity) => {
                                const items = pool.items.filter((i) => i.rarity === rarity);
                                if (items.length === 0) return null;
                                const config = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG];
                                return (
                                    <div key={rarity} className="space-y-3">
                                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                                            <span
                                                className="px-2 py-0.5 rounded text-xs font-bold"
                                                style={{
                                                    backgroundColor: `${config.color}20`,
                                                    color: config.color,
                                                    border: `1px solid ${config.color}`,
                                                }}
                                            >
                                                {rarity}
                                            </span>
                                            <span className="text-white/60 text-sm">
                                                合計期待値: {items.reduce((sum, i) => sum + i.dropRate, 0).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                                >
                                                    <span className="text-2xl">{item.icon}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline justify-between">
                                                            <span className="font-bold text-white text-sm truncate">
                                                                {item.name}
                                                            </span>
                                                            <span className="text-white/60 text-xs font-mono ml-2">
                                                                {item.dropRate}%
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-white/40 truncate">
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            <button
                                onClick={() => setShowPoolList(false)}
                                className="w-full mt-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors"
                            >
                                戻る
                            </button>
                        </div>
                    ) : isRolling ? (
                        // ガチャ演出
                        <div className="text-center py-12">
                            <div className="text-8xl animate-bounce mb-4">🎰</div>
                            <p className="text-xl text-white font-bold">ガチャ中...</p>
                            <div className="flex justify-center gap-2 mt-4">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"
                                        style={{ animationDelay: `${i * 0.2}s` }}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : showResult ? (
                        // 結果表示
                        <div className="py-4">
                            <h3 className="text-xl font-bold text-white text-center mb-6">
                                🎊 結果発表 🎊
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {results.map((result, index) => (
                                    <div
                                        key={index}
                                        className="rounded-xl p-4 border-2 flex items-center gap-4 animate-fade-in"
                                        style={{
                                            ...getRarityStyle(result.item.rarity),
                                            animationDelay: `${index * 0.1}s`,
                                        }}
                                    >
                                        <span className="text-4xl">{result.item.icon}</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-white">{result.item.name}</p>
                                                <span
                                                    className="text-xs px-2 py-0.5 rounded font-bold"
                                                    style={getRarityStyle(result.item.rarity)}
                                                >
                                                    {result.item.rarity}
                                                </span>
                                                {result.isNew && (
                                                    <span className="text-xs bg-green-500/30 text-green-400 px-2 py-0.5 rounded">
                                                        NEW!
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-white/60">
                                                {result.item.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={handleContinue}
                                className="w-full mt-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-colors"
                            >
                                続ける
                            </button>
                        </div>
                    ) : (
                        // メイン画面
                        <>
                            <div className="text-center mb-6">
                                <div className="text-6xl mb-2">{pool.banner}</div>
                                <p className="text-white/60 text-sm">{pool.description}</p>
                            </div>
                            {activeGachaBoosts.length > 0 && (
                                <div className="mb-6 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                                    <div className="text-xs text-white/60 mb-2">????????</div>
                                    <div className="flex flex-wrap gap-2">
                                        {activeGachaBoosts.map((b) => (
                                            <div key={b.id} className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-200 border border-amber-500/30 rounded-full px-2 py-1">
                                                <span>{b.icon}</span>
                                                <span>{b.label}</span>
                                                <span className="font-mono">{formatRemaining(b.remainingMs)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* レートテーブル */}
                            <div className="bg-white/5 rounded-xl p-4 mb-6">
                                <p className="text-xs text-white/60 mb-2">排出率</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(RARITY_CONFIG).map(([rarity, config]) => (
                                        <div
                                            key={rarity}
                                            className="flex items-center gap-1 text-xs"
                                        >
                                            <span
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: config.color }}
                                            />
                                            <span className="text-white/60">{rarity}</span>
                                            <span style={{ color: config.color }}>{config.rate}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ガチャボタン */}
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => handlePull(1)}
                                    disabled={isPending || data.money < Math.floor(pool.cost * discountRate)}
                                    className="py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                                >
                                    <span className="text-2xl block">🎰</span>
                                    <span>1回ガチャ</span>
                                    <span className="block text-sm text-white/70">
                                        💰 {pool.cost}
                                    </span>
                                </button>
                                <button
                                    onClick={() => handlePull(10)}
                                    disabled={isPending || data.money < Math.floor(pool.cost * 10 * discountRate)}
                                    className="py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                                >
                                    <span className="text-2xl block">🎰✨</span>
                                    <span>10連ガチャ</span>
                                    <span className="block text-sm text-white/70">
                                        💰 {pool.cost * 10}
                                    </span>
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* フッター */}
                <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
