"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useGameStore } from "@/stores/gameStore";
import { getActiveRace, placeBet, cancelBet, getTodayRaceResults } from "@/app/actions/keiba";
import { getGameData } from "@/app/actions/game";
import type { Race, Bet, Horse } from "@/types/keiba";
import { useSound } from "@/lib/sound/SoundContext";
import { toast } from "@/components/ui/Toast";

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

    const [betType, setBetType] = useState<"WIN" | "PLACE" | "FRAME" | "QUINELLA" | "EXACTA" | "WIDE" | "TRIO" | "TRIFECTA" | "WIN5">("WIN");
    const [betMethod, setBetMethod] = useState<"normal" | "box" | "nagashi" | "formation">("normal");
    const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
    const [selectedHorseIds, setSelectedHorseIds] = useState<number[]>([]);
    const [selectedFrames, setSelectedFrames] = useState<number[]>([]);
    const [anchorHorseId, setAnchorHorseId] = useState<number | null>(null);
    const [anchorFrame, setAnchorFrame] = useState<number | null>(null);
    const [formationA, setFormationA] = useState<number[]>([]);
    const [formationB, setFormationB] = useState<number[]>([]);
    const [formationC, setFormationC] = useState<number[]>([]);
    const [formationFrameA, setFormationFrameA] = useState<number[]>([]);
    const [formationFrameB, setFormationFrameB] = useState<number[]>([]);
    const [formationFrameC, setFormationFrameC] = useState<number[]>([]);
    const [win5Selections, setWin5Selections] = useState<number[]>([1, 1, 1, 1, 1]);
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
    const [isResultsPending, startResultsTransition] = useTransition();
    const todayResultsRef = useRef(todayResults);
    const resultsSignatureRef = useRef<string>("");
    const resultsFetchingRef = useRef(false);
    const resultsLoadedRef = useRef(false);

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
        todayResultsRef.current = todayResults;
    }, [todayResults]);

    useEffect(() => {
        if (isOpen) {
            fetchRace();
            const timer = setInterval(() => setCurrentTime(new Date()), 1000);
            const refresh = setInterval(() => {
                if (phase !== "racing") {
                    fetchRace();
                }
            }, 5000);
            return () => {
                clearInterval(timer);
                clearInterval(refresh);
            };
        }
    }, [isOpen, fetchRace, phase]);

    const fetchTodayResults = useCallback(async (forceLoading = false) => {
        if (resultsFetchingRef.current) return;
        resultsFetchingRef.current = true;
        const shouldShowLoading = forceLoading || (!resultsLoadedRef.current && todayResultsRef.current.length === 0);
        if (shouldShowLoading) {
            setResultsLoading(true);
        }
        try {
            const res = await getTodayRaceResults();
            const signature = JSON.stringify(res.map(item => ({
                id: item.race.id,
                status: item.race.status,
                startedAt: item.race.startedAt,
                ranking: item.ranking,
                results: item.results,
                bets: (item.bets || []).map(b => ({
                    userId: b.userId,
                    totalBet: b.totalBet,
                    totalPayout: b.totalPayout,
                })),
            })));

            if (signature !== resultsSignatureRef.current) {
                resultsSignatureRef.current = signature;
                startResultsTransition(() => setTodayResults(res));
            }
            setResultsError(null);
            resultsLoadedRef.current = true;
            if (forceLoading) {
                toast.info("最新に更新しました");
            }
        } catch (err) {
            console.error("[HorseRaceModal] Failed to fetch results:", err);
            if (!resultsLoadedRef.current && todayResultsRef.current.length === 0) {
                setResultsError("本日の結果の取得に失敗しました");
                setTodayResults([]);
            }
            if (forceLoading) {
                toast.error("更新に失敗しました。再試行してください");
            }
        } finally {
            if (shouldShowLoading) {
                setResultsLoading(false);
            }
            resultsFetchingRef.current = false;
        }
    }, [startResultsTransition, setResultsError, setResultsLoading, setTodayResults]);

    useEffect(() => {
        if (tab !== "today" || !isOpen) return;
        fetchTodayResults();
        return () => {};
    }, [tab, isOpen, fetchTodayResults]);

    useEffect(() => {
        if (phase === "result") {
            getTodayRaceResults()
                .then(res => setTodayResults(res))
                .catch(err => {
                    console.error("[HorseRaceModal] Failed to refresh results after race:", err);
                });
        }
    }, [phase]);

    useEffect(() => {
        if (betType === "WIN" || betType === "PLACE" || betType === "WIN5") {
            setBetMethod("normal");
        }
        setSelectedHorseId(null);
        setSelectedHorseIds([]);
        setSelectedFrames([]);
        setAnchorHorseId(null);
        setAnchorFrame(null);
        setFormationA([]);
        setFormationB([]);
        setFormationC([]);
        setFormationFrameA([]);
        setFormationFrameB([]);
        setFormationFrameC([]);
    }, [betType]);

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
        if (!race || isLoading) return;
        if (betType === "WIN" || betType === "PLACE") {
            if (!selectedHorseId) return;
        } else if (betType === "WIN5") {
            if (win5Selections.length !== 5) return;
        } else {
            if (tickets.length === 0) return;
        }
        if (isBetOverLimit) {
            alert("所持金が不足しています");
            return;
        }
        setIsLoading(true);
        playSe("decide");

        try {
            const horses = race.horses || [];
            const selectedHorse = horses.find(h => h.id === selectedHorseId);
            const currentOdds = betType === "WIN"
                ? (selectedHorse?.odds || 2.0)
                : betType === "PLACE"
                    ? Math.max(1.0, (selectedHorse?.odds || 3.0) / 3)
                    : 0;

            const betMode = betMethod === "normal"
                ? "NORMAL"
                : betMethod === "box"
                    ? "BOX"
                    : betMethod === "nagashi"
                        ? "NAGASHI"
                        : "FORMATION";

            const betDetails = JSON.stringify({
                type: betType,
                method: betMethod,
                tickets,
                baseAmount: betAmount,
                odds: currentOdds,
            });

            const primaryHorseId = selectedHorseId ?? tickets[0]?.[0] ?? 0;
            const result = await placeBet(gameUser.userId, race.id, [{
                type: betType,
                mode: betMode,
                horseId: primaryHorseId,
                details: betDetails,
                amount: totalCost,
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
                alert("賭けが完了しました");
                setSelectedHorseId(null);
            } else {
                playSe("cancel");
                alert(result.error || "賭けに失敗しました");
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
        if (!confirm("この賭けをキャンセルしますか？")) return;

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
    const maxTotalBet = Math.min(maxBetByDebtLimit, maxBetByDailyLoan);

    const horsesList = horses.length > 0 ? horses.map(h => h.id) : [1, 2, 3, 4, 5, 6, 7, 8];
    const framesList = [1, 2, 3, 4];
    const isPairType = ["FRAME", "QUINELLA", "EXACTA", "WIDE"].includes(betType);
    const isTripleType = ["TRIO", "TRIFECTA"].includes(betType);
    const isOrderedType = ["EXACTA", "TRIFECTA"].includes(betType);
    const selectionSize = betType === "WIN" || betType === "PLACE" ? 1 : isTripleType ? 3 : isPairType ? 2 : betType === "WIN5" ? 5 : 1;
    const isFrameType = betType === "FRAME";

    const uniqueSorted = (arr: number[]) => Array.from(new Set(arr)).sort((a, b) => a - b);
    const combinations = (arr: number[], k: number) => {
        const result: number[][] = [];
        const helper = (start: number, combo: number[]) => {
            if (combo.length === k) {
                result.push([...combo]);
                return;
            }
            for (let i = start; i < arr.length; i++) {
                combo.push(arr[i]);
                helper(i + 1, combo);
                combo.pop();
            }
        };
        helper(0, []);
        return result;
    };
    const permutations = (arr: number[], k: number) => {
        const result: number[][] = [];
        const used = new Array(arr.length).fill(false);
        const helper = (combo: number[]) => {
            if (combo.length === k) {
                result.push([...combo]);
                return;
            }
            for (let i = 0; i < arr.length; i++) {
                if (used[i]) continue;
                used[i] = true;
                combo.push(arr[i]);
                helper(combo);
                combo.pop();
                used[i] = false;
            }
        };
        helper([]);
        return result;
    };

    const buildTickets = () => {
        if (betType === "WIN5") {
            return [win5Selections.slice(0, 5)];
        }
        if (betType === "WIN" || betType === "PLACE") {
            return selectedHorseId ? [[selectedHorseId]] : [];
        }
        const baseList = isFrameType ? framesList : horsesList;
        const pickNormal = isFrameType ? selectedFrames : selectedHorseIds;
        const anchor = isFrameType ? anchorFrame : anchorHorseId;
        const formA = isFrameType ? formationFrameA : formationA;
        const formB = isFrameType ? formationFrameB : formationB;
        const formC = isFrameType ? formationFrameC : formationC;

        if (betMethod === "normal") {
            if (pickNormal.length !== selectionSize) return [];
            const ticket = isOrderedType ? pickNormal : uniqueSorted(pickNormal);
            return [ticket];
        }
        if (betMethod === "box") {
            if (pickNormal.length < selectionSize) return [];
            return isOrderedType ? permutations(uniqueSorted(pickNormal), selectionSize) : combinations(uniqueSorted(pickNormal), selectionSize);
        }
        if (betMethod === "nagashi") {
            if (!anchor) return [];
            const others = uniqueSorted(pickNormal.filter(n => n !== anchor));
            if (isPairType) {
                if (isOrderedType) {
                    return others.map(o => [anchor, o]);
                }
                const seen = new Set<string>();
                const tickets: number[][] = [];
                for (const o of others) {
                    const ticket = [anchor, o].sort((a, b) => a - b);
                    const key = ticket.join("-");
                    if (!seen.has(key)) {
                        seen.add(key);
                        tickets.push(ticket);
                    }
                }
                return tickets;
            }
            if (isTripleType) {
                const combos = isOrderedType ? permutations(others, 2) : combinations(others, 2);
                return combos.map(c => {
                    const ticket = [anchor, ...c];
                    return isOrderedType ? ticket : uniqueSorted(ticket);
                });
            }
        }
        if (betMethod === "formation") {
            if (isPairType) {
                const tickets: number[][] = [];
                for (const a of formA) {
                    for (const b of formB) {
                        if (a === b) continue;
                        const ticket = isOrderedType ? [a, b] : uniqueSorted([a, b]);
                        tickets.push(ticket);
                    }
                }
                return tickets;
            }
            if (isTripleType) {
                const tickets: number[][] = [];
                for (const a of formA) {
                    for (const b of formB) {
                        for (const c of formC) {
                            if (a === b || b === c || a === c) continue;
                            const ticket = isOrderedType ? [a, b, c] : uniqueSorted([a, b, c]);
                            tickets.push(ticket);
                        }
                    }
                }
                return tickets;
            }
        }
        return [];
    };

    const tickets = buildTickets();
    const ticketCount = tickets.length;
    const maxBetAmount = Math.min(Math.max(100, Math.floor(maxTotalBet / Math.max(1, ticketCount))), 100000);
    const totalCost = ticketCount === 0 ? 0 : betAmount * ticketCount;
    const isBetOverLimit = totalCost > maxTotalBet;
    const isSelectionValid = betType === "WIN" || betType === "PLACE"
        ? !!selectedHorseId
        : betType === "WIN5"
            ? win5Selections.length === 5
            : ticketCount > 0;

    useEffect(() => {
        if (betAmount > maxBetAmount) {
            setBetAmount(maxBetAmount);
        }
    }, [betAmount, maxBetAmount]);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 w-full max-w-4xl rounded-lg shadow-2xl overflow-hidden text-white border border-gray-700 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 flex justify-between items-center border-b border-gray-700 bg-gray-800">
                    <div>
                        <h2 className="text-xl font-bold">{race?.name || "Loading..."}</h2>
                        {phase === "betting" && (
                            <p className="text-xs text-gray-400">
                                開始まで {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-black/40 px-3 py-2 rounded">
                            <div className="text-xs text-gray-400">WALLET</div>
                            <div className="font-mono text-yellow-400">{gameUser.money.toLocaleString()} G</div>
                        </div>
                        <button onClick={handleClose} className="text-gray-400 hover:text-white">×</button>
                    </div>
                </div>

                                                                                                <div className="flex border-b border-gray-700 bg-gray-900 text-sm">
                    <button onClick={() => setTab("bet")} className={`flex-1 py-3 font-bold ${tab === "bet" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-800"}`}>賭け</button>
                    <button onClick={() => setTab("race")} className={`flex-1 py-3 font-bold ${tab === "race" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-800"}`}>レース</button>
                    <button onClick={() => setTab("today")} className={`flex-1 py-3 font-bold ${tab === "today" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-800"}`}>本日の結果</button>
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
                                        <div className="flex flex-wrap gap-2">
                                            {([
                                                { key: "WIN", label: "単勝" },
                                                { key: "PLACE", label: "複勝" },
                                                { key: "FRAME", label: "枠連" },
                                                { key: "QUINELLA", label: "馬連" },
                                                { key: "EXACTA", label: "馬単" },
                                                { key: "WIDE", label: "ワイド" },
                                                { key: "TRIO", label: "3連複" },
                                                { key: "TRIFECTA", label: "3連単" },
                                                { key: "WIN5", label: "WIN5" },
                                            ] as const).map((t) => (
                                                <button
                                                    key={t.key}
                                                    onClick={() => setBetType(t.key)}
                                                    className={`px-3 py-1 rounded ${betType === t.key ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-300"}`}
                                                >
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>

                                        {betType !== "WIN" && betType !== "PLACE" && betType !== "WIN5" && (
                                            <div className="flex flex-wrap gap-2">
                                                {([
                                                    { key: "normal", label: "通常" },
                                                    { key: "box", label: "ボックス" },
                                                    { key: "nagashi", label: "流し" },
                                                    { key: "formation", label: "フォーメーション" },
                                                ] as const).map((m) => (
                                                    <button
                                                        key={m.key}
                                                        onClick={() => setBetMethod(m.key)}
                                                        className={`px-3 py-1 rounded ${betMethod === m.key ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-300"}`}
                                                    >
                                                        {m.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {(betType === "WIN" || betType === "PLACE") && (
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
                                        )}

                                        {betType === "WIN5" && (
                                            <div className="space-y-2">
                                                {[0, 1, 2, 3, 4].map((i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-400 w-16">R{i + 1}</span>
                                                        <select
                                                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                                                            value={win5Selections[i] ?? 1}
                                                            onChange={(e) => {
                                                                const next = [...win5Selections];
                                                                next[i] = Number(e.target.value);
                                                                setWin5Selections(next);
                                                            }}
                                                        >
                                                            {horsesList.map((n) => (
                                                                <option key={n} value={n}>{n}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {betType !== "WIN" && betType !== "PLACE" && betType !== "WIN5" && (
                                            <div className="space-y-3">
                                                {betMethod === "normal" && (
                                                    <div className="space-y-2">
                                                        <div className="text-xs text-gray-400">選択順が買い目になります</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(isFrameType ? framesList : horsesList).map((n) => {
                                                                const selected = isFrameType ? selectedFrames.includes(n) : selectedHorseIds.includes(n);
                                                                return (
                                                                    <button
                                                                        key={n}
                                                                        onClick={() => {
                                                                            const current = isFrameType ? selectedFrames : selectedHorseIds;
                                                                            const next = current.includes(n)
                                                                                ? current.filter(v => v !== n)
                                                                                : [...current, n].slice(-selectionSize);
                                                                            if (isFrameType) setSelectedFrames(next);
                                                                            else setSelectedHorseIds(next);
                                                                        }}
                                                                        className={`px-3 py-1 rounded border ${selected ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 bg-gray-800/50"}`}
                                                                    >
                                                                        {isFrameType ? `枠${n}` : n}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {betMethod === "box" && (
                                                    <div className="space-y-2">
                                                        <div className="text-xs text-gray-400">選択した全組み合わせ</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(isFrameType ? framesList : horsesList).map((n) => {
                                                                const selected = isFrameType ? selectedFrames.includes(n) : selectedHorseIds.includes(n);
                                                                return (
                                                                    <button
                                                                        key={n}
                                                                        onClick={() => {
                                                                            const current = isFrameType ? selectedFrames : selectedHorseIds;
                                                                            const next = current.includes(n) ? current.filter(v => v !== n) : [...current, n];
                                                                            if (isFrameType) setSelectedFrames(next);
                                                                            else setSelectedHorseIds(next);
                                                                        }}
                                                                        className={`px-3 py-1 rounded border ${selected ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 bg-gray-800/50"}`}
                                                                    >
                                                                        {isFrameType ? `枠${n}` : n}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {betMethod === "nagashi" && (
                                                    <div className="space-y-2">
                                                        <div className="text-xs text-gray-400">軸</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(isFrameType ? framesList : horsesList).map((n) => {
                                                                const selected = isFrameType ? anchorFrame === n : anchorHorseId === n;
                                                                return (
                                                                    <button
                                                                        key={n}
                                                                        onClick={() => isFrameType ? setAnchorFrame(n) : setAnchorHorseId(n)}
                                                                        className={`px-3 py-1 rounded border ${selected ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 bg-gray-800/50"}`}
                                                                    >
                                                                        {isFrameType ? `枠${n}` : n}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="text-xs text-gray-400">相手</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(isFrameType ? framesList : horsesList).map((n) => {
                                                                const selected = isFrameType ? selectedFrames.includes(n) : selectedHorseIds.includes(n);
                                                                return (
                                                                    <button
                                                                        key={n}
                                                                        onClick={() => {
                                                                            const current = isFrameType ? selectedFrames : selectedHorseIds;
                                                                            const next = current.includes(n) ? current.filter(v => v !== n) : [...current, n];
                                                                            if (isFrameType) setSelectedFrames(next);
                                                                            else setSelectedHorseIds(next);
                                                                        }}
                                                                        className={`px-3 py-1 rounded border ${selected ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 bg-gray-800/50"}`}
                                                                    >
                                                                        {isFrameType ? `枠${n}` : n}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {betMethod === "formation" && (
                                                    <div className="space-y-2">
                                                        <div className="text-xs text-gray-400">1列目</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(isFrameType ? framesList : horsesList).map((n) => {
                                                                const selected = isFrameType ? formationFrameA.includes(n) : formationA.includes(n);
                                                                return (
                                                                    <button
                                                                        key={n}
                                                                        onClick={() => {
                                                                            const current = isFrameType ? formationFrameA : formationA;
                                                                            const next = current.includes(n) ? current.filter(v => v !== n) : [...current, n];
                                                                            if (isFrameType) setFormationFrameA(next);
                                                                            else setFormationA(next);
                                                                        }}
                                                                        className={`px-3 py-1 rounded border ${selected ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 bg-gray-800/50"}`}
                                                                    >
                                                                        {isFrameType ? `枠${n}` : n}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="text-xs text-gray-400">2列目</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(isFrameType ? framesList : horsesList).map((n) => {
                                                                const selected = isFrameType ? formationFrameB.includes(n) : formationB.includes(n);
                                                                return (
                                                                    <button
                                                                        key={n}
                                                                        onClick={() => {
                                                                            const current = isFrameType ? formationFrameB : formationB;
                                                                            const next = current.includes(n) ? current.filter(v => v !== n) : [...current, n];
                                                                            if (isFrameType) setFormationFrameB(next);
                                                                            else setFormationB(next);
                                                                        }}
                                                                        className={`px-3 py-1 rounded border ${selected ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 bg-gray-800/50"}`}
                                                                    >
                                                                        {isFrameType ? `枠${n}` : n}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        {isTripleType && (
                                                            <>
                                                                <div className="text-xs text-gray-400">3列目</div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {(isFrameType ? framesList : horsesList).map((n) => {
                                                                        const selected = isFrameType ? formationFrameC.includes(n) : formationC.includes(n);
                                                                        return (
                                                                            <button
                                                                                key={n}
                                                                                onClick={() => {
                                                                                    const current = isFrameType ? formationFrameC : formationC;
                                                                                    const next = current.includes(n) ? current.filter(v => v !== n) : [...current, n];
                                                                                    if (isFrameType) setFormationFrameC(next);
                                                                                    else setFormationC(next);
                                                                                }}
                                                                                className={`px-3 py-1 rounded border ${selected ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 bg-gray-800/50"}`}
                                                                            >
                                                                                {isFrameType ? `枠${n}` : n}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

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
                                                                            キャンセル
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
                                        <h3 className="text-lg font-bold mb-4">賭けの内容</h3>

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
                                                        本日残り貸付: {remainingLoan.toLocaleString()}G
                                                    </p>
                                                    <div className="mt-2 text-xs text-gray-400">
                                                        買い目数: {ticketCount}
                                                    </div>
                                                    <div className={`text-xs ${isBetOverLimit ? "text-red-400" : "text-gray-400"}`}>
                                                        合計: {totalCost.toLocaleString()}G
                                                    </div>
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
                                                        disabled={isLoading || !isSelectionValid || isBetOverLimit}
                                                        className="w-full py-3 bg-red-600 hover:bg-red-500 rounded font-bold disabled:opacity-50"
                                                    >
                                                        {isLoading ? "処理中..." : "賭ける"}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-gray-400 text-sm">馬を選択してください</div>
                                        )}
                                    </div>
                                </div>
                            )}

                                                        {phase !== "betting" && (
                                <div className="text-gray-400 text-center py-10">
                                    {phase === "loading" && "レース情報を取得中..."}
                                    {phase === "racing" && "レース進行中..."}
                                    {phase === "result" && "結果のレースを確認しています..."}
                                    <div className="mt-4">
                                        <button onClick={fetchRace} className="px-4 py-2 bg-gray-700 rounded">譖ｴ譁ｰ</button>
                                    </div>
                                </div>
                            )}

                            
                        </>
                     ) : tab === "race" ? (
                        <div className="space-y-4">
                            {phase === "betting" && (
                                <div className="text-gray-400 text-center py-10">レースはまだ開始していません</div>
                            )}

                            {(phase === "racing" || phase === "result") && (
                                <div className="space-y-4">
                                    <div className="text-center text-gray-400">
                                        {phase === "racing" ? "レース進行中..." : "レース終了"}
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
                                                <div className="text-xs">{race?.winnerId === horse.id ? "WIN" : "RUN"}</div>
                                            </div>
                                        ))}
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
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white font-bold text-lg">本日のレース結果</h3>
                                <button
                                    onClick={() => fetchTodayResults(true)}
                                    className="p-2 text-xs bg-gray-700 hover:bg-gray-600 rounded-full"
                                    disabled={resultsLoading || isResultsPending}
                                    title="譖ｴ譁ｰ"
                                >
                                    <svg className={`w-4 h-4 ${resultsLoading || isResultsPending ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                        />
                                    </svg>
                                </button>
                            </div>
                            {(resultsLoading || isResultsPending) ? (
                                <div className="text-gray-400 text-center py-10">読み込み中...</div>
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
                                                {r.race.status === "finished" ? "終了" : r.race.status}
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
                                        <div className="mt-3 text-xs text-gray-400">払戻とユーザー一覧</div>
                                        <div className="mt-2 space-y-2">
                                            {r.bets.length === 0 ? (
                                                <div className="text-gray-500 text-xs">該当ユーザーなし</div>
                                            ) : (
                                                r.bets.map((b) => (
                                                    <div key={b.userId} className="bg-black/40 rounded p-2 text-xs">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-300">User: {b.userId}</span>
                                                            <span className="text-yellow-300">払い戻し {b.totalPayout.toLocaleString()}G</span>
                                                        </div>
                                                        <div className="text-gray-400">
                                                            賭け合計 {b.totalBet.toLocaleString()}G
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
