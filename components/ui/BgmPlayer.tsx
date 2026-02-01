"use client";

import { useState, useRef, useEffect } from "react";

// BGM種類定義
const BGM_OPTIONS = [
    { id: "off", name: "オフ", icon: "🔇", url: null },
    { id: "bonfire", name: "焚き火", icon: "🔥", url: "https://www.soundjay.com/nature/campfire-1.mp3" },
    { id: "rain", name: "雨", icon: "🌧️", url: "https://www.soundjay.com/nature/rain-01.mp3" },
    { id: "cafe", name: "カフェ", icon: "☕", url: "https://www.soundjay.com/nature/wind-howl-1.mp3" },
];

/**
 * BGMプレイヤー - GAS完全再現版
 * 最小化/展開切り替え、BGM選択、音量調整
 */
export function BgmPlayer() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentBgm, setCurrentBgm] = useState("off");
    const [volume, setVolume] = useState(0.5);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // BGM変更時
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        const bgm = BGM_OPTIONS.find(b => b.id === currentBgm);
        if (bgm && bgm.url) {
            const audio = new Audio(bgm.url);
            audio.loop = true;
            audio.volume = volume;
            audio.play().catch(() => {
                // 自動再生がブロックされた場合は無視
            });
            audioRef.current = audio;
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, [currentBgm]);

    // 音量変更時
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // コンポーネントアンマウント時にクリーンアップ
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    return (
        <div className="fixed bottom-4 right-4 z-40">
            {isExpanded ? (
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-[200px]">
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">🎵 BGM</span>
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                            ▼
                        </button>
                    </div>

                    {/* BGM選択ボタン */}
                    <div className="grid grid-cols-4 gap-1 mb-3">
                        {BGM_OPTIONS.map((bgm) => (
                            <button
                                key={bgm.id}
                                onClick={() => setCurrentBgm(bgm.id)}
                                className={`p-2 rounded text-center transition-colors ${currentBgm === bgm.id
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                                    }`}
                                title={bgm.name}
                            >
                                <div className="text-lg">{bgm.icon}</div>
                            </button>
                        ))}
                    </div>

                    {/* 音量スライダー */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">🔊</span>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="flex-1"
                        />
                        <span className="text-xs text-gray-500 w-8">{Math.round(volume * 100)}%</span>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="bg-white rounded-full shadow-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                    title="BGMプレイヤー"
                >
                    {currentBgm === "off" ? "🔇" : BGM_OPTIONS.find(b => b.id === currentBgm)?.icon || "🎵"}
                </button>
            )}
        </div>
    );
}
