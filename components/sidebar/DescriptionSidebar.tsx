"use client";

import { useMemo } from "react";
import { useBoardStore } from "@/stores/boardStore";

/**
 * 説明詳細サイドバー
 * 右側からスライドインしてカードのDescriptionを表示する
 * ユーザー要望によりSankou-gasの挙動（プレーンテキスト+単純リンク化、検索機能付き）を再現
 */
export function DescriptionSidebar() {
    const { ui, data, filters, setFilter, setViewingDescriptionCard } = useBoardStore();
    const cardId = ui.viewingDescriptionCardId;
    const searchQuery = filters.search || "";

    // 表示対象のカードID（検索結果から選択された場合はそちらを優先できるが、
    // 現状は store の viewingDescriptionCardId が正とする）
    const effectiveCardId = cardId;

    // カード情報取得
    const card = useMemo(() => {
        if (!data || !effectiveCardId) return null;
        return data.cards.find(c => c.id === effectiveCardId);
    }, [data, effectiveCardId]);

    // 検索ロジック
    const groupedResults = useMemo(() => {
        if (!data || !searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        const results = data.cards.filter(c =>
            (c.name || "").toLowerCase().includes(query)
        );

        const grouped = data.lists.map(list => ({
            list,
            cards: results.filter(card => card.idList === list.id),
        }));

        return grouped.filter(group => group.cards.length > 0);
    }, [data, searchQuery]);

    // 説明文のレンダリング（Sankou-gasロジック再現）
    // 単純な改行反映と、URLの自動リンク化のみを行う
    const renderDescription = (rawDesc: string) => {
        if (!rawDesc) return <span className="text-gray-400 italic">(説明はありません)</span>;

        // HTMLエスケープ（Reactがやってくれるが、dangerouslySetInnerHTMLを使うなら自前でやる必要がある。
        // ここでは安全のため、文字列をReactNodeの配列に変換する方式をとる）

        // URL正規表現
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        // 行ごとに分割
        const lines = rawDesc.split('\n');

        return (
            <div className="text-sm text-gray-800 leading-relaxed font-sans">
                {lines.map((line, lineIndex) => {
                    // 行内のURLをリンク化
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
            {/* サイドバーパネル */}
            <div className="fixed right-0 top-0 h-full w-[400px] max-w-full bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col animate-slide-in font-sans">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
                    <div className="flex items-center gap-2 font-bold text-gray-700 text-lg">
                        <span className="material-icons text-blue-600">description</span>
                        <span>説明詳細</span>
                    </div>
                    <button
                        onClick={closeSidebar}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <span className="material-icons">close</span>
                    </button>
                </div>

                {/* 検索バー */}
                <div className="p-3 bg-gray-50 border-b border-gray-200">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="店舗名で検索..."
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

                    {/* 検索結果リスト */}
                    {searchQuery.trim() && groupedResults.length === 0 && (
                        <div className="absolute left-0 right-0 mt-1 mx-3 bg-white border border-gray-200 rounded-md shadow-lg p-3 text-xs text-gray-500 z-20">
                            {"\u691c\u7d22\u7d50\u679c\u304c\u3042\u308a\u307e\u305b\u3093"}
                        </div>
                    )}
                    {groupedResults.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 mx-3 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto z-20">
                            {groupedResults.map(group => (
                                <div key={group.list.id} className="border-b border-gray-100 last:border-0">
                                    <div className="px-3 py-2 text-xs font-bold text-gray-600 bg-gray-50">
                                        {group.list.name}
                                    </div>
                                    {group.cards.map(resCard => (
                                        <div
                                            key={resCard.id}
                                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-t border-gray-100 text-sm"
                                            onClick={() => {
                                                setViewingDescriptionCard(resCard.id);
                                                setFilter("search", "");
                                            }}
                                        >
                                            {resCard.name}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto bg-gray-100 p-4 custom-scrollbar">
                    {card ? (
                        <div className="bg-white rounded shadow-sm border border-gray-200 p-5 min-h-[300px]">
                            {/* カードタイトル */}
                            <h3 className="font-bold text-gray-800 text-base mb-4 border-b border-gray-100 pb-2">
                                {card.name}
                            </h3>

                            {/* 説明本文 */}
                            <div className="mb-6">
                                {renderDescription(card.desc)}
                            </div>

                            {/* フッター情報 */}
                            <div className="pt-4 border-t border-gray-100 text-xs text-gray-500">
                                <a
                                    href={card.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1 inline-flex"
                                >
                                    <span className="material-icons text-sm">open_in_new</span>
                                    Trelloで開く
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

            {/* オーバーレイ */}
            {ui.viewingDescriptionCardId && (
                <div
                    className="fixed inset-0 bg-black/20 z-40"
                    onClick={closeSidebar}
                />
            )}
        </>
    );
}
