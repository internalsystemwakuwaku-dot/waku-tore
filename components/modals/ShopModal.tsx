"use client";

import { useGameStore, SHOP_ITEMS } from "@/stores/gameStore";
import { useSound } from "@/lib/sound/SoundContext";
import { useEffect, useState } from "react";
import { activateBooster } from "@/app/actions/game";
import type { ShopItem } from "@/types/game";

interface ShopModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * ワクワクショップモーダル
 * - カテゴリ別にアイテムを表示
 * - 施設/ブースターは所持数と効果を表示
 */
export function ShopModal({ isOpen, onClose }: ShopModalProps) {
    const { data, purchaseItem, canAfford, getOwnedCount } = useGameStore();
    const { playSe, playBgm } = useSound();
    const [activeCategory, setActiveCategory] = useState<ShopItem["category"]>("facility");
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        if (!isOpen) return;
        const timer = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [isOpen]);

    if (!isOpen) return null;

    const categoryLabels: Record<string, string> = {
        facility: "🏭 施設",
        theme: "🎨 テーマ",
        decoration: "✨ 装飾",
        booster: "⚡ ブースター",
        special: "🏆 特別",
    };

    const displayedItems = SHOP_ITEMS.filter((item) => item.category === activeCategory);
    const activeBoosts = data.activeBoosts || {};

    const handlePurchase = (item: ShopItem) => {
        if (!canAfford(item.price)) {
            playSe("cancel");
            return;
        }

        const result = purchaseItem(item.id);
        if (!result.success) {
            alert(result.message);
            playSe("cancel");
        } else {
            playSe("coin");
        }
    };

    const formatRemaining = (ms: number) => {
        const totalSec = Math.max(0, Math.floor(ms / 1000));
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${String(sec).padStart(2, "0")}`;
    };

    const formatEffect = (item: ShopItem) => {
        if (!item.effect) return null;
        if (item.effect.startsWith("auto_xp_")) {
            const xp = item.effect.replace("auto_xp_", "");
            return `効果: 1秒ごとに${xp}XP`;
        }
        return null;
    };

    const handleActivate = async (item: ShopItem) => {
        if (!data.userId) {
            alert("ユーザー情報の取得に失敗しました");
            return;
        }
        const owned = getOwnedCount(item.id);
        if (owned <= 0) {
            alert("ブースターがありません");
            return;
        }
        const result = await activateBooster(data.userId, item.id);
        if (!result.success) {
            alert(result.error || "ブースターの使用に失敗しました");
            return;
        }
        useGameStore.getState().setData({
            ...data,
            inventory: result.inventory || data.inventory,
            activeBoosts: result.activeBoosts || data.activeBoosts,
        });
        useGameStore.getState().markDirty();
        playSe("decide");
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div
                className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden text-white"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-4">
                        <span className="text-3xl">🏪</span>
                        <div>
                            <h2 className="text-xl font-bold text-amber-400">ワクワクショップ</h2>
                            <p className="text-sm text-gray-400">XPを貯めてアイテムをゲット</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-full border border-gray-700">
                            <span className="text-xl">💰</span>
                            <span className="font-mono text-xl text-yellow-400 font-bold">
                                {data.money.toLocaleString()} G
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg transition-colors"
                        >
                            閉じる
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 min-h-0">
                    {/* サイドバー（カテゴリ） */}
                    <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col p-4 gap-2">
                        {(Object.keys(categoryLabels) as ShopItem["category"][]).map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${activeCategory === cat
                                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                                    : "hover:bg-gray-700 text-gray-400 hover:text-white"
                                    }`}
                            >
                                <span className={`text-lg transition-transform ${activeCategory === cat ? "scale-110" : ""}`}>
                                    {categoryLabels[cat].split(" ")[0]}
                                </span>
                                <span className="font-bold">{categoryLabels[cat].split(" ")[1]}</span>
                            </button>
                        ))}
                    </div>

                    {/* アイテムリスト */}
                    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {displayedItems.map((item) => {
                                const count = getOwnedCount(item.id);
                                const isMax = item.maxOwn && count >= item.maxOwn;
                                const affordable = canAfford(item.price);
                                const isBooster = item.category === "booster";
                                const expiresAt = activeBoosts[item.id];
                                const remainingMs = expiresAt ? expiresAt - nowMs : 0;
                                const isActive = isBooster && remainingMs > 0;

                                return (
                                    <div
                                        key={item.id}
                                        className={`bg-gray-800 border-2 rounded-xl p-4 transition-all relative overflow-hidden group ${isMax
                                            ? "border-green-500/50 opacity-80"
                                            : affordable
                                                ? "border-gray-700 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10"
                                                : "border-gray-700 opacity-60"
                                            }`}
                                    >
                                        <div className="flex gap-4">
                                            {/* アイコン */}
                                            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform">
                                                {item.icon}
                                            </div>

                                            {/* 情報 */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h3 className="font-bold text-lg truncate pr-2">{item.name}</h3>
                                                    {count > 0 && (
                                                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow">
                                                            x{count}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 mb-2 line-clamp-2 min-h-[2.5em]">
                                                    {item.description}
                                                    {formatEffect(item) && (
                                                        <span className="block text-amber-400 mt-0.5">
                                                            {formatEffect(item)}
                                                        </span>
                                                    )}
                                                </p>
                                                {isBooster && (
                                                    <div className="text-xs text-amber-300">
                                                        {isActive ? `使用中 残り ${formatRemaining(remainingMs)}` : "未使用"}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between mt-auto">
                                                    <div className="text-yellow-400 font-bold font-mono">
                                                        {item.price.toLocaleString()} G
                                                    </div>

                                                    {isMax ? (
                                                        <button disabled className="px-4 py-1.5 bg-green-900 text-green-400 text-xs font-bold rounded cursor-not-allowed border border-green-700">
                                                            購入済み
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            {isBooster && (
                                                                <button
                                                                    onClick={() => handleActivate(item)}
                                                                    disabled={count <= 0}
                                                                    className={`px-3 py-1.5 rounded text-xs font-bold shadow-lg transition-transform active:scale-95 ${count > 0
                                                                        ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                                                                        : "bg-gray-700 text-gray-500 cursor-not-allowed"
                                                                        }`}
                                                                >
                                                                    {isActive ? "使用中" : "使用"}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handlePurchase(item)}
                                                                disabled={!affordable}
                                                                className={`px-4 py-1.5 rounded text-sm font-bold shadow-lg transition-transform active:scale-95 ${affordable
                                                                    ? "bg-amber-500 hover:bg-amber-400 text-black"
                                                                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                                                                    }`}
                                                            >
                                                                購入
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 背景エフェクト */}
                                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
