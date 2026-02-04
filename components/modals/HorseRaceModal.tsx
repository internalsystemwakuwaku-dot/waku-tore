"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/stores/gameStore";
import { getActiveRace, placeBet, cancelBet, getTodayRaceResults } from "@/app/actions/keiba";
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

    const [betType, setBetType] = useState<"WIN" | "PLACE">("WIN");
    const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
    const [betAmount, setBetAmount] = useState<number>(100);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    const [tab, setTab] = useState<"bet" | "race" | "today">("bet");
    const [todayResults, setTodayResults] = useState<{
        race: Race;
        results: string[];
        ranking?: number[];
        bets: {
            userId: string;
            totalBet: number;
            totalPayout: number;
            items: { type: string; horseId?: number; amount: number; payout: number; isWin: boolean }[];
        }[];
    }[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [resultsError, setResultsError] = useState<string | null>(null);

    const [phase, setPhase] = useState<"loading" | "betting" | "racing" | "result">("loading");
    const [positions, setPositions] = useState<number[]>([0, 0, 0, 0, 0, 0]);
    const raceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchRace = useCallback(async () => {
        setIsLoading(true);
        try {
            const { race: fetchedRace, myBets: fetchedBets } = await getActiveRace(gameUser.userId);
            setRace(fetchedRace);
            setMyBets(fetchedBets);

            if (fetchedRace.status === "finished") {
                if (phase !== "racing") setPhase("result");
            } else if (fetchedRace.status === "calculating") {
                setPhase("racing");
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
    }, [gameUser.userId]);

    useEffect(() => {
        if (isOpen) {
            fetchRace();
            const timer = setInterval(() => setCurrentTime(new Date()), 1000);
            return () => clearInterval(timer);
        }
    }, [isOpen, fetchRace]);

    useEffect(() => {
        if (tab !== "today" || !isOpen) return;

        const fetchResults = () => {
            setResultsLoading(true);
            setResultsError(null);
            getTodayRaceResults()
                .then(res => setTodayResults(res))
                .catch(err => {
                    console.error("[HorseRaceModal] Failed to fetch results:", err);
                    setResultsError("結果の取得に失敗しました");
                    setTodayResults([]);
                })
                .finally(() => setResultsLoading(false));
        };

        fetchResults();
        const interval = setInterval(fetchResults, 5000);
        return () => clearInterval(interval);
    }, [tab, isOpen]);

    useEffect(() => {
        if (phase === "result") {
            getTodayRaceResults()
                .then(res => setTodayResults(res))
                .catch(err => {
                    console.error("[HorseRaceModal] Failed to refresh results after race:", err);
                });
        }
    }, [phase]);

    const handleClose = () => {
        if (phase === "racing") return;
        onClose();
        setPhase("loading");
        setSelectedHorseId(null);
        setMyBets([]);
        setPositions([0, 0, 0, 0, 0, 0]);
        setTab("bet");
        setBetAmount(100);
        setBetType("WIN");
        if (raceTimerRef.current) {
            clearInterval(raceTimerRef.current);
            raceTimerRef.current = null;
        }
    };

    const startRiggedAnimation = useCallback((winnerId: number, horses: Horse[]) => {
        const raceDuration = 10000;
        const interval = 50;
        const steps = raceDuration / interval;
        let currentStep = 0;

        if (raceTimerRef.current) clearInterval(raceTimerRef.current);

        raceTimerRef.current = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;

            setPositions(prev => {
                if (prev.length === 0) return Array(horses.length).fill(0);

                return horses.map((h, idx) => {
                    const isWinner = h.id === winnerId;
                    let p = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
                    p += (Math.random() - 0.5) * 0.05;

                    if (progress > 0.9) {
                        const target = isWinner ? 100 : 90 + ((h.id * 17) % 8);
                        const current = prev[idx] || (p * 100);
                        return current + (target - current) * 0.1;
                    }
                    return Math.min(100, Math.max(0, p * 100));
                });
            });

            if (currentStep >= steps) {
                if (raceTimerRef.current) clearInterval(raceTimerRef.current);
                setTimeout(async () => {
                    try {
                        const { myBets: finalBets } = await getActiveRace(gameUser.userId);
                        setMyBets(finalBets);
                    } catch (e) {
                        console.error("[HorseRaceModal] Failed to refresh bets before result:", e);
                    }
                    setPhase("result");
                }, 2000);
            }
        }, interval);
    }, [gameUser.userId]);

    useEffect(() => {
        let pollTimer: NodeJS.Timeout;
        let isPolling = false;

        if (phase === "racing") {
            playBgm("race");
            pollTimer = setInterval(async () => {
                if (isPolling) return;
                isPolling = true;

                try {
                    const { race: latestRace, myBets: latestBets } = await getActiveRace(gameUser.userId);
                    if (latestRace.status === "calculating") return;

                    if (latestRace.status === "finished" && latestRace.winnerId) {
                        clearInterval(pollTimer);
                        setRace(latestRace);

                        const hasPayout = latestBets.some(b => (b.payout || 0) > 0);
                        const hasWinningBet = latestBets.some(b => {
                            if (b.type === "WIN" && b.horseId === latestRace.winnerId) return true;
                            if (b.type === "PLACE" && latestRace.ranking && latestRace.ranking.slice(0, 3).includes(b.horseId || 0)) return true;
                            return false;
                        });

                        if (hasWinningBet && !hasPayout && latestBets.length > 0) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                            const { myBets: refreshedBets } = await getActiveRace(gameUser.userId);
                            setMyBets(refreshedBets);
                        } else {
                            setMyBets(latestBets);
                        }

                        startRiggedAnimation(latestRace.winnerId, latestRace.horses);

                        try {
                            const updatedUser = await getGameData(gameUser.userId);
                            setData(updatedUser, true);
                        } catch (e) {
                            console.error("[HorseRaceModal] Failed to refresh user data:", e);
                        }
                    }
                } catch (e) {
                    console.error("[HorseRaceModal] Polling error:", e);
                } finally {
                    isPolling = false;
                }
            }, 3000);
        } else if (phase === "result") {
            stopBgm();
            playSe("fanfare");
            (async () => {
                try {
                    const updatedUser = await getGameData(gameUser.userId);
                    setData(updatedUser, true);
                } catch (e) {
                    console.error("[HorseRaceModal] Failed to refresh user data on result:", e);
                }
            })();
        } else {
            playBgm("home");
        }

        return () => {
            clearInterval(pollTimer);
            if (!isOpen) stopBgm();
        };
    }, [phase, gameUser.userId, isOpen, playBgm, playSe, stopBgm, setData, startRiggedAnimation]);

    const handleBet = async () => {
        if (!race || !selectedHorseId || isLoading) return;
        setIsLoading(true);
        playSe("decide");

        try {
            const horses = race.horses || [];
            const selectedHorse = horses.find(h => h.id === selectedHorseId);
            const currentOdds = betType === "WIN"
                ? (selectedHorse?.odds || 2.0)
                : Math.max(1.0, (selectedHorse?.odds || 3.0) / 3);

            const betDetails = JSON.stringify({
                horses: [selectedHorseId],
                odds: currentOdds,
            });

            const result = await placeBet(gameUser.userId, race.id, [{
                type: betType,
                mode: "NORMAL",
                horseId: selectedHorseId,
                details: betDetails,
                amount: betAmount,
            }]);

            if (result.success) {
                if (typeof result.newBalance === "number") {
                    setData({ ...gameUser, money: result.newBalance });
                }
                try {
                    const updatedUser = await getGameData(gameUser.userId);
                    setData(updatedUser, true);
                } catch (e) {
                    console.error("[HorseRaceModal] Failed to refresh user data after bet:", e);
                }
                await fetchRace();
                playSe("coin");
                alert("投票しました");
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

    const handleCancelBet = async (betId: string) => {
        if (isLoading) return;
        if (!confirm("この投票をキャンセルしますか？")) return;

        setIsLoading(true);
        try {
            const result = await cancelBet(gameUser.userId, betId);
            if (result.success) {
                if (typeof result.newBalance === "number") {
                    setData({ ...gameUser, money: result.newBalance });
                }
                try {
                    const updatedUser = await getGameData(gameUser.userId);
                    setData(updatedUser, true);
                } catch (e) {
                    console.error("[HorseRaceModal] Failed to refresh user data after cancel:", e);
                }
                await fetchRace();
                playSe("coin");
                alert("キャンセルしました");
            } else {
                playSe("cancel");
                alert(result.error || "キャンセルに失敗しました");
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
    const DEBT_LIMIT = -10000;
    const DAILY_LOAN_LIMIT = 10000;
    const today = new Date().toISOString().slice(0, 10);
    const loanUsedToday = gameUser.lastLoanDate === today ? (gameUser.todayLoanAmount || 0) : 0;
    const remainingLoan = Math.max(0, DAILY_LOAN_LIMIT - loanUsedToday);
    const maxBetByDebtLimit = gameUser.money - DEBT_LIMIT;
    const maxBetByDailyLoan = Math.max(0, gameUser.money) + remainingLoan;
    const maxBetAmount = Math.min(Math.max(100, Math.min(maxBetByDebtLimit, maxBetByDailyLoan)), 100000);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 w-full max-w-4xl rounded-lg shadow-2xl overflow-hidden text-white border border-gray-700 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 flex justify-between items-center border-b border-gray-700 bg-gray-800">
                    <div>
                        <h2 className="text-xl font-bold">{race?.name || "Loading..."}</h2>
                        {phase === "betting" && (
                            <p className="text-xs text-gray-400">
                                締切まで {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-black/40 px-3 py-2 rounded">
                            <div className="text-xs text-gray-400">WALLET</div>
                            <div className="font-mono text-yellow-400">{gameUser.money.toLocaleString()} G</div>
                        </div>
                        <button onClick={handleClose} className="text-gray-400 hover:text-white">?</button>
                    </div>
                </div>

                <div className="flex border-b border-gray-700 bg-gray-900 text-sm">
                    <button onClick={() => setTab("bet")} className={`flex-1 py-3 font-bold ${tab === "bet" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-800"}`}>??</button>
                    <button onClick={() => setTab("race")} className={`flex-1 py-3 font-bold ${tab === "race" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-800"}`}>??</button>
                    <button onClick={() => setTab("today")} className={`flex-1 py-3 font-bold ${tab === "today" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-800"}`}>?????</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {tab === "bet" ? (
                        <>
                            {isLoading && !race && (
                                <div className="text-center text-gray-400">Loading...</div>
                            )}

                            {phase === "betting" && race && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2 space-y-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setBetType("WIN")}
                                                className={`px-3 py-1 rounded ${betType === "WIN" ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-300"}`}
                                            >
                                                単勝
                                            </button>
                                            <button
                                                onClick={() => setBetType("PLACE")}
                                                className={`px-3 py-1 rounded ${betType === "PLACE" ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-300"}`}
                                            >
                                                複勝
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {horses.map((horse) => (
                                                <button
                                                    key={horse.id}
                                                    onClick={() => setSelectedHorseId(horse.id)}
                                                    className={`w-full text-left p-3 rounded border ${selectedHorseId === horse.id ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 bg-gray-800/50"}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="font-bold">{horse.name}</div>
                                                            <div className="text-xs text-gray-400">ID: {horse.id}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-400">ODDS</div>
                                                            <div className="font-mono text-yellow-400">
                                                                {betType === "WIN"
                                                                    ? horse.odds.toFixed(1)
                                                                    : Math.max(1.0, horse.odds / 3).toFixed(1)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {myBets.length > 0 && (
                                            <div className="mt-4 border-t border-gray-700 pt-4">
                                                <h4 className="text-sm text-gray-400 mb-2">MY BETS</h4>
                                                <div className="space-y-2">
                                                    {myBets.map(bet => {
                                                        const h = horses.find(h => h.id === bet.horseId);
                                                        return (
                                                            <div key={bet.id} className="flex justify-between items-center text-xs bg-gray-800/60 p-2 rounded border border-gray-700">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-1 rounded ${bet.type === "WIN" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"}`}>
                                                                        {bet.type.substring(0, 1)}
                                                                    </span>
                                                                    <span>{h?.name || `Horse #${bet.horseId}`}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono">{bet.amount.toLocaleString()} G</span>
                                                                    {phase === "betting" && bet.id && (
                                                                        <button
                                                                            onClick={() => handleCancelBet(bet.id as string)}
                                                                            className="text-gray-400 hover:text-red-400"
                                                                        >
                                                                            取消
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-gray-800/80 rounded-lg p-4 border border-gray-700 h-fit">
                                        <h3 className="text-lg font-bold mb-4">投票内容</h3>

                                        {selectedHorseId ? (
                                            <>
                                                <div className="mb-4">
                                                    <div className="text-xs text-gray-400">選択中</div>
                                                    <div className="font-bold">
                                                        {horses.find(h => h.id === selectedHorseId)?.name}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-xs text-gray-400">BET AMOUNT</label>
                                                    <input
                                                        type="range"
                                                        min="100"
                                                        max={maxBetAmount}
                                                        step="100"
                                                        value={Math.min(betAmount, maxBetAmount)}
                                                        onChange={(e) => setBetAmount(Number(e.target.value))}
                                                        className="w-full"
                                                    />
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setBetAmount(Math.max(100, betAmount - 100))}
                                                                className="px-2 py-1 bg-gray-700 rounded text-xs"
                                                            >
                                                                -100
                                                            </button>
                                                            <button
                                                                onClick={() => setBetAmount(Math.min(maxBetAmount, betAmount + 100))}
                                                                className="px-2 py-1 bg-gray-700 rounded text-xs"
                                                            >
                                                                +100
                                                            </button>
                                                        </div>
                                                        <span className="font-mono">{betAmount.toLocaleString()} G</span>
                                                    </div>
                                                    <p className="text-xs text-red-400">
                                                        借入残り (本日): {remainingLoan.toLocaleString()}G
                                                    </p>
                                                </div>

                                                <div className="pt-4 border-t border-gray-700 mt-4">
                                                    <div className="flex justify-between text-sm mb-2">
                                                        <span className="text-gray-400">想定払戻</span>
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
                                                        className="w-full py-3 bg-red-600 hover:bg-red-500 rounded font-bold disabled:opacity-50"
                                                    >
                                                        {isLoading ? "処理中..." : "投票する"}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-gray-400 text-sm">馬を選択してください</div>
                                        )}
                                    </div>
                                </div>
                            )}
</div>

                                    {phase === "result" && (
                                        <div className="bg-gray-800/80 rounded p-4 border border-gray-700">
                                            <div className="text-sm text-gray-400 mb-2">TOP 3</div>
                                            <div className="space-y-1">
                                                {race?.ranking?.slice(0, 3).map((horseId, idx) => {
                                                    const horse = horses.find(h => h.id === horseId);
                                                    return (
                                                        <div key={horseId} className="flex justify-between">
                                                            <span>{idx + 1}位</span>
                                                            <span>{horse?.name || `Horse #${horseId}`}</span>
                                                            <span>{horse?.odds?.toFixed(1)}倍</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-4 text-center">
                                                <div className="text-xs text-gray-400">TOTAL PAYOUT</div>
                                                <div className="text-2xl font-mono text-yellow-400">
                                                    {myBets.reduce((sum, b) => sum + (b.payout || 0), 0).toLocaleString()} G
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                     ) : tab === "race" ? (
                        <div className="space-y-4">
                            {phase === "betting" && (
                                <div className="text-gray-400 text-center py-10">?????????????</div>
                            )}


                            {(phase === "racing" || phase === "result") && (
                                <div className="space-y-4">
                                    <div className="text-center text-gray-400">
                                        {phase === "racing" ? "レース進行中..." : "結果確定"}
                                    </div>

                                    <div className="space-y-2">
                                        {horses.map((horse, idx) => (
                                            <div key={horse.id} className="w-full bg-gray-800 rounded p-2 flex items-center gap-2">
                                                <div className="w-24 text-xs text-gray-400 truncate">{horse.name}</div>
                                                <div className="flex-1 bg-gray-700 h-2 rounded overflow-hidden">
                                                    <div
                                                        className="h-2 bg-yellow-500/70"
                                                        style={{ width: `${positions[idx] || 0}%` }}
                                                    />
                                                </div>
                                                <div className="text-xs">{race?.winnerId === horse.id ? "??" : "??"}</div>
                                            </div>
                                        ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="text-white font-bold text-lg mb-2">本日のレース結果</h3>
                            {resultsLoading ? (
                                <div className="text-gray-400 text-center py-10">取得中...</div>
                            ) : resultsError ? (
                                <div className="text-red-400 text-center py-10">
                                    <p>{resultsError}</p>
                                    <button onClick={() => setTab("bet")} className="mt-4 px-4 py-2 bg-gray-700 rounded">
                                        戻る
                                    </button>
                                </div>
                            ) : todayResults.length === 0 ? (
                                <div className="text-gray-500 text-center py-10">本日の結果はまだありません</div>
                            ) : (
                                todayResults.map((r, i) => (
                                    <div key={i} className="bg-gray-800 p-4 rounded border border-gray-700">
                                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                                            <span>{new Date(r.race.startedAt!).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span>
                                            <span className={r.race.status === "finished" ? "text-green-400" : "text-gray-500"}>
                                                {r.race.status === "finished" ? "確定" : r.race.status}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-white text-md mb-2">{r.race.name}</h4>
                                        <div className="bg-black/30 p-2 rounded text-sm">
                                            {r.results.slice(0, 3).map((res, j) => (
                                                <div key={j} className="flex gap-2">
                                                    <span className="font-bold">{j + 1}位</span>
                                                    <span>{res}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 text-xs text-gray-400">配当と購入一覧</div>
                                        <div className="mt-2 space-y-2">
                                            {r.bets.length === 0 ? (
                                                <div className="text-gray-500 text-xs">購入者なし</div>
                                            ) : (
                                                r.bets.map((b) => (
                                                    <div key={b.userId} className="bg-black/40 rounded p-2 text-xs">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-300">User: {b.userId}</span>
                                                            <span className="text-yellow-300">払い戻し {b.totalPayout.toLocaleString()}G</span>
                                                        </div>
                                                        <div className="text-gray-400">
                                                            投票合計 {b.totalBet.toLocaleString()}G
                                                        </div>
                                                        <div className="mt-1 space-y-1">
                                                            {b.items.map((it, idx) => (
                                                                <div key={idx} className="flex justify-between text-gray-300">
                                                                    <span>{it.type} #{it.horseId ?? "-"}</span>
                                                                    <span>{it.amount.toLocaleString()}G / {it.payout.toLocaleString()}G</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
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
