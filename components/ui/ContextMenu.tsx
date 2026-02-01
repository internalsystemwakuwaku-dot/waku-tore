"use client";

import { useState, useEffect, useRef } from "react";
import type { ProcessedCard } from "@/types/trello";

interface ContextMenuProps {
    card: ProcessedCard;
    x: number;
    y: number;
    onClose: () => void;
    onEdit: () => void;
    onOpenTrello: () => void;
    onCopyLink: () => void;
    onTogglePin: () => void;
}

/**
 * 右クリックメニュー - GAS風のカードコンテキストメニュー
 */
export function CardContextMenu({
    card,
    x,
    y,
    onClose,
    onEdit,
    onOpenTrello,
    onCopyLink,
    onTogglePin,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // 画面外に出ないよう調整
    const [adjustedPos, setAdjustedPos] = useState({ x, y });

    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const newX = Math.min(x, window.innerWidth - rect.width - 10);
            const newY = Math.min(y, window.innerHeight - rect.height - 10);
            setAdjustedPos({ x: newX, y: newY });
        }
    }, [x, y]);

    // クリック外で閉じる
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    // ESCで閉じる
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const menuItems = [
        { icon: "✏️", label: "詳細を開く", action: onEdit },
        { icon: "🔗", label: "Trelloで開く", action: onOpenTrello },
        { icon: "📋", label: "リンクをコピー", action: onCopyLink },
        { icon: card.roles.isPinned ? "📍" : "📌", label: card.roles.isPinned ? "ピン解除" : "ピン留め", action: onTogglePin },
    ];

    return (
        <div
            ref={menuRef}
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[100] min-w-[160px] animate-fade-in"
            style={{ left: adjustedPos.x, top: adjustedPos.y }}
        >
            {/* カード名 */}
            <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500 truncate max-w-[200px]">{card.name}</p>
            </div>

            {/* メニュー項目 */}
            {menuItems.map((item, index) => (
                <button
                    key={index}
                    onClick={() => {
                        item.action();
                        onClose();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                </button>
            ))}
        </div>
    );
}

// コンテキストメニュー用のカスタムフック
export function useContextMenu() {
    const [contextMenu, setContextMenu] = useState<{
        card: ProcessedCard;
        x: number;
        y: number;
    } | null>(null);

    const openContextMenu = (card: ProcessedCard, x: number, y: number) => {
        setContextMenu({ card, x, y });
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    return { contextMenu, openContextMenu, closeContextMenu };
}
