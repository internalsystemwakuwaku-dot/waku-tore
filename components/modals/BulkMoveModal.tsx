"use client";

import { useState } from "react";
import { useBoardStore } from "@/stores/boardStore";
import { moveCardToList } from "@/app/actions/trello";

interface BulkMoveModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * 一括移動モーダル - GAS完全再現版
 */
export function BulkMoveModal({ isOpen, onClose }: BulkMoveModalProps) {
    const { data, ui, clearSelection } = useBoardStore();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedListId, setSelectedListId] = useState<string>("");

    if (!isOpen || !data) return null;

    const selectedCards = data.cards.filter((c) => ui.selectedCardIds.has(c.id));
    const selectedCount = selectedCards.length;

    // 一括移動実行
    const handleBulkMove = async () => {
        if (selectedCount === 0) {
            alert("カードが選択されていません");
            return;
        }
        if (!selectedListId) {
            alert("移動先のリストを選択してください");
            return;
        }

        const targetList = data.lists.find((l) => l.id === selectedListId);
        if (!targetList) {
            alert("リストが見つかりません");
            return;
        }

        setIsSaving(true);
        try {
            let successCount = 0;
            let errorCount = 0;

            for (const card of selectedCards) {
                // 既に同じリストにあるカードはスキップ
                if (card.idList === selectedListId) continue;

                const result = await moveCardToList(card.id, selectedListId);
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            }

            // ストアのカードデータを更新
            const updatedCards = data.cards.map((c) => {
                if (!ui.selectedCardIds.has(c.id)) return c;
                return { ...c, idList: selectedListId };
            });
            useBoardStore.getState().setData({ ...data, cards: updatedCards });

            alert(`${successCount}件移動完了${errorCount > 0 ? ` (${errorCount}件失敗)` : ""}`);
            clearSelection();
            onClose();
        } catch (e) {
            alert("エラーが発生しました");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl w-[400px] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-white border-b border-gray-200 px-4 py-3">
                    <h3 className="font-bold text-gray-800">📦 一括移動</h3>
                </div>

                {/* コンテンツ */}
                <div className="p-4 space-y-4">
                    {/* 選択中件数 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                        <span className="text-blue-700 font-bold">{selectedCount}件</span>
                        <span className="text-blue-600 text-sm">のカードを一括移動</span>
                    </div>

                    {/* リスト選択 */}
                    <div>
                        <label className="block text-xs text-gray-600 mb-2">移動先のリストを選択</label>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {data.lists.map((list) => (
                                <button
                                    key={list.id}
                                    onClick={() => setSelectedListId(list.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${selectedListId === list.id
                                        ? "bg-blue-50 border-blue-500 text-blue-700"
                                        : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                                        }`}
                                >
                                    <span className="text-sm font-medium">{list.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* フッター */}
                <div className="px-4 py-3 bg-gray-100 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleBulkMove}
                        disabled={isSaving || selectedCount === 0 || !selectedListId}
                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isSaving ? "移動中..." : "移動"}
                    </button>
                </div>
            </div>
        </div>
    );
}
