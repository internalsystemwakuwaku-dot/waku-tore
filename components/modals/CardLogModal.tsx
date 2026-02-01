"use client";

import { useEffect, useState } from "react";
import { getCardLogs } from "@/app/actions/trello";

interface CardLogModalProps {
    cardId: string;
    cardName: string;
    onClose: () => void;
}

interface LogEntry {
    date: string;
    user: string;
    action: string;
}

/**
 * 操作履歴モーダル - GAS完全再現版
 * カードごとの操作ログを表示
 */
export function CardLogModal({ cardId, cardName, onClose }: CardLogModalProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                const data = await getCardLogs(cardId);
                setLogs(data);
            } catch (e) {
                console.error("ログ取得エラー:", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
    }, [cardId]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl w-[500px] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <span className="material-icons text-gray-500">history</span> 操作履歴
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1">{cardName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* ログリスト */}
                <div className="p-4 max-h-[60vh] overflow-y-auto bg-gray-50">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                            履歴はありません
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log, index) => (
                                <div key={index} className="bg-white p-3 rounded border border-gray-200 text-sm">
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>{new Date(log.date).toLocaleString("ja-JP")}</span>
                                        <span>{log.user}</span>
                                    </div>
                                    <div className="text-gray-700">
                                        {log.action}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="px-4 py-3 bg-gray-100 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
