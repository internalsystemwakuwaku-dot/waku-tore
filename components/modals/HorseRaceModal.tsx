"use client";

import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/stores/gameStore";

interface HorseRaceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Horse {
    id: number;
    name: string;
    odds: number;
    color: string;
    icon: string;
}

const HORSES: Horse[] = [
    { id: 1, name: "バグスレイヤー", odds: 2.5, color: "bg-red-500", icon: "🐞" },
    { id: 2, name: "デプロイインパクト", odds: 3.8, color: "bg-blue-500", icon: "🚀" },
    { id: 3, name: "コードレビュー", odds: 5.2, color: "bg-green-500", icon: "👓" },
    { id: 4, name: "ムゲンループ", odds: 12.5, color: "bg-yellow-500", icon: "🔄" },
    { id: 5, name: "カミゴッド", odds: 1.8, color: "bg-purple-500", icon: "😇" },
];

/**
 * 競馬モーダル - GAS完全再現版
 * - 投票 -> レース -> 結果発表
 */
export function HorseRaceModal({ isOpen, onClose }: HorseRaceModalProps) {
    const { data, addMoney, addXP } = useGameStore();
    const [phase, setPhase] = useState<"bet" | "race" | "result">("bet");
    const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
    const [betAmount, setBetAmount] = useState<number>(100);

    const [positions, setPositions] = useState<number[]>([0, 0, 0, 0, 0]);
    const [ranks, setRanks] = useState<number[]>([]); // ゴール順に馬IDを格納

    const raceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // リセット
    useEffect(() => {
        if (isOpen && phase === "bet") {
            setPositions([0, 0, 0, 0, 0]);
            setRanks([]);
        }
    }, [isOpen, phase]);

    // クローズ時の処理
    const handleClose = () => {
        if (phase === "race") return; // レース中は閉じられない
        onClose();
        setPhase("bet");
        setPositions([0, 0, 0, 0, 0]);
        setRanks([]);
        setSelectedHorseId(null);
        setBetAmount(100);
    };

    // レース開始
    const startRace = () => {
        if (!selectedHorseId) return;
        if (data.money < betAmount) {
            alert("所持金が足りません！");
            return;
        }

        addMoney(-betAmount);
        setPhase("race");
        setPositions([0, 0, 0, 0, 0]);
        setRanks([]);

        // アニメーション開始
        raceTimerRef.current = setInterval(() => {
            setPositions((prev) => {
                const newPositions = [...prev];
                const finishLine = 100;
                let finishedCount = 0;
                let currentRanks = [...ranks]; // これはstate更新関数内では古い値を参照する可能性があるので注意が必要だが、
                // 今回はsetRanksを別途呼ぶことで対応

                let isRaceRunning = false;

                for (let i = 0; i < 5; i++) {
                    if (newPositions[i] >= finishLine) {
                        finishedCount++;
                        continue;
                    }

                    isRaceRunning = true;
                    // ランダムに進む
                    // オッズが低い（強い）ほど進みやすい補正を入れる？
                    // 今回はカオスにするためほぼランダム + 少しだけ補正
                    const horse = HORSES[i];
                    // 基本速度(0.5-2.0) + オッズ逆補正(オッズ低い = 強い = 速い)
                    // オッズ2.0 -> 補正1.0, オッズ10.0 -> 補正0.2
                    const speed = Math.random() * 1.5 + (2.0 / horse.odds) * 0.5;

                    newPositions[i] += speed;

                    if (newPositions[i] >= finishLine) {
                        newPositions[i] = finishLine;
                        // ゴールした瞬間
                        // setRanksをここで呼ぶためには、stateの外で管理するか、useEffectで監視が必要
                        // 今回は簡易的に、次のrenderサイクルで処理するためにpositionsだけ更新し、
                        // useEffectでranksを更新する
                    }
                }

                if (!isRaceRunning) {
                    if (raceTimerRef.current) clearInterval(raceTimerRef.current);
                    setTimeout(() => setPhase("result"), 1000);
                }

                return newPositions;
            });
        }, 50);
    };

    // 順位判定監視
    useEffect(() => {
        if (phase !== "race") return;

        // ゴールした馬を検知してランクに追加
        const finishedHorses = positions
            .map((pos, idx) => ({ id: HORSES[idx].id, pos }))
            .filter((h) => h.pos >= 100)
            .filter((h) => !ranks.includes(h.id)); // まだランクインしていない

        if (finishedHorses.length > 0) {
            // 複数同時ゴールの場合の処理（今回は単純に検知順）
            setRanks((prev) => [...prev, ...finishedHorses.map(h => h.id)]);
        }
    }, [positions, phase, ranks]);


    // 結果コンポーネント
    const renderResult = () => {
        const winnerId = ranks[0];
        const isWin = winnerId === selectedHorseId;
        const winnerHorse = HORSES.find(h => h.id === winnerId);
        const dividend = isWin ? Math.floor(betAmount * (winnerHorse?.odds || 1)) : 0;

        // 配当付与（初回レンダリング時のみに行う必要があるが、
        // ReactのStrictModeの兼ね合いもあるため、確定ボタン押下時に行うのが安全）

        return (
            <div className="text-center space-y-6">
                <div className="text-6xl animate-bounce">
                    {isWin ? "🎉" : "😢"}
                </div>
                <h2 className="text-2xl font-bold">
                    {isWin ? "的中！おめでとうございます！" : "残念！ハズレ..."}
                </h2>

                <div className="bg-gray-800 rounded p-4 inline-block">
                    <p className="text-gray-400 text-sm">優勝馬</p>
                    <p className="text-xl font-bold text-white flex items-center justify-center gap-2">
                        <span>{winnerHorse?.icon}</span>
                        {winnerHorse?.name}
                    </p>
                </div>

                {isWin && (
                    <div className="text-yellow-400 font-bold text-xl">
                        配当金: +{dividend.toLocaleString()} G
                    </div>
                )}

                <button
                    onClick={() => {
                        if (isWin) {
                            addMoney(dividend);
                            addXP(15); // 勝利XP
                        }
                        handleClose();
                    }}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold shadow-lg transition-transform active:scale-95"
                >
                    {isWin ? "賞金を受け取る" : "閉じる"}
                </button>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-gray-900 w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden text-white border border-gray-700">
                {/* ヘッダー */}
                <div className="bg-green-800 px-6 py-4 flex justify-between items-center shadow-md">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        🐎 わくわくダービー
                    </h2>
                    <div className="bg-black/30 px-3 py-1 rounded text-yellow-400 font-mono font-bold">
                        {data.money.toLocaleString()} G
                    </div>
                </div>

                <div className="p-6 min-h-[400px]">
                    {phase === "bet" && (
                        <div className="space-y-6">
                            <p className="text-center text-gray-300">
                                優勝すると思う馬に賭けてください！
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                {HORSES.map((horse) => (
                                    <button
                                        key={horse.id}
                                        onClick={() => setSelectedHorseId(horse.id)}
                                        className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${selectedHorseId === horse.id
                                                ? "border-yellow-400 bg-yellow-400/20 scale-105"
                                                : "border-gray-700 bg-gray-800 hover:bg-gray-700"
                                            }`}
                                    >
                                        <span className="text-4xl mb-2">{horse.icon}</span>
                                        <span className="font-bold text-sm text-center mb-1">{horse.name}</span>
                                        <span className="text-xs bg-black/50 px-2 py-0.5 rounded text-yellow-300">
                                            x{horse.odds.toFixed(1)}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col items-center gap-4 bg-gray-800 p-6 rounded-xl border border-gray-700">
                                <label className="text-sm font-bold text-gray-400">賭け金</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="100"
                                        max={Math.min(data.money, 10000)}
                                        step="100"
                                        value={betAmount}
                                        onChange={(e) => setBetAmount(Number(e.target.value))}
                                        className="w-64 accent-green-500"
                                    />
                                    <span className="text-xl font-mono font-bold w-24 text-right">
                                        {betAmount} G
                                    </span>
                                </div>
                                <div className="flex gap-2 text-xs">
                                    <button onClick={() => setBetAmount(100)} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">min</button>
                                    <button onClick={() => setBetAmount(Math.min(data.money, 10000))} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600">max</button>
                                </div>
                            </div>

                            <div className="text-center">
                                <button
                                    onClick={startRace}
                                    disabled={!selectedHorseId}
                                    className="px-12 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xl font-bold rounded-full shadow-lg transition-all active:scale-95 disabled:active:scale-100"
                                >
                                    出走！
                                </button>
                                <button onClick={handleClose} className="ml-4 text-gray-400 hover:text-white underline">
                                    やめる
                                </button>
                            </div>
                        </div>
                    )}

                    {phase === "race" && (
                        <div className="space-y-4 py-8 relative">
                            {/* ゴールライン */}
                            <div className="absolute right-8 top-0 bottom-0 w-1 bg-white/20 z-0 flex flex-col justify-center items-center">
                                <span className="bg-gray-900 text-xs px-1 text-gray-500 rotate-90">GOAL</span>
                            </div>

                            {HORSES.map((horse, idx) => (
                                <div key={horse.id} className="relative z-10">
                                    <div className="flex items-center gap-2 mb-1 pl-4">
                                        <span className="text-xs w-24 truncate text-gray-400">{horse.name}</span>
                                    </div>
                                    <div className="h-12 bg-gray-800 mx-4 rounded-full relative overflow-hidden border border-gray-700">
                                        {/* 馬 */}
                                        <div
                                            className="absolute top-0 bottom-0 transition-all duration-75 flex items-center justify-end pr-2"
                                            style={{
                                                left: `${positions[idx]}%`,
                                                width: "60px",
                                                transform: "translateX(-100%)" // 左にあふれないように調整
                                            }}
                                        >
                                            <span className="text-3xl transform -scale-x-100 inline-block">{horse.icon}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {phase === "result" && renderResult()}
                </div>
            </div>
        </div>
    );
}
