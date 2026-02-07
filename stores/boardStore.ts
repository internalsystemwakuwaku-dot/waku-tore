import { create } from "zustand";
import type { BoardData, ProcessedCard, TrelloListInfo } from "@/types/trello";
import { updateGameSettings } from "@/app/actions/game";

// フィルター状態
interface FilterState {
    search: string;
    construction: string;
    system: string;
    sales: string;
    mtg: string;
    industry: string;
    prefecture: string;
    trelloLabel: string;
    systemType: string;
    quickFilter: "none" | "overdue" | "due24h" | "due3d";
    sortMode: "none" | "due-asc" | "updated-desc" | "name-asc";
}

// UI状態
interface UIState {
    isBulkMode: boolean;
    selectedCardIds: Set<string>;
    hiddenListIds: Set<string>;
    unlockedListIds: Set<string>;
    sidebarType: "today" | "tomorrow" | "nextMonday" | null;
    editingCardId: string | null;
    viewingDescriptionCardId: string | null; // M-XX: 説明詳細表示用
    overdueCardIds: Set<string>;
}

// ボードストア
interface BoardStore {
    // データ
    data: BoardData | null;
    isLoading: boolean;
    error: string | null;
    currentUserId: string | null;

    // フィルター
    filters: FilterState;

    // UI状態
    ui: UIState;

    // アクション
    setData: (data: BoardData | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setCurrentUserId: (userId: string | null) => void;

    // フィルター操作
    setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
    resetFilters: () => void;

    // UI操作
    toggleBulkMode: () => void;
    toggleCardSelection: (cardId: string) => void;
    clearSelection: () => void;
    toggleListVisibility: (listId: string) => void;
    setHiddenListIds: (ids: string[]) => void; // 初期化用
    toggleListLock: (listId: string) => void;
    lockAllLists: () => void;
    unlockAllLists: () => void;
    setSidebarType: (type: UIState["sidebarType"]) => void;
    setEditingCard: (cardId: string | null, tab?: UIState["editingCardTab"]) => void;
    setViewingDescriptionCard: (cardId: string | null) => void;
    setOverdueCardIds: (ids: string[]) => void;

    // フィルタリング済みカード取得
    getFilteredCards: () => ProcessedCard[];
}

const initialFilters: FilterState = {
    search: "",
    construction: "",
    system: "",
    sales: "",
    mtg: "",
    industry: "",
    prefecture: "",
    trelloLabel: "",
    systemType: "",
    quickFilter: "none",
    sortMode: "none",
};

const initialUI: UIState = {
    isBulkMode: false,
    selectedCardIds: new Set(),
    hiddenListIds: new Set(),
    unlockedListIds: new Set(),
    sidebarType: null,
    editingCardId: null,
    editingCardTab: null,
    viewingDescriptionCardId: null,
    overdueCardIds: new Set(),
};

export const useBoardStore = create<BoardStore>((set, get) => ({
    data: null,
    isLoading: false,
    error: null,
    currentUserId: null,
    filters: initialFilters,
    ui: initialUI,

    setData: (data) => set({ data }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setCurrentUserId: (userId) => set({ currentUserId: userId }),

    setFilter: (key, value) =>
        set((state) => ({
            filters: { ...state.filters, [key]: value },
        })),

    resetFilters: () => set({ filters: initialFilters }),

    toggleBulkMode: () =>
        set((state) => ({
            ui: {
                ...state.ui,
                isBulkMode: !state.ui.isBulkMode,
                selectedCardIds: new Set(),
            },
        })),

    toggleCardSelection: (cardId) =>
        set((state) => {
            const newSet = new Set(state.ui.selectedCardIds);
            if (newSet.has(cardId)) {
                newSet.delete(cardId);
            } else {
                newSet.add(cardId);
            }
            return { ui: { ...state.ui, selectedCardIds: newSet } };
        }),

    clearSelection: () =>
        set((state) => ({
            ui: { ...state.ui, selectedCardIds: new Set() },
        })),

    toggleListVisibility: (listId) => {
        const state = get();
        const newSet = new Set(state.ui.hiddenListIds);
        if (newSet.has(listId)) {
            newSet.delete(listId);
        } else {
            newSet.add(listId);
        }

        // サーバーへ設定保存
        if (state.currentUserId) {
            updateGameSettings(state.currentUserId, {
                hiddenListIds: Array.from(newSet)
            }).catch(e => console.error("Failed to save list visibility:", e));
        }

        set({ ui: { ...state.ui, hiddenListIds: newSet } });
    },

    setHiddenListIds: (ids) => {
        set((state) => ({
            ui: { ...state.ui, hiddenListIds: new Set(ids) }
        }));
    },

    toggleListLock: (listId) =>
        set((state) => {
            const newUnlocked = new Set(state.ui.unlockedListIds);
            if (newUnlocked.has(listId)) {
                newUnlocked.delete(listId);
            } else {
                newUnlocked.add(listId);
            }
            return { ui: { ...state.ui, unlockedListIds: newUnlocked } };
        }),

    lockAllLists: () =>
        set((state) => ({
            ui: { ...state.ui, unlockedListIds: new Set() }
        })),

    unlockAllLists: () =>
        set((state) => {
            if (!state.data) return state;
            const allIds = new Set(state.data.lists.map(l => l.id));
            return { ui: { ...state.ui, unlockedListIds: allIds } };
        }),

    setSidebarType: (sidebarType) =>
        set((state) => ({
            ui: { ...state.ui, sidebarType: sidebarType },
        })),

    setEditingCard: (cardId, tab) =>
        set((state) => ({
            ui: {
                ...state.ui,
                editingCardId: cardId,
                editingCardTab: cardId ? (tab ?? null) : null,
            },
        })),

    setViewingDescriptionCard: (cardId) =>
        set((state) => ({
            ui: { ...state.ui, viewingDescriptionCardId: cardId },
        })),

    setOverdueCardIds: (ids) =>
        set((state) => ({
            ui: { ...state.ui, overdueCardIds: new Set(ids) },
        })),


    getFilteredCards: () => {
        const { data, filters } = get();
        if (!data) return [];

        let cards = [...data.cards];

        // 検索フィルター
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            cards = cards.filter((c) =>
                c.name.toLowerCase().includes(searchLower)
            );
        }

        // 担当者フィルター
        if (filters.construction) {
            cards = cards.filter((c) => c.roles.construction === filters.construction);
        }
        if (filters.system) {
            cards = cards.filter((c) => c.roles.system === filters.system);
        }
        if (filters.sales) {
            cards = cards.filter((c) => c.roles.sales === filters.sales);
        }
        if (filters.mtg) {
            cards = cards.filter((c) => c.roles.mtg === filters.mtg);
        }

        // 業種・都道府県フィルター
        if (filters.industry) {
            cards = cards.filter((c) => c.industries.includes(filters.industry));
        }
        if (filters.prefecture) {
            cards = cards.filter((c) => c.prefectures.includes(filters.prefecture));
        }

        // Trelloラベルフィルター
        if (filters.trelloLabel) {
            cards = cards.filter((c) =>
                c.trelloLabels.some((l) => l.name === filters.trelloLabel)
            );
        }

        // システム種別フィルター
        if (filters.systemType) {
            cards = cards.filter(
                (c) =>
                    c.roles.systemType === filters.systemType ||
                    c.roles.systemType2 === filters.systemType
            );
        }

        // クイックフィルター（期限関連）
        const now = new Date();
        if (filters.quickFilter === "overdue") {
            cards = cards.filter((c) => {
                if (!c.due || c.dueComplete) return false;
                return new Date(c.due) < now;
            });
        } else if (filters.quickFilter === "due24h") {
            const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            cards = cards.filter((c) => {
                if (!c.due || c.dueComplete) return false;
                const dueDate = new Date(c.due);
                return dueDate >= now && dueDate <= limit;
            });
        } else if (filters.quickFilter === "due3d") {
            const limit = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            cards = cards.filter((c) => {
                if (!c.due || c.dueComplete) return false;
                const dueDate = new Date(c.due);
                return dueDate >= now && dueDate <= limit;
            });
        }

        // ソート
        if (filters.sortMode === "due-asc") {
            cards.sort((a, b) => {
                if (!a.due && !b.due) return 0;
                if (!a.due) return 1;
                if (!b.due) return -1;
                return new Date(a.due).getTime() - new Date(b.due).getTime();
            });
        } else if (filters.sortMode === "updated-desc") {
            cards.sort((a, b) => {
                const aTime = a.roles.updatedAt ? new Date(a.roles.updatedAt).getTime() : 0;
                const bTime = b.roles.updatedAt ? new Date(b.roles.updatedAt).getTime() : 0;
                return bTime - aTime;
            });
        } else if (filters.sortMode === "name-asc") {
            cards.sort((a, b) => a.name.localeCompare(b.name, "ja"));
        }

        return cards;
    },
}));
