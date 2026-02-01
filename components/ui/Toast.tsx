"use client";

import { useState, useEffect, useCallback } from "react";
import { create } from "zustand";

// トースト型定義
interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info" | "xp";
    duration?: number;
}

// トーストストア
interface ToastStore {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    addToast: (toast) => {
        const id = Math.random().toString(36).substr(2, 9);
        set((state) => ({
            toasts: [...state.toasts, { ...toast, id }],
        }));
        // 自動削除
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id),
            }));
        }, toast.duration || 3000);
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
    },
}));

// トースト表示用のヘルパー関数
export const toast = {
    success: (message: string) => useToastStore.getState().addToast({ message, type: "success" }),
    error: (message: string) => useToastStore.getState().addToast({ message, type: "error" }),
    info: (message: string) => useToastStore.getState().addToast({ message, type: "info" }),
    xp: (amount: number) => useToastStore.getState().addToast({ message: `+${amount} XP`, type: "xp", duration: 2000 }),
};

/**
 * トースト通知コンテナ - GAS完全再現版
 */
export function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
            ))}
        </div>
    );
}

interface ToastItemProps {
    toast: Toast;
    onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // アニメーション用に少し遅らせて表示
        setTimeout(() => setIsVisible(true), 10);
    }, []);

    // スタイル
    const getStyles = () => {
        switch (toast.type) {
            case "success":
                return "bg-green-500 text-white";
            case "error":
                return "bg-red-500 text-white";
            case "xp":
                return "bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold";
            case "info":
            default:
                return "bg-blue-500 text-white";
        }
    };

    // アイコン
    const getIcon = () => {
        switch (toast.type) {
            case "success":
                return "✓";
            case "error":
                return "✕";
            case "xp":
                return "⭐";
            case "info":
            default:
                return "ℹ";
        }
    };

    return (
        <div
            className={`
                flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg cursor-pointer
                transition-all duration-300 transform
                ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
                ${getStyles()}
            `}
            onClick={onClose}
        >
            <span className="text-lg">{getIcon()}</span>
            <span className="text-sm">{toast.message}</span>
        </div>
    );
}
