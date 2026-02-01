"use client";

import { useState, useEffect, useTransition } from "react";
import { getTodayRaceResults } from "@/app/actions/keiba";
import type { Horse } from "@/types/keiba";

interface RaceResult {
    id: string;
    name: string;
    status: string;
    ranking: number[];
    horses: Horse[];
    startedAt: string;
}

interface RaceResultsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * 本日のレース結果パネル (M-4対応)
 */
export function RaceResultsPanel({ isOpen, onClose }: RaceResultsPanelProps) {
    const [races, setRaces] = useState<RaceResult[]>([]);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (isOpen) {
            startTransition(async () => {
                const result = await getTodayRaceResults();
                setRaces(result.races);
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl w-[550px] max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                    <h3 className="font-bold flex items-center gap-2">
                        🏆 本日のレース結果
                    </h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white text-lg">
                        ✕
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {isPending ? (
                        <div className="text-center py-8 text-gray-500">読み込み中...</div>
                    ) : races.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            本日の結果はまだありません
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {races.map((race) => (
                                <div key={race.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* レース名 */}
                                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                                        <span className="font-medium text-gray-800">{race.name}</span>
                                        <span className="text-xs text-gray-500">
                                            {new Date(race.startedAt).toLocaleTimeString("ja-JP", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>

                                    {/* 着順 */}
                                    <div className="p-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            {race.ranking.slice(0, 3).map((horseId, idx) => {
                                                const horse = race.horses.find((h) => h.id === horseId);
                                                const placeColors = ["bg-yellow-100 border-yellow-400", "bg-gray-100 border-gray-400", "bg-orange-100 border-orange-400"];
                                                const placeLabels = ["🥇 1着", "🥈 2着", "🥉 3着"];

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`border rounded-lg p-2 text-center ${placeColors[idx]}`}
                                                    >
                                                        <div className="text-xs text-gray-600">{placeLabels[idx]}</div>
                                                        <div className="font-bold text-sm">{horse?.name || `馬${horseId}`}</div>
                                                        <div className="text-xs text-gray-500">
                                                            オッズ: {horse?.odds?.toFixed(1) || "-"}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
