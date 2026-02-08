"use client";

import { useMemo } from "react";
import { useBoardStore } from "@/stores/boardStore";

/**
 * 説明詳細サイドバー
 */
export function DescriptionSidebar() {
    const { ui, data, filters, setFilter, setViewingDescriptionCard } = useBoardStore();
    const cardId = ui.viewingDescriptionCardId;
    const searchQuery = filters.search || "";

    const effectiveCardId = cardId;

    const card = useMemo(() => {
        if (!data || !effectiveCardId) return null;
        return data.cards.find((c) => c.id === effectiveCardId);
    }, [data, effectiveCardId]);

    const groupedResults = useMemo(() => {
        if (!data || !searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        const results = data.cards.filter((c) =>
            (c.name || "").toLowerCase().includes(query)
        );

        const grouped = data.lists.map((list) => ({
            list,
            cards: results.filter((cardItem) => cardItem.idList === list.id),
        }));

        return grouped.filter((group) => group.cards.length > 0);
    }, [data, searchQuery]);

    const renderDescription = (rawDesc: string) => {
        if (!rawDesc) {
            return (
                <span className="text-gray-400 italic">
                    (\u8aac\u660e\u306f\u3042\u308a\u307e\u305b\u3093)
                </span>
            );
        }

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const lines = rawDesc.split("\n");

        return (
            <div className="text-sm text-gray-800 leading-relaxed font-sans">
                {lines.map((line, lineIndex) => {
                    const parts = line.split(urlRegex);
                    return (
                        <div key={lineIndex} className="min-h-[1.2em]">
                            {parts.map((part, partIndex) => {
                                if (part.match(urlRegex)) {
                                    return (
                                        <a
                                            key={partIndex}
                                            href={part}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all"
                                        >
                                            {part}
                                        </a>
                                    );
                                }
                                return <span key={partIndex}>{part}</span>;
                            })}
                        </div>
                    );
                })}
            </div>
        );
    };

    const closeSidebar = () => {
        setViewingDescriptionCard(null);
        setFilter("search", "");
    };

    if (!ui.viewingDescriptionCardId && !effectiveCardId && !searchQuery.trim()) return null;

    return (
        <>
            <div className="fixed right-0 top-0 h-full w-[400px] max-w-full bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col animate-slide-in font-sans">
                <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
                    <div className="flex items-center gap-2 font-bold text-gray-700 text-lg">
                        <span className="material-icons text-blue-600">description</span>
                        <span>\u8aac\u660e\u8a73\u7d30</span>
                    </div>
                    <button
                        onClick={closeSidebar}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <span className="material-icons">close</span>
                    </button>
                </div>

                <div className="p-3 bg-gray-50 border-b border-gray-200">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="\u5e97\u8217\u540d\u3067\u691c\u7d22..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            value={searchQuery}
                            onChange={(e) => setFilter("search", e.target.value)}
                        />
                        <span className="absolute left-2.5 top-2 text-gray-400">
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="11" cy="11" r="7" />
                                <line x1="16.5" y1="16.5" x2="21" y2="21" />
                            </svg>
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-100 p-4 custom-scrollbar">
                    {searchQuery.trim() ? (
                        groupedResults.length > 0 ? (
                            <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
                                {groupedResults.map((group) => (
                                    <div key={group.list.id} className="border-b border-gray-100 last:border-0">
                                        <div className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-50">
                                            {group.list.name}
                                        </div>
                                        {group.cards.map((resCard) => (
                                            <button
                                                key={resCard.id}
                                                className="w-full text-left px-4 py-2 hover:bg-blue-50 border-t border-gray-100 text-sm"
                                                onClick={() => {
                                                    setViewingDescriptionCard(resCard.id);
                                                    setFilter("search", "");
                                                }}
                                            >
                                                {resCard.name}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                {"\u691c\u7d22\u7d50\u679c\u304c\u3042\u308a\u307e\u305b\u3093"}
                            </div>
                        )
                    ) : card ? (
                        <div className="bg-white rounded shadow-sm border border-gray-200 p-5 min-h-[300px]">
                            <h3 className="font-bold text-gray-800 text-base mb-4 border-b border-gray-100 pb-2">
                                {card.name}
                            </h3>
                            <div className="mb-6">{renderDescription(card.desc)}</div>
                            <div className="pt-4 border-t border-gray-100 text-xs text-gray-500">
                                <a
                                    href={card.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1 inline-flex"
                                >
                                    <span className="material-icons text-sm">open_in_new</span>
                                    Trello\u3067\u958b\u304f
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            {"\u691c\u7d22\u7d50\u679c\u304b\u3089\u30ab\u30fc\u30c9\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044"}
                        </div>
                    )}
                </div>
            </div>

            {ui.viewingDescriptionCardId && (
                <div className="fixed inset-0 bg-black/20 z-40" onClick={closeSidebar} />
            )}
        </>
    );
}
