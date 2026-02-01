"use client";

import { useState, useTransition } from "react";
import { createRace, runRace } from "@/app/actions/keiba";
import { useGameStore } from "@/stores/gameStore";
import type { Race, Horse, Bet, RaceResult } from "@/types/keiba";

interface KeibaModalProps {
    userId: string;
    onClose: () => void;
}

export function KeibaModal({ userId, onClose }: KeibaModalProps) {
    const { data, setData } = useGameStore();
    const [race, setRace] = useState<Race | null>(null);
    const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
    const [betAmount, setBetAmount] = useState<number>(100);
    const [result, setResult] = useState<RaceResult | null>(null);
    const [isRacing, setIsRacing] = useState(false);
    const [isPending, startTransition] = useTransition();

    // 新しいレースを開始
    const handleNewRace = () => {
        startTransition(async () => {
            const newRace = await createRace(userId);
            setRace(newRace);
            setSelectedHorse(null);
            setResult(null);
        });
    };

    // レースを実行
    const handleRunRace = () => {
        if (!race || selectedHorse === null || betAmount <= 0) return;

        if (data.money < betAmount) {
            alert("所持金が不足しています");
            return;
        }

        const bet: Bet = { horseId: selectedHorse, amount: betAmount };

        setIsRacing(true);

        startTransition(async () => {
            try {
                const raceResult = await runRace(userId, race.id, bet);

                // アニメーション待ち
                await new Promise((resolve) => setTimeout(resolve, 2000));

                setResult(raceResult);
                setIsRacing(false);

                // ストアの所持金を更新
                const newMoney = data.money - bet.amount + raceResult.payout;
                setData({ ...data, money: newMoney });
            } catch (e) {
                alert("エラー: " + (e instanceof Error ? e.message : String(e)));
                setIsRacing(false);
            }
        });
    };

    const getHorseStyle = (horse: Horse) => ({
        borderColor: horse.color,
        backgroundColor: `${horse.color}20`,
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🏇</span>
                        <div>
                            <h2 className="text-lg font-bold text-white">わくわく競馬</h2>
                            <p className="text-sm text-white/70">
                                💰 {data.money.toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {!race ? (
                        // レース未開始
                        <div className="text-center py-12">
                            <span className="text-6xl block mb-4">🏇</span>
                            <h3 className="text-xl font-bold text-white mb-2">
                                レースを開始しよう！
                            </h3>
                            <p className="text-white/60 mb-6">
                                馬を選んで賭けると、レースが始まります
                            </p>
                            <button
                                onClick={handleNewRace}
                                disabled={isPending}
                                className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg transition-colors disabled:opacity-50"
                            >
                                {isPending ? "準備中..." : "新しいレース"}
                            </button>
                        </div>
                    ) : result ? (
                        // レース結果
                        <div className="text-center py-8">
                            <span className="text-6xl block mb-4">
                                {result.isWin ? "🎉" : "😢"}
                            </span>
                            <h3 className="text-2xl font-bold text-white mb-2">
                                {result.isWin ? "勝利！" : "残念..."}
                            </h3>
                            <p className="text-white/70 mb-4">
                                勝者: <span className="text-yellow-400 font-bold">{result.winnerName}</span>
                            </p>
                            {result.isWin && (
                                <p className="text-3xl font-bold text-green-400 mb-6">
                                    +{result.payout.toLocaleString()} 💰
                                </p>
                            )}
                            <button
                                onClick={handleNewRace}
                                disabled={isPending}
                                className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                            >
                                もう一度
                            </button>
                        </div>
                    ) : (
                        // 馬選択・賭け
                        <>
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-white">{race.name}</h3>
                                <p className="text-white/60 text-sm">出走馬を選んでください</p>
                            </div>

                            {/* 馬リスト */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {race.horses.map((horse) => (
                                    <button
                                        key={horse.id}
                                        onClick={() => setSelectedHorse(horse.id)}
                                        disabled={isRacing}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${selectedHorse === horse.id
                                                ? "ring-2 ring-green-400 scale-105"
                                                : "hover:scale-102"
                                            } ${isRacing ? "animate-pulse" : ""}`}
                                        style={getHorseStyle(horse)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">🏇</span>
                                            <div>
                                                <p className="font-bold text-white">{horse.name}</p>
                                                <p className="text-sm text-white/70">
                                                    オッズ: <span className="text-yellow-400">{horse.odds}倍</span>
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* 賭け金入力 */}
                            {selectedHorse !== null && (
                                <div className="bg-white/5 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-white/60 mb-2">賭け金</p>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="number"
                                            value={betAmount}
                                            onChange={(e) => setBetAmount(Math.max(10, Number(e.target.value)))}
                                            min={10}
                                            max={data.money}
                                            className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-lg focus:outline-none focus:border-green-400"
                                        />
                                        <div className="flex gap-2">
                                            {[100, 500, 1000].map((amount) => (
                                                <button
                                                    key={amount}
                                                    onClick={() => setBetAmount(amount)}
                                                    disabled={data.money < amount}
                                                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm transition-colors disabled:opacity-30"
                                                >
                                                    {amount}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-white/40 mt-2">
                                        予想配当: {Math.floor(betAmount * (race.horses.find((h) => h.id === selectedHorse)?.odds || 0)).toLocaleString()}
                                    </p>
                                </div>
                            )}

                            {/* レーススタート */}
                            {selectedHorse !== null && (
                                <button
                                    onClick={handleRunRace}
                                    disabled={isRacing || isPending || betAmount > data.money}
                                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50"
                                >
                                    {isRacing ? "🏃 レース中..." : "🚀 スタート！"}
                                </button>
                            )}
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
