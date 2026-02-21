"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogIn,
  LogOut,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

import { supabase } from "@/utils/supabase";

type PlayView = "menu" | "settings" | "tutorial" | "about" | "mode_select";

interface TutorialStep {
  iconPath: string;
  title: string;
  lines: string[];
}

interface MenuSettingsState {
  musicVol: number;
  sfxVol: number;
  debugHands: boolean;
  restrictedSigns: boolean;
  fullscreen: boolean;
}

const SETTINGS_STORAGE_KEY = "jutsu-play-menu-settings-v1";

const DEFAULT_SETTINGS: MenuSettingsState = {
  musicVol: 0.5,
  sfxVol: 0.7,
  debugHands: false,
  restrictedSigns: true,
  fullscreen: false,
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    iconPath: "/pics/tutorial/step_camera.png",
    title: "Setup Your Camera",
    lines: [
      "Open Settings and choose your camera device.",
      "Enable preview to verify framing and lighting.",
      "Keep both hands visible in the camera panel.",
    ],
  },
  {
    iconPath: "/pics/tutorial/step_signs.png",
    title: "Perform Signs In Order",
    lines: [
      "Follow the sign sequence shown at the bottom.",
      "Each correct sign advances your combo step.",
      "Stable lighting improves landmark recognition.",
    ],
  },
  {
    iconPath: "/pics/tutorial/step_execute.png",
    title: "Execute The Jutsu",
    lines: [
      "Complete all signs to trigger the jutsu effect.",
      "You earn XP for successful completions.",
      "Level up to unlock higher-tier jutsu.",
    ],
  },
  {
    iconPath: "/pics/tutorial/step_challenge.png",
    title: "Rank Mode And Progress",
    lines: [
      "Use Rank Mode for timed runs and leaderboard ranking.",
      "Visit Quest Board for daily and weekly XP rewards.",
      "Master each jutsu to reach Bronze, Silver, and Gold tiers.",
    ],
  },
];

const ABOUT_SECTIONS: Array<{ title: string; lines: string[]; tone?: "accent" | "success" | "error" }> = [
  {
    title: "Overview",
    tone: "success",
    lines: [
      "Jutsu Academy is a Naruto-inspired hand-sign training game where players perform sign sequences in front of a camera to execute jutsu.",
      "The game focuses on timing, recognition accuracy, progression unlocks, and fast iteration between free practice and rank mode runs.",
    ],
  },
  {
    title: "Modes",
    lines: [
      "Free Play: pick any unlocked jutsu and practice at your pace.",
      "Rank Mode: clear the full sequence as fast as possible.",
      "Jutsu Library: browse tiers, lock requirements, and progression status.",
      "Leaderboard: compare rank mode times against other players.",
    ],
  },
  {
    title: "Controls",
    tone: "accent",
    lines: [
      "Menu navigation: mouse or touch input.",
      "Playing: LEFT and RIGHT arrows switch jutsu when allowed.",
      "Rank Mode: SPACE starts countdown and restarts after results.",
      "Exit current run: ESC or the in-game BACK button.",
    ],
  },
  {
    title: "Privacy And Data",
    lines: [
      "Camera frames are processed locally for sign detection and effects.",
      "Raw camera frames are not uploaded.",
      "Discord login is used for account identity and progression sync.",
    ],
  },
  {
    title: "Legal Notice",
    tone: "error",
    lines: [
      "This is a non-profit fan-made project for educational and portfolio use.",
      "Naruto and related names or characters are property of their respective rights holders.",
      "This project is not affiliated with or endorsed by official rights holders.",
    ],
  },
];

function clampVolume(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function sanitizeSettings(raw: Partial<MenuSettingsState> | null | undefined): MenuSettingsState {
  return {
    musicVol: clampVolume(raw?.musicVol, DEFAULT_SETTINGS.musicVol),
    sfxVol: clampVolume(raw?.sfxVol, DEFAULT_SETTINGS.sfxVol),
    debugHands: Boolean(raw?.debugHands),
    restrictedSigns: true,
    fullscreen: Boolean(raw?.fullscreen),
  };
}

function readStoredSettings(): MenuSettingsState {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<MenuSettingsState>;
    return sanitizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getDiscordUsername(session: Session | null): string {
  const metadata = session?.user?.user_metadata;
  const preferred = String(
    metadata?.preferred_username
    || metadata?.user_name
    || metadata?.username
    || metadata?.full_name
    || metadata?.name
    || "",
  ).trim();
  if (preferred) return preferred;

  const email = String(session?.user?.email || "").trim();
  if (!email) return "Shinobi";
  const [left] = email.split("@");
  return left || "Shinobi";
}

function toggleFullscreen(enabled: boolean): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const doc = document as Document & {
    webkitExitFullscreen?: () => void;
  };

  if (enabled) {
    if (document.fullscreenElement) return;
    if (root.requestFullscreen) {
      void root.requestFullscreen().catch(() => { });
      return;
    }
    if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
    return;
  }

  if (!document.fullscreenElement) return;
  if (doc.exitFullscreen) {
    void doc.exitFullscreen().catch(() => { });
    return;
  }
  if (doc.webkitExitFullscreen) {
    doc.webkitExitFullscreen();
  }
}

export default function PlayPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(
    !supabase
      ? "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      : "",
  );

  const [view, setView] = useState<PlayView>("menu");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  const [savedSettings, setSavedSettings] = useState<MenuSettingsState>(() => readStoredSettings());
  const [draftSettings, setDraftSettings] = useState<MenuSettingsState>(() => readStoredSettings());

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = savedSettings.musicVol;
      // We attempt to play it continuously based on standard browser policies. It may need user interaction first.
      audioRef.current.play().catch(() => { });
    }
  }, [savedSettings.musicVol]);

  const username = useMemo(() => getDiscordUsername(session), [session]);
  const avatarUrl = useMemo(() => {
    const metadata = session?.user?.user_metadata;
    const raw = metadata?.avatar_url || metadata?.picture || "";
    const value = String(raw || "").trim();
    return value || null;
  }, [session]);

  useEffect(() => {
    if (!supabase) return;

    let alive = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        setAuthError(error.message);
      }
      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setAuthReady(true);
      setAuthBusy(false);
      if (nextSession) {
        setAuthError("");
      }
    });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleDiscordLogin = async () => {
    if (!supabase || typeof window === "undefined") return;
    setAuthBusy(true);
    setAuthError("");

    const redirectTo = `${window.location.origin}/play`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo,
        scopes: "identify email",
      },
    });

    if (error) {
      setAuthError(error.message);
      setAuthBusy(false);
    }
  };

  const handleSaveSettings = () => {
    if (typeof window !== "undefined") {
      const next = sanitizeSettings(draftSettings);
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      toggleFullscreen(next.fullscreen);
      setSavedSettings(next);
      setDraftSettings(next);
    } else {
      const next = sanitizeSettings(draftSettings);
      setSavedSettings(next);
      setDraftSettings(next);
    }
    setView("menu");
  };

  const handleQuit = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    }
    setShowQuitConfirm(false);
    setView("menu");
    setAuthBusy(false);
  };

  const tutorial = TUTORIAL_STEPS[tutorialStep];
  const inMenu = view === "menu";

  return (
    <div className="min-h-screen bg-ninja-bg text-ninja-text">
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url('/vl2.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "grayscale(100%) contrast(115%) brightness(0.42)",
        }}
      />
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black/55 via-black/70 to-black/85" />

      {/* Background Music */}
      <audio ref={audioRef} src="/sounds/music2.mp3" loop />

      <header className="relative z-20 border-b border-ninja-border bg-ninja-bg/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 hover:opacity-85 transition-opacity">
            <img src="/logo2.png" alt="Jutsu Academy" className="h-10 w-10 object-contain" />
            <span className="font-bold tracking-tight text-zinc-100">Jutsu Academy</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-ninja-border bg-ninja-card/70 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-200 hover:border-ninja-accent/40 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Base
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8 md:py-12">
        {!authReady && (
          <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-ninja-border bg-ninja-panel/85 p-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-ninja-accent" />
            <p className="mt-4 text-sm text-zinc-300">Initializing academy gate...</p>
          </div>
        )}

        {authReady && !session && (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-ninja-border bg-ninja-panel/90 p-8 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-black tracking-tight text-white">Login Required</h1>
              <p className="mt-2 text-sm text-ninja-dim">
                Sign in with Discord to enter <span className="text-ninja-accent font-semibold">/play</span>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleDiscordLogin()}
              disabled={!supabase || authBusy}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-indigo-600 px-6 text-base font-black text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              LOGIN WITH DISCORD
            </button>

            <p className="mt-4 text-center text-xs text-ninja-dim">
              This mirrors the pygame flow: Discord login first, main menu second.
            </p>

            {authError && (
              <p className="mt-4 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {authError}
              </p>
            )}
          </div>
        )}

        {session && (
          <>
            <div className="mx-auto mb-6 flex w-full max-w-2xl items-center justify-between rounded-xl border border-ninja-border bg-ninja-card/70 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={username} className="h-11 w-11 rounded-lg border border-ninja-border object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-ninja-border bg-ninja-panel text-sm font-black text-ninja-accent">
                    {username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-white">{username}</p>
                  <p className="text-[11px] uppercase tracking-wider text-ninja-dim">Discord Connected</p>
                </div>
              </div>
              {!inMenu && (
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  className="rounded-lg border border-ninja-border bg-ninja-panel px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-200 hover:border-ninja-accent/40 hover:text-white"
                >
                  Back To Menu
                </button>
              )}
            </div>

            {view === "menu" && (
              <div className="mx-auto max-w-2xl rounded-3xl border border-ninja-border bg-ninja-panel/85 p-8 md:p-10 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <div className="text-center">
                  <img src="/logo2.png" alt="Jutsu Academy" className="mx-auto h-28 w-28 object-contain md:h-36 md:w-36" />
                  <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-white">JUTSU ACADEMY</h1>
                  <p className="mt-2 text-sm font-bold tracking-[0.2em] text-ninja-accent">TRAIN • MASTER • RANK UP</p>
                </div>

                <div className="mt-8 space-y-3">
                  <button
                    type="button"
                    onClick={() => setView("mode_select")}
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-ninja-accent text-base font-black tracking-wide text-white transition hover:bg-ninja-accent-glow cursor-pointer"
                  >
                    ENTER ACADEMY
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSettings(savedSettings);
                      setView("settings");
                    }}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    <Settings className="h-5 w-5" />
                    SETTINGS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTutorialStep(0);
                      setView("tutorial");
                    }}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    <Sparkles className="h-5 w-5" />
                    TUTORIAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("about")}
                    className="flex h-14 w-full items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    ABOUT
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuitConfirm(true)}
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-red-700/80 text-base font-black tracking-wide text-white transition hover:bg-red-600"
                  >
                    QUIT
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-center gap-4">
                  <a
                    href="https://www.instagram.com/james.uzumaki_/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-ninja-border bg-ninja-card/80 p-2 hover:border-pink-400/60"
                  >
                    <img src="/socials/ig.png" alt="Instagram" className="h-7 w-7 object-contain" />
                  </a>
                  <a
                    href="https://www.youtube.com/@James_Uzumaki"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-ninja-border bg-ninja-card/80 p-2 hover:border-red-400/60"
                  >
                    <img src="/socials/yt.png" alt="YouTube" className="h-7 w-7 object-contain" />
                  </a>
                  <a
                    href="https://discord.gg/7xBQ22SnN2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-ninja-border bg-ninja-card/80 p-2 hover:border-indigo-400/60"
                  >
                    <img src="/socials/discord.png" alt="Discord" className="h-7 w-7 object-contain" />
                  </a>
                </div>

                <div className="mt-6 rounded-xl border border-ninja-border bg-ninja-bg/35 px-4 py-3 text-xs text-ninja-dim">
                  Current settings: music {Math.round(savedSettings.musicVol * 100)}%, sfx {Math.round(savedSettings.sfxVol * 100)}%, restricted signs ON.
                </div>
              </div>
            )}

            {view === "settings" && (
              <div className="mx-auto max-w-2xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-8 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <h2 className="text-3xl font-black tracking-tight text-white">SETTINGS</h2>
                <p className="mt-1 text-sm text-ninja-dim">Menu settings mirror the pygame controls.</p>

                <div className="mt-6 space-y-6">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-zinc-100">
                      <span>Music Volume</span>
                      <span className="font-mono text-ninja-accent">{Math.round(draftSettings.musicVol * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={draftSettings.musicVol}
                      onChange={(event) => {
                        setDraftSettings((prev) => ({
                          ...prev,
                          musicVol: clampVolume(event.target.value, prev.musicVol),
                        }));
                      }}
                      className="w-full accent-orange-500"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-zinc-100">
                      <span>SFX Volume</span>
                      <span className="font-mono text-ninja-accent">{Math.round(draftSettings.sfxVol * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={draftSettings.sfxVol}
                      onChange={(event) => {
                        setDraftSettings((prev) => ({
                          ...prev,
                          sfxVol: clampVolume(event.target.value, prev.sfxVol),
                        }));
                      }}
                      className="w-full accent-orange-500"
                    />
                  </div>

                  <label className="flex items-center justify-between rounded-lg border border-ninja-border bg-ninja-bg/30 px-4 py-3 text-sm text-zinc-100">
                    <span>Show Hand Skeleton</span>
                    <input
                      type="checkbox"
                      checked={draftSettings.debugHands}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDraftSettings((prev) => ({ ...prev, debugHands: checked }));
                      }}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-ninja-border bg-ninja-bg/30 px-4 py-3 text-sm text-zinc-400">
                    <span>Restricted Signs (Require 2 Hands) - Always On</span>
                    <input type="checkbox" checked readOnly disabled className="h-4 w-4 accent-orange-500" />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-ninja-border bg-ninja-bg/30 px-4 py-3 text-sm text-zinc-100">
                    <span>Fullscreen</span>
                    <input
                      type="checkbox"
                      checked={draftSettings.fullscreen}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDraftSettings((prev) => ({ ...prev, fullscreen: checked }));
                      }}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="h-12 rounded-xl bg-ninja-accent px-6 text-sm font-black tracking-wide text-white hover:bg-ninja-accent-glow"
                  >
                    SAVE & BACK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSettings(savedSettings);
                      setView("menu");
                    }}
                    className="h-12 rounded-xl border border-ninja-border bg-ninja-card px-6 text-sm font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            {view === "tutorial" && (
              <div className="mx-auto max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-5 md:p-6 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <p className="text-[10px] md:text-xs font-black tracking-[0.2em] text-ninja-dim">
                  STEP {tutorialStep + 1} / {TUTORIAL_STEPS.length}
                </p>
                <h2 className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-white">{tutorial.title}</h2>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[280px,1fr]">
                  <div className="overflow-hidden rounded-2xl border border-ninja-border bg-ninja-bg/60 flex items-center justify-center max-h-40 md:max-h-56">
                    <img src={tutorial.iconPath} alt={tutorial.title} className="max-h-full w-full object-cover" />
                  </div>

                  <div className="rounded-2xl border border-ninja-border bg-ninja-bg/40 p-4 flex flex-col justify-center">
                    <ul className="space-y-2.5 text-sm text-zinc-200">
                      {tutorial.lines.map((line) => (
                        <li key={line} className="leading-relaxed border-l-2 border-ninja-accent/30 pl-3">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTutorialStep((prev) => Math.max(0, prev - 1))}
                    disabled={tutorialStep === 0}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-ninja-border bg-ninja-card px-5 text-sm font-black text-zinc-100 hover:border-ninja-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    BACK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTutorialStep(0);
                      setView("menu");
                    }}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-ninja-border bg-ninja-card px-5 text-sm font-black text-zinc-100 hover:border-ninja-accent/40"
                  >
                    SKIP
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
                        setTutorialStep(0);
                        setView("menu");
                        return;
                      }
                      setTutorialStep((prev) => Math.min(TUTORIAL_STEPS.length - 1, prev + 1));
                    }}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-ninja-accent px-5 text-sm font-black text-white hover:bg-ninja-accent-glow"
                  >
                    {tutorialStep >= TUTORIAL_STEPS.length - 1 ? "FINISH" : "NEXT"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {view === "about" && (
              <div className="mx-auto max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <h2 className="text-3xl font-black tracking-tight text-white">ABOUT JUTSU ACADEMY</h2>
                <p className="mt-1 text-sm text-ninja-dim">Project details, controls, privacy, and roadmap.</p>

                <div className="mt-6 max-h-[62vh] space-y-4 overflow-y-auto pr-1">
                  {ABOUT_SECTIONS.map((section) => (
                    <section key={section.title} className="rounded-xl border border-ninja-border bg-ninja-bg/35 p-4">
                      <h3
                        className={`text-base font-black uppercase tracking-wide ${section.tone === "success"
                          ? "text-green-300"
                          : section.tone === "error"
                            ? "text-red-300"
                            : "text-ninja-accent"
                          }`}
                      >
                        {section.title}
                      </h3>
                      <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                        {section.lines.map((line) => (
                          <li key={line} className="leading-relaxed">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </div>
            )}

            {view === "mode_select" && (
              <div className="mx-auto max-w-2xl rounded-3xl border border-ninja-border bg-ninja-panel/85 p-8 md:p-10 shadow-[0_18px_55px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200">
                <div className="text-center mb-8">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">SELECT YOUR PATH</h1>
                  <p className="mt-2 text-sm font-bold tracking-[0.2em] text-ninja-accent">CHOOSE YOUR TRAINING</p>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/challenge"
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-gradient-to-r from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500 text-base font-black tracking-wide text-white transition shadow-lg border border-zinc-500/30"
                  >
                    FREE OBSTACLE / PLAY
                  </Link>
                  <Link
                    href="/challenge?mode=rank"
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-base font-black tracking-wide text-white transition shadow-lg border border-red-500/30"
                  >
                    RANK MODE
                  </Link>
                  <button
                    type="button"
                    disabled
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-blue-900/40 border border-blue-500/20 text-base font-black tracking-wide text-blue-300 opacity-60 cursor-not-allowed"
                  >
                    JUTSU LIBRARY (LOCKED)
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-base font-black tracking-wide text-zinc-500 cursor-not-allowed"
                  >
                    MULTIPLAYER (LOCKED)
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-emerald-900/40 border border-emerald-500/20 text-base font-black tracking-wide text-emerald-300 opacity-60 cursor-not-allowed"
                  >
                    QUEST BOARD (LOCKED)
                  </button>
                  <Link
                    href="/leaderboard"
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-base font-black tracking-wide text-white transition shadow-lg border border-yellow-500/30"
                  >
                    LEADERBOARD
                  </Link>
                  <button
                    type="button"
                    onClick={() => setView("menu")}
                    className="mt-6 flex h-14 w-full items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    BACK
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {showQuitConfirm && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close quit dialog"
            onClick={() => setShowQuitConfirm(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-md rounded-2xl border border-ninja-border bg-ninja-panel p-6">
            <h3 className="text-2xl font-black tracking-tight text-white">Leaving so soon?</h3>
            <p className="mt-2 text-sm text-ninja-dim">
              QUIT in web signs out your Discord session and returns you to login.
            </p>
            {authError && (
              <p className="mt-3 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {authError}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleQuit()}
                disabled={authBusy}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-black text-white hover:bg-red-500 disabled:opacity-60"
              >
                {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                YES, QUIT
              </button>
              <button
                type="button"
                onClick={() => setShowQuitConfirm(false)}
                className="h-11 flex-1 rounded-xl border border-ninja-border bg-ninja-card text-sm font-black text-zinc-100 hover:border-ninja-accent/40"
              >
                STAY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
