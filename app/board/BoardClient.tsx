"use client";

import { useState } from "react";
import { BoardView } from "@/components/board/BoardView";
import { FilterBar } from "@/components/filters/FilterBar";
import { CardModal, MemoModal } from "@/components/modals";
import { useBoardStore } from "@/stores/boardStore";
import Link from "next/link";

interface User {
    id: string;
    email: string;
    name?: string | null;
}

interface BoardClientProps {
    user: User;
}

export function BoardClient({ user }: BoardClientProps) {
    const { ui, toggleBulkMode, clearSelection, data, setEditingCard } = useBoardStore();
    const selectedCount = ui.selectedCardIds.size;
    const [showMemoModal, setShowMemoModal] = useState(false);

    // 編集中のカードを取得
    const editingCard = ui.editingCardId && data
        ? data.cards.find((c) => c.id === ui.editingCardId)
        : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
            {/* ヘッダー */}
            <header className="bg-white/10 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
                <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-2xl">🫡</span>
                            わく☆とれ
                        </Link>

                        {/* 一括操作ボタン */}
                        <button
                            onClick={toggleBulkMode}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${ui.isBulkMode
                                ? "bg-blue-500 text-white"
                                : "bg-white/10 text-white/70 hover:bg-white/20"
                                }`}
                        >
                            {ui.isBulkMode ? `✓ 一括選択中 (${selectedCount})` : "一括操作"}
                        </button>

                        {ui.isBulkMode && selectedCount > 0 && (
                            <div className="flex gap-2">
                                <button className="px-3 py-1.5 bg-green-500/80 hover:bg-green-500 text-white rounded-lg text-sm transition-colors">
                                    移動
                                </button>
                                <button
                                    onClick={clearSelection}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm transition-colors"
                                >
                                    選択解除
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        {/* リロードボタン */}
                        <button
                            onClick={() => window.location.reload()}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 transition-colors"
                            title="データ再読込"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                        </button>

                        {/* メモボタン */}
                        <button
                            onClick={() => setShowMemoModal(true)}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 transition-colors"
                            title="メモ帳"
                        >
                            📝
                        </button>

                        {/* ユーザー情報 */}
                        <div className="flex items-center gap-2 text-white/80">
                            <span className="text-sm">{user.name || user.email}</span>
                        </div>

                        {/* ログアウト */}
                        <form action="/api/auth/sign-out" method="POST">
                            <button
                                type="submit"
                                className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors"
                            >
                                ログアウト
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="max-w-[1920px] mx-auto px-4 py-6">
                {/* フィルターバー */}
                <FilterBar />

                {/* ボードビュー */}
                <BoardView />
            </main>

            {/* 非表示リスト復元ボタン */}
            {data && ui.hiddenListIds.size > 0 && (
                <div className="fixed bottom-4 left-4 bg-white/10 backdrop-blur-md rounded-lg p-3 border border-white/20">
                    <p className="text-xs text-white/60 mb-2">
                        非表示リスト: {ui.hiddenListIds.size}
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {Array.from(ui.hiddenListIds).map((listId) => {
                            const list = data.lists.find((l) => l.id === listId);
                            return (
                                <button
                                    key={listId}
                                    onClick={() => useBoardStore.getState().toggleListVisibility(listId)}
                                    className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded transition-colors"
                                >
                                    {list?.name || listId} ×
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* カード編集モーダル */}
            {editingCard && (
                <CardModal
                    card={editingCard}
                    onClose={() => setEditingCard(null)}
                />
            )}

            {/* メモモーダル */}
            {showMemoModal && (
                <MemoModal
                    userId={user.id}
                    onClose={() => setShowMemoModal(false)}
                />
            )}
        </div>
    );
}

