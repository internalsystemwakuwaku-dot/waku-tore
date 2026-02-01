"use client";

import { useState, useTransition } from "react";
import { useGameStore, SHOP_ITEMS } from "@/stores/gameStore";
import { purchaseItem } from "@/app/actions/game";
import type { ShopItem } from "@/types/game";

interface ShopModalProps {
    userId: string;
    onClose: () => void;
}

export function ShopModal({ userId, onClose }: ShopModalProps) {
    const { data, canAfford, getOwnedCount, setData } = useGameStore();
    const [activeCategory, setActiveCategory] = useState<ShopItem["category"]>("theme");
    const [isPending, startTransition] = useTransition();

    const categories = [
        { id: "theme" as const, name: "テーマ", icon: "🎨" },
        { id: "decoration" as const, name: "装飾", icon: "✨" },
        { id: "booster" as const, name: "ブースター", icon: "⚡" },
        { id: "special" as const, name: "特別", icon: "👑" },
    ];

    const filteredItems = SHOP_ITEMS.filter(
        (item) => item.category === activeCategory
    );

    const handlePurchase = (item: ShopItem) => {
        if (!canAfford(item.price)) {
            alert("所持金が不足しています");
            return;
        }

        const owned = getOwnedCount(item.id);
        if (item.maxOwn && owned >= item.maxOwn) {
            alert("これ以上購入できません");
            return;
        }

        startTransition(async () => {
            const result = await purchaseItem(userId, item.id, item.price);
            if (result.success) {
                // ストアを更新
                setData({
                    ...data,
                    money: data.money - item.price,
                    inventory: {
                        ...data.inventory,
                        [item.id]: owned + 1,
                    },
                });
            } else {
                alert("購入に失敗しました: " + result.error);
            }
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-pink-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🛒</span>
                        <div>
                            <h2 className="text-lg font-bold text-white">ショップ</h2>
                            <p className="text-sm text-white/70">
                                💰 {data.money.toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* カテゴリタブ */}
                <div className="flex border-b border-white/10">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeCategory === cat.id
                                    ? "text-pink-400 border-b-2 border-pink-400"
                                    : "text-white/60 hover:text-white"
                                }`}
                        >
                            {cat.icon} {cat.name}
                        </button>
                    ))}
                </div>

                {/* アイテムグリッド */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredItems.map((item) => {
                            const owned = getOwnedCount(item.id);
                            const affordable = canAfford(item.price);
                            const maxed = item.maxOwn ? owned >= item.maxOwn : false;

                            return (
                                <div
                                    key={item.id}
                                    className={`bg-white/5 rounded-xl p-4 border transition-all ${maxed
                                            ? "border-green-500/30 opacity-70"
                                            : affordable
                                                ? "border-white/10 hover:border-pink-400/50"
                                                : "border-white/10 opacity-50"
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="text-4xl">{item.icon}</div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white">{item.name}</h3>
                                                {maxed && (
                                                    <span className="text-xs bg-green-500/30 text-green-400 px-2 py-0.5 rounded">
                                                        所持済
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-white/60 mt-1">
                                                {item.description}
                                            </p>
                                            {owned > 0 && !maxed && (
                                                <p className="text-xs text-white/40 mt-1">
                                                    所持: {owned}個
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-yellow-400">
                                                💰 {item.price.toLocaleString()}
                                            </p>
                                            <button
                                                onClick={() => handlePurchase(item)}
                                                disabled={!affordable || maxed || isPending}
                                                className={`mt-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${maxed
                                                        ? "bg-green-500/30 text-green-400 cursor-not-allowed"
                                                        : affordable
                                                            ? "bg-pink-500 hover:bg-pink-600 text-white"
                                                            : "bg-gray-500/30 text-gray-400 cursor-not-allowed"
                                                    }`}
                                            >
                                                {maxed ? "購入済" : isPending ? "..." : "購入"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* フッター */}
                <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
