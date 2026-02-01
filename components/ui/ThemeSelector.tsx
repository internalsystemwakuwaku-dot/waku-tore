"use client";

import { useState, useEffect, useRef } from "react";
import { useThemeStore, THEMES, type ThemeId } from "@/stores/themeStore";

/**
 * テーマセレクター - GAS風のドロップダウン
 */
export function ThemeSelector() {
    const { currentTheme, setTheme } = useThemeStore();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // クリック外で閉じる
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 初期化時にテーマを適用
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", currentTheme);
    }, [currentTheme]);

    const currentThemeData = THEMES.find((t) => t.id === currentTheme);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* セレクターボタン */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
                <span>{currentThemeData?.emoji}</span>
                <span className="hidden sm:inline">{currentThemeData?.name}</span>
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* ドロップダウンメニュー */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 animate-fade-in">
                    <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500 font-medium">表示テーマを選択</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {THEMES.map((theme) => (
                            <button
                                key={theme.id}
                                onClick={() => {
                                    setTheme(theme.id as ThemeId);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${currentTheme === theme.id
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                <span className="text-lg">{theme.emoji}</span>
                                <span>{theme.name}</span>
                                {currentTheme === theme.id && (
                                    <span className="ml-auto text-blue-500">✓</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
