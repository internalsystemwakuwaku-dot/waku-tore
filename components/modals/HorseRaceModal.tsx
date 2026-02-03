"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/stores/gameStore";
import { getActiveRace, placeBet, cancelBet } from "@/app/actions/keiba";
import { getGameData } from "@/app/actions/game";
import type { Race, Bet, Horse } from "@/types/keiba";

import { useSound } from "@/lib/sound/SoundContext";

interface HorseRaceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function HorseRaceModal({ isOpen, onClose }: HorseRaceModalProps) {
    const { data: gameUser, setData } = useGameStore();
    const { playSe, playBgm, stopBgm } = useSound();
    const [race, setRace] = useState<Race | null>(null);
    const [myBets, setMyBets] = useState<Bet[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // UI State
    const [betType, setBetType] = useState<"WIN" | "PLACE">("WIN"); // 単勝 | 複勝
    const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
    const [betAmount, setBetAmount] = useState<number>(100);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    // M-20: Results Tab
    const [tab, setTab] = useState<"bet" | "result">("bet");
    const [todayResults, setTodayResults] = useState<{ race: Race; results: string[] }[]>([]);

    useEffect(() => {
        if (tab === "result") {
            // Fetch results
            import("@/app/actions/keiba").then(({ getTodayRaceResults }) => {
                getTodayRaceResults().then(res => {
                    setTodayResults(res);
                });
            });
        }
    }, [tab]);

    // Animation State
    const [phase, setPhase] = useState<"loading" | "betting" | "racing" | "result">("loading");
    const [positions, setPositions] = useState<number[]>([0, 0, 0, 0, 0, 0]);
    const raceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Initial Fetch
    const fetchRace = useCallback(async () => {
        setIsLoading(true);
        try {
            const { race: fetchedRace, myBets: fetchedBets } = await getActiveRace(gameUser.userId);
            setRace(fetchedRace);
            setMyBets(fetchedBets);

            // Determine Phase
            if (fetchedRace.status === "finished") {
                if (phase !== "racing") {
                    setPhase("result");
                }
            } else if (fetchedRace.status === "waiting") {
                const now = new Date();
                const scheduled = new Date(fetchedRace.startedAt!);
                if (now >= scheduled) {
                    setPhase("racing");
                } else {
                    setPhase("betting");
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameUser.userId]); // Phase excluded to avoid loop, verified safe as phase changes trigger re-eval via useEffect

    useEffect(() => {
        if (isOpen) {
            fetchRace();
            const timer = setInterval(() => setCurrentTime(new Date()), 1000);
            return () => clearInterval(timer);
        }
    }, [isOpen, fetchRace]);

    // Handle Closing
    const handleClose = () => {
        if (phase === "racing") return;
        onClose();
        // 状態を完全にリセット
        setPhase("loading");
        setSelectedHorseId(null);
        setMyBets([]);
        setPositions([0, 0, 0, 0, 0, 0]);
        setTab("bet");
        setBetAmount(100);
        setBetType("WIN");
        // raceTimerをクリア
        if (raceTimerRef.current) {
            clearInterval(raceTimerRef.current);
            raceTimerRef.current = null;
        }
    };



    // Rigged Animation
    const startRiggedAnimation = useCallback((winnerId: number, horses: Horse[]) => {
        const raceDuration = 10000;
        const interval = 50;
        const steps = raceDuration / interval;
        let currentStep = 0;

        if (raceTimerRef.current) clearInterval(raceTimerRef.current);

        raceTimerRef.current = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps; // 0 to 1

            setPositions(prev => {
                // Initialize if empty
                if (prev.length === 0) return Array(horses.length).fill(0);

                return horses.map((h, idx) => {
                    const isWinner = h.id === winnerId;

                    // Curve: Slow start, fast middle, sprint end
                    let p = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

                    // Randomness
                    p += (Math.random() - 0.5) * 0.05;

                    // Convergence at end
                    if (progress > 0.9) {
                        const target = isWinner ? 100 : 90 + ((h.id * 17) % 8);
                        const current = prev[idx] || (p * 100);
                        // Lerp to target
                        return current + (target - current) * 0.1;
                    }

                    return Math.min(100, Math.max(0, p * 100));
                });
            });

            if (currentStep >= steps) {
                if (raceTimerRef.current) clearInterval(raceTimerRef.current);
                setTimeout(() => setPhase("result"), 2000);
            }
        }, interval);
    }, []);

    // Poll logic
    useEffect(() => {
        let pollTimer: NodeJS.Timeout;
        let isPolling = false; // 重複ポーリング防止フラグ

        if (phase === "racing") {
            playBgm("race");
            // If we just entered racing phase, start polling for result
            pollTimer = setInterval(async () => {
                // 既にポーリング中なら次のポーリングをスキップ
                if (isPolling) return;
                isPolling = true;

                try {
                    const { race: latestRace, myBets: latestBets } = await getActiveRace(gameUser.userId);
                    if (latestRace.status === "finished" && latestRace.winnerId) {
                        clearInterval(pollTimer);
                        setRace(latestRace);
                        setMyBets(latestBets);
                        startRiggedAnimation(latestRace.winnerId, latestRace.horses); // Pass horses explicitly

                        // Payout refresh
                        try {
                            const updatedUser = await getGameData(gameUser.userId);
                            setData(updatedUser);
                        } catch (e) {
                            console.error("[HorseRaceModal] Failed to refresh user data:", e);
                        }
                    }
                } catch (e) {
                    console.error("[HorseRaceModal] Polling error:", e);
                    // エラーが発生してもポーリングを継続（一時的なネットワークエラー対策）
                } finally {
                    isPolling = false;
                }
            }, 3000);
        } else if (phase === "result") {
            stopBgm();
            playSe("fanfare");
        } else {
            // betting
            playBgm("home"); // Assuming home BGM or maybe shop/custom for betting?
        }
        return () => {
            clearInterval(pollTimer);
            if (!isOpen) stopBgm();
        };
    }, [phase, gameUser.userId, isOpen, playBgm, playSe, stopBgm, setData, startRiggedAnimation]);

    // Place Bet
    const handleBet = async () => {
        if (!race || !selectedHorseId || isLoading) return;

        setIsLoading(true);
        playSe("decide");

        try {
            // 選択された馬のオッズを取得
            const selectedHorse = horses.find(h => h.id === selectedHorseId);
            const currentOdds = betType === "WIN"
                ? (selectedHorse?.odds || 2.0)
                : Math.max(1.0, (selectedHorse?.odds || 3.0) / 3);

            // ベット時のオッズをdetailsに含める
            const betDetails = JSON.stringify({
                horses: [selectedHorseId],
                odds: currentOdds
            });

            const result = await placeBet(gameUser.userId, race.id, [{
                type: betType,
                mode: "NORMAL",
                horseId: selectedHorseId,
                details: betDetails,
                amount: betAmount
            }]);

            if (result.success) {
                if (typeof result.newBalance === 'number') {
                    setData({ ...gameUser, money: result.newBalance });
                }
                await fetchRace();
                playSe("coin");
                alert("投票しました！");
                setSelectedHorseId(null);
            } else {
                playSe("cancel");
                alert(result.error || "投票に失敗しました");
            }
        } catch (e) {
            console.error(e);
            playSe("cancel");
            alert("エラーが発生しました");
        } finally {
            setIsLoading(false);
        }
    };

    // Cancel Bet
    const handleCancelBet = async (betId: string) => {
        if (isLoading) return; // 連打防止
        if (!confirm("この投票を取り消しますか？\n（返金されます）")) return;

        setIsLoading(true);
        try {
            const result = await cancelBet(gameUser.userId, betId);
            if (result.success) {
                if (typeof result.newBalance === 'number') {
                    setData({ ...gameUser, money: result.newBalance });
                }
                await fetchRace();
                playSe("coin"); // 返金音としてコイン音使用
                alert("投票を取り消しました");
            } else {
                playSe("cancel");
                alert(result.error || "取り消しに失敗しました");
            }
        } catch (e) {
            console.error(e);
            alert("エラーが発生しました");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const horses = race?.horses || [];
    const scheduledTime = race?.startedAt ? new Date(race.startedAt) : null;
    const timeDiff = scheduledTime ? Math.max(0, Math.floor((scheduledTime.getTime() - currentTime.getTime()) / 1000)) : 0;
    const minutes = Math.floor(timeDiff / 60);
    const seconds = timeDiff % 60;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm">
            <div className="bg-gray-900 w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden text-white border border-gray-700 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-900 to-gray-900 px-6 py-4 flex justify-between items-center shadow-md border-b border-gray-700">
                    <div className="flex items-center gap-4">
                        <span className="text-3xl">🐎</span>
                        <div>
                            <h2 className="text-2xl font-bold font-mono tracking-wider">
                                {race?.name || "Loading..."}
                            </h2>
                            <p className="text-xs text-green-400 font-mono">
                                GLOBAL SERVER • CONNECTED
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Timer */}
                        {phase === "betting" && (
                            <div className="text-center">
                                <p className="text-xs text-gray-400 mb-1">ENTRY CLOSES IN</p>
                                <div className={`text-3xl font-mono font-bold ${timeDiff < 60 ? "text-red-500 animate-pulse" : "text-white"}`}>
                                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                                </div>
                            </div>
                        )}

                        <div className="bg-black/50 px-4 py-2 rounded-lg border border-yellow-500/30">
                            <p className="text-xs text-yellow-500 mb-1">WALLET</p>
                            <p className="text-xl font-mono font-bold text-yellow-400">
                                {gameUser.money.toLocaleString()} G
                            </p>
                        </div>

                        <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                            <span className="text-2xl">×</span>
                        </button>
                    </div>
                </div>

                {/* M-20/M-21 Tabs */}
                {phase !== "racing" && (
                    <div className="flex border-b border-gray-700 bg-gray-900 text-sm">
                        <button onClick={() => setTab("bet")} className={`flex-1 py-3 font-bold transition-colors ${tab === "bet" ? "bg-gray-800 text-white border-b-2 border-yellow-500" : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"}`}>投票</button>
                        <button onClick={() => setTab("result")} className={`flex-1 py-3 font-bold transition-colors ${tab === "result" ? "bg-gray-800 text-white border-b-2 border-yellow-500" : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"}`}>本日の結果</button>
                    </div>
                )}

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {tab === "bet" ? (
                        <>
                            {/* Loading State */}
                            {isLoading && !race && (
                                <div className="h-full flex items-center justify-center">
                                    <div className="animate-spin text-4xl">↻</div>
                                </div>
                            )}

                            {/* Betting Phase */}
                            {phase === "betting" && race && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 space-y-4">
                                        <div className="flex justify-between items-end mb-2">
                                            <div className="flex gap-4 items-center">
                                                <h3 className="text-lg font-bold border-l-4 border-green-500 pl-3">出走馬一覧</h3>
                                                <div className="flex bg-gray-800 rounded-lg p-1">
                                                    <button
                                                        onClick={() => setBetType("WIN")}
                                                        className={`px-3 py-1 text-xs rounded ${betType === "WIN" ? "bg-yellow-500 text-black font-bold" : "text-gray-400"}`}
                                                    >
                                                        単勝 (WIN)
                                                    </button>
                                                    <button
                                                        onClick={() => setBetType("PLACE")}
                                                        className={`px-3 py-1 text-xs rounded ${betType === "PLACE" ? "bg-yellow-500 text-black font-bold" : "text-gray-400"}`}
                                                    >
                                                        複勝 (PLACE)
                                                    </button>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-400">※1着を予想（単勝） / 3着以内を予想（複勝）</span>
                                        </div>

                                        <div className="grid gap-3">
                                            {horses.map((horse) => (
                                                <button
                                                    key={horse.id}
                                                    onClick={() => setSelectedHorseId(horse.id)}
                                                    className={`relative group flex items-center p-4 rounded-xl border transition-all duration-200 ${selectedHorseId === horse.id
                                                        ? "border-yellow-400 bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.3)] translate-x-1"
                                                        : "border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-500"
                                                        }`}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-white text-gray-900 font-bold flex items-center justify-center mr-4 shadow-sm">
                                                        {horse.id}
                                                    </div>

                                                    <div className="flex-1 text-left">
                                                        <div className="font-bold text-lg group-hover:text-yellow-300 transition-colors">
                                                            {horse.name}
                                                        </div>
                                                        <div className="text-xs text-gray-400 flex gap-2">
                                                            <span style={{ color: horse.color }}>●</span>
                                                            <span>Condition: Excellent</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-right px-4">
                                                        <div className="text-xs text-gray-500">ODDS</div>
                                                        <div className="text-2xl font-mono font-bold text-yellow-400">
                                                            {betType === "WIN"
                                                                ? horse.odds.toFixed(1)
                                                                : Math.max(1.0, horse.odds / 3).toFixed(1)}
                                                        </div>
                                                    </div>

                                                    {selectedHorseId === horse.id && (
                                                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-yellow-400 rounded-r-xl"></div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-gray-800/80 rounded-xl p-6 border border-gray-700/50 flex flex-col h-fit sticky top-0">
                                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                            <span className="text-xl">🎫</span> 投票パネル
                                        </h3>

                                        {selectedHorseId ? (
                                            <div className="space-y-6 flex-1">
                                                <div className="bg-black/30 p-4 rounded-lg">
                                                    <div className="text-sm text-gray-400 mb-1">
                                                        Selected ({betType})
                                                    </div>
                                                    <div className="text-xl font-bold text-white">
                                                        {horses.find(h => h.id === selectedHorseId)?.name}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-gray-400">BET AMOUNT</label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="range"
                                                            min="100"
                                                            max={Math.min(gameUser.money, 100000)}
                                                            step="100"
                                                            value={betAmount}
                                                            onChange={(e) => setBetAmount(Number(e.target.value))}
                                                            className="flex-1 accent-yellow-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setBetAmount(Math.max(100, betAmount - 100))} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">-100</button>
                                                            <button onClick={() => setBetAmount(Math.min(gameUser.money, betAmount + 100))} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">+100</button>
                                                        </div>
                                                        <span className="text-2xl font-mono font-bold text-white">
                                                            {betAmount.toLocaleString()} G
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="pt-4 border-t border-gray-700">
                                                    <div className="flex justify-between text-sm mb-2">
                                                        <span className="text-gray-400">予想払戻金</span>
                                                        <span className="text-yellow-400 font-bold">
                                                            {(() => {
                                                                const selectedHorse = horses.find(h => h.id === selectedHorseId);
                                                                const odds = betType === "WIN"
                                                                    ? (selectedHorse?.odds || 2.0)
                                                                    : Math.max(1.0, (selectedHorse?.odds || 3.0) / 3);
                                                                return Math.floor(betAmount * odds).toLocaleString();
                                                            })()} G
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={handleBet}
                                                        disabled={isLoading}
                                                        className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-lg shadow-lg transform transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isLoading ? "処理中..." : "投票する"}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 rounded-lg p-8">
                                                <span className="text-4xl mb-4">👈</span>
                                                <p>右の一覧から</p>
                                                <p>馬を選択してください</p>
                                            </div>
                                        )}

                                        {myBets.length > 0 && (
                                            <div className="mt-6 pt-6 border-t border-gray-700">
                                                <h4 className="font-bold text-sm text-gray-400 mb-3">MY BETS (Total: {myBets.length})</h4>
                                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                                    {myBets.map(bet => {
                                                        const h = horses.find(h => h.id === bet.horseId);
                                                        return (
                                                            <div key={bet.id} className="flex justify-between items-center text-xs bg-gray-900/50 p-2 rounded border border-gray-700">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-1 rounded ${bet.type === "WIN" ? "bg-yellow-500/20 text-yellow-500" : "bg-blue-500/20 text-blue-500"}`}>
                                                                        {bet.type.substring(0, 1)}
                                                                    </span>
                                                                    <span>{h?.name || `Horse #${bet.horseId}`}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono text-gray-300">{bet.amount.toLocaleString()}</span>
                                                                    {phase === "betting" && bet.id && (
                                                                        <button
                                                                            onClick={() => handleCancelBet(bet.id as string)}
                                                                            className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                                                            title="取り消し"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {(phase === "racing" || phase === "result") && (
                                <div className="h-full flex flex-col">
                                    {/* Race Track */}
                                    <div className="flex-1 relative flex flex-col justify-center gap-4 py-8">
                                        <div className="absolute right-16 top-0 bottom-0 w-1 bg-white/20 z-0 flex flex-col justify-center items-center">
                                            <span className="bg-gray-900 text-xs px-1 text-gray-500 rotate-90">GOAL</span>
                                        </div>

                                        {horses.map((horse, idx) => (
                                            <div key={horse.id} className="relative z-10 mx-8">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs w-24 truncate text-gray-400">{horse.name}</span>
                                                </div>
                                                <div className="h-12 bg-gray-800 rounded-full relative overflow-hidden border border-gray-700">
                                                    <div
                                                        className="absolute top-0 bottom-0 transition-transform duration-[50ms] ease-linear flex items-center justify-end pr-2"
                                                        style={{
                                                            width: "100%",
                                                            transform: `translateX(-${100 - (positions[idx] || 0)}%)`
                                                        }}
                                                    >
                                                        <span className="text-3xl transform -scale-x-100 inline-block filter drop-shadow-lg">
                                                            {phase === "result" && race?.winnerId === horse.id ? "👑" : "🏇"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {phase === "racing" && !race?.winnerId && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 backdrop-blur-sm">
                                                <div className="text-center">
                                                    <div className="text-4xl animate-bounce mb-2">📡</div>
                                                    <p className="text-yellow-400 font-bold">WAITING FOR SATELLITE FEED...</p>
                                                </div>
                                            </div>
                                        )}

                                        {phase === "result" && (
                                            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 animate-in fade-in zoom-in duration-300">
                                                <div className="p-8 bg-gray-900 rounded-2xl border-2 border-yellow-500 text-center shadow-[0_0_100px_rgba(234,179,8,0.3)] max-w-md w-full">
                                                    <h2 className="text-2xl font-bold text-white mb-6 tracking-widest">RESULT</h2>

                                                    <div className="text-6xl mb-6 animate-bounce">
                                                        {myBets.some(b => b.payout! > 0) ? "🎉" : "💀"}
                                                    </div>

                                                    <div className="mb-8">
                                                        <p className="text-gray-400 text-xs mb-1">WINNER</p>
                                                        <p className="text-3xl font-bold text-white">
                                                            {horses.find(h => h.id === race?.winnerId)?.name}
                                                        </p>
                                                    </div>

                                                    <div className="py-4 border-t border-gray-800 bg-gray-800/50 rounded-lg mb-6">
                                                        <p className="text-sm text-gray-400 mb-1">TOTAL PAYOUT</p>
                                                        <p className="text-4xl font-mono font-bold text-yellow-400">
                                                            {myBets.reduce((sum, b) => sum + (b.payout || 0), 0).toLocaleString()} G
                                                        </p>
                                                    </div>

                                                    <button onClick={handleClose} className="w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors">
                                                        閉じる
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="text-white font-bold text-lg mb-2">今日のレース結果一覧 (M-20)</h3>
                            {todayResults.length === 0 ? (
                                <div className="text-gray-500 text-center py-10">データ取得中、または結果がありません</div>
                            ) : (
                                todayResults.map((r, i) => (
                                    <div key={i} className="bg-gray-800 p-4 rounded border border-gray-700">
                                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                                            <span>{new Date(r.race.startedAt!).toLocaleTimeString()}</span>
                                            <span className={r.race.status === "finished" ? "text-green-500" : "text-gray-500"}>{r.race.status}</span>
                                        </div>
                                        <h4 className="font-bold text-white text-md mb-2">{r.race.name}</h4>
                                        <div className="bg-black/30 p-2 rounded text-sm font-mono text-gray-300">
                                            {r.results.map((res, j) => (
                                                <div key={j} className="flex gap-2">
                                                    <span className={`font-bold ${j === 0 ? "text-yellow-400" : j === 1 ? "text-gray-300" : "text-orange-400"}`}>{j + 1}着</span>
                                                    <span>{res}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
