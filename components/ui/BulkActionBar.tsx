"use client";

import { useBoardStore } from "@/stores/boardStore";

interface BulkActionBarProps {
    onOpenBulkAssign: () => void;
    onOpenBulkMove: () => void;
}

/**
 * 一括アクションバー - GAS完全再現版
 * 選択モード時に画面下部に固定表示
 */
export function BulkActionBar({ onOpenBulkAssign, onOpenBulkMove }: BulkActionBarProps) {
    const { ui, clearSelection, toggleBulkMode } = useBoardStore();

    const selectedCount = ui.selectedCardIds.size;

    if (!ui.isBulkMode) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-blue-800 text-white py-3 px-4 flex items-center justify-between shadow-lg z-40">
            {/* 左側：選択件数とキャンセル */}
            <div className="flex items-center gap-4">
                <div className="font-bold">
                    <span className="text-xl">{selectedCount}</span>
                    <span className="ml-1 text-sm">件 選択中</span>
                </div>
                <button
                    onClick={() => {
                        clearSelection();
                        toggleBulkMode();
                    }}
                    className="px-3 py-1.5 border border-white/50 rounded text-sm hover:bg-white/10 transition-colors"
                >
                    キャンセル
                </button>
            </div>

            {/* 右側：一括操作ボタン */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onOpenBulkAssign}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                    👥 担当者一括設定
                </button>
                <button
                    onClick={onOpenBulkMove}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                    📦 一括移動
                </button>
            </div>
        </div>
    );
}
