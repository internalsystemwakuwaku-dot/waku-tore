"use client";

import { useState, useMemo } from "react";
import { useBoardStore } from "@/stores/boardStore";

type SidebarMode = "today" | "tomorrow" | "nextMonday" | null;

/**
 * 予定サイドバー - GAS風の「本日予定」「明日予定」「翌週月曜予定」表示
 */
export function ScheduleSidebar() {
    const [mode, setMode] = useState<SidebarMode>(null);
    const { data } = useBoardStore();

    // 日付計算
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextMonday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);

    // フィルタリングされたカード
    const filteredCards = useMemo(() => {
        if (!data || !mode) return [];

        let targetDate: Date;
        if (mode === "today") {
            targetDate = today;
        } else if (mode === "tomorrow") {
            targetDate = tomorrow;
        } else {
            targetDate = nextMonday;
        }

        const targetEnd = new Date(targetDate);
        targetEnd.setDate(targetEnd.getDate() + 1);

        return data.cards.filter((card) => {
            if (!card.due) return false;
            const dueDate = new Date(card.due);
            return dueDate >= targetDate && dueDate < targetEnd;
        }).sort((a, b) => {
            const aDate = new Date(a.due!);
            const bDate = new Date(b.due!);
            return aDate.getTime() - bDate.getTime();
        });
    }, [data, mode, today, tomorrow, nextMonday]);

    // モードラベル
    const getModeLabel = () => {
        switch (mode) {
            case "today":
                return "📅 本日予定";
            case "tomorrow":
                return "📅 明日予定";
            case "nextMonday":
                return "📅 翌週月曜予定";
            default:
                return "";
        }
    };

    // 日付フォーマット
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    };

    return (
        <>
            {/* サイドバートグルボタン群 */}
            <div className="flex gap-1">
                <button
                    onClick={() => setMode(mode === "today" ? null : "today")}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${mode === "today"
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
                        }`}
                >
                    本日
                </button>
                <button
                    onClick={() => setMode(mode === "tomorrow" ? null : "tomorrow")}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${mode === "tomorrow"
                        ? "bg-green-500 text-white border-green-500"
                        : "bg-white text-green-600 border-green-200 hover:bg-green-50"
                        }`}
                >
                    明日
                </button>
                <button
                    onClick={() => setMode(mode === "nextMonday" ? null : "nextMonday")}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${mode === "nextMonday"
                        ? "bg-purple-500 text-white border-purple-500"
                        : "bg-white text-purple-600 border-purple-200 hover:bg-purple-50"
                        }`}
                >
                    翌月曜
                </button>
            </div>

            {/* サイドバーパネル */}
            {mode && (
                <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col animate-slide-in">
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-bold text-gray-800">{getModeLabel()}</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">{filteredCards.length}件</span>
                            <button
                                onClick={() => setMode(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* カードリスト */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {filteredCards.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                                <p className="text-2xl mb-2">📭</p>
                                <p>予定はありません</p>
                            </div>
                        ) : (
                            filteredCards.map((card) => (
                                <div
                                    key={card.id}
                                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors cursor-pointer"
                                    onClick={() => {
                                        // カードをクリックしたら編集モーダルを開く
                                        useBoardStore.getState().setEditingCard(card.id);
                                    }}
                                >
                                    {/* 時刻 */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-bold text-blue-600">
                                            {formatTime(card.due!)}
                                        </span>
                                        {card.dueComplete && (
                                            <span className="text-xs text-green-600 bg-green-100 px-1 rounded">
                                                完了
                                            </span>
                                        )}
                                    </div>

                                    {/* カード名 */}
                                    <h4 className="text-sm text-gray-800 font-medium mb-1 line-clamp-2">
                                        {card.name}
                                    </h4>

                                    {/* 担当者 */}
                                    {(card.roles.construction || card.roles.system) && (
                                        <div className="flex flex-wrap gap-1 text-xs">
                                            {card.roles.construction && (
                                                <span className="text-blue-600">構築:{card.roles.construction}</span>
                                            )}
                                            {card.roles.system && (
                                                <span className="text-purple-600">予約:{card.roles.system}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* フッター */}
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                        クリックでカード詳細を開く
                    </div>
                </div>
            )}

            {/* オーバーレイ */}
            {mode && (
                <div
                    className="fixed inset-0 bg-black/20 z-40"
                    onClick={() => setMode(null)}
                />
            )}
        </>
    );
}
