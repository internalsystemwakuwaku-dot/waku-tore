"use client";

import { useEffect } from "react";
import { useBoardStore } from "@/stores/boardStore";
import { getTrelloData } from "@/app/actions/trello";
import { CardItem } from "./CardItem";
import type { TrelloListInfo } from "@/types/trello";

export function BoardView() {
    const { data, isLoading, error, setData, setLoading, setError, getFilteredCards, ui } =
        useBoardStore();

    // 初期データ読み込み
    useEffect(() => {
        async function loadData() {
            setLoading(true);
            setError(null);
            try {
                const result = await getTrelloData();
                if (result.error) {
                    setError(result.error);
                } else {
                    setData(result.data);
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : "データ取得に失敗しました");
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [setData, setLoading, setError]);

    // ローディング中
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3 text-white/60">
                    <svg
                        className="animate-spin h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <span>データを取得中...</span>
                </div>
            </div>
        );
    }

    // エラー
    if (error) {
        return (
            <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200">
                <p className="font-semibold">エラーが発生しました</p>
                <p className="text-sm mt-1">{error}</p>
            </div>
        );
    }

    // データなし
    if (!data) {
        return (
            <div className="text-center text-white/60 py-12">
                <p>データがありません</p>
            </div>
        );
    }

    const filteredCards = getFilteredCards();

    // リストごとにカードをグループ化
    const cardsByList = new Map<string, typeof filteredCards>();
    for (const list of data.lists) {
        cardsByList.set(list.id, []);
    }
    for (const card of filteredCards) {
        const listCards = cardsByList.get(card.idList);
        if (listCards) {
            listCards.push(card);
        }
    }

    return (
        <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
                {data.lists
                    .filter((list) => !ui.hiddenListIds.has(list.id))
                    .map((list) => (
                        <ListView
                            key={list.id}
                            list={list}
                            cards={cardsByList.get(list.id) || []}
                            isUnlocked={ui.unlockedListIds.has(list.id)}
                            overdueMemoCardIds={data.overdueMemoCardIds}
                        />
                    ))}
            </div>
        </div>
    );
}

// リストビューコンポーネント
interface ListViewProps {
    list: TrelloListInfo;
    cards: ReturnType<typeof useBoardStore.getState>["getFilteredCards"] extends () => infer R
    ? R
    : never;
    isUnlocked: boolean;
    overdueMemoCardIds: string[];
}

function ListView({ list, cards, isUnlocked, overdueMemoCardIds }: ListViewProps) {
    const { toggleListLock, toggleListVisibility } = useBoardStore();

    return (
        <div className="w-72 flex-shrink-0">
            {/* リストヘッダー */}
            <div className="bg-white/10 backdrop-blur-sm rounded-t-lg px-3 py-2 flex items-center justify-between border-b border-white/10">
                <h3 className="font-semibold text-white text-sm truncate flex-1">
                    {list.name}
                </h3>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                        {cards.length}
                    </span>
                    <button
                        onClick={() => toggleListLock(list.id)}
                        className={`p-1 rounded hover:bg-white/10 transition-colors ${isUnlocked ? "text-green-400" : "text-white/40"
                            }`}
                        title={isUnlocked ? "ロック" : "アンロック"}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {isUnlocked ? (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                                />
                            ) : (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            )}
                        </svg>
                    </button>
                    <button
                        onClick={() => toggleListVisibility(list.id)}
                        className="p-1 rounded hover:bg-white/10 text-white/40 transition-colors"
                        title="非表示"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            {/* カードリスト */}
            <div className="bg-white/5 rounded-b-lg p-2 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                {cards.length === 0 ? (
                    <p className="text-center text-white/30 text-sm py-4">カードなし</p>
                ) : (
                    cards.map((card) => (
                        <CardItem
                            key={card.id}
                            card={card}
                            hasOverdueMemo={overdueMemoCardIds.includes(card.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
