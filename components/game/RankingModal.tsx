"use client";

import { useState, useEffect } from "react";
import { getXpRanking, getMoneyRanking, getDebtRanking, getPayoutRanking } from "@/app/actions/game";
import type { RankingEntry } from "@/types/game";

interface RankingModalProps {
    isOpen: boolean;
    currentUserId: string;
    onClose: () => void;
}

export function RankingModal({ isOpen, currentUserId, onClose }: RankingModalProps) {
    if (!isOpen) return null;

    const [activeTab, setActiveTab] = useState<"xp" | "money" | "debt" | "payout">("xp");
    const [xpRanking, setXpRanking] = useState<RankingEntry[]>([]);
    const [moneyRanking, setMoneyRanking] = useState<RankingEntry[]>([]);
    const [debtRanking, setDebtRanking] = useState<RankingEntry[]>([]);
    const [payoutRanking, setPayoutRanking] = useState<RankingEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadRankings();
    }, []);

    const loadRankings = async () => {
        setIsLoading(true);
        try {
            const [xp, money, debt, payout] = await Promise.all([
                getXpRanking(20),
                getMoneyRanking(20),
                getDebtRanking(20),
                getPayoutRanking(20),
            ]);
            setXpRanking(xp);
            setMoneyRanking(money);
            setDebtRanking(debt);
            setPayoutRanking(payout);
        } catch (e) {
            console.error("ランキング取得エラー:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const getRankIcon = (rank: number) => {
        if (rank === 1) return "🥇";
        if (rank === 2) return "🥈";
        if (rank === 3) return "🥉";
        return `${rank}`;
    };

    const getRankStyle = (rank: number) => {
        if (rank === 1) return "bg-yellow-500/20 border-yellow-500/50";
        if (rank === 2) return "bg-gray-400/20 border-gray-400/50";
        if (rank === 3) return "bg-orange-500/20 border-orange-500/50";
        return "bg-white/5 border-white/10";
    };

    let activeRanking: RankingEntry[] = [];
    if (activeTab === "xp") activeRanking = xpRanking;
    if (activeTab === "money") activeRanking = moneyRanking;
    if (activeTab === "debt") activeRanking = debtRanking;
    if (activeTab === "payout") activeRanking = payoutRanking;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🏆</span>
                        <h2 className="text-lg font-bold text-white">ランキング</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* タブ */}
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => setActiveTab("xp")}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "xp"
                            ? "text-indigo-400 border-b-2 border-indigo-400"
                            : "text-white/60 hover:text-white"
                            }`}
                    >
                        ⭐ XPランキング
                    </button>
                    <button
                        onClick={() => setActiveTab("money")}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "money"
                            ? "text-yellow-400 border-b-2 border-yellow-400"
                            : "text-white/60 hover:text-white"
                            }`}
                    >
                        💰 所持金
                    </button>
                    <button
                        onClick={() => setActiveTab("debt")}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "debt"
                            ? "text-red-400 border-b-2 border-red-400"
                            : "text-white/60 hover:text-white"
                            }`}
                    >
                        💸 借金王
                    </button>
                    <button
                        onClick={() => setActiveTab("payout")}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "payout"
                            ? "text-green-400 border-b-2 border-green-400"
                            : "text-white/60 hover:text-white"
                            }`}
                    >
                        🎯 高配当
                    </button>
                </div>

                {/* ランキングリスト */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin h-6 w-6 border-2 border-indigo-400 border-t-transparent rounded-full" />
                        </div>
                    ) : activeRanking.length === 0 ? (
                        <div className="text-center text-white/50 py-8">
                            <p className="text-3xl mb-2">📊</p>
                            <p>まだランキングデータがありません</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {activeRanking.map((entry) => (
                                <div
                                    key={entry.userId}
                                    className={`rounded-lg p-3 border flex items-center gap-3 transition-all ${getRankStyle(
                                        entry.rank
                                    )} ${entry.userId === currentUserId
                                        ? "ring-2 ring-blue-400"
                                        : ""
                                        }`}
                                >
                                    {/* ランク */}
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold">
                                        {getRankIcon(entry.rank)}
                                    </div>

                                    {/* ユーザー情報 */}
                                    <div className="flex-1">
                                        <p className="font-medium text-white">
                                            {entry.userName}
                                            {entry.userId === currentUserId && (
                                                <span className="ml-2 text-xs bg-blue-500/30 text-blue-400 px-2 py-0.5 rounded">
                                                    あなた
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    {/* 値 */}
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-white">
                                            {activeTab === "xp" ? "⭐" : "💰"}{" "}
                                            {entry.value.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
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
