"use client";

import { useBoardStore } from "@/stores/boardStore";
import type { ProcessedCard } from "@/types/trello";

interface CardItemProps {
    card: ProcessedCard;
    hasOverdueMemo: boolean;
}

/**
 * GASシステム風のカードアイテム
 * 白背景、明瞭な情報表示、ホバーエフェクト
 */
export function CardItem({ card, hasOverdueMemo }: CardItemProps) {
    const { ui, toggleCardSelection, setEditingCard } = useBoardStore();
    const isSelected = ui.selectedCardIds.has(card.id);

    // 期限の表示形式とスタイル
    const getDueInfo = () => {
        if (!card.due) return null;

        const dueDate = new Date(card.due);
        const now = new Date();
        const diffMs = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // 表示形式
        const dateStr = dueDate.toLocaleDateString("ja-JP", {
            month: "short",
            day: "numeric",
        });
        const timeStr = dueDate.toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
        });

        // スタイル - GAS風の明確なカラー
        let bgColor = "bg-gray-100 text-gray-600 border-gray-200";
        let icon = "🕐";
        if (card.dueComplete) {
            bgColor = "bg-green-100 text-green-700 border-green-200";
            icon = "✓";
        } else if (diffMs < 0) {
            bgColor = "bg-red-100 text-red-700 border-red-200";
            icon = "🔥";
        } else if (diffDays <= 1) {
            bgColor = "bg-orange-100 text-orange-700 border-orange-200";
            icon = "⚠️";
        } else if (diffDays <= 3) {
            bgColor = "bg-yellow-100 text-yellow-700 border-yellow-200";
            icon = "📅";
        }

        return { dateStr, timeStr, bgColor, icon, isComplete: card.dueComplete };
    };

    const dueInfo = getDueInfo();

    // カードクリック
    const handleClick = () => {
        if (ui.isBulkMode) {
            toggleCardSelection(card.id);
        } else {
            setEditingCard(card.id);
        }
    };

    // 右クリックメニュー
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        // コンテキストメニュー表示（TODO）
    };

    // Trelloリンクを開く
    const handleOpenTrello = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (card.url) {
            window.open(card.url, "_blank");
        }
    };

    return (
        <div
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            className={`
                relative bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200
                border hover:border-blue-300 cursor-pointer
                ${isSelected ? "ring-2 ring-blue-500 border-blue-400" : "border-gray-200"}
                ${card.roles.isPinned ? "border-l-4 border-l-yellow-400" : ""}
                ${hasOverdueMemo ? "ring-1 ring-red-400" : ""}
            `}
        >
            {/* ラベル行 */}
            {card.trelloLabels.length > 0 && (
                <div className="flex flex-wrap gap-1 px-3 pt-2">
                    {card.trelloLabels.map((label, i) => (
                        <span
                            key={i}
                            className={`h-2 rounded-full label-${label.color || "gray"}`}
                            style={{ width: label.name ? "auto" : "32px", minWidth: "32px", padding: label.name ? "0 8px" : 0 }}
                            title={label.name}
                        />
                    ))}
                </div>
            )}

            {/* メインコンテンツ */}
            <div className="p-3">
                {/* カード名 */}
                <h4 className="text-sm text-gray-800 font-medium leading-snug mb-2 flex items-start gap-1">
                    {hasOverdueMemo && (
                        <span className="text-red-500 flex-shrink-0" title="期限切れメモあり">
                            ⚠️
                        </span>
                    )}
                    {card.roles.isPinned && (
                        <span className="text-yellow-500 flex-shrink-0" title="ピン留め">
                            📌
                        </span>
                    )}
                    <span className="flex-1">{card.name}</span>
                </h4>

                {/* 期限 */}
                {dueInfo && (
                    <div
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${dueInfo.bgColor}`}
                    >
                        <span>{dueInfo.icon}</span>
                        <span className="font-medium">{dueInfo.dateStr}</span>
                        <span className="opacity-70">{dueInfo.timeStr}</span>
                    </div>
                )}

                {/* 担当者グリッド - GAS風の2列レイアウト */}
                {(card.roles.construction || card.roles.system || card.roles.sales || card.roles.mtg) && (
                    <div className="mt-2 grid grid-cols-2 gap-1">
                        {card.roles.construction && (
                            <div className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">
                                <span className="font-medium">構築</span>
                                <span className="truncate">{card.roles.construction}</span>
                            </div>
                        )}
                        {card.roles.system && (
                            <div className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100">
                                <span className="font-medium">予約</span>
                                <span className="truncate">{card.roles.system}</span>
                            </div>
                        )}
                        {card.roles.sales && (
                            <div className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
                                <span className="font-medium">商談</span>
                                <span className="truncate">{card.roles.sales}</span>
                            </div>
                        )}
                        {card.roles.mtg && (
                            <div className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100">
                                <span className="font-medium">MTG</span>
                                <span className="truncate">{card.roles.mtg}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* システム種別・構築番号 */}
                {(card.roles.systemType || card.roles.constructionNumber) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {card.roles.systemType && (
                            <span className="bg-gray-100 px-2 py-0.5 rounded">
                                📱 {card.roles.systemType}
                            </span>
                        )}
                        {card.roles.constructionNumber && (
                            <span className="bg-gray-100 px-2 py-0.5 rounded">
                                🔢 No.{card.roles.constructionNumber}
                            </span>
                        )}
                    </div>
                )}

                {/* メモ表示 */}
                {(card.roles.memo1 || card.roles.memo2 || card.roles.memo3) && (
                    <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                        {card.roles.memo1 && <div className="truncate">📝 {card.roles.memo1}</div>}
                        {card.roles.memo2 && <div className="truncate">📝 {card.roles.memo2}</div>}
                        {card.roles.memo3 && <div className="truncate">📝 {card.roles.memo3}</div>}
                    </div>
                )}
            </div>

            {/* フッター - Trelloリンク */}
            <div className="px-3 pb-2 flex items-center justify-between">
                <button
                    onClick={handleOpenTrello}
                    className="text-xs text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.5 3h-15A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3m-9 15a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 10.5 6h3A1.5 1.5 0 0 1 15 7.5v3a1.5 1.5 0 0 1-1.5 1.5h-3v4.5a1.5 1.5 0 0 1-1.5 1.5" />
                    </svg>
                    Trello
                </button>

                {/* カスタムリンク */}
                {card.roles.customLink && (
                    <a
                        href={card.roles.customLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-green-500 hover:text-green-700 hover:underline flex items-center gap-1"
                    >
                        🔗 リンク
                    </a>
                )}
            </div>

            {/* 一括選択モード時のチェックボックス */}
            {ui.isBulkMode && (
                <div className="absolute top-2 right-2">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCardSelection(card.id)}
                        className="w-4 h-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500"
                    />
                </div>
            )}
        </div>
    );
}
