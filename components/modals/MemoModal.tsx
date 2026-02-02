"use client";

import { useState, useEffect, useTransition } from "react";
import { getMemos, getCardTimeline, addMemo, deleteMemo, toggleMemoStatus } from "@/app/actions/memos";
import { useBoardStore } from "@/stores/boardStore";
import type { Memo, MemoType } from "@/types/memo";

interface MemoModalProps {
    userId: string;
    cardId?: string;    // カードメモの場合に指定
    cardName?: string;  // カード名
    onClose: () => void;
}

/**
 * メモ帳モーダル - GAS完全再現版
 * - 3カラムレイアウト（入力、未完了、完了）
 * - 関係者タグ付け
 * - 通知日時
 */
export function MemoModal({ userId, cardId, cardName, onClose }: MemoModalProps) {
    const { data } = useBoardStore();
    const [activeTab, setActiveTab] = useState<MemoType>(cardId ? "card" : "personal");
    const [memoList, setMemoList] = useState<Memo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // 新規メモ入力
    const [newContent, setNewContent] = useState("");
    const [newNotifyTime, setNewNotifyTime] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

    // メンバーリストの統合（構築/システム/商談/MTGの全メンバー）
    const allMembers = data ? Array.from(new Set([
        ...data.members.construction,
        ...data.members.system,
        ...data.members.sales,
        ...data.members.mtg
    ])).filter(m => m !== "未設定" && m !== "(未設定)") : [];

    // メモ読み込み
    useEffect(() => {
        loadMemos();
    }, [activeTab, userId, cardId]);

    const loadMemos = async () => {
        setIsLoading(true);
        try {
            let result: Memo[];
            if (activeTab === "card" && cardId) {
                // M-26: カードメモの場合は統合タイムラインを取得
                result = await getCardTimeline(userId, cardId);
            } else {
                result = await getMemos(
                    userId,
                    activeTab,
                    undefined // cardId is undefined for personal/shared tabs
                );
            }
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

        // メンション付きの本文を作成
        let contentWithMentions = newContent.trim();
        if (selectedMembers.size > 0) {
            const mentions = Array.from(selectedMembers).map(m => `@${m}`).join(" ");
            contentWithMentions = `${mentions}\n${contentWithMentions}`;
        }

        startTransition(async () => {
            const result = await addMemo(userId, {
                type: activeTab,
                content: contentWithMentions,
                notifyTime: newNotifyTime || undefined,
                cardId: activeTab === "card" ? cardId : undefined,
            });

            if (result.success && result.memo) {
                setMemoList((prev) => [result.memo!, ...prev]);
                setNewContent("");
                setNewNotifyTime("");
                setSelectedMembers(new Set());
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

    // メンバー選択トグル
    const toggleMember = (member: string) => {
        setSelectedMembers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(member)) {
                newSet.delete(member);
            } else {
                newSet.add(member);
            }
            return newSet;
        });
    };

    // 通知時刻チェック
    const isOverdue = (notifyTime: string | null) => {
        if (!notifyTime) return false;
        return new Date(notifyTime) < new Date();
    };

    // 未完了・完了リスト分割
    const unfinishedMemos = memoList.filter(m => !m.isFinished);
    const finishedMemos = memoList.filter(m => m.isFinished);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📝</span>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">
                                {cardId ? "カードメモ" : "メモ帳"}
                            </h2>
                            {cardName && (
                                <p className="text-sm text-gray-500">{cardName}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                    >
                        ✕ 閉じる
                    </button>
                </div>

                <div className="flex-1 flex min-h-0 bg-gray-50">
                    {/* 左カラム：入力・設定 */}
                    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                        {/* タブ（カードメモの場合は非表示） */}
                        {!cardId && (
                            <div className="flex border-b border-gray-200">
                                {(["personal", "shared"] as MemoType[]).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab
                                            ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                            }`}
                                    >
                                        {tab === "personal" && "🔒 個人メモ"}
                                        {tab === "shared" && "👥 全員へ共有"}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="p-4 flex-1 overflow-y-auto">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">内容</label>
                                    <textarea
                                        value={newContent}
                                        onChange={(e) => setNewContent(e.target.value)}
                                        placeholder="メモを入力..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y min-h-[120px] focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">関係者タグ付け</label>
                                    <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                                        {allMembers.length > 0 ? (
                                            allMembers.map(member => (
                                                <button
                                                    key={member}
                                                    onClick={() => toggleMember(member)}
                                                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${selectedMembers.has(member)
                                                        ? "bg-blue-100 border-blue-300 text-blue-700"
                                                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-100"
                                                        }`}
                                                >
                                                    {member}
                                                </button>
                                            ))
                                        ) : (
                                            <p className="text-xs text-gray-400 p-1">メンバー情報なし</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">通知日時 (任意)</label>
                                    <input
                                        type="datetime-local"
                                        value={newNotifyTime}
                                        onChange={(e) => setNewNotifyTime(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={handleAddMemo}
                                        disabled={!newContent.trim() || isPending}
                                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isPending ? (
                                            "追加中..."
                                        ) : (
                                            <>
                                                <span className="material-icons text-sm">add_circle</span> 追加する
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 中央カラム：未完了タスク */}
                    <div className="flex-1 bg-white border-r border-gray-200 flex flex-col min-w-0">
                        <div className="px-4 py-3 border-b border-blue-500 bg-blue-50 flex justify-between items-center">
                            <span className="font-bold text-blue-800 flex items-center gap-2">
                                <span className="text-lg">📋</span> 未完了タスク
                            </span>
                            <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                {unfinishedMemos.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                                </div>
                            ) : unfinishedMemos.length === 0 ? (
                                <div className="text-center text-gray-400 py-12">
                                    <p>未完了のメモはありません</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {unfinishedMemos.map((memo) => (
                                        <div
                                            key={memo.id}
                                            className={`bg-white rounded border p-3 hover:shadow-sm transition-shadow ${isOverdue(memo.notifyTime) ? "border-red-300 bg-red-50" : "border-gray-200"
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={() => handleToggleStatus(memo.id)}
                                                    className="mt-0.5 w-5 h-5 rounded border border-gray-300 hover:border-blue-500 bg-white flex items-center justify-center transition-colors"
                                                >
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {memo.id.startsWith("trello-") && (
                                                            <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded border border-blue-200 font-bold flex items-center gap-1">
                                                                <span className="material-icons text-[10px]">link</span> Trello
                                                            </span>
                                                        )}
                                                        <span className="text-xs font-bold text-gray-600">
                                                            {memo.userId}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(memo.createdAt).toLocaleString("ja-JP")}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{memo.content}</p>
                                                    {memo.notifyTime && (
                                                        <p className={`text-xs mt-1 ${isOverdue(memo.notifyTime) ? "text-red-600 font-bold" : "text-gray-500"}`}>
                                                            ⏰ {new Date(memo.notifyTime).toLocaleString("ja-JP")}
                                                            {isOverdue(memo.notifyTime) && " (期限切れ)"}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteMemo(memo.id)}
                                                    className="text-gray-400 hover:text-red-500 p-1"
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
                    </div>

                    {/* 右カラム：完了済みタスク */}
                    <div className="w-80 bg-gray-100 flex flex-col border-l border-gray-200">
                        <div className="px-4 py-3 border-b border-gray-300 bg-gray-200 flex justify-between items-center">
                            <span className="font-bold text-gray-600 flex items-center gap-2">
                                <span className="text-lg">✅</span> 完了済み
                            </span>
                            <span className="bg-gray-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                {finishedMemos.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {finishedMemos.length === 0 ? (
                                <div className="text-center text-gray-400 py-12">
                                    <p>完了済みのメモはありません</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {finishedMemos.map((memo) => (
                                        <div key={memo.id} className="bg-white/50 rounded border border-gray-200 p-3 opacity-70">
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={() => handleToggleStatus(memo.id)}
                                                    className="mt-0.5 w-5 h-5 rounded border border-green-500 bg-green-500 text-white flex items-center justify-center text-xs"
                                                >
                                                    ✓
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-gray-600 line-through whitespace-pre-wrap">{memo.content}</p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {new Date(memo.createdAt).toLocaleString("ja-JP")}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteMemo(memo.id)}
                                                    className="text-gray-400 hover:text-red-500 p-1"
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
                    </div>
                </div>
            </div>
        </div>
    );
}
