"use client";

import { useState } from "react";
import { useBoardStore } from "@/stores/boardStore";

/**
 * フィルターバー - GAS完全再現版
 * GAS構成: 選択モード | 全解除/全ロック | 並び替え | 各担当フィルター | 列表示設定 | 検索 | 件数
 */
export function FilterBar() {
    const { data, filters, setFilter, resetFilters, getFilteredCards, ui, toggleBulkMode, toggleListVisibility } = useBoardStore();
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    if (!data) return null;

    const { filterOptions } = data;
    const filteredCount = getFilteredCards().length;
    const totalCount = data.cards.length;

    // GAS風スタイル
    const selectClass = "text-xs bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-700 focus:outline-none focus:border-blue-500 min-w-[80px]";
    const labelClass = "text-xs text-gray-600";
    const filterGroupClass = "flex flex-col gap-0.5";
    const btnQuickClass = "px-2 py-1 text-xs font-medium rounded border transition-colors";

    return (
        <div className="flex flex-wrap items-center gap-2 text-sm">
            {/* 選択モードボタン - GAS風 */}
            <button
                onClick={() => toggleBulkMode()}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors ${ui.isBulkMode
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
            >
                ☑ 選択モード
            </button>

            {/* 全解除/全ロック - GAS風 */}
            <div className="flex gap-1">
                <button
                    className="flex items-center gap-0.5 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                    title="全リストのロックを解除"
                >
                    🔓 全解除
                </button>
                <button
                    className="flex items-center gap-0.5 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                    title="全リストをロック"
                >
                    🔒 全ロック
                </button>
            </div>

            {/* 区切り */}
            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* 並び替え - GAS風 */}
            <div className={filterGroupClass}>
                <label className={labelClass}>並び替え</label>
                <select
                    value={filters.sortMode}
                    onChange={(e) => setFilter("sortMode", e.target.value as typeof filters.sortMode)}
                    className={selectClass}
                >
                    <option value="none">Trello順</option>
                    <option value="due-asc">期限が近い順</option>
                    <option value="updated-desc">更新日が新しい順</option>
                    <option value="name-asc">店舗名順</option>
                </select>
            </div>

            {/* 予約システム担当 */}
            <div className={filterGroupClass}>
                <label className={labelClass}>予約システム担当</label>
                <select
                    value={filters.system}
                    onChange={(e) => setFilter("system", e.target.value)}
                    className={selectClass}
                >
                    <option value="">すべて</option>
                    {filterOptions.roles.system.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* システム種別 */}
            <div className={filterGroupClass}>
                <label className={labelClass}>システム種別</label>
                <select
                    value={filters.systemType || ""}
                    onChange={(e) => setFilter("systemType", e.target.value)}
                    className={selectClass}
                >
                    <option value="">すべて</option>
                    <option value="中江式予約システム/アンケート">中江式予約システム/アンケート</option>
                    <option value="Mokare">Mokare</option>
                </select>
            </div>

            {/* Trelloラベル */}
            <div className={filterGroupClass}>
                <label className={labelClass}>Trelloラベル</label>
                <select
                    value={filters.trelloLabel}
                    onChange={(e) => setFilter("trelloLabel", e.target.value)}
                    className={selectClass}
                >
                    <option value="">すべて</option>
                    {filterOptions.trelloLabels.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* 構築担当 */}
            <div className={filterGroupClass}>
                <label className={labelClass}>構築担当</label>
                <select
                    value={filters.construction}
                    onChange={(e) => setFilter("construction", e.target.value)}
                    className={selectClass}
                >
                    <option value="">すべて</option>
                    {filterOptions.roles.construction.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* 商談担当 */}
            <div className={filterGroupClass}>
                <label className={labelClass}>商談担当</label>
                <select
                    value={filters.sales}
                    onChange={(e) => setFilter("sales", e.target.value)}
                    className={selectClass}
                >
                    <option value="">すべて</option>
                    {filterOptions.roles.sales.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* MTG担当 */}
            <div className={filterGroupClass}>
                <label className={labelClass}>MTG担当</label>
                <select
                    value={filters.mtg}
                    onChange={(e) => setFilter("mtg", e.target.value)}
                    className={selectClass}
                >
                    <option value="">すべて</option>
                    {filterOptions.roles.mtg.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* 業種 */}
            <div className={filterGroupClass}>
                <label className={labelClass}>業種</label>
                <select
                    value={filters.industry}
                    onChange={(e) => setFilter("industry", e.target.value)}
                    className={selectClass}
                >
                    <option value="">すべて</option>
                    {filterOptions.industries.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* 都道府県 */}
            <div className={filterGroupClass}>
                <label className={labelClass}>都道府県</label>
                <select
                    value={filters.prefecture || ""}
                    onChange={(e) => setFilter("prefecture", e.target.value)}
                    className={selectClass}
                >
                    <option value="">すべて</option>
                    {filterOptions.prefectures?.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* 区切り */}
            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* 列の表示設定 - GAS風ドロップダウン */}
            <div className="relative">
                <button
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                >
                    📊 表示切替 ▼
                </button>
                {showColumnMenu && (
                    <div
                        className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[150px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar min-w-[200px]">
                            <div className="mb-2 text-xs font-bold text-gray-500 px-1 border-b border-gray-100 pb-1">リストの表示設定</div>
                            {data.lists.map((list) => (
                                <label key={list.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={!ui.hiddenListIds.has(list.id)}
                                        onChange={() => toggleListVisibility(list.id)}
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className={`text-xs truncate ${ui.hiddenListIds.has(list.id) ? "text-gray-400" : "text-gray-700 font-medium"}`}>
                                        {list.name}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 検索 - GAS風 */}
            <div className="relative ml-2">
                <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilter("search", e.target.value)}
                    placeholder="店舗名で検索..."
                    className="text-xs bg-white border border-gray-300 rounded px-2 py-1 pr-6 w-[140px] focus:outline-none focus:border-blue-500"
                />
                {filters.search ? (
                    <button
                        onClick={() => setFilter("search", "")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    >
                        ✕
                    </button>
                ) : (
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                )}
            </div>

            {/* 件数表示 - GAS風 */}
            <div className="ml-auto text-xs text-gray-600">
                <span className="font-bold text-gray-800">{filteredCount}</span>件
            </div>
        </div>
    );
}

/**
 * クイックフィルターボタン群 - ヘッダー用
 */
export function QuickFilterButtons() {
    const { filters, setFilter } = useBoardStore();

    const btnClass = (active: boolean, color: string) =>
        `px-2 py-1 text-xs font-medium rounded border transition-colors ${active
            ? `bg-${color}-500 text-white border-${color}-500`
            : `bg-white text-${color}-600 border-${color}-200 hover:bg-${color}-50`
        }`;

    return (
        <div className="flex gap-1">
            <button
                onClick={() => setFilter("quickFilter", filters.quickFilter === "overdue" ? "none" : "overdue")}
                className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${filters.quickFilter === "overdue"
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-white text-red-600 border-red-200 hover:bg-red-50"
                    }`}
            >
                期限切れ
            </button>
            <button
                onClick={() => setFilter("quickFilter", filters.quickFilter === "due24h" ? "none" : "due24h")}
                className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${filters.quickFilter === "due24h"
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-orange-600 border-orange-200 hover:bg-orange-50"
                    }`}
            >
                24時間以内
            </button>
            <button
                onClick={() => setFilter("quickFilter", filters.quickFilter === "due3d" ? "none" : "due3d")}
                className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${filters.quickFilter === "due3d"
                    ? "bg-yellow-500 text-white border-yellow-500"
                    : "bg-white text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                    }`}
            >
                3日以内
            </button>
        </div>
    );
}
