"use client";

import { useEffect, useState } from "react";
import { useBoardStore } from "@/stores/boardStore";
import { getTrelloData, moveCardToList } from "@/app/actions/trello";
import { CardItem } from "./CardItem";
import { useDraggableScroll } from "@/hooks/useDraggableScroll";
import type { TrelloListInfo } from "@/types/trello";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    defaultDropAnimationSideEffects,
    useDroppable,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface User {
    id: string;
    email: string;
    name?: string | null;
}

interface BoardViewProps {
    user?: User;
}

export function BoardView({ user }: BoardViewProps) {
    const { data, isLoading, error, setData, setLoading, setError, getFilteredCards, ui } =
        useBoardStore();

    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeCard, setActiveCard] = useState<any>(null);

    // M-18: ドラッグスクロール
    const scrollRef = useDraggableScroll();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 3, // Sensitivity adjustment (M-23)
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

    // Drag Start
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        setActiveCard(active.data.current?.card);
    };

    // Drag End
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveCard(null);

        if (!over || !data) return;

        const activeIdStr = active.id as string;
        const overIdStr = over.id as string;

        // Find dragged card
        const card = data.cards.find(c => c.id === activeIdStr);
        if (!card) return;

        // Determine destination list
        let destListId = overIdStr;

        // If dropped on another card, find that card's list
        const overCard = data.cards.find(c => c.id === overIdStr);
        if (overCard) {
            destListId = overCard.idList;
        }

        // Find Destination List Name
        const destList = data.lists.find(l => l.id === destListId);

        // If list changed
        if (card.idList !== destListId) {
            // Optimistic UI Update
            const newData = { ...data };
            const cardIndex = newData.cards.findIndex(c => c.id === activeIdStr);
            if (cardIndex !== -1) {
                newData.cards[cardIndex] = { ...newData.cards[cardIndex], idList: destListId };
                setData(newData);

                // Call Server Action with Logging Info
                try {
                    await moveCardToList(
                        activeIdStr,
                        destListId,
                        user?.id,
                        card.name,
                        destList ? destList.name : "不明なリスト"
                    );
                } catch (e) {
                    console.error("Move failed:", e);
                    // Revert on failure
                    setData(data);
                }
            }
        }
    };

    // ローディング中
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3 text-gray-500">
                    <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>データを取得中...</span>
                </div>
            </div>
        );
    }

    // エラー
    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p className="font-semibold">エラーが発生しました</p>
                <p className="text-sm mt-1">{error}</p>
            </div>
        );
    }

    // データなし
    if (!data) {
        return (
            <div className="text-center text-gray-500 py-12">
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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div ref={scrollRef} className="h-full overflow-x-auto pb-4 -mx-4 px-4 cursor-grab">
                <div className="flex gap-4 min-w-max">
                    {data.lists
                        .filter((list) => !ui.hiddenListIds.has(list.id))
                        .map((list) => (
                            <ListColumn
                                key={list.id}
                                list={list}
                                cards={cardsByList.get(list.id) || []}
                                isUnlocked={ui.unlockedListIds.has(list.id)}
                                overdueMemoCardIds={data.overdueMemoCardIds}
                            />
                        ))}
                </div>
            </div>

            <DragOverlay dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                    styles: {
                        active: {
                            opacity: '0.5',
                        },
                    },
                }),
            }}>
                {activeCard ? (
                    <div className="rotate-2">
                        <CardItem card={activeCard} hasOverdueMemo={false} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

// リストカラムコンポーネント - GAS風デザイン
interface ListColumnProps {
    list: TrelloListInfo;
    cards: ReturnType<typeof useBoardStore.getState>["getFilteredCards"] extends () => infer R
    ? R
    : never;
    isUnlocked: boolean;
    overdueMemoCardIds: string[];
}

function ListColumn({ list, cards, isUnlocked, overdueMemoCardIds }: ListColumnProps) {
    const { toggleListLock, toggleListVisibility } = useBoardStore();

    // UseDroppable for the list container
    const { setNodeRef } = useDroppable({
        id: list.id,
        data: { type: "List", list }
    });

    // リスト名の色分け（GAS風）
    const getListColor = () => {
        const name = list.name.toLowerCase();
        if (name.includes("完了") || name.includes("done")) return "bg-green-500";
        if (name.includes("進行") || name.includes("doing") || name.includes("wip")) return "bg-blue-500";
        if (name.includes("待機") || name.includes("待ち") || name.includes("pending")) return "bg-yellow-500";
        if (name.includes("未着手") || name.includes("todo")) return "bg-gray-400";
        return "bg-indigo-500";
    };

    return (
        <div ref={setNodeRef} className="w-80 flex-shrink-0 flex flex-col bg-gray-100 rounded-lg shadow-sm border border-gray-200">
            {/* リストヘッダー - GAS風 */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white rounded-t-lg">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-3 h-3 rounded-full ${getListColor()}`} />
                    <h3 className="font-semibold text-gray-800 text-sm truncate">
                        {list.name}
                    </h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                        {cards.length}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {/* ロック切替 */}
                    <button
                        onClick={() => toggleListLock(list.id)}
                        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${isUnlocked ? "text-green-600" : "text-gray-400"
                            }`}
                        title={isUnlocked ? "ロック" : "アンロック（移動可能）"}
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
                    {/* 非表示 */}
                    <button
                        onClick={() => toggleListVisibility(list.id)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
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
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {cards.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">カードなし</p>
                    ) : (
                        cards.map((card) => (
                            <CardItem
                                key={card.id}
                                card={card}
                                hasOverdueMemo={overdueMemoCardIds.includes(card.id)}
                                disabled={!isUnlocked} // M-21: Lock fix
                            />
                        ))
                    )}
                </SortableContext>
            </div>
        </div>
    );
}
