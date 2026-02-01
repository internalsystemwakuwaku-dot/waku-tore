"use client";

import { useThemeStore } from "@/stores/themeStore";
import { useEffect, useState } from "react";

/**
 * テーマ背景コンポーネント
 * 設定された画像/動画を最背面に表示する
 */
export function ThemeBackground() {
    const { config } = useThemeStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || config.bgType === "none") return null;

    const style: React.CSSProperties = {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -10,
        pointerEvents: "none",
        opacity: 1 - config.bgOpacity, // 設定値は「暗さ(Opacity)」なので、表示のOpacityは逆になる設計か確認が必要
        // SettingsModalの実装を見ると「暗さ」として0.0-0.9を設定している。
        // つまり、0なら明るい（背景そのまま）、0.9なら暗い。
        // 背景の上に黒いオーバーレイをかける形式の方が「暗さ」としては自然だが、
        // ここでは単純に背景要素自体の透明度とするか、フィルターで暗くするか。
        // GAS版の挙動に合わせると、背景の上に黒半透明を乗せるのが一般的。
        // 今回は「背景自体の不透明度」ではなく「背景の上に被せる黒マスクの濃さ」として実装済みと思われる（SettingsModalのUI的に）。
        // しかし、画像を薄くする実装の方が簡単かもしれない。
        // いったん、画像を表示し、その上に黒オーバーレイを乗せる形にする。
    };

    // 変形スタイル
    const transformStyle: React.CSSProperties = {
        transform: `translate(${config.bgPosX}%, ${config.bgPosY}%) scale(${config.bgScale})`,
        width: "100%",
        height: "100%",
        objectFit: "cover",
    };

    return (
        <div style={style} className="overflow-hidden">
            {/* 背景メディア */}
            {config.bgType === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={config.bgUrl}
                    alt="Background"
                    style={transformStyle}
                />
            )}
            {config.bgType === "video" && (
                <video
                    src={config.bgUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={transformStyle}
                />
            )}

            {/* 暗さオーバーレイ */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "black",
                    opacity: config.bgOpacity
                }}
            />
        </div>
    );
}
