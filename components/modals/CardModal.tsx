"use client";

import { useState } from "react";
import { useBoardStore } from "@/stores/boardStore";
import { saveCardAssignment } from "@/app/actions/trello";
import type { ProcessedCard, CardRoles } from "@/types/trello";

interface CardModalProps {
    card: ProcessedCard;
    onClose: () => void;
}

export function CardModal({ card, onClose }: CardModalProps) {
    const { data } = useBoardStore();
    const [roles, setRoles] = useState<CardRoles>(card.roles);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"assignment" | "info" | "memo">("assignment");

    if (!data) return null;

    // 保存処理
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await saveCardAssignment(card.id, roles);
            if (result.success) {
                // ストアのカードデータを更新
                const updatedCards = data.cards.map((c) =>
                    c.id === card.id ? { ...c, roles } : c
                );
                useBoardStore.getState().setData({ ...data, cards: updatedCards });
                onClose();
            } else {
                alert("保存に失敗しました: " + result.error);
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
                className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-white truncate">{card.name}</h2>
                        <a
                            href={card.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-white/70 hover:text-white transition-colors"
                        >
                            Trelloで開く ↗
                        </a>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTogglePin}
                            className={`p-2 rounded-lg transition-colors ${roles.isPinned
                                    ? "bg-yellow-500 text-white"
                                    : "bg-white/20 text-white/70 hover:bg-white/30"
                                }`}
                            title={roles.isPinned ? "ピン解除" : "ピン留め"}
                        >
                            📌
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* タブ */}
                <div className="flex border-b border-white/10">
                    {(["assignment", "info", "memo"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab
                                    ? "text-blue-400 border-b-2 border-blue-400"
                                    : "text-white/60 hover:text-white"
                                }`}
                        >
                            {tab === "assignment" && "担当者設定"}
                            {tab === "info" && "カード情報"}
                            {tab === "memo" && "メモ"}
                        </button>
                    ))}
                </div>

                {/* コンテンツ */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {activeTab === "assignment" && (
                        <div className="space-y-4">
                            {/* 担当者選択 */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* 構築担当 */}
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">構築担当</label>
                                    <select
                                        value={roles.construction}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, construction: e.target.value }))
                                        }
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                    >
                                        <option value="">未設定</option>
                                        {data.members.construction.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* 予約システム */}
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">予約システム</label>
                                    <select
                                        value={roles.system}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, system: e.target.value }))
                                        }
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                    >
                                        <option value="">未設定</option>
                                        {data.members.system.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* 商談 */}
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">商談担当</label>
                                    <select
                                        value={roles.sales}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, sales: e.target.value }))
                                        }
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                    >
                                        <option value="">未設定</option>
                                        {data.members.sales.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* MTG */}
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">MTG担当</label>
                                    <select
                                        value={roles.mtg}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, mtg: e.target.value }))
                                        }
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                    >
                                        <option value="">未設定</option>
                                        {data.members.mtg.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* システム種別 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">システム種別1</label>
                                    <input
                                        type="text"
                                        value={roles.systemType}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, systemType: e.target.value }))
                                        }
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                        placeholder="例: WEB予約"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">システム種別2</label>
                                    <input
                                        type="text"
                                        value={roles.systemType2}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, systemType2: e.target.value }))
                                        }
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                        placeholder="例: LINE連携"
                                    />
                                </div>
                            </div>

                            {/* カスタムリンク・構築番号 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">カスタムリンク</label>
                                    <input
                                        type="text"
                                        value={roles.customLink}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, customLink: e.target.value }))
                                        }
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">構築番号</label>
                                    <input
                                        type="text"
                                        value={roles.constructionNumber}
                                        onChange={(e) =>
                                            setRoles((prev) => ({ ...prev, constructionNumber: e.target.value }))
                                        }
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                        placeholder="例: 12345"
                                    />
                                </div>
                            </div>

                            {/* メモ欄 */}
                            <div className="space-y-2">
                                {[1, 2, 3].map((num) => (
                                    <div key={num}>
                                        <label className="block text-xs text-white/60 mb-1">メモ{num}</label>
                                        <input
                                            type="text"
                                            value={roles[`memo${num}` as keyof CardRoles] as string}
                                            onChange={(e) =>
                                                setRoles((prev) => ({
                                                    ...prev,
                                                    [`memo${num}`]: e.target.value,
                                                }))
                                            }
                                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "info" && (
                        <div className="space-y-4">
                            {/* ラベル */}
                            {card.trelloLabels.length > 0 && (
                                <div>
                                    <label className="block text-xs text-white/60 mb-2">ラベル</label>
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
                                    <label className="block text-xs text-white/60 mb-1">期限</label>
                                    <p className="text-white">
                                        {new Date(card.due).toLocaleString("ja-JP")}
                                        {card.dueComplete && (
                                            <span className="ml-2 text-green-400">✓ 完了</span>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* 業種・都道府県 */}
                            {card.industries.length > 0 && (
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">業種</label>
                                    <p className="text-white">{card.industries.join(", ")}</p>
                                </div>
                            )}
                            {card.prefectures.length > 0 && (
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">都道府県</label>
                                    <p className="text-white">{card.prefectures.join(", ")}</p>
                                </div>
                            )}

                            {/* 説明 */}
                            {card.desc && (
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">説明</label>
                                    <p className="text-white whitespace-pre-wrap text-sm bg-white/5 p-3 rounded-lg">
                                        {card.desc}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "memo" && (
                        <div className="text-center text-white/60 py-8">
                            <p>メモ機能は Phase 3 で実装予定です</p>
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isSaving ? "保存中..." : "保存"}
                    </button>
                </div>
            </div>
        </div>
    );
}
