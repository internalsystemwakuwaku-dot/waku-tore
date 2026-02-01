"use client";

import { useBoardStore } from "@/stores/boardStore";
import type { ProcessedCard } from "@/types/trello";

interface CardItemProps {
    card: ProcessedCard;
    hasOverdueMemo: boolean;
}

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

        // スタイル
        let style = "bg-gray-500/30 text-gray-300";
        if (card.dueComplete) {
            style = "bg-green-500/30 text-green-300";
        } else if (diffMs < 0) {
            style = "bg-red-500/30 text-red-300"; // 期限切れ
        } else if (diffDays <= 1) {
            style = "bg-orange-500/30 text-orange-300"; // 24時間以内
        } else if (diffDays <= 3) {
            style = "bg-yellow-500/30 text-yellow-300"; // 3日以内
        }

        return { dateStr, timeStr, style, isComplete: card.dueComplete };
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

    // 右クリックメニュー（TODO: 実装）
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        // コンテキストメニュー表示
    };

    return (
        <div
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            className={`
        bg-white/10 hover:bg-white/15 rounded-lg p-3 cursor-pointer transition-all
        border border-transparent hover:border-white/20
        ${isSelected ? "ring-2 ring-blue-500 border-blue-500/50" : ""}
        ${card.roles.isPinned ? "border-l-4 border-l-yellow-500" : ""}
      `}
        >
            {/* ラベル */}
            {card.trelloLabels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {card.trelloLabels.map((label, i) => (
                        <span
                            key={i}
                            className={`h-2 w-8 rounded-full label-${label.color || "gray"}`}
                            title={label.name}
                        />
                    ))}
                </div>
            )}

            {/* カード名 */}
            <h4 className="text-sm text-white font-medium leading-snug mb-2">
                {hasOverdueMemo && (
                    <span className="text-red-400 mr-1" title="期限切れメモあり">
                        ⚠️
                    </span>
                )}
                {card.name}
            </h4>

            {/* 期限 */}
            {dueInfo && (
                <div
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${dueInfo.style}`}
                >
                    {dueInfo.isComplete && <span>✓</span>}
                    <span>{dueInfo.dateStr}</span>
                    <span className="opacity-70">{dueInfo.timeStr}</span>
                </div>
            )}

            {/* 担当者情報 */}
            {(card.roles.construction ||
                card.roles.system ||
                card.roles.sales ||
                card.roles.mtg) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {card.roles.construction && (
                            <span className="text-xs bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded">
                                構築: {card.roles.construction}
                            </span>
                        )}
                        {card.roles.system && (
                            <span className="text-xs bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded">
                                予約: {card.roles.system}
                            </span>
                        )}
                        {card.roles.sales && (
                            <span className="text-xs bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded">
                                商談: {card.roles.sales}
                            </span>
                        )}
                        {card.roles.mtg && (
                            <span className="text-xs bg-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded">
                                MTG: {card.roles.mtg}
                            </span>
                        )}
                    </div>
                )}

            {/* システム種別・構築番号 */}
            {(card.roles.systemType || card.roles.constructionNumber) && (
                <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
                    {card.roles.systemType && <span>📱 {card.roles.systemType}</span>}
                    {card.roles.constructionNumber && (
                        <span>🔢 No.{card.roles.constructionNumber}</span>
                    )}
                </div>
            )}

            {/* 一括選択モード時のチェックボックス */}
            {ui.isBulkMode && (
                <div className="absolute top-2 right-2">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCardSelection(card.id)}
                        className="w-4 h-4 rounded border-white/30 bg-white/10"
                    />
                </div>
            )}
        </div>
    );
}
