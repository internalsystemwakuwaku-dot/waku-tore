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
 * 繝懊・繝峨け繝ｩ繧､繧｢繝ｳ繝・- GAS鬚ｨ繝倥ャ繝繝ｼ繝・じ繧､繝ｳ
 */
export function BoardClient({ user }: BoardClientProps) {
    const { ui, toggleBulkMode, clearSelection, data, setEditingCard, setOverdueCardIds, setCurrentUserId, setHiddenListIds } = useBoardStore();
    const selectedCount = ui.selectedCardIds.size;
    const [showMemoModal, setShowMemoModal] = useState(false);
    const { config, currentTheme } = useThemeStore();
    const isThemeHydratingRef = useRef(true);
    const getUserThemeKey = (userId: string) => `waku-tore-theme-user:${userId}`;
    // ローカルキャッシュから即時反映（初期表示のちらつき低減）
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
            isThemeHydratingRef.current = true;
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
    // テーマ設定の変更をユーザー設定として保存
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

    // 繧ｪ繝ｼ繝医け繝ｪ繝・き繝ｼ遲峨・繧ｿ繧､繝槭・
    useEffect(() => {
        // 1遘偵＃縺ｨ縺ｫ繧ｲ繝ｼ繝縺ｮtick繧貞ｮ溯｡・
        const timer = setInterval(() => {
            useGameStore.getState().tick();
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // 30遘偵＃縺ｨ縺ｮ閾ｪ蜍穂ｿ晏ｭ・
    useEffect(() => {
        const AUTO_SAVE_INTERVAL = 30000; // 30遘・

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

        // 繝壹・繧ｸ繧帝屬繧後ｋ蜑阪↓繧ゆｿ晏ｭ・
        const handleBeforeUnload = () => {
            const gameState = useGameStore.getState();
            if (gameState.isDirty && gameState.data.userId) {
                // sendBeacon 繧剃ｽｿ縺｣縺ｦ髱槫酔譛溘〒菫晏ｭ假ｼ医・繝ｼ繧ｸ驕ｷ遘ｻ繧偵ヶ繝ｭ繝・け縺励↑縺・ｼ・
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
            // 繧ｯ繝ｪ繝ｼ繝ｳ繧｢繝・・譎ゅ↓繧ゆｿ晏ｭ倥ｒ隧ｦ縺ｿ繧・
            autoSave();
        };
    }, []);

    // M-14: 譛滄剞蛻・ｌ繝｡繝｢繧貞ｮ壽悄繝√ぉ繝・け
    useEffect(() => {
        const checkOverdue = async () => {
            const ids = await getOverdueMemoCardIds();
            setOverdueCardIds(ids);
        };
        checkOverdue();
        const timer = setInterval(checkOverdue, 60000); // 1蛻・ｯ・
        return () => clearInterval(timer);
    }, [setOverdueCardIds]);

    // 邱ｨ髮・ｸｭ縺ｮ繧ｫ繝ｼ繝峨ｒ蜿門ｾ・
    const editingCard = ui.editingCardId && data
        ? data.cards.find((c) => c.id === ui.editingCardId)
        : null;

    return (
        <div className={`min-h-screen flex flex-col ${config.bgType === "none" ? "bg-gray-100" : "bg-transparent"}`}>
            {/* 繝・・繝櫁レ譎ｯ */}
            <ThemeBackground />

            {/* 繝倥ャ繝繝ｼ - GAS鬚ｨ */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
                {/* 繝医ャ繝励ヰ繝ｼ */}
                <div className="max-w-[1920px] mx-auto px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* 繝ｭ繧ｴ */}
                        <Link href="/" className="flex items-center gap-2 text-gray-800 hover:text-blue-600 transition-colors">
                            <span className="text-2xl">ｫ｡</span>
                            <span className="text-lg font-bold">繧上￥笘・→繧・/span>
                            <span className="text-xs text-gray-400">v2.0</span>
                        </Link>

                        {/* 繝倥ャ繝繝ｼ謚倥ｊ縺溘◆縺ｿ */}
                        <button
                            onClick={() => setHeaderCollapsed(!headerCollapsed)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                            title="繝｡繝九Η繝ｼ髢矩哩"
                        >
                            <svg className={`w-5 h-5 transition-transform ${headerCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                        </button>

                        {/* 繧ｲ繝ｼ繝繧ｹ繝・・繧ｿ繧ｹ繝舌・ */}
                        <GameStatusBar
                            onOpenShop={() => setShowShopModal(true)}
                            onOpenRanking={() => setShowRankingModal(true)}
                            onOpenKeiba={() => setShowHorseRaceModal(true)}
                            onOpenGacha={() => setShowGachaModal(true)}
                        />
                    </div>

                    {/* 繧ｯ繧､繝・け繧｢繧ｯ繧ｷ繝ｧ繝ｳ */}
                    <div className="flex items-center gap-2">
                        {/* 荳諡ｬ謫堺ｽ懊・繧ｿ繝ｳ */}
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
                            {ui.isBulkMode ? `驕ｸ謚樔ｸｭ (${selectedCount})` : "驕ｸ謚槭Δ繝ｼ繝・}
                        </button>

                        {ui.isBulkMode && selectedCount > 0 && (
                            <div className="flex gap-1">
                                <button className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium transition-colors">
                                    遘ｻ蜍・
                                </button>
                                <button
                                    onClick={clearSelection}
                                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
                                >
                                    隗｣髯､
                                </button>
                            </div>
                        )}

                        {/* 蛹ｺ蛻・ｊ邱・*/}
                        <div className="w-px h-6 bg-gray-200 mx-1" />

                        {/* GAS鬚ｨ繧ｯ繧､繝・け繝輔ぅ繝ｫ繧ｿ繝ｼ */}
                        <QuickFilterButtons />

                        {/* 繝ｪ繝ｭ繝ｼ繝・*/}
                        <button
                            onClick={() => window.location.reload()}
                            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="繝・・繧ｿ蜀崎ｪｭ霎ｼ"
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

                        {/* 繝｡繝｢繝懊ち繝ｳ */}
                        <button
                            onClick={() => setShowMemoModal(true)}
                            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="繝｡繝｢蟶ｳ"
                        >
                            統
                        </button>

                        {/* 繝繝・す繝･繝懊・繝・*/}
                        <button
                            onClick={() => setShowDashboardModal(true)}
                            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="繝繝・す繝･繝懊・繝・
                        >
                            投
                        </button>

                        {/* 繧ｷ繝ｧ繝・・ */}

                        {/* 遶ｶ鬥ｬ */}

                        {/* 縺翫∩縺上§ */}
                        <button
                            onClick={() => setShowOmikujiModal(true)}
                            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="莉頑律縺ｮ驕句兇"
                        >
                            醗
                        </button>

                        {/* 莠亥ｮ壹し繧､繝峨ヰ繝ｼ */}
                        <ScheduleSidebar />

                        {/* 險ｭ螳壹・繧ｿ繝ｳ */}
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                        >
                            笞呻ｸ・險ｭ螳・
                        </button>

                        {/* 蛹ｺ蛻・ｊ邱・*/}
                        <div className="w-px h-6 bg-gray-200 mx-2" />

                        {/* 繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ */}
                        <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-sm font-medium">{user.name || user.email}</span>
                        </div>

                        {/* 繝ｭ繧ｰ繧｢繧ｦ繝・*/}
                        <button
                            onClick={async () => {
                                await signOut();
                                window.location.href = "/login";
                            }}
                            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded transition-colors"
                        >
                            繝ｭ繧ｰ繧｢繧ｦ繝・
                        </button>
                    </div>
                </div>

                {/* 繝輔ぅ繝ｫ繧ｿ繝ｼ繝舌・ - 謚倥ｊ縺溘◆縺ｿ蜿ｯ閭ｽ */}
                {!headerCollapsed && (
                    <div className="border-t border-gray-100 bg-gray-50">
                        <div className="max-w-[1920px] mx-auto px-4 py-2">
                            <FilterBar />
                        </div>
                    </div>
                )}
            </header>

            {/* 繝｡繧､繝ｳ繧ｳ繝ｳ繝・Φ繝・*/}
            <main className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto px-4 py-4 overflow-hidden">
                <BoardView user={user} />
            </main>

            {/* Description Sidebar (M-XX) */}
            <DescriptionSidebar />

            {/* 繧ｫ繝ｼ繝臥ｷｨ髮・Δ繝ｼ繝繝ｫ */}
            {editingCard && (
                <CardModal
                    card={editingCard}
                    userId={user.id}
                    onClose={() => setEditingCard(null)}
                    onOpenLog={(id, name) => setShowCardLogModal({ id, name })}
                />
            )}

            {/* 繝｡繝｢繝｢繝ｼ繝繝ｫ */}
            {showMemoModal && (
                <MemoModal
                    userId={user.id}
                    onClose={() => setShowMemoModal(false)}
                />
            )}

            {/* 險ｭ螳壹Δ繝ｼ繝繝ｫ */}
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />

            {/* 縺翫∩縺上§繝｢繝ｼ繝繝ｫ */}
            <OmikujiModal
                isOpen={showOmikujiModal}
                onClose={() => setShowOmikujiModal(false)}
            />

            {/* 繝ｬ繝吶Ν繧｢繝・・貍泌・ */}
            <LevelUpModal />

            {/* BGM繝励Ξ繧､繝､繝ｼ */}
            <BgmPlayer />

            {/* 繝医・繧ｹ繝磯夂衍 */}
            <ToastContainer />

            {/* 荳諡ｬ諡・ｽ楢・ｨｭ螳壹Δ繝ｼ繝繝ｫ */}
            <BulkAssignModal
                isOpen={showBulkAssignModal}
                onClose={() => setShowBulkAssignModal(false)}
            />

            {/* 荳諡ｬ遘ｻ蜍輔Δ繝ｼ繝繝ｫ */}
            <BulkMoveModal
                isOpen={showBulkMoveModal}
                onClose={() => setShowBulkMoveModal(false)}
            />

            {/* 荳諡ｬ繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝舌・ */}
            <BulkActionBar
                onOpenBulkAssign={() => setShowBulkAssignModal(true)}
                onOpenBulkMove={() => setShowBulkMoveModal(true)}
            />

            {/* 謫堺ｽ懷ｱ･豁ｴ繝｢繝ｼ繝繝ｫ */}
            {showCardLogModal && (
                <CardLogModal
                    cardId={showCardLogModal.id}
                    cardName={showCardLogModal.name}
                    onClose={() => setShowCardLogModal(null)}
                />
            )}

            {/* 繝繝・す繝･繝懊・繝峨Δ繝ｼ繝繝ｫ */}
            <DashboardModal
                isOpen={showDashboardModal}
                onClose={() => setShowDashboardModal(false)}
            />

            {/* 繧ｷ繝ｧ繝・・繝｢繝ｼ繝繝ｫ */}
            <ShopModal
                isOpen={showShopModal}
                onClose={() => setShowShopModal(false)}
            />

            {/* 遶ｶ鬥ｬ繝｢繝ｼ繝繝ｫ */}
            <HorseRaceModal
                isOpen={showHorseRaceModal}
                onClose={() => setShowHorseRaceModal(false)}
            />

            {/* 繧ｬ繝√Ε繝｢繝ｼ繝繝ｫ */}
            <GachaModal
                isOpen={showGachaModal}
                userId={user.id}
                onClose={() => setShowGachaModal(false)}
            />

            {/* 繝ｩ繝ｳ繧ｭ繝ｳ繧ｰ繝｢繝ｼ繝繝ｫ */}
            <RankingModal
                isOpen={showRankingModal}
                currentUserId={user.id}
                onClose={() => setShowRankingModal(false)}
            />
        </div>
    );
}
