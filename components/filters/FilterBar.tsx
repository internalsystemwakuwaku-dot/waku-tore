"use client";

import { useBoardStore } from "@/stores/boardStore";

/**
 * フィルターバー - GAS風コンパクトデザイン
 */
export function FilterBar() {
    const { data, filters, setFilter, resetFilters, getFilteredCards } = useBoardStore();

    if (!data) return null;

    const { filterOptions } = data;
    const filteredCount = getFilteredCards().length;
    const totalCount = data.cards.length;

    // GAS風のフィルターグループスタイル
    const filterGroupClass = "flex items-center gap-1";
    const labelClass = "text-xs text-gray-500 font-medium";
    const selectClass = "text-sm bg-white border border-gray-200 rounded px-2 py-1 text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 min-w-[100px]";
    const inputClass = "text-sm bg-white border border-gray-200 rounded px-2 py-1 text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";

    return (
        <div className="flex flex-wrap items-center gap-3">
            {/* 検索 */}
            <div className="relative flex-1 min-w-[180px] max-w-[300px]">
                <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilter("search", e.target.value)}
                    placeholder="店舗名で検索..."
                    className={`${inputClass} w-full pr-8`}
                />
                {filters.search ? (
                    <button
                        onClick={() => setFilter("search", "")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                ) : (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                )}
            </div>

            {/* クイックフィルター GAS風ボタン */}
            <div className="flex gap-1">
                <button
                    onClick={() => setFilter("quickFilter", filters.quickFilter === "overdue" ? "none" : "overdue")}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${filters.quickFilter === "overdue"
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-white text-red-600 border-red-200 hover:bg-red-50"
                        }`}
                >
                    期限切れ
                </button>
                <button
                    onClick={() => setFilter("quickFilter", filters.quickFilter === "due24h" ? "none" : "due24h")}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${filters.quickFilter === "due24h"
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-orange-600 border-orange-200 hover:bg-orange-50"
                        }`}
                >
                    24時間以内
                </button>
                <button
                    onClick={() => setFilter("quickFilter", filters.quickFilter === "due3d" ? "none" : "due3d")}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${filters.quickFilter === "due3d"
                        ? "bg-yellow-500 text-white border-yellow-500"
                        : "bg-white text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                        }`}
                >
                    3日以内
                </button>
            </div>

            {/* 区切り */}
            <div className="w-px h-6 bg-gray-200" />

            {/* 担当者フィルター */}
            <div className={filterGroupClass}>
                <label className={labelClass}>構築</label>
                <select
                    value={filters.construction}
                    onChange={(e) => setFilter("construction", e.target.value)}
                    className={selectClass}
                >
                    <option value="">全て</option>
                    {filterOptions.roles.construction.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            <div className={filterGroupClass}>
                <label className={labelClass}>予約</label>
                <select
                    value={filters.system}
                    onChange={(e) => setFilter("system", e.target.value)}
                    className={selectClass}
                >
                    <option value="">全て</option>
                    {filterOptions.roles.system.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            <div className={filterGroupClass}>
                <label className={labelClass}>商談</label>
                <select
                    value={filters.sales}
                    onChange={(e) => setFilter("sales", e.target.value)}
                    className={selectClass}
                >
                    <option value="">全て</option>
                    {filterOptions.roles.sales.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            <div className={filterGroupClass}>
                <label className={labelClass}>MTG</label>
                <select
                    value={filters.mtg}
                    onChange={(e) => setFilter("mtg", e.target.value)}
                    className={selectClass}
                >
                    <option value="">全て</option>
                    {filterOptions.roles.mtg.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* 区切り */}
            <div className="w-px h-6 bg-gray-200" />

            {/* 詳細フィルター */}
            <div className={filterGroupClass}>
                <label className={labelClass}>業種</label>
                <select
                    value={filters.industry}
                    onChange={(e) => setFilter("industry", e.target.value)}
                    className={selectClass}
                >
                    <option value="">全て</option>
                    {filterOptions.industries.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            <div className={filterGroupClass}>
                <label className={labelClass}>ラベル</label>
                <select
                    value={filters.trelloLabel}
                    onChange={(e) => setFilter("trelloLabel", e.target.value)}
                    className={selectClass}
                >
                    <option value="">全て</option>
                    {filterOptions.trelloLabels.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* ソート */}
            <div className={filterGroupClass}>
                <label className={labelClass}>並び順</label>
                <select
                    value={filters.sortMode}
                    onChange={(e) => setFilter("sortMode", e.target.value as typeof filters.sortMode)}
                    className={selectClass}
                >
                    <option value="none">Trello順</option>
                    <option value="due-asc">期限順</option>
                    <option value="updated-desc">更新順</option>
                    <option value="name-asc">名前順</option>
                </select>
            </div>

            {/* リセット */}
            <button
                onClick={resetFilters}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
                リセット
            </button>

            {/* 件数 */}
            <div className="ml-auto text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{filteredCount}</span>
                <span className="text-gray-400"> / {totalCount}</span>
                <span className="text-gray-400 ml-1">件</span>
            </div>
        </div>
    );
}
