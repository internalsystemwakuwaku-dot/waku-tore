"use client";

import { useMemo } from "react";
import { useBoardStore } from "@/stores/boardStore";

/**
 * 説明詳細サイドバー
 * 右側からスライドインしてカードのDescriptionを表示する
 */
export function DescriptionSidebar() {
    const { ui, data, setViewingDescriptionCard } = useBoardStore();
    const cardId = ui.viewingDescriptionCardId;

    // カード情報取得
    const card = useMemo(() => {
        if (!data || !cardId) return null;
        return data.cards.find(c => c.id === cardId);
    }, [data, cardId]);

    if (!cardId) return null;

    // リンクを整形する簡易レンダラー
    const renderContent = (content: string) => {
        if (!content) return <span className="text-gray-400 italic">説明はありません</span>;

        // URLをリンクに変換
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = content.split(urlRegex);

        return (
            <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                {parts.map((part, i) => {
                    if (part.match(urlRegex)) {
                        return (
                            <a
                                key={i}
                                href={part}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                            >
                                {part}
                            </a>
                        );
                    }
                    return part;
                })}
            </div>
        );
    };

    return (
        <>
            {/* サイドバーパネル */}
            <div className="fixed right-0 top-0 h-full w-[400px] max-w-full bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col animate-slide-in">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-xl">📝</span>
                        <h3 className="font-bold text-gray-800 truncate" title={card?.name}>
                            {card?.name || "詳細"}
                        </h3>
                    </div>
                    <button
                        onClick={() => setViewingDescriptionCard(null)}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {card ? (
                        <div className="space-y-4">
                            {/* ラベル */}
                            {card.trelloLabels.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {card.trelloLabels.map((label, i) => (
                                        <span
                                            key={i}
                                            className={`px-2 py-0.5 rounded text-xs font-medium bg-${label.color ? label.color + "-100" : "gray-100"} text-${label.color ? label.color + "-800" : "gray-800"}`}
                                        >
                                            {label.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* 説明本文 */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 min-h-[200px]">
                                {renderContent(card.desc)}
                            </div>

                            {/* フッター情報 */}
                            <div className="pt-4 border-t border-gray-100 text-xs text-gray-500">
                                <p>最終更新: {new Date(card.roles.updatedAt).toLocaleString("ja-JP")}</p>
                                <a
                                    href={card.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1 mt-1"
                                >
                                    Trelloで開く
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            カードが見つかりません
                        </div>
                    )}
                </div>
            </div>

            {/* オーバーレイ */}
            <div
                className="fixed inset-0 bg-black/20 z-40"
                onClick={() => setViewingDescriptionCard(null)}
            />
        </>
    );
}
