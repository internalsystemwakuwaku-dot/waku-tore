"use client";

import { useState } from "react";
import { BoardView } from "@/components/board/BoardView";
import { FilterBar, QuickFilterButtons } from "@/components/filters/FilterBar";
import { CardModal, MemoModal } from "@/components/modals";
import { useBoardStore } from "@/stores/boardStore";
import { ThemeSelector } from "@/components/ui/ThemeSelector";
import { GameStatusBar } from "@/components/game/GameStatusBar";
import { ScheduleSidebar } from "@/components/sidebar/ScheduleSidebar";
import Link from "next/link";

interface User {
    id: string;
    email: string;
    name?: string | null;
}

interface BoardClientProps {
    user: User;
}

/**
 * ボードクライアント - GAS風ヘッダーデザイン
 */
export function BoardClient({ user }: BoardClientProps) {
    const { ui, toggleBulkMode, clearSelection, data, setEditingCard } = useBoardStore();
    const selectedCount = ui.selectedCardIds.size;
    const [showMemoModal, setShowMemoModal] = useState(false);
    const [headerCollapsed, setHeaderCollapsed] = useState(false);

    // 編集中のカードを取得
    const editingCard = ui.editingCardId && data
        ? data.cards.find((c) => c.id === ui.editingCardId)
        : null;

    return (
        <div className="min-h-screen bg-gray-100">
            {/* ヘッダー - GAS風 */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
                {/* トップバー */}
                <div className="max-w-[1920px] mx-auto px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* ロゴ */}
                        <Link href="/" className="flex items-center gap-2 text-gray-800 hover:text-blue-600 transition-colors">
                            <span className="text-2xl">🫡</span>
                            <span className="text-lg font-bold">わく☆とれ</span>
                            <span className="text-xs text-gray-400">v2.0</span>
                        </Link>

                        {/* ヘッダー折りたたみ */}
                        <button
                            onClick={() => setHeaderCollapsed(!headerCollapsed)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                            title="メニュー開閉"
                        >
                            <svg className={`w-5 h-5 transition-transform ${headerCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                        </button>

                        {/* ゲームステータスバー */}
                        <GameStatusBar />
                    </div>

                    {/* クイックアクション */}
                    <div className="flex items-center gap-2">
                        {/* 一括操作ボタン */}
                        <button
                            onClick={toggleBulkMode}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${ui.isBulkMode
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            {ui.isBulkMode ? `選択中 (${selectedCount})` : "選択モード"}
                        </button>

                        {ui.isBulkMode && selectedCount > 0 && (
                            <div className="flex gap-1">
                                <button className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium transition-colors">
                                    移動
                                </button>
                                <button
                                    onClick={clearSelection}
                                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
                                >
                                    解除
                                </button>
                            </div>
                        )}

                        {/* 区切り線 */}
                        <div className="w-px h-6 bg-gray-200 mx-1" />

                        {/* GAS風クイックフィルター */}
                        <QuickFilterButtons />

                        {/* リロード */}
                        <button
                            onClick={() => window.location.reload()}
                            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
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
                            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="メモ帳"
                        >
                            📝
                        </button>

                        {/* ダッシュボード（TODO） */}
                        <button
                            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="ダッシュボード"
                        >
                            📊
                        </button>

                        {/* 予定サイドバー */}
                        <ScheduleSidebar />

                        {/* テーマセレクター */}
                        <ThemeSelector />

                        {/* 区切り線 */}
                        <div className="w-px h-6 bg-gray-200 mx-2" />

                        {/* ユーザー情報 */}
                        <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-sm font-medium">{user.name || user.email}</span>
                        </div>

                        {/* ログアウト */}
                        <form action="/api/auth/sign-out" method="POST">
                            <button
                                type="submit"
                                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded transition-colors"
                            >
                                ログアウト
                            </button>
                        </form>
                    </div>
                </div>

                {/* フィルターバー - 折りたたみ可能 */}
                {!headerCollapsed && (
                    <div className="border-t border-gray-100 bg-gray-50">
                        <div className="max-w-[1920px] mx-auto px-4 py-2">
                            <FilterBar />
                        </div>
                    </div>
                )}
            </header>

            {/* メインコンテンツ */}
            <main className="max-w-[1920px] mx-auto px-4 py-4">
                <BoardView />
            </main>

            {/* 非表示リスト復元ボタン */}
            {data && ui.hiddenListIds.size > 0 && (
                <div className="fixed bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">
                        非表示リスト: {ui.hiddenListIds.size}
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {Array.from(ui.hiddenListIds).map((listId) => {
                            const list = data.lists.find((l) => l.id === listId);
                            return (
                                <button
                                    key={listId}
                                    onClick={() => useBoardStore.getState().toggleListVisibility(listId)}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs rounded transition-colors"
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
