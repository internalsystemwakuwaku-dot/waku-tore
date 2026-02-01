"use client";

import { useState, useEffect } from "react";
import { getCardActivityLogs, getUserActivityLogs } from "@/app/actions/memos";
import type { ActivityLog } from "@/types/memo";

interface LogModalProps {
    cardId?: string;   // カードログの場合
    userId?: string;   // ユーザーログの場合
    title?: string;
    onClose: () => void;
}

export function LogModal({ cardId, userId, title, onClose }: LogModalProps) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadLogs();
    }, [cardId, userId]);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            if (cardId) {
                const result = await getCardActivityLogs(cardId);
                setLogs(result);
            } else if (userId) {
                const result = await getUserActivityLogs(userId);
                setLogs(result);
            }
        } catch (e) {
            console.error("ログ取得エラー:", e);
        } finally {
            setIsLoading(false);
        }
    };

    // アクションに応じたアイコン
    const getActionIcon = (action: string) => {
        if (action.includes("移動")) return "↔️";
        if (action.includes("担当")) return "👤";
        if (action.includes("期限")) return "📅";
        if (action.includes("メモ")) return "📝";
        if (action.includes("コメント")) return "💬";
        return "📋";
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📜</span>
                        <h2 className="text-lg font-bold text-white">
                            {title || "操作履歴"}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* ログリスト */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin h-6 w-6 border-2 border-slate-400 border-t-transparent rounded-full" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center text-white/50 py-8">
                            <p className="text-3xl mb-2">📋</p>
                            <p>履歴がありません</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-start gap-3"
                                >
                                    <span className="text-xl">{getActionIcon(log.action)}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white">{log.action}</p>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                                            <span>👤 {log.userId}</span>
                                            <span>•</span>
                                            <span>
                                                {new Date(log.createdAt).toLocaleString("ja-JP", {
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-between items-center">
                    <p className="text-xs text-white/40">
                        {logs.length} 件の履歴
                    </p>
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
