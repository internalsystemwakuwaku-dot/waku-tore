"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// 利用可能なテーマ
export const THEMES = [
    { id: "default", name: "デフォルト (ライト)", emoji: "☀️" },
    { id: "dark", name: "ダークモード", emoji: "🌙" },
    { id: "cat", name: "猫モード", emoji: "🐱" },
    { id: "dog", name: "犬モード", emoji: "🐶" },
    { id: "horse", name: "馬モード (競馬風)", emoji: "🏇" },
    { id: "dragon", name: "ドラゴンモード", emoji: "🐉" },
    { id: "neon", name: "ネオンモード", emoji: "🌃" },
    { id: "gaming", name: "ゲーミングモード", emoji: "🌈" },
    { id: "retro", name: "レトロRPGモード", emoji: "👾" },
    { id: "blueprint", name: "設計図モード", emoji: "📐" },
    { id: "japan", name: "和風・浮世絵モード", emoji: "🍵" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

interface ThemeState {
    currentTheme: ThemeId;
    setTheme: (theme: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            currentTheme: "default",
            setTheme: (theme) => {
                set({ currentTheme: theme });
                // DOMにテーマを適用
                if (typeof document !== "undefined") {
                    document.documentElement.setAttribute("data-theme", theme);
                }
            },
        }),
        {
            name: "waku-tore-theme",
        }
    )
);

// テーマ初期化用フック
export function initializeTheme() {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem("waku-tore-theme");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.state?.currentTheme) {
                    document.documentElement.setAttribute("data-theme", parsed.state.currentTheme);
                }
            } catch {
                // パースエラーは無視
            }
        }
    }
}
