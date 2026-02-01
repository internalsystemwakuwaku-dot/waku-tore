"use client";

import { useState } from "react";
import { useThemeStore, THEMES, ThemeId } from "@/stores/themeStore";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * 設定モーダル - GAS完全再現版
 * タブ構成: 一般/ゲーム設定
 */
export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<"general" | "game">("general");
    const { currentTheme, config, setTheme, updateConfig } = useThemeStore();

    // 背景設定はStoreのconfigを直接参照・更新するため、ローカルstateは不要

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl w-[450px] max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        ⚙️ 設定
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        ✕
                    </button>
                </div>

                {/* タブ */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab("general")}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === "general"
                            ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                            : "text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        一般
                    </button>
                    <button
                        onClick={() => setActiveTab("game")}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === "game"
                            ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                            : "text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        ゲーム設定
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {activeTab === "general" && (
                        <div className="space-y-4">
                            {/* テーマ選択 */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">表示テーマ</label>
                                <select
                                    value={currentTheme}
                                    onChange={(e) => setTheme(e.target.value as ThemeId)}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                >
                                    {THEMES.map((theme) => (
                                        <option key={theme.id} value={theme.id}>
                                            {theme.emoji} {theme.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <hr className="border-gray-200" />

                            {/* 背景設定 (M-3 UX改善) */}
                            <h4 className="font-medium text-gray-700">背景設定</h4>

                            <div className="space-y-1">
                                <label className="text-sm text-gray-600">背景タイプ</label>
                                <select
                                    value={config.bgType}
                                    onChange={(e) => updateConfig({ bgType: e.target.value as any })}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                >
                                    <option value="none">なし (デフォルト)</option>
                                    <option value="image">画像 (URL)</option>
                                    <option value="video">動画 (URL)</option>
                                </select>
                            </div>

                            {config.bgType !== "none" && (
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-600">URL</label>
                                    <input
                                        type="text"
                                        value={config.bgUrl}
                                        onChange={(e) => updateConfig({ bgUrl: e.target.value })}
                                        placeholder={config.bgType === "image" ? "https://example.com/image.jpg" : "https://example.com/video.mp4"}
                                        className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${config.bgUrl && !config.bgUrl.match(/^https?:\/\/.+/)
                                                ? "border-red-300 bg-red-50"
                                                : "border-gray-300"
                                            }`}
                                    />
                                    {config.bgUrl && !config.bgUrl.match(/^https?:\/\/.+/) && (
                                        <p className="text-xs text-red-500">有効なURLを入力してください (http:// または https:// で始まる必要があります)</p>
                                    )}

                                    {/* プレビューサムネイル */}
                                    {config.bgUrl && config.bgUrl.match(/^https?:\/\/.+/) && (
                                        <div className="mt-2 p-2 bg-gray-100 rounded-lg">
                                            <p className="text-xs text-gray-500 mb-1">プレビュー:</p>
                                            {config.bgType === "image" ? (
                                                <img
                                                    src={config.bgUrl}
                                                    alt="背景プレビュー"
                                                    className="w-full h-24 object-cover rounded border border-gray-200"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = "none";
                                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                                    }}
                                                />
                                            ) : (
                                                <video
                                                    src={config.bgUrl}
                                                    className="w-full h-24 object-cover rounded border border-gray-200"
                                                    muted
                                                    autoPlay
                                                    loop
                                                    playsInline
                                                    onError={(e) => {
                                                        (e.target as HTMLVideoElement).style.display = "none";
                                                        (e.target as HTMLVideoElement).nextElementSibling?.classList.remove("hidden");
                                                    }}
                                                />
                                            )}
                                            <p className="hidden text-xs text-red-500 mt-1">読み込みに失敗しました。URLを確認してください。</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-sm text-gray-600">背景の暗さ</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="0.9"
                                        step="0.1"
                                        value={config.bgOpacity}
                                        onChange={(e) => updateConfig({ bgOpacity: parseFloat(e.target.value) })}
                                        className="flex-1"
                                    />
                                    <span className="text-xs text-gray-500 w-10 text-right">
                                        {Math.round(config.bgOpacity * 100)}%
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm text-gray-600">背景サイズ (拡大/縮小)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="3.0"
                                        step="0.1"
                                        value={config.bgScale}
                                        onChange={(e) => updateConfig({ bgScale: parseFloat(e.target.value) })}
                                        className="flex-1"
                                    />
                                    <span className="text-xs text-gray-500 w-10 text-right">
                                        {Math.round(config.bgScale * 100)}%
                                    </span>
                                    <button
                                        onClick={() => updateConfig({ bgScale: 1 })}
                                        className="text-xs text-gray-500 border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-50"
                                    >
                                        リセット
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm text-gray-600">位置調整 X (左右)</label>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="range"
                                            min="-50"
                                            max="50"
                                            value={config.bgPosX}
                                            onChange={(e) => updateConfig({ bgPosX: parseInt(e.target.value) })}
                                            className="flex-1"
                                        />
                                        <span className="text-xs text-gray-500 w-8">{config.bgPosX}%</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-gray-600">位置調整 Y (上下)</label>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="range"
                                            min="-50"
                                            max="50"
                                            value={config.bgPosY}
                                            onChange={(e) => updateConfig({ bgPosY: parseInt(e.target.value) })}
                                            className="flex-1"
                                        />
                                        <span className="text-xs text-gray-500 w-8">{config.bgPosY}%</span>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-200" />

                            {/* ログアウト */}
                            <form action="/api/auth/sign-out" method="POST">
                                <button
                                    type="submit"
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                    🚪 ログアウト
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === "game" && (
                        <div className="space-y-4">
                            {/* ランキングプレート */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">
                                    ランキングプレート (Lv.80~)
                                </label>
                                <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                                    <option value="">なし</option>
                                    <option value="plate-galaxy">銀河</option>
                                    <option value="plate-magma">マグマ</option>
                                    <option value="plate-matrix">マトリックス</option>
                                    <option value="plate-gold">黄金</option>
                                </select>
                            </div>

                            {/* 名前エフェクト */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">
                                    名前エフェクト (Lv.50~)
                                </label>
                                <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                                    <option value="">なし</option>
                                    <option value="effect-rainbow">レインボー</option>
                                    <option value="effect-fire">炎</option>
                                    <option value="effect-ice">氷</option>
                                    <option value="effect-gold">ゴールド</option>
                                </select>
                            </div>

                            {/* プレビュー */}
                            <div className="p-4 bg-gray-100 rounded text-center">
                                <p className="text-sm text-gray-500">プレビュー</p>
                                <div className="mt-2 inline-block px-4 py-2 bg-white rounded shadow">
                                    <span className="font-bold">ユーザー名</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
