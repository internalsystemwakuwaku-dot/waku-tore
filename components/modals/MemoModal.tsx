"use client";

import { useState, useEffect, useTransition } from "react";
import { getMemos, addMemo, deleteMemo, toggleMemoStatus } from "@/app/actions/memos";
import type { Memo, MemoType } from "@/types/memo";

interface MemoModalProps {
    userId: string;
    cardId?: string;    // カードメモの場合に指定
    cardName?: string;  // カード名
    onClose: () => void;
}

export function MemoModal({ userId, cardId, cardName, onClose }: MemoModalProps) {
    const [activeTab, setActiveTab] = useState<MemoType>(cardId ? "card" : "personal");
    const [memoList, setMemoList] = useState<Memo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // 新規メモ入力
    const [newContent, setNewContent] = useState("");
    const [newNotifyTime, setNewNotifyTime] = useState("");

    // メモ読み込み
    useEffect(() => {
        loadMemos();
    }, [activeTab, userId, cardId]);

    const loadMemos = async () => {
        setIsLoading(true);
        try {
            const result = await getMemos(
                userId,
                activeTab,
                activeTab === "card" ? cardId : undefined
            );
            setMemoList(result);
        } catch (e) {
            console.error("メモ取得エラー:", e);
        } finally {
            setIsLoading(false);
        }
    };

    // メモ追加
    const handleAddMemo = () => {
        if (!newContent.trim()) return;

        startTransition(async () => {
            const result = await addMemo(userId, {
                type: activeTab,
                content: newContent.trim(),
                notifyTime: newNotifyTime || undefined,
                cardId: activeTab === "card" ? cardId : undefined,
            });

            if (result.success && result.memo) {
                setMemoList((prev) => [result.memo!, ...prev]);
                setNewContent("");
                setNewNotifyTime("");
            } else {
                alert("メモの追加に失敗しました: " + result.error);
            }
        });
    };

    // メモ削除
    const handleDeleteMemo = (memoId: string) => {
        if (!confirm("このメモを削除しますか？")) return;

        startTransition(async () => {
            const result = await deleteMemo(memoId);
            if (result.success) {
                setMemoList((prev) => prev.filter((m) => m.id !== memoId));
            } else {
                alert("削除に失敗しました: " + result.error);
            }
        });
    };

    // 完了状態切り替え
    const handleToggleStatus = (memoId: string) => {
        startTransition(async () => {
            const result = await toggleMemoStatus(memoId);
            if (result.success) {
                setMemoList((prev) =>
                    prev.map((m) =>
                        m.id === memoId ? { ...m, isFinished: result.isFinished! } : m
                    )
                );
            }
        });
    };

    // 通知時刻チェック
    const isOverdue = (notifyTime: string | null) => {
        if (!notifyTime) return false;
        return new Date(notifyTime) < new Date();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📝</span>
                        <div>
                            <h2 className="text-lg font-bold text-white">
                                {cardId ? "カードメモ" : "メモ帳"}
                            </h2>
                            {cardName && (
                                <p className="text-sm text-white/70">{cardName}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* タブ（カードメモの場合は非表示） */}
                {!cardId && (
                    <div className="flex border-b border-white/10">
                        {(["personal", "shared", "card"] as MemoType[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab
                                        ? "text-amber-400 border-b-2 border-amber-400"
                                        : "text-white/60 hover:text-white"
                                    }`}
                            >
                                {tab === "personal" && "🔒 個人メモ"}
                                {tab === "shared" && "👥 共有メモ"}
                                {tab === "card" && "📎 カードメモ"}
                            </button>
                        ))}
                    </div>
                )}

                {/* 新規メモ入力 */}
                <div className="p-4 bg-white/5 border-b border-white/10">
                    <div className="flex gap-2">
                        <textarea
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            placeholder="新しいメモを入力..."
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm resize-none focus:outline-none focus:border-amber-400"
                            rows={2}
                        />
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-white/60">通知時刻:</label>
                            <input
                                type="datetime-local"
                                value={newNotifyTime}
                                onChange={(e) => setNewNotifyTime(e.target.value)}
                                className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none focus:border-amber-400"
                            />
                        </div>
                        <button
                            onClick={handleAddMemo}
                            disabled={!newContent.trim() || isPending}
                            className="ml-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isPending ? "追加中..." : "追加"}
                        </button>
                    </div>
                </div>

                {/* メモリスト */}
                <div className="p-4 overflow-y-auto max-h-[50vh]">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin h-6 w-6 border-2 border-amber-400 border-t-transparent rounded-full" />
                        </div>
                    ) : memoList.length === 0 ? (
                        <div className="text-center text-white/50 py-8">
                            <p className="text-3xl mb-2">📋</p>
                            <p>メモがありません</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {memoList.map((memo) => (
                                <div
                                    key={memo.id}
                                    className={`bg-white/5 rounded-lg p-3 border transition-all ${memo.isFinished
                                            ? "border-green-500/30 opacity-60"
                                            : isOverdue(memo.notifyTime)
                                                ? "border-red-500/50 bg-red-500/10"
                                                : "border-white/10"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* 完了チェック */}
                                        <button
                                            onClick={() => handleToggleStatus(memo.id)}
                                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${memo.isFinished
                                                    ? "bg-green-500 border-green-500 text-white"
                                                    : "border-white/30 hover:border-amber-400"
                                                }`}
                                        >
                                            {memo.isFinished && "✓"}
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            {/* メモ内容 */}
                                            <p
                                                className={`text-sm text-white whitespace-pre-wrap ${memo.isFinished ? "line-through" : ""
                                                    }`}
                                            >
                                                {memo.content}
                                            </p>

                                            {/* 通知時刻 */}
                                            {memo.notifyTime && (
                                                <p
                                                    className={`text-xs mt-1 ${isOverdue(memo.notifyTime)
                                                            ? "text-red-400"
                                                            : "text-white/50"
                                                        }`}
                                                >
                                                    ⏰{" "}
                                                    {new Date(memo.notifyTime).toLocaleString("ja-JP", {
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                    {isOverdue(memo.notifyTime) && " (期限切れ)"}
                                                </p>
                                            )}

                                            {/* 作成日時 */}
                                            <p className="text-xs text-white/30 mt-1">
                                                {new Date(memo.createdAt).toLocaleString("ja-JP")}
                                            </p>
                                        </div>

                                        {/* 削除ボタン */}
                                        <button
                                            onClick={() => handleDeleteMemo(memo.id)}
                                            disabled={isPending}
                                            className="flex-shrink-0 p-1 text-white/30 hover:text-red-400 transition-colors"
                                            title="削除"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-between items-center">
                    <p className="text-xs text-white/40">
                        {memoList.length} 件のメモ
                    </p>
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
