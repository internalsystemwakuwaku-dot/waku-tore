"use client";

import { useBoardStore } from "@/stores/boardStore";

export function FilterBar() {
    const { data, filters, setFilter, resetFilters, getFilteredCards } = useBoardStore();

    if (!data) return null;

    const { filterOptions } = data;
    const filteredCount = getFilteredCards().length;
    const totalCount = data.cards.length;

    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 mb-6 border border-white/10">
            <div className="flex flex-wrap gap-4 items-end">
                {/* 検索 */}
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-white/60 mb-1">検索</label>
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => setFilter("search", e.target.value)}
                        placeholder="カード名で検索..."
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400"
                    />
                </div>

                {/* 構築担当 */}
                <div className="w-36">
                    <label className="block text-xs text-white/60 mb-1">構築</label>
                    <select
                        value={filters.construction}
                        onChange={(e) => setFilter("construction", e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option value="">全て</option>
                        {filterOptions.roles.construction.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 予約システム */}
                <div className="w-36">
                    <label className="block text-xs text-white/60 mb-1">予約</label>
                    <select
                        value={filters.system}
                        onChange={(e) => setFilter("system", e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option value="">全て</option>
                        {filterOptions.roles.system.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 商談 */}
                <div className="w-36">
                    <label className="block text-xs text-white/60 mb-1">商談</label>
                    <select
                        value={filters.sales}
                        onChange={(e) => setFilter("sales", e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option value="">全て</option>
                        {filterOptions.roles.sales.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* MTG */}
                <div className="w-36">
                    <label className="block text-xs text-white/60 mb-1">MTG</label>
                    <select
                        value={filters.mtg}
                        onChange={(e) => setFilter("mtg", e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option value="">全て</option>
                        {filterOptions.roles.mtg.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* リセットボタン */}
                <button
                    onClick={resetFilters}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm transition-colors"
                >
                    リセット
                </button>
            </div>

            {/* 2行目：詳細フィルター */}
            <div className="flex flex-wrap gap-4 items-end mt-4 pt-4 border-t border-white/10">
                {/* 業種 */}
                <div className="w-40">
                    <label className="block text-xs text-white/60 mb-1">業種</label>
                    <select
                        value={filters.industry}
                        onChange={(e) => setFilter("industry", e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option value="">全て</option>
                        {filterOptions.industries.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 都道府県 */}
                <div className="w-40">
                    <label className="block text-xs text-white/60 mb-1">都道府県</label>
                    <select
                        value={filters.prefecture}
                        onChange={(e) => setFilter("prefecture", e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option value="">全て</option>
                        {filterOptions.prefectures.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* ラベル */}
                <div className="w-40">
                    <label className="block text-xs text-white/60 mb-1">ラベル</label>
                    <select
                        value={filters.trelloLabel}
                        onChange={(e) => setFilter("trelloLabel", e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option value="">全て</option>
                        {filterOptions.trelloLabels.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* クイックフィルター */}
                <div className="flex gap-2">
                    <button
                        onClick={() =>
                            setFilter(
                                "quickFilter",
                                filters.quickFilter === "overdue" ? "none" : "overdue"
                            )
                        }
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${filters.quickFilter === "overdue"
                                ? "bg-red-500 text-white"
                                : "bg-white/10 text-white/70 hover:bg-white/20"
                            }`}
                    >
                        🔥 期限切れ
                    </button>
                    <button
                        onClick={() =>
                            setFilter(
                                "quickFilter",
                                filters.quickFilter === "due24h" ? "none" : "due24h"
                            )
                        }
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${filters.quickFilter === "due24h"
                                ? "bg-orange-500 text-white"
                                : "bg-white/10 text-white/70 hover:bg-white/20"
                            }`}
                    >
                        ⏰ 24時間以内
                    </button>
                    <button
                        onClick={() =>
                            setFilter(
                                "quickFilter",
                                filters.quickFilter === "due3d" ? "none" : "due3d"
                            )
                        }
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${filters.quickFilter === "due3d"
                                ? "bg-yellow-500 text-white"
                                : "bg-white/10 text-white/70 hover:bg-white/20"
                            }`}
                    >
                        📅 3日以内
                    </button>
                </div>

                {/* ソート */}
                <div className="w-40">
                    <label className="block text-xs text-white/60 mb-1">ソート</label>
                    <select
                        value={filters.sortMode}
                        onChange={(e) =>
                            setFilter("sortMode", e.target.value as typeof filters.sortMode)
                        }
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-400"
                    >
                        <option value="none">デフォルト</option>
                        <option value="due-asc">期限順</option>
                        <option value="updated-desc">更新順</option>
                        <option value="name-asc">名前順</option>
                    </select>
                </div>

                {/* 件数表示 */}
                <div className="ml-auto text-sm text-white/60">
                    表示中: <span className="text-white font-semibold">{filteredCount}</span> /{" "}
                    {totalCount} 件
                </div>
            </div>
        </div>
    );
}
