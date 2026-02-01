"use client";

import { useState } from "react";
import { useBoardStore } from "@/stores/boardStore";
import { saveCardAssignment } from "@/app/actions/trello";

interface BulkAssignModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// システム種別の選択肢
const SYSTEM_TYPE_OPTIONS = [
    "(変更しない)",
    "中江式予約システム/アンケート",
    "Mokare",
];

/**
 * 一括担当者設定モーダル - GAS完全再現版
 */
export function BulkAssignModal({ isOpen, onClose }: BulkAssignModalProps) {
    const { data, ui, clearSelection } = useBoardStore();
    const [isSaving, setIsSaving] = useState(false);

    // 一括設定の状態
    const [bulkData, setBulkData] = useState({
        systemType: "",
        systemType2: "",
        construction: "",
        system: "",
        sales: "",
        mtg: "",
    });

    if (!isOpen || !data) return null;

    const selectedCards = data.cards.filter((c) => ui.selectedCardIds.has(c.id));
    const selectedCount = selectedCards.length;

    // 一括更新実行
    const handleBulkSubmit = async () => {
        if (selectedCount === 0) {
            alert("カードが選択されていません");
            return;
        }

        // 変更がない場合は警告
        const hasChange = Object.values(bulkData).some(v => v && v !== "(変更しない)");
        if (!hasChange) {
            alert("変更する項目を選択してください");
            return;
        }

        setIsSaving(true);
        try {
            let successCount = 0;
            let errorCount = 0;

            for (const card of selectedCards) {
                const updatedRoles = { ...card.roles };

                // 変更がある項目のみ更新
                if (bulkData.systemType && bulkData.systemType !== "(変更しない)") {
                    updatedRoles.systemType = bulkData.systemType;
                }
                if (bulkData.systemType2 && bulkData.systemType2 !== "(変更しない)") {
                    updatedRoles.systemType2 = bulkData.systemType2;
                }
                if (bulkData.construction && bulkData.construction !== "(変更しない)") {
                    updatedRoles.construction = bulkData.construction;
                }
                if (bulkData.system && bulkData.system !== "(変更しない)") {
                    updatedRoles.system = bulkData.system;
                }
                if (bulkData.sales && bulkData.sales !== "(変更しない)") {
                    updatedRoles.sales = bulkData.sales;
                }
                if (bulkData.mtg && bulkData.mtg !== "(変更しない)") {
                    updatedRoles.mtg = bulkData.mtg;
                }

                const result = await saveCardAssignment(card.id, updatedRoles);
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            }

            // ストアのカードデータを更新
            const updatedCards = data.cards.map((c) => {
                if (!ui.selectedCardIds.has(c.id)) return c;

                const updatedRoles = { ...c.roles };
                if (bulkData.systemType && bulkData.systemType !== "(変更しない)") {
                    updatedRoles.systemType = bulkData.systemType;
                }
                if (bulkData.systemType2 && bulkData.systemType2 !== "(変更しない)") {
                    updatedRoles.systemType2 = bulkData.systemType2;
                }
                if (bulkData.construction && bulkData.construction !== "(変更しない)") {
                    updatedRoles.construction = bulkData.construction;
                }
                if (bulkData.system && bulkData.system !== "(変更しない)") {
                    updatedRoles.system = bulkData.system;
                }
                if (bulkData.sales && bulkData.sales !== "(変更しない)") {
                    updatedRoles.sales = bulkData.sales;
                }
                if (bulkData.mtg && bulkData.mtg !== "(変更しない)") {
                    updatedRoles.mtg = bulkData.mtg;
                }

                return { ...c, roles: updatedRoles };
            });
            useBoardStore.getState().setData({ ...data, cards: updatedCards });

            alert(`${successCount}件更新完了${errorCount > 0 ? ` (${errorCount}件失敗)` : ""}`);
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
                className="bg-white rounded-lg shadow-xl w-[450px] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-white border-b border-gray-200 px-4 py-3">
                    <h3 className="font-bold text-gray-800">👥 一括担当者設定</h3>
                    <p className="text-xs text-red-600 mt-1">
                        ※ 変更したい項目のみ選択してください。未選択の項目は変更されません。
                    </p>
                </div>

                {/* コンテンツ */}
                <div className="p-4 space-y-4">
                    {/* 選択中件数 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                        <span className="text-blue-700 font-bold">{selectedCount}件</span>
                        <span className="text-blue-600 text-sm">のカードを一括更新</span>
                    </div>

                    {/* システム種別 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">システム種別 1</label>
                            <select
                                value={bulkData.systemType}
                                onChange={(e) => setBulkData((prev) => ({ ...prev, systemType: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            >
                                {SYSTEM_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">システム種別 2</label>
                            <select
                                value={bulkData.systemType2}
                                onChange={(e) => setBulkData((prev) => ({ ...prev, systemType2: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            >
                                {SYSTEM_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* 担当者 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">構築担当者</label>
                            <select
                                value={bulkData.construction}
                                onChange={(e) => setBulkData((prev) => ({ ...prev, construction: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            >
                                <option value="">(変更しない)</option>
                                {data.members.construction.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">予約システム構築担当</label>
                            <select
                                value={bulkData.system}
                                onChange={(e) => setBulkData((prev) => ({ ...prev, system: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            >
                                <option value="">(変更しない)</option>
                                {data.members.system.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">商談担当</label>
                            <select
                                value={bulkData.sales}
                                onChange={(e) => setBulkData((prev) => ({ ...prev, sales: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            >
                                <option value="">(変更しない)</option>
                                {data.members.sales.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">MTG担当者</label>
                            <select
                                value={bulkData.mtg}
                                onChange={(e) => setBulkData((prev) => ({ ...prev, mtg: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            >
                                <option value="">(変更しない)</option>
                                {data.members.mtg.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
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
                        onClick={handleBulkSubmit}
                        disabled={isSaving || selectedCount === 0}
                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isSaving ? "更新中..." : "一括更新"}
                    </button>
                </div>
            </div>
        </div>
    );
}
