"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { BoardView } from "@/components/board/BoardView";
import { FilterBar, QuickFilterButtons } from "@/components/filters/FilterBar";
import { CardModal, MemoModal } from "@/components/modals";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { BulkAssignModal } from "@/components/modals/BulkAssignModal";
import { BulkMoveModal } from "@/components/modals/BulkMoveModal";
import { CardLogModal } from "@/components/modals/CardLogModal";
import { DashboardModal } from "@/components/modals/DashboardModal";
import { ShopModal } from "@/components/modals/ShopModal";
import { HorseRaceModal } from "@/components/modals/HorseRaceModal";
import { useBoardStore } from "@/stores/boardStore";
import { useGameStore } from "@/stores/gameStore";
import { useThemeStore } from "@/stores/themeStore";
import { GameStatusBar } from "@/components/game/GameStatusBar";
import { LevelUpModal } from "@/components/game/LevelUpModal";
import { OmikujiModal } from "@/components/game/OmikujiModal";
import { GachaModal } from "@/components/game/GachaModal";
import { RankingModal } from "@/components/game/RankingModal";
import { ScheduleSidebar } from "@/components/sidebar/ScheduleSidebar";
import { DescriptionSidebar } from "@/components/sidebar/DescriptionSidebar";
import { BgmPlayer } from "@/components/ui/BgmPlayer";
import { ToastContainer } from "@/components/ui/Toast";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { ThemeBackground } from "@/components/ui/ThemeBackground";
import Link from "next/link";
import { getOverdueMemoCardIds } from "@/app/actions/memo";
import { updateGameSettings } from "@/app/actions/game";
import { signOut } from "@/lib/auth/client";

interface User {
    id: string;
    email: string;
    name?: string | null;
}

interface BoardClientProps {
    user: User;
}

/**
 * ボ�EドクライアンチE- GAS風ヘッダーチE��イン
 */
export function BoardClient({ user }: BoardClientProps) {
    const { ui, toggleBulkMode, clearSelection, data, setEditingCard, setOverdueCardIds, setCurrentUserId, setHiddenListIds } = useBoardStore();
    const selectedCount = ui.selectedCardIds.size;
    const [showMemoModal, setShowMemoModal] = useState(false);
    const { config, currentTheme } = useThemeStore();
    const isThemeHydratingRef = useRef(true);
    const getUserThemeKey = (userId: string) => `waku-tore-theme-user:${userId}`;
    // ���[�J���L���b�V�����瑦�����f�i�����\���̂�����ጸ�j
    useLayoutEffect(() => {
        if (!user?.id) return;
        const key = getUserThemeKey(user.id);
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                isThemeHydratingRef.current = true;
                if (parsed.theme) {
                    useThemeStore.getState().setTheme(parsed.theme);
                }
                if (parsed.config) {
                    useThemeStore.getState().updateConfig(parsed.config);
                }
            } catch {
                // ignore invalid cache
            } finally {
                isThemeHydratingRef.current = false;
            }
        } else {
            isThemeHydratingRef.current = false;
        }
    }, [user?.id]);
    useEffect(() => {
        if (user?.id) {
            setCurrentUserId(user.id);
            import("@/app/actions/game").then(async ({ getGameData }) => {
                try {
                    const gameData = await getGameData(user.id);

                    useGameStore.getState().setData(gameData, true);
                    if (gameData.settings.hiddenListIds) {
                        setHiddenListIds(gameData.settings.hiddenListIds);
                    }

                    isThemeHydratingRef.current = true;
                    if (gameData.settings.theme) {
                        useThemeStore.getState().setTheme(gameData.settings.theme as any);
                    }
                    if (gameData.settings.themeConfig) {
                        useThemeStore.getState().updateConfig(gameData.settings.themeConfig);
                    }
                    isThemeHydratingRef.current = false;
                } catch (e) {
                    console.error("Failed to load user settings:", e);
                    isThemeHydratingRef.current = false;
                }
            });
        }
    }, [user?.id, setCurrentUserId, setHiddenListIds]);
    // �e�[�}�ݒ�̕ύX����[�U�[�ݒ�Ƃ��ĕۑ�
    useEffect(() => {
        if (!user?.id) return;
        if (isThemeHydratingRef.current) return;

        const timer = setTimeout(() => {
            const key = getUserThemeKey(user.id);
            localStorage.setItem(
                key,
                JSON.stringify({ theme: currentTheme, config })
            );
            updateGameSettings(user.id, {
                theme: currentTheme,
                themeConfig: config,
            }).catch((e) => console.error("Failed to save theme settings:", e));
        }, 300);

        return () => clearTimeout(timer);
    }, [user?.id, currentTheme, config]);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showOmikujiModal, setShowOmikujiModal] = useState(false);
    const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
    const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
    const [showCardLogModal, setShowCardLogModal] = useState<{ id: string; name: string } | null>(null);
    const [showDashboardModal, setShowDashboardModal] = useState(false);
    const [showShopModal, setShowShopModal] = useState(false);
    const [showHorseRaceModal, setShowHorseRaceModal] = useState(false);
    const [showGachaModal, setShowGachaModal] = useState(false);
    const [showRankingModal, setShowRankingModal] = useState(false);
    const [headerCollapsed, setHeaderCollapsed] = useState(false);

    // オートクリチE��ー等�Eタイマ�E
    useEffect(() => {
        // 1秒ごとにゲームのtickを実衁E
        const timer = setInterval(() => {
            useGameStore.getState().tick();
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // 30秒ごとの自動保孁E
    useEffect(() => {
        const AUTO_SAVE_INTERVAL = 30000; // 30私E

        const autoSave = async () => {
            const gameState = useGameStore.getState();
            if (gameState.isDirty && gameState.data.userId) {
                try {
                    const { saveGameData } = await import("@/app/actions/game");
                    const result = await saveGameData(gameState.data.userId, gameState.data);
                    if (result.success) {
                        gameState.markClean();
                        console.log("[AutoSave] Game data saved successfully");
                    } else {
                        console.error("[AutoSave] Failed to save game data");
                    }
                } catch (e) {
                    console.error("[AutoSave] Error saving game data:", e);
                }
            }
        };

        const timer = setInterval(autoSave, AUTO_SAVE_INTERVAL);

        // ペ�Eジを離れる前にも保孁E
        const handleBeforeUnload = () => {
            const gameState = useGameStore.getState();
            if (gameState.isDirty && gameState.data.userId) {
                // sendBeacon を使って非同期で保存（�Eージ遷移をブロチE��しなぁE��E
                navigator.sendBeacon(
                    "/api/game/save",
                    JSON.stringify({ userId: gameState.data.userId, data: gameState.data })
                );
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            clearInterval(timer);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            // クリーンアチE�E時にも保存を試みめE
            autoSave();
        };
    }, []);

    // M-14: 期限刁E��メモを定期チェチE��
    useEffect(() => {
        const checkOverdue = async () => {
            const ids = await getOverdueMemoCardIds();
            setOverdueCardIds(ids);
        };
        checkOverdue();
        const timer = setInterval(checkOverdue, 60000); // 1刁E��E
        return () => clearInterval(timer);
    }, [setOverdueCardIds]);

    // 編雁E��のカードを取征E
    const editingCard = ui.editingCardId && data
        ? data.cards.find((c) => c.id === ui.editingCardId)
        : null;

    return (
        <div className={`min-h-screen flex flex-col ${config.bgType === "none" ? "bg-gray-100" : "bg-transparent"}`}>
            {/* テーマ背景 */}
            <ThemeBackground />

            {/* ヘッダー - GAS風 */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
                {/* トップバー */}
                <div className="max-w-[1920px] mx-auto px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* ロゴ */}
                        <Link href="/" className="flex items-center gap-2 text-gray-800 hover:text-blue-600 transition-colors">
                            <span className="text-2xl">🫡</span>
                            <span className="text-lg font-bold">わくとれ</span>
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
                        <GameStatusBar
                            onOpenShop={() => setShowShopModal(true)}
                            onOpenRanking={() => setShowRankingModal(true)}
                            onOpenKeiba={() => setShowHorseRaceModal(true)}
                            onOpenGacha={() => setShowGachaModal(true)}
                        />
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

                        {/* 区切り線*/}
                        <div className="w-px h-6 bg-gray-200 mx-1" />

                        {/* GAS風クイックフィルター */}
                        <QuickFilterButtons />

                        {/* リロード*/}
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

                        {/* ダッシュボード */}
                        <button
                            onClick={() => setShowDashboardModal(true)}
                            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="ダッシュボード"
                        >
                            📊
                        </button>

                        {/* ショップ */}

                        {/* 競馬 */}

                        {/* おみくじ */}
                        <button
                            onClick={() => setShowOmikujiModal(true)}
                            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="今日の運勢"
                        >
                            🔮
                        </button>

                        {/* 予定サイドバー */}
                        <ScheduleSidebar />

                        {/* 設定ボタン */}
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                        >
                            ⚙ 設定
                        </button>

                        {/* 区切り線*/}
                        <div className="w-px h-6 bg-gray-200 mx-2" />

                        {/* ユーザー情報 */}
                        <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-sm font-medium">{user.name || user.email}</span>
                        </div>

                        {/* ログアウト*/}
                        <button
                            onClick={async () => {
                                await signOut();
                                window.location.href = "/login";
                            }}
                            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded transition-colors"
                        >
                            ログアウト
                        </button>
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

            {/* メインコンテンツ*/}
            <main className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto px-4 py-4 overflow-hidden">
                <BoardView user={user} />
            </main>

            {/* Description Sidebar (M-XX) */}
            <DescriptionSidebar />

            {/* カード編集モーダル */}
            {editingCard && (
                <CardModal
                    card={editingCard}
                    userId={user.id}
                    onClose={() => setEditingCard(null)}
                    onOpenLog={(id, name) => setShowCardLogModal({ id, name })}
                />
            )}

            {/* メモモーダル */}
            {showMemoModal && (
                <MemoModal
                    userId={user.id}
                    onClose={() => setShowMemoModal(false)}
                />
            )}

            {/* 設定モーダル */}
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />

            {/* おみくじモーダル */}
            <OmikujiModal
                isOpen={showOmikujiModal}
                onClose={() => setShowOmikujiModal(false)}
            />

            {/* レベルアップ演出 */}
            <LevelUpModal />

            {/* BGMプレイヤー */}
            <BgmPlayer />

            {/* トースト通知 */}
            <ToastContainer />

            {/* 一括担当者設定モーダル */}
            <BulkAssignModal
                isOpen={showBulkAssignModal}
                onClose={() => setShowBulkAssignModal(false)}
            />

            {/* 一括移動モーダル */}
            <BulkMoveModal
                isOpen={showBulkMoveModal}
                onClose={() => setShowBulkMoveModal(false)}
            />

            {/* 一括アクションバー */}
            <BulkActionBar
                onOpenBulkAssign={() => setShowBulkAssignModal(true)}
                onOpenBulkMove={() => setShowBulkMoveModal(true)}
            />

            {/* 操作履歴モーダル */}
            {showCardLogModal && (
                <CardLogModal
                    cardId={showCardLogModal.id}
                    cardName={showCardLogModal.name}
                    onClose={() => setShowCardLogModal(null)}
                />
            )}

            {/* ダッシュボードモーダル */}
            <DashboardModal
                isOpen={showDashboardModal}
                onClose={() => setShowDashboardModal(false)}
            />

            {/* ショップモーダル */}
            <ShopModal
                isOpen={showShopModal}
                onClose={() => setShowShopModal(false)}
            />

            {/* 競馬モーダル */}
            <HorseRaceModal
                isOpen={showHorseRaceModal}
                onClose={() => setShowHorseRaceModal(false)}
            />

            {/* ガチャモーダル */}
            <GachaModal
                isOpen={showGachaModal}
                userId={user.id}
                onClose={() => setShowGachaModal(false)}
            />

            {/* ランキングモーダル */}
            <RankingModal
                isOpen={showRankingModal}
                currentUserId={user.id}
                onClose={() => setShowRankingModal(false)}
            />
        </div>
    );
}
