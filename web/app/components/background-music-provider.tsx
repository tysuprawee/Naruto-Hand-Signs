"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/utils/supabase";

const SETTINGS_STORAGE_KEY = "jutsu-play-menu-settings-v1";
const MENU_MUTE_STORAGE_KEY = "jutsu-play-menu-mute-v1";
const DEFAULT_VOLUME = 0.5;

interface BackgroundMusicContextValue {
  musicVolume: number;
  musicMuted: boolean;
  setMusicVolume: (value: number) => void;
  setMusicMuted: (value: boolean) => void;
}

const BackgroundMusicContext = createContext<BackgroundMusicContextValue | null>(null);

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(1, value));
}

function readStoredVolume(): number {
  if (typeof window === "undefined") return DEFAULT_VOLUME;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_VOLUME;
    const parsed = JSON.parse(raw) as { musicVol?: unknown; music_vol?: unknown } | null;
    return clamp01(Number(parsed?.musicVol ?? parsed?.music_vol ?? DEFAULT_VOLUME));
  } catch {
    return DEFAULT_VOLUME;
  }
}

function readStoredMute(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MENU_MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function BackgroundMusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canPlayRef = useRef(false);
  const userInteractedRef = useRef(false);
  const [hasAuthenticatedSession, setHasAuthenticatedSession] = useState(false);
  const [musicVolume, setMusicVolumeState] = useState<number>(() => readStoredVolume());
  const [musicMuted, setMusicMutedState] = useState<boolean>(() => readStoredMute());

  const setMusicVolume = useCallback((value: number) => {
    setMusicVolumeState(clamp01(value));
  }, []);

  const setMusicMuted = useCallback((value: boolean) => {
    setMusicMutedState(Boolean(value));
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setHasAuthenticatedSession(Boolean(data.session));
    }).catch(() => {
      if (!cancelled) setHasAuthenticatedSession(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setHasAuthenticatedSession(Boolean(session));
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio("/sounds/music2.mp3");
    audio.loop = true;
    audio.preload = "auto";
    audioRef.current = audio;

    const onGesture = () => {
      userInteractedRef.current = true;
      if (!canPlayRef.current) return;
      void audio.play().catch(() => { });
    };

    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("touchstart", onGesture);

    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchstart", onGesture);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const canPlay = hasAuthenticatedSession && !musicMuted && musicVolume > 0.001;
    canPlayRef.current = canPlay;
    audio.volume = musicVolume;
    audio.muted = !hasAuthenticatedSession || musicMuted || musicVolume <= 0.001;
    if (!canPlay) {
      audio.pause();
      return;
    }
    if (audio.paused) {
      void audio.play().catch(() => { });
    }
  }, [hasAuthenticatedSession, musicMuted, musicVolume]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(MENU_MUTE_STORAGE_KEY, musicMuted ? "1" : "0");
    } catch {
      // Ignore localStorage write failures.
    }
  }, [musicMuted]);

  const value = useMemo<BackgroundMusicContextValue>(
    () => ({
      musicVolume,
      musicMuted,
      setMusicVolume,
      setMusicMuted,
    }),
    [musicMuted, musicVolume, setMusicMuted, setMusicVolume],
  );

  return (
    <BackgroundMusicContext.Provider value={value}>
      {children}
    </BackgroundMusicContext.Provider>
  );
}

export function useBackgroundMusic(): BackgroundMusicContextValue {
  const value = useContext(BackgroundMusicContext);
  if (!value) {
    throw new Error("useBackgroundMusic must be used within BackgroundMusicProvider");
  }
  return value;
}
