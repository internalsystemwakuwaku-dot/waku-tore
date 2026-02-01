"use client";

import { useState } from "react";
import { useBoardStore } from "@/stores/boardStore";
import { saveCardAssignment, updateCardDue, moveCardToList } from "@/app/actions/trello";
import type { ProcessedCard, CardRoles } from "@/types/trello";

interface CardModalProps {
    card: ProcessedCard;
    onClose: () => void;
    onOpenLog: (cardId: string, cardName: string) => void;
}

// システム種別の選択肢
const SYSTEM_TYPE_OPTIONS = [
    "(未設定)",
    "中江式予約システム/アンケート",
    "Mokare",
];

// 構築番号の選択肢（1-50）
const CONSTRUCTION_NUMBER_OPTIONS = ["(未設定)", ...Array.from({ length: 50 }, (_, i) => String(i + 1))];

export function CardModal({ card, onClose, onOpenLog }: CardModalProps) {
    const { data } = useBoardStore();
    const [roles, setRoles] = useState<CardRoles>(card.roles);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"assignment" | "info" | "memo" | "move">("assignment");

    // 期限日時の状態
    const [dueDate, setDueDate] = useState<string>(
        card.due ? new Date(card.due).toISOString().slice(0, 16) : ""
    );

    // 移動先リストの状態
    const [selectedListId, setSelectedListId] = useState<string>(card.idList);

    if (!data) return null;

    // 現在のリスト名を取得
    const currentList = data.lists.find(l => l.id === card.idList);

    // 保存処理
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // 担当者情報を保存
            const result = await saveCardAssignment(card.id, roles);
            if (!result.success) {
                alert("保存に失敗しました: " + result.error);
                return;
            }

            // 期限日時が変更されていたらTrelloに同期
            const originalDue = card.due ? new Date(card.due).toISOString().slice(0, 16) : "";
            if (dueDate !== originalDue) {
                const dueResult = await updateCardDue(card.id, dueDate || null);
                if (!dueResult.success) {
                    alert("期限の更新に失敗しました: " + dueResult.error);
                }
            }

            // ストアのカードデータを更新
            const updatedCards = data.cards.map((c) =>
                c.id === card.id ? {
                    ...c,
                    roles,
                    due: dueDate ? new Date(dueDate).toISOString() : null
                } : c
            );
            useBoardStore.getState().setData({ ...data, cards: updatedCards });
            onClose();
        } catch (e) {
            alert("エラーが発生しました");
        } finally {
            setIsSaving(false);
        }
    };

    // 期限クリア
    const handleClearDue = () => {
        setDueDate("");
    };

    // リスト移動処理
    const handleMoveCard = async () => {
        if (selectedListId === card.idList) {
            alert("移動先が現在のリストと同じです");
            return;
        }

        setIsSaving(true);
        try {
            const result = await moveCardToList(card.id, selectedListId);
            if (result.success) {
                // ストアのカードデータを更新
                const updatedCards = data.cards.map((c) =>
                    c.id === card.id ? { ...c, idList: selectedListId } : c
                );
                useBoardStore.getState().setData({ ...data, cards: updatedCards });
                onClose();
            } else {
                alert("移動に失敗しました: " + result.error);
            }
        } catch (e) {
            alert("エラーが発生しました");
        } finally {
            setIsSaving(false);
        }
    };

    // ピン留め切り替え
    const handleTogglePin = () => {
        setRoles((prev) => ({ ...prev, isPinned: !prev.isPinned }));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー - GAS風 */}
                <div className="bg-white border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-gray-800 truncate">{card.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <a
                                    href={card.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    Trelloで開く ↗
                                </a>
                                {currentList && (
                                    <span className="text-xs text-gray-500">
                                        現在: {currentList.name}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleTogglePin}
                                className={`p-1.5 rounded transition-colors ${roles.isPinned
                                    ? "bg-yellow-100 text-yellow-600"
                                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                    }`}
                                title={roles.isPinned ? "ピン解除" : "ピン留め"}
                            >
                                📌
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </div>

                {/* タブ - GAS風 */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                    {(["assignment", "info", "memo", "move"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === tab
                                ? "text-blue-600 border-b-2 border-blue-500 bg-white"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            {tab === "assignment" && "📝 設定"}
                            {tab === "info" && "ℹ️ 情報"}
                            {tab === "memo" && "📋 メモ"}
                            {tab === "move" && "📦 移動"}
                        </button>
                    ))}
                </div>

                {/* コンテンツ */}
                <div className="p-4 overflow-y-auto max-h-[60vh] bg-gray-50">
                    {activeTab === "assignment" && (
                        <div className="space-y-4">
                            {/* 期限日時 - GAS風（Trello同期） */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <label className="block text-xs font-medium text-blue-700 mb-1">
                                    期限日時（Trello同期）
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="datetime-local"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleClearDue}
                                        className="px-2 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 text-sm"
                                        title="期限を削除"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* 構築番号・システム種別 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">構築番号</label>
                                    <select
                                        value={roles.constructionNumber}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, constructionNumber: e.target.value === "(未設定)" ? "" : e.target.value }))
                                        }
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    >
                                        {CONSTRUCTION_NUMBER_OPTIONS.map((num) => (
                                            <option key={num} value={num === "(未設定)" ? "" : num}>
                                                {num}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">システム種別1</label>
                                        <select
                                            value={roles.systemType}
                                            onChange={(e) =>
                                                setRoles((prev) => ({ ...prev, systemType: e.target.value === "(未設定)" ? "" : e.target.value }))
                                            }
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                        >
                                            {SYSTEM_TYPE_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt === "(未設定)" ? "" : opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">システム種別2</label>
                                        <select
                                            value={roles.systemType2}
                                            onChange={(e) =>
                                                setRoles((prev) => ({ ...prev, systemType2: e.target.value === "(未設定)" ? "" : e.target.value }))
                                            }
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                        >
                                            {SYSTEM_TYPE_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt === "(未設定)" ? "" : opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* カスタムリンク */}
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">リンク先URL</label>
                                <input
                                    type="text"
                                    value={roles.customLink}
                                    onChange={(e) =>
                                        setRoles((prev) => ({ ...prev, customLink: e.target.value }))
                                    }
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    placeholder="https://..."
                                />
                            </div>

                            {/* メモ1-3 */}
                            <div className="space-y-2">
                                {[1, 2, 3].map((num) => (
                                    <div key={num}>
                                        <label className="block text-xs text-gray-600 mb-1">メモ{num}</label>
                                        <input
                                            type="text"
                                            value={roles[`memo${num}` as keyof CardRoles] as string}
                                            onChange={(e) =>
                                                setRoles((prev) => ({
                                                    ...prev,
                                                    [`memo${num}`]: e.target.value,
                                                }))
                                            }
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                ))}
                            </div>

                            <hr className="border-gray-200" />

                            {/* 担当者選択 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">構築担当者</label>
                                    <select
                                        value={roles.construction}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, construction: e.target.value }))
                                        }
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    >
                                        <option value="">(未設定)</option>
                                        {data.members.construction.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">予約システム構築担当</label>
                                    <select
                                        value={roles.system}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, system: e.target.value }))
                                        }
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    >
                                        <option value="">(未設定)</option>
                                        {data.members.system.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">商談担当</label>
                                    <select
                                        value={roles.sales}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, sales: e.target.value }))
                                        }
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    >
                                        <option value="">(未設定)</option>
                                        {data.members.sales.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">MTG担当者</label>
                                    <select
                                        value={roles.mtg}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, mtg: e.target.value }))
                                        }
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    >
                                        <option value="">(未設定)</option>
                                        {data.members.mtg.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "info" && (
                        <div className="space-y-4">
                            {/* ラベル */}
                            {card.trelloLabels.length > 0 && (
                                <div>
                                    <label className="block text-xs text-gray-600 mb-2">ラベル</label>
                                    <div className="flex flex-wrap gap-2">
                                        {card.trelloLabels.map((label, i) => (
                                            <span
                                                key={i}
                                                className={`px-3 py-1 rounded-full text-sm text-white label-${label.color}`}
                                            >
                                                {label.name || label.color}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 期限 */}
                            {card.due && (
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">期限</label>
                                    <p className="text-gray-800">
                                        {new Date(card.due).toLocaleString("ja-JP")}
                                        {card.dueComplete && (
                                            <span className="ml-2 text-green-600">✓ 完了</span>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* 業種・都道府県 */}
                            {card.industries.length > 0 && (
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">業種</label>
                                    <p className="text-gray-800">{card.industries.join(", ")}</p>
                                </div>
                            )}
                            {card.prefectures.length > 0 && (
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">都道府県</label>
                                    <p className="text-gray-800">{card.prefectures.join(", ")}</p>
                                </div>
                            )}

                            {/* 説明 */}
                            {card.desc && (
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">説明</label>
                                    <p className="text-gray-800 whitespace-pre-wrap text-sm bg-white p-3 rounded-lg border border-gray-200">
                                        {card.desc}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "memo" && (
                        <div className="text-center text-gray-500 py-8">
                            <p>カードメモ機能は フェーズC で実装予定です</p>
                        </div>
                    )}

                    {activeTab === "move" && (
                        <div className="space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <p className="text-xs text-yellow-700">
                                    📦 カードを別のリストへ移動します（Trello同期）
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-600 mb-2">移動先リスト</label>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {data.lists.map((list) => (
                                        <button
                                            key={list.id}
                                            onClick={() => setSelectedListId(list.id)}
                                            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${selectedListId === list.id
                                                ? "bg-blue-50 border-blue-500 text-blue-700"
                                                : list.id === card.idList
                                                    ? "bg-gray-100 border-gray-300 text-gray-500"
                                                    : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                                                }`}
                                        >
                                            <span className="text-sm font-medium">{list.name}</span>
                                            {list.id === card.idList && (
                                                <span className="ml-2 text-xs text-gray-400">(現在)</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleMoveCard}
                                disabled={isSaving || selectedListId === card.idList}
                                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? "移動中..." : "このリストへ移動"}
                            </button>
                        </div>
                    )}
                </div>

                {/* フッター */}
                {activeTab !== "move" && (
                    <div className="px-4 py-3 bg-gray-100 border-t border-gray-200 flex justify-end gap-3">
                        <button
                            onClick={() => onOpenLog(card.id, card.name)}
                            className="mr-auto px-4 py-2 text-gray-500 hover:text-gray-700 text-xs flex items-center gap-1"
                        >
                            <span className="material-icons text-sm">history</span> 履歴
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isSaving ? "保存中..." : "保存"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
