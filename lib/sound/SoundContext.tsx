"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/stores/gameStore";

type SoundType = "click" | "decide" | "cancel" | "popup" | "coin" | "levelUp" | "gacha" | "fanfare";
type BgmType = "home" | "race" | "shop";

interface SoundContextType {
    playSe: (type: SoundType) => void;
    playBgm: (type: BgmType) => void;
    stopBgm: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

// Sound Assets (Base64 placeholders / paths for now)
// In a real app, these would be mp3 files in public/sounds/
const SOUND_FILES: Record<SoundType, string> = {
    click: "/sounds/click.mp3",
    decide: "/sounds/decide.mp3",
    cancel: "/sounds/cancel.mp3",
    popup: "/sounds/popup.mp3",
    coin: "/sounds/coin.mp3",
    levelUp: "/sounds/levelup.mp3",
    gacha: "/sounds/gacha.mp3",
    fanfare: "/sounds/fanfare.mp3",
};

const BGM_FILES: Record<BgmType, string> = {
    home: "/sounds/bgm_home.mp3",
    race: "/sounds/bgm_race.mp3",
    shop: "/sounds/bgm_shop.mp3",
};

export function SoundProvider({ children }: { children: React.ReactNode }) {
    const { data } = useGameStore();
    const bgmRef = useRef<HTMLAudioElement | null>(null);
    const [currentBgm, setCurrentBgm] = useState<BgmType | null>(null);

    const playSe = (type: SoundType) => {
        if (!data.settings.enableNotifications) return; // Using enableNotifications as a proxy for master mute for now if generic mute doesn't exist? 
        // Actually GameSettings has seVolume.

        try {
            const audio = new Audio(SOUND_FILES[type]);
            audio.volume = data.settings.seVolume;
            audio.play().catch(() => { });
        } catch (e) {
            // Audio play failed (interaction required etc)
        }
    };

    const playBgm = (type: BgmType) => {
        if (currentBgm === type) return;

        if (bgmRef.current) {
            bgmRef.current.pause();
            bgmRef.current = null;
        }

        try {
            const audio = new Audio(BGM_FILES[type]);
            audio.volume = data.settings.bgmVolume;
            audio.loop = true;
            audio.play().catch(() => { });
            bgmRef.current = audio;
            setCurrentBgm(type);
        } catch (e) {
            // Autoplay policy
        }
    };

    const stopBgm = () => {
        if (bgmRef.current) {
            bgmRef.current.pause();
            bgmRef.current = null;
            setCurrentBgm(null);
        }
    };

    // Update volume if playing
    useEffect(() => {
        if (bgmRef.current) {
            bgmRef.current.volume = data.settings.bgmVolume;
        }
    }, [data.settings.bgmVolume]);

    return (
        <SoundContext.Provider value={{ playSe, playBgm, stopBgm }}>
            {children}
        </SoundContext.Provider>
    );
}

export function useSound() {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error("useSound must be used within a SoundProvider");
    }
    return context;
}
