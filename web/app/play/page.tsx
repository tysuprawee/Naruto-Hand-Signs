"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Play,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

import { KNNClassifier, normalizeHand } from "@/utils/knn";
import { JUTSU_NAMES, OFFICIAL_JUTSUS, type JutsuEffect } from "@/utils/jutsu-registry";
import {
  addXp,
  createInitialProgression,
  getXpForLevel,
  type ProgressionState,
} from "@/utils/progression";
import {
  DEFAULT_FILTERS,
  applyTemporalVote,
  evaluateLighting,
  type VoteEntry,
} from "@/utils/detection-filters";
import { supabase } from "@/utils/supabase";

type GameMode = "freeplay" | "challenge";
type PlayScreen = "menu" | "mode_select" | "library" | "playing";
type ChallengeState = "waiting" | "countdown" | "active" | "results";

type HandPoint = { x: number; y: number };
type TrackedHand = {
  pos: HandPoint | null;
  label: "Left" | "Right" | null;
  scale: number;
  smoothScale: number | null;
};

type PendingSound = { name: string; due: number };
type PendingEffect = { effect: JutsuEffect; due: number; jutsuName: string };

type RankedResult = {
  text: string;
  pending: boolean;
};

const LIGHTING_CHECK_INTERVAL_MS = 250;
const PREDICTION_THROTTLE_MS = 100;
const COOLDOWN_MS = 500;
const VOTE_WINDOW_SIZE = 5;
const VOTE_TTL_MS = 700;
const CLONE_SPAWN_DELAY_MS = 1500;

const SOUND_MAP: Record<string, string> = {
  each: "/sounds/each.mp3",
  complete: "/sounds/complete.mp3",
  fireball: "/sounds/fireball.mp3",
  clone: "/sounds/clone.mp3",
  rasengan: "/sounds/rasengan.mp3",
  chidori: "/sounds/chidori.mp3",
};

const SIGN_ICON: Record<string, string> = {
  snake: "/pics/snake.jpeg",
  ram: "/pics/ram.jpeg",
  monkey: "/pics/monkey.jpeg",
  boar: "/pics/boar.jpeg",
  horse: "/pics/horse.jpeg",
  tiger: "/pics/tiger.jpeg",
  dragon: "/pics/dragon.jpeg",
  bird: "/pics/bird.jpeg",
  dog: "/pics/dog.jpeg",
  ox: "/pics/ox.jpeg",
  hare: "/pics/hare.jpeg",
  rat: "/pics/rat.jpeg",
};

const UI_ASSETS = {
  logo: "/pics/logo2.png",
  panel: "/pics/tutorial/panel_bg.png",
  shadow: "/pics/shadow.jpg",
  fire: "/pics/fire.png",
  lock: "/pics/ui/lock.png",
  quest: "/pics/quests/daily_icon.png",
  cameraStep: "/pics/tutorial/step_camera.png",
  signsStep: "/pics/tutorial/step_signs.png",
  executeStep: "/pics/tutorial/step_execute.png",
  challengeStep: "/pics/tutorial/step_challenge.png",
  rankBadge: "/pics/mastery/star_small.png",
};

const LIBRARY_TIERS = [
  { name: "Academy Tier", min: 0, max: 2 },
  { name: "Genin Tier", min: 3, max: 5 },
  { name: "Chunin Tier", min: 6, max: 10 },
  { name: "Jonin+ Tier", min: 11, max: Number.POSITIVE_INFINITY },
] as const;

const DEV_DISCORD_ID = "[REDACTED_DISCORD_ID]";
const PROGRESSION_KEY = "shinobi_progression_v1";
const PLAY_PREFS_KEY = "shinobi_play_preferences_v1";

function titleCase(raw: string): string {
  return raw
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0.00s";
  return `${seconds.toFixed(2)}s`;
}

function statusColor(status: string): string {
  if (status === "good") return "text-green-400";
  if (status === "low_light" || status === "low_contrast") return "text-amber-400";
  if (status === "overexposed") return "text-red-400";
  return "text-zinc-400";
}

export default function PlayPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);

  const chidoriVideoRef = useRef<HTMLVideoElement | null>(null);
  const rasenganVideoRef = useRef<HTMLVideoElement | null>(null);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const classifierRef = useRef<KNNClassifier | null>(null);

  const [visionReady, setVisionReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [screen, setScreen] = useState<PlayScreen>("menu");
  const screenRef = useRef<PlayScreen>("menu");

  const [fps, setFps] = useState(0);
  const frameCounterRef = useRef({ frames: 0, lastUpdate: 0 });

  const [mode, setMode] = useState<GameMode>("freeplay");
  const modeRef = useRef<GameMode>("freeplay");

  const [jutsuIndex, setJutsuIndex] = useState(0);
  const jutsuIndexRef = useRef(0);

  const [prediction, setPrediction] = useState("IDLE");
  const [rawPrediction, setRawPrediction] = useState("IDLE");

  const [currentStep, setCurrentStep] = useState(0);
  const currentStepRef = useRef(0);
  const sequenceStartRef = useRef<number | null>(null);
  const lastSignTimeRef = useRef(0);

  const [jutsuActive, setJutsuActive] = useState(false);
  const jutsuActiveRef = useRef(false);
  const jutsuStartMsRef = useRef(0);
  const jutsuDurationMsRef = useRef(5000);
  const jutsuDisplayRef = useRef<string>("");

  const [challengeState, setChallengeState] = useState<ChallengeState>("waiting");
  const challengeStateRef = useRef<ChallengeState>("waiting");
  const challengeCountdownRef = useRef(3);
  const [challengeCountdown, setChallengeCountdown] = useState(3);
  const challengeStartMsRef = useRef(0);
  const challengeFinalTimeRef = useRef(0);
  const [challengeTime, setChallengeTime] = useState(0);
  const [challengeResult, setChallengeResult] = useState<RankedResult>({ text: "", pending: false });
  const submittingScoreRef = useRef(false);
  const challengePendingResultsRef = useRef(false);

  const [lighting, setLighting] = useState({ status: "unknown", mean: 0, contrast: 0 });
  const lightingThresholdsRef = useRef({ ...DEFAULT_FILTERS });
  const lastLightingCheckRef = useRef(0);

  const [voteHits, setVoteHits] = useState(0);
  const voteWindowRef = useRef<VoteEntry[]>([]);

  const [progression, setProgression] = useState<ProgressionState>(createInitialProgression());
  const progressionRef = useRef<ProgressionState>(createInitialProgression());

  const [rankPopup, setRankPopup] = useState<string | null>(null);
  const rankPopupUntilRef = useRef(0);

  const [detectedHands, setDetectedHands] = useState(0);

  const pendingSoundsRef = useRef<PendingSound[]>([]);
  const pendingEffectsRef = useRef<PendingEffect[]>([]);
  const audioCacheRef = useRef<Record<string, HTMLAudioElement>>({});

  const trackedHandRef = useRef<TrackedHand>({ pos: null, label: null, scale: 1, smoothScale: null });

  const activeEffectRef = useRef<JutsuEffect | null>(null);
  const cloneActiveRef = useRef(false);
  const [cloneVisible, setCloneVisible] = useState(false);
  const comboChidoriTripleRef = useRef(false);
  const comboRasenganTripleRef = useRef(false);
  const comboTriggeredStepsRef = useRef<Set<number>>(new Set());

  const fireParticlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; max: number; size: number }>>([]);

  const [playerName, setPlayerName] = useState("Guest");
  const [playerDiscordId, setPlayerDiscordId] = useState<string | null>(null);
  const [playerAvatarUrl, setPlayerAvatarUrl] = useState<string | null>(null);

  const currentJutsuName = useMemo(() => JUTSU_NAMES[jutsuIndex] ?? JUTSU_NAMES[0], [jutsuIndex]);
  const currentJutsu = OFFICIAL_JUTSUS[currentJutsuName];
  const tieredJutsu = useMemo(() => {
    return LIBRARY_TIERS.map((tier) => ({
      ...tier,
      items: JUTSU_NAMES
        .map((name, idx) => ({ name, idx, config: OFFICIAL_JUTSUS[name] }))
        .filter((entry) => entry.config.minLevel >= tier.min && entry.config.minLevel <= tier.max),
    })).filter((tier) => tier.items.length > 0);
  }, []);

  const isLocked = progression.level < (currentJutsu?.minLevel ?? 0);
  const sequence = useMemo(() => currentJutsu?.sequence ?? [], [currentJutsu]);
  const lastPredictionTimeRef = useRef(0);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    jutsuIndexRef.current = jutsuIndex;
  }, [jutsuIndex]);

  useEffect(() => {
    jutsuDisplayRef.current = currentJutsu?.displayText || "";
  }, [currentJutsu]);

  const stopAllEffects = useCallback(() => {
    activeEffectRef.current = null;
    cloneActiveRef.current = false;
    setCloneVisible(false);
    comboChidoriTripleRef.current = false;
    comboRasenganTripleRef.current = false;
    pendingEffectsRef.current = [];
  }, []);

  const resetRunState = useCallback(() => {
    currentStepRef.current = 0;
    setCurrentStep(0);
    sequenceStartRef.current = null;
    lastSignTimeRef.current = 0;
    setPrediction("IDLE");
    setRawPrediction("IDLE");
    setVoteHits(0);
    voteWindowRef.current = [];

    jutsuActiveRef.current = false;
    setJutsuActive(false);
    jutsuStartMsRef.current = 0;
    jutsuDurationMsRef.current = 5000;
    challengePendingResultsRef.current = false;
    setChallengeTime(0);

    stopAllEffects();
  }, [stopAllEffects]);

  const loadPreferences = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(PLAY_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { mode?: GameMode; jutsuIndex?: number };
      if (parsed.mode === "freeplay" || parsed.mode === "challenge") {
        setMode(parsed.mode);
      }
      if (Number.isInteger(parsed.jutsuIndex)) {
        const nextIndex = Math.max(0, Math.min(Number(parsed.jutsuIndex), JUTSU_NAMES.length - 1));
        setJutsuIndex(nextIndex);
      }
    } catch {
      // ignore malformed local storage
    }
  }, []);

  const persistPreferences = useCallback((nextMode: GameMode, nextJutsuIndex: number) => {
    window.localStorage.setItem(
      PLAY_PREFS_KEY,
      JSON.stringify({ mode: nextMode, jutsuIndex: nextJutsuIndex })
    );
  }, []);

  const loadProgression = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(PROGRESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProgressionState;
      if (!parsed || typeof parsed !== "object") return;
      const hydrated: ProgressionState = {
        ...createInitialProgression(),
        ...parsed,
      };
      progressionRef.current = hydrated;
      setProgression(hydrated);
    } catch {
      // ignore malformed local storage
    }
  }, []);

  const persistProgression = useCallback((next: ProgressionState) => {
    progressionRef.current = next;
    setProgression(next);
    window.localStorage.setItem(PROGRESSION_KEY, JSON.stringify(next));
  }, []);

  const ensureAudio = useCallback((name: string): HTMLAudioElement | null => {
    const src = SOUND_MAP[name];
    if (!src) return null;
    if (!audioCacheRef.current[name]) {
      const audio = new Audio(src);
      audio.preload = "auto";
      audioCacheRef.current[name] = audio;
    }
    return audioCacheRef.current[name];
  }, []);

  const scheduleSound = useCallback((name: string, delayMs = 0) => {
    if (!SOUND_MAP[name]) return;
    pendingSoundsRef.current.push({
      name,
      due: performance.now() + Math.max(0, delayMs),
    });
  }, []);

  const triggerPayload = useCallback((jutsuName: string, effect: JutsuEffect | undefined) => {
    if (!effect) return;

    const lowered = jutsuName.toLowerCase();
    if (lowered.includes("chidori")) {
      scheduleSound("chidori");
    } else if (lowered.includes("rasengan")) {
      scheduleSound("rasengan");
    } else if (lowered.includes("fire")) {
      scheduleSound("fireball");
    } else if (effect === "clone") {
      scheduleSound("clone");
    }

    if (effect === "clone") {
      pendingEffectsRef.current.push({
        effect,
        jutsuName,
        due: performance.now() + CLONE_SPAWN_DELAY_MS,
      });
      return;
    }

    activeEffectRef.current = effect;

    if (effect === "fire") {
      scheduleSound("fireball");
    }
  }, [scheduleSound]);

  const submitChallengeScore = useCallback(async (timeSeconds: number, jutsuName: string) => {
    if (submittingScoreRef.current) return;
    submittingScoreRef.current = true;
    setChallengeResult({ text: "Submitting score...", pending: true });

    try {
      if (!supabase) {
        setChallengeResult({ text: "Supabase unavailable in this environment.", pending: false });
        return;
      }

      const payload = {
        username: playerName || "Guest",
        score_time: Number(timeSeconds.toFixed(4)),
        mode: jutsuName.toUpperCase(),
        discord_id: playerDiscordId,
        avatar_url: playerAvatarUrl,
      };

      const { error: submitError } = await supabase.from("leaderboard").insert(payload);
      if (submitError) throw submitError;

      const { data, error: fetchError } = await supabase
        .from("leaderboard")
        .select("id, score_time")
        .eq("mode", jutsuName.toUpperCase())
        .order("score_time", { ascending: true })
        .limit(100);

      if (fetchError) throw fetchError;

      let rank = -1;
      const records = data || [];
      for (let i = 0; i < records.length; i += 1) {
        const row = records[i] as { score_time?: number };
        if (Math.abs((row.score_time || 0) - timeSeconds) < 0.001) {
          rank = i + 1;
          break;
        }
      }

      if (rank > 0) {
        const percentile = ((records.length - rank + 1) / Math.max(1, records.length)) * 100;
        setChallengeResult({ text: `Rank #${rank} (Top ${Math.round(percentile)}%)`, pending: false });
      } else if (records.length === 0) {
        setChallengeResult({ text: "Rank #1 (First Record!)", pending: false });
      } else {
        setChallengeResult({ text: "Rank: Top 100+", pending: false });
      }
    } catch (err) {
      console.error("Score submit failed:", err);
      setChallengeResult({ text: "Error submitting score.", pending: false });
    } finally {
      submittingScoreRef.current = false;
    }
  }, [playerAvatarUrl, playerDiscordId, playerName]);

  const upsertProfile = useCallback(async (next: ProgressionState) => {
    if (!supabase) return;
    try {
      const payload = {
        username: playerName || "Guest",
        xp: next.xp,
        level: next.level,
        rank: next.rank,
        discord_id: playerDiscordId,
        avatar_url: playerAvatarUrl,
      };
      await supabase.from("profiles").upsert(payload, { onConflict: "username" });
    } catch (err) {
      console.warn("Profile sync failed:", err);
    }
  }, [playerAvatarUrl, playerDiscordId, playerName]);

  const switchJutsu = useCallback((direction: number) => {
    const next = (jutsuIndexRef.current + direction + JUTSU_NAMES.length) % JUTSU_NAMES.length;
    setJutsuIndex(next);
    jutsuIndexRef.current = next;
    persistPreferences(modeRef.current, next);
    resetRunState();
  }, [persistPreferences, resetRunState]);

  const updateTrackedHand = useCallback((results: {
    landmarks?: Array<Array<{ x: number; y: number; z: number }>>;
    handedness?: Array<Array<{ categoryName?: string }>>;
  }, width: number, height: number) => {
    const tracked = trackedHandRef.current;
    const landmarks = results.landmarks || [];
    const handedness = results.handedness || [];

    const candidates: Array<{ x: number; y: number; scale: number; label: "Left" | "Right" | null }> = [];
    for (let handIdx = 0; handIdx < landmarks.length; handIdx += 1) {
      const hand = landmarks[handIdx];
      if (!hand || hand.length < 21) continue;

      const idx = [0, 5, 9, 13, 17];
      const baseX = idx.reduce((sum, i) => sum + hand[i].x, 0) / idx.length;
      const baseY = idx.reduce((sum, i) => sum + hand[i].y, 0) / idx.length;

      const v1 = [hand[5].x - hand[0].x, hand[5].y - hand[0].y, hand[5].z - hand[0].z];
      const v2 = [hand[17].x - hand[0].x, hand[17].y - hand[0].y, hand[17].z - hand[0].z];
      const normal = [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0],
      ];
      const normalMag = Math.hypot(normal[0], normal[1], normal[2]) || 1;
      const nx = normal[0] / normalMag;
      const ny = normal[1] / normalMag;

      const labelRaw = handedness[handIdx]?.[0]?.categoryName || "";
      const label = labelRaw === "Left" || labelRaw === "Right" ? labelRaw : null;
      const offsetStrength = label === "Left" ? -0.25 : 0.25;

      const targetX = (baseX + nx * offsetStrength) * width;
      const targetY = (baseY + ny * offsetStrength) * height;

      const palmSpan = Math.hypot(hand[5].x - hand[17].x, hand[5].y - hand[17].y);
      const targetScale = Math.max(0.65, Math.min(1.9, palmSpan / 0.18));

      candidates.push({
        x: targetX,
        y: targetY,
        scale: targetScale,
        label,
      });
    }

    if (!candidates.length) {
      tracked.pos = null;
      tracked.smoothScale = null;
      tracked.scale = 1;
      return;
    }

    let chosen = candidates[0];
    if (tracked.label) {
      const same = candidates.filter((c) => c.label === tracked.label);
      if (same.length && tracked.pos) {
        chosen = same.reduce((best, item) => {
          const bd = (best.x - tracked.pos!.x) ** 2 + (best.y - tracked.pos!.y) ** 2;
          const id = (item.x - tracked.pos!.x) ** 2 + (item.y - tracked.pos!.y) ** 2;
          return id < bd ? item : best;
        }, same[0]);
      } else if (same.length) {
        chosen = same[0];
      }
    } else if (!tracked.pos) {
      chosen = candidates.find((c) => c.label === "Right") || candidates.find((c) => c.label === "Left") || candidates[0];
    } else if (tracked.pos) {
      chosen = candidates.reduce((best, item) => {
        const bd = (best.x - tracked.pos!.x) ** 2 + (best.y - tracked.pos!.y) ** 2;
        const id = (item.x - tracked.pos!.x) ** 2 + (item.y - tracked.pos!.y) ** 2;
        return id < bd ? item : best;
      }, candidates[0]);
    }

    const jitterPx = 9;
    let x = chosen.x;
    let y = chosen.y;
    if (tracked.pos) {
      const d2 = (x - tracked.pos.x) ** 2 + (y - tracked.pos.y) ** 2;
      if (d2 < jitterPx ** 2) {
        x = tracked.pos.x;
        y = tracked.pos.y;
      }
    }

    tracked.pos = { x, y };
    tracked.label = chosen.label || tracked.label;

    if (tracked.smoothScale == null) {
      tracked.smoothScale = chosen.scale;
    } else {
      tracked.smoothScale = tracked.smoothScale + (chosen.scale - tracked.smoothScale) * 0.1;
    }
    tracked.scale = tracked.smoothScale;
  }, []);

  const drawSkeleton = useCallback((ctx: CanvasRenderingContext2D, handLandmarks: Array<Array<{ x: number; y: number; z: number }>>) => {
    const CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
    ];

    ctx.save();
    for (const landmarks of handLandmarks || []) {
      for (const [a, b] of CONNECTIONS) {
        const p1 = landmarks[a];
        const p2 = landmarks[b];
        if (!p1 || !p2) continue;
        ctx.strokeStyle = "rgba(50,200,120,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
        ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
        ctx.stroke();
      }
      for (const lm of landmarks) {
        ctx.fillStyle = "rgba(255,120,50,0.95)";
        ctx.beginPath();
        ctx.arc(lm.x * ctx.canvas.width, lm.y * ctx.canvas.height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }, []);

  const drawFireParticles = useCallback((ctx: CanvasRenderingContext2D, dtMs: number, width: number, height: number) => {
    if (activeEffectRef.current !== "fire") return;

    const tracked = trackedHandRef.current.pos;
    const emitX = tracked?.x ?? width * 0.5;
    const emitY = tracked?.y ?? height * 0.65;

    const particles = fireParticlesRef.current;
    for (let i = 0; i < 8; i += 1) {
      particles.push({
        x: emitX + (Math.random() - 0.5) * 30,
        y: emitY + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 70,
        vy: -120 - Math.random() * 120,
        life: 0.5 + Math.random() * 0.7,
        max: 0.5 + Math.random() * 0.7,
        size: 8 + Math.random() * 18,
      });
    }

    const dt = Math.max(0.001, dtMs / 1000);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    fireParticlesRef.current = particles.filter((p) => p.life > 0).slice(-220);

    for (const p of fireParticlesRef.current) {
      const ratio = p.life / p.max;
      const size = Math.max(2, p.size * ratio);
      const alpha = Math.max(0, Math.min(1, ratio));

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 1.5);
      grad.addColorStop(0, `rgba(255,255,210,${0.8 * alpha})`);
      grad.addColorStop(0.4, `rgba(255,180,50,${0.7 * alpha})`);
      grad.addColorStop(1, `rgba(255,80,20,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  const drawVideoEffect = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const tracked = trackedHandRef.current.pos;
    if (!tracked) return;

    let video: HTMLVideoElement | null = null;
    let base = 560;

    if (activeEffectRef.current === "lightning") {
      video = chidoriVideoRef.current;
      base = 620;
    } else if (activeEffectRef.current === "rasengan") {
      video = rasenganVideoRef.current;
      base = 520;
    } else {
      return;
    }

    if (!video || video.readyState < 2) return;

    const size = Math.max(320, Math.min(920, base * trackedHandRef.current.scale));
    const aspect = video.videoWidth > 0 ? video.videoWidth / video.videoHeight : 1;
    const drawW = aspect >= 1 ? size : size * aspect;
    const drawH = aspect >= 1 ? size / aspect : size;

    const offsets: Array<[number, number]> =
      (comboChidoriTripleRef.current && activeEffectRef.current === "lightning") ||
      (comboRasenganTripleRef.current && activeEffectRef.current === "rasengan")
        ? [
            [-drawW * 0.35, -drawH * 0.08],
            [0, 0],
            [drawW * 0.35, -drawH * 0.08],
          ]
        : [[0, 0]];

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [ox, oy] of offsets) {
      const x = tracked.x - drawW / 2 + ox;
      const y = tracked.y - drawH / 2 + oy;
      ctx.drawImage(video, x, y, drawW, drawH);
    }
    ctx.restore();

    if (activeEffectRef.current === "lightning") {
      ctx.fillStyle = "rgba(40,90,180,0.18)";
      ctx.fillRect(0, 0, width, height);
    }
  }, []);

  const drawColorTint = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!activeEffectRef.current) return;
    const effect = activeEffectRef.current;

    if (effect === "water") {
      ctx.fillStyle = "rgba(50,120,220,0.14)";
      ctx.fillRect(0, 0, width, height);
    } else if (effect === "eye") {
      const grad = ctx.createRadialGradient(width * 0.5, height * 0.45, 10, width * 0.5, height * 0.45, width * 0.55);
      grad.addColorStop(0, "rgba(255,0,0,0.08)");
      grad.addColorStop(1, "rgba(0,0,0,0.0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  }, []);

  const drawCloneOverlay = useCallback((ctx: CanvasRenderingContext2D, source: HTMLVideoElement, width: number, height: number) => {
    if (!cloneActiveRef.current || !cloneVisible) return;

    const dx = width * 0.28;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(source, -dx, 0, width, height);
    ctx.drawImage(source, dx, 0, width, height);
    ctx.restore();
  }, [cloneVisible]);

  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    const classifier = classifierRef.current;

    if (screenRef.current !== "playing") {
      requestRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    if (!video || !canvas || !landmarker || !classifier) {
      requestRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      requestRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    if (video.readyState < 2) {
      requestRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const now = performance.now();

    if (video.currentTime === lastVideoTimeRef.current) {
      requestRef.current = requestAnimationFrame(renderFrame);
      return;
    }
    lastVideoTimeRef.current = video.currentTime;

    const width = canvas.width;
    const height = canvas.height;

    const results = landmarker.detectForVideo(video, now) as {
      landmarks?: Array<Array<{ x: number; y: number; z: number }> >;
      handedness?: Array<Array<{ categoryName?: string }> >;
    };

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0, width, height);

    updateTrackedHand(results, width, height);

    const shouldRunChallenge = modeRef.current === "challenge";

    if (shouldRunChallenge && challengeStateRef.current === "countdown") {
      const elapsed = (now - challengeStartMsRef.current) / 1000;
      const remaining = 3 - Math.floor(elapsed);
      challengeCountdownRef.current = Math.max(0, remaining);
      setChallengeCountdown(challengeCountdownRef.current);
      if (remaining <= 0) {
        challengeStateRef.current = "active";
        setChallengeState("active");
        challengeStartMsRef.current = now;
        setChallengeTime(0);
        scheduleSound("complete");
      }
    }

    if (shouldRunChallenge && challengeStateRef.current === "active") {
      setChallengeTime((now - challengeStartMsRef.current) / 1000);
    }

    const frameCounter = frameCounterRef.current;
    frameCounter.frames += 1;
    if (now - frameCounter.lastUpdate >= 1000) {
      setFps(frameCounter.frames);
      frameCounter.frames = 0;
      frameCounter.lastUpdate = now;
    }

    let lightingOk = true;
    if (now - lastLightingCheckRef.current >= LIGHTING_CHECK_INTERVAL_MS) {
      lastLightingCheckRef.current = now;
      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement("canvas");
        offscreenRef.current.width = 160;
        offscreenRef.current.height = 120;
      }
      const off = offscreenRef.current;
      const offCtx = off.getContext("2d", { willReadFrequently: true });
      if (offCtx) {
        offCtx.drawImage(video, 0, 0, off.width, off.height);
        const img = offCtx.getImageData(0, 0, off.width, off.height);
        const stats = evaluateLighting(
          img.data,
          off.width,
          off.height,
          lightingThresholdsRef.current
        );
        lightingOk = stats.status === "good";
        setLighting({ status: stats.status, mean: stats.mean, contrast: stats.contrast });
      }
    } else {
      lightingOk = lighting.status === "good";
    }

    let detectedRaw = "idle";
    let rawConfidence = 0;

    const handCount = results.landmarks?.length || 0;
    setDetectedHands(handCount);

    const canDetectInChallenge =
      modeRef.current === "freeplay" ||
      (modeRef.current === "challenge" && challengeStateRef.current === "active");

    const runDetection = !isLocked && canDetectInChallenge;

    if (runDetection && now - lastPredictionTimeRef.current >= PREDICTION_THROTTLE_MS) {
      lastPredictionTimeRef.current = now;

      const features = new Array<number>(126).fill(0);

      if (results.landmarks && results.handedness) {
        for (let i = 0; i < results.landmarks.length; i += 1) {
          const hand = results.landmarks[i];
          const handInfo = results.handedness[i]?.[0]?.categoryName || "";
          const label = handInfo === "Left" ? "Left" : "Right";

          const flipped = hand.map((lm) => ({ x: 1 - lm.x, y: lm.y, z: lm.z }));
          const normalized = normalizeHand(flipped);
          const offset = label === "Left" ? 0 : 63;
          for (let j = 0; j < normalized.length; j += 1) {
            features[offset + j] = normalized[j];
          }
        }
      }

      const predictionResult = classifier.predictWithConfidence(features);
      detectedRaw = String(predictionResult.label || "idle").toLowerCase();
      rawConfidence = predictionResult.confidence;

      if (handCount < 2) {
        detectedRaw = "idle";
        rawConfidence = 0;
      }

      setRawPrediction(detectedRaw.toUpperCase());

      const vote = applyTemporalVote(
        voteWindowRef.current,
        detectedRaw,
        rawConfidence,
        now,
        lightingOk && handCount > 0 && !isLocked,
        VOTE_WINDOW_SIZE,
        VOTE_TTL_MS,
        lightingThresholdsRef.current.voteRequiredHits,
        lightingThresholdsRef.current.voteMinConfidence
      );
      voteWindowRef.current = vote.nextWindow;
      setVoteHits(vote.hits);

      const stable = vote.label;
      setPrediction(stable.toUpperCase());

      if (!jutsuActiveRef.current && runDetection && stable !== "idle") {
        const targetSign = sequence[currentStepRef.current];
        if (targetSign && stable === targetSign) {
          if (now - lastSignTimeRef.current >= COOLDOWN_MS) {
            if (currentStepRef.current === 0) {
              sequenceStartRef.current = now;
            }

            currentStepRef.current += 1;
            setCurrentStep(currentStepRef.current);
            lastSignTimeRef.current = now;
            scheduleSound("each");

            const jutsuName = JUTSU_NAMES[jutsuIndexRef.current];
            const jutsuData = OFFICIAL_JUTSUS[jutsuName];
            const comboParts = jutsuData.comboParts || [];

            for (const part of comboParts) {
              if (part.atStep === currentStepRef.current && !comboTriggeredStepsRef.current.has(part.atStep)) {
                comboTriggeredStepsRef.current.add(part.atStep);
                if (part.effect === "clone") cloneActiveRef.current = true;
                if (part.effect === "lightning" && part.name.toLowerCase() === "chidori") {
                  comboChidoriTripleRef.current = true;
                }
                if (part.effect === "rasengan" && part.name.toLowerCase() === "rasengan") {
                  comboRasenganTripleRef.current = true;
                }
                scheduleSound("complete");
                triggerPayload(part.name, part.effect);
              }
            }

            if (currentStepRef.current >= sequence.length) {
              jutsuActiveRef.current = true;
              setJutsuActive(true);
              jutsuStartMsRef.current = now;
              jutsuDurationMsRef.current = Math.max(1000, Number(jutsuData.duration || 5) * 1000);
              currentStepRef.current = 0;
              setCurrentStep(0);

              let clearTime: number | null = null;
              if (modeRef.current === "challenge" && challengeStateRef.current === "active") {
                clearTime = (now - challengeStartMsRef.current) / 1000;
                challengeFinalTimeRef.current = clearTime;
              } else if (sequenceStartRef.current) {
                clearTime = (now - sequenceStartRef.current) / 1000;
              }
              sequenceStartRef.current = null;

              const xpGain = 50 + sequence.length * 10;
              const before = progressionRef.current;
              const xpResult = addXp(before, xpGain);
              const nextProgress = {
                ...xpResult.next,
                totalSigns: before.totalSigns + sequence.length,
                fastestCombo:
                  clearTime && clearTime > 0
                    ? Math.min(before.fastestCombo || 99, clearTime)
                    : before.fastestCombo,
              };
              persistProgression(nextProgress);
              void upsertProfile(nextProgress);

              if (xpResult.leveledUp) {
                setRankPopup(`RANK UP: ${nextProgress.rank}`);
                rankPopupUntilRef.current = now + 3000;
              }

              if (modeRef.current === "challenge" && challengeStateRef.current === "active") {
                challengePendingResultsRef.current = true;
              }

              if (!comboParts.length) {
                scheduleSound("complete");
                triggerPayload(jutsuName, jutsuData.effect);
              } else {
                comboTriggeredStepsRef.current = new Set();
              }
            }
          }
        }
      }
    }

    const dueSounds = pendingSoundsRef.current.filter((s) => now >= s.due);
    pendingSoundsRef.current = pendingSoundsRef.current.filter((s) => now < s.due);
    for (const s of dueSounds) {
      const audio = ensureAudio(s.name);
      if (!audio) continue;
      try {
        audio.currentTime = 0;
        void audio.play();
      } catch {
        // Autoplay restrictions are expected before first user interaction.
      }
    }

    const dueEffects = pendingEffectsRef.current.filter((e) => now >= e.due);
    pendingEffectsRef.current = pendingEffectsRef.current.filter((e) => now < e.due);
    for (const effect of dueEffects) {
      if (effect.effect === "clone") {
        cloneActiveRef.current = true;
        setCloneVisible(true);
      } else {
        activeEffectRef.current = effect.effect;
      }
    }

    if (jutsuActiveRef.current && now - jutsuStartMsRef.current > jutsuDurationMsRef.current) {
      jutsuActiveRef.current = false;
      setJutsuActive(false);
      stopAllEffects();

      if (modeRef.current === "challenge" && challengePendingResultsRef.current) {
        challengePendingResultsRef.current = false;
        challengeStateRef.current = "results";
        setChallengeState("results");
        void submitChallengeScore(challengeFinalTimeRef.current, currentJutsuName);
      }
    }

    if (rankPopup && now > rankPopupUntilRef.current) {
      setRankPopup(null);
    }

    drawCloneOverlay(ctx, video, width, height);

    const dtMs = Math.max(16, 1000 / 60);
    drawFireParticles(ctx, dtMs, width, height);
    drawColorTint(ctx, width, height);
    drawVideoEffect(ctx, width, height);
    drawSkeleton(ctx, results.landmarks || []);

    requestRef.current = requestAnimationFrame(renderFrame);
  }, [
    currentJutsuName,
    drawCloneOverlay,
    drawColorTint,
    drawFireParticles,
    drawSkeleton,
    drawVideoEffect,
    ensureAudio,
    isLocked,
    lighting.status,
    persistProgression,
    rankPopup,
    scheduleSound,
    sequence,
    stopAllEffects,
    submitChallengeScore,
    triggerPayload,
    updateTrackedHand,
    upsertProfile,
  ]);

  const stopVisionRuntime = useCallback(() => {
    cancelAnimationFrame(requestRef.current);
    requestRef.current = 0;
    lastVideoTimeRef.current = -1;

    const videoNode = videoRef.current;
    if (videoNode?.srcObject) {
      const tracks = (videoNode.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoNode.srcObject = null;
    }
  }, []);

  const startVisionRuntime = useCallback(async () => {
    if (!visionReady) return;
    const videoNode = videoRef.current;
    if (!videoNode) return;

    try {
      setLoading(true);
      if (!videoNode.srcObject) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });
        videoNode.srcObject = stream;
      }

      await videoNode.play();

      if (chidoriVideoRef.current) {
        chidoriVideoRef.current.currentTime = 0;
        try {
          await chidoriVideoRef.current.play();
        } catch {
          // ignore autoplay restriction
        }
      }

      if (rasenganVideoRef.current) {
        rasenganVideoRef.current.currentTime = 0;
        try {
          await rasenganVideoRef.current.play();
        } catch {
          // ignore autoplay restriction
        }
      }

      cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(renderFrame);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to start camera.");
      setLoading(false);
    }
  }, [renderFrame, visionReady]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setLoading(true);

        const rawSession = window.localStorage.getItem("user_session");
        if (rawSession) {
          const session = JSON.parse(rawSession) as {
            username?: string;
            discord_user?: { id?: string; avatar?: string; avatar_url?: string; username?: string };
          };

          const username = session.username || session.discord_user?.username || "Guest";
          const discordId = session.discord_user?.id || null;
          const avatarHash = session.discord_user?.avatar;
          const avatarUrl = session.discord_user?.avatar_url ||
            (discordId && avatarHash
              ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=64`
              : null);

          if (mounted) {
            setPlayerName(username);
            setPlayerDiscordId(discordId);
            setPlayerAvatarUrl(avatarUrl || null);
          }
        }

        loadPreferences();
        loadProgression();

        const response = await fetch("/model/hand_signs_db.json");
        const dataset = await response.json();
        if (!mounted) return;
        classifierRef.current = new KNNClassifier(dataset, 3, 1.8);

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
        );

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/model/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });

        if (!mounted) return;
        landmarkerRef.current = handLandmarker;
        setVisionReady(true);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error(err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to initialize play mode");
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
      stopVisionRuntime();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [loadPreferences, loadProgression, stopVisionRuntime]);

  useEffect(() => {
    if (screen === "playing") {
      void startVisionRuntime();
    } else {
      stopVisionRuntime();
    }
  }, [screen, startVisionRuntime, stopVisionRuntime]);

  useEffect(() => {
    persistPreferences(mode, jutsuIndex);
  }, [mode, jutsuIndex, persistPreferences]);

  useEffect(() => {
    resetRunState();
  }, [currentJutsuName, resetRunState]);

  const leavePlaying = useCallback(() => {
    challengeStateRef.current = "waiting";
    setChallengeState("waiting");
    setChallengeResult({ text: "", pending: false });
    resetRunState();
    setScreen("library");
  }, [resetRunState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screenRef.current !== "playing") return;

      if (event.key === "Escape") {
        event.preventDefault();
        leavePlaying();
        return;
      }

      if (event.key === "ArrowLeft" && !jutsuActiveRef.current) {
        switchJutsu(-1);
      } else if (event.key === "ArrowRight" && !jutsuActiveRef.current) {
        switchJutsu(1);
      } else if (event.key.toLowerCase() === "r") {
        resetRunState();
      } else if (event.key === " " && modeRef.current === "challenge") {
        event.preventDefault();
        if (challengeStateRef.current === "waiting") {
          challengeStateRef.current = "countdown";
          setChallengeState("countdown");
          challengeStartMsRef.current = performance.now();
          challengeCountdownRef.current = 3;
          setChallengeCountdown(3);
          setChallengeResult({ text: "", pending: false });
        } else if (challengeStateRef.current === "results") {
          challengeStateRef.current = "waiting";
          setChallengeState("waiting");
          setChallengeResult({ text: "", pending: false });
          setChallengeTime(0);
          resetRunState();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leavePlaying, resetRunState, switchJutsu]);

  const startChallenge = useCallback(() => {
    challengeStateRef.current = "countdown";
    setChallengeState("countdown");
    challengeStartMsRef.current = performance.now();
    challengeCountdownRef.current = 3;
    setChallengeCountdown(3);
    setChallengeResult({ text: "", pending: false });
  }, []);

  const tryAgainChallenge = useCallback(() => {
    challengeStateRef.current = "waiting";
    setChallengeState("waiting");
    setChallengeResult({ text: "", pending: false });
    setChallengeTime(0);
    resetRunState();
  }, [resetRunState]);

  const startFromLibrary = useCallback((idx: number) => {
    setJutsuIndex(idx);
    jutsuIndexRef.current = idx;
    challengeStateRef.current = "waiting";
    setChallengeState("waiting");
    setChallengeResult({ text: "", pending: false });
    resetRunState();
    setScreen("playing");
  }, [resetRunState]);

  const chooseMode = useCallback((next: GameMode) => {
    setMode(next);
    modeRef.current = next;
    challengeStateRef.current = "waiting";
    setChallengeState("waiting");
    setChallengeResult({ text: "", pending: false });
    setScreen("library");
  }, []);

  const xpNext = getXpForLevel(progression.level + 1);
  const xpCurrentFloor = getXpForLevel(progression.level);
  const xpPct = Math.max(0, Math.min(1, (progression.xp - xpCurrentFloor) / Math.max(1, xpNext - xpCurrentFloor)));

  const modeCanSwitch = !jutsuActive && (mode !== "challenge" || challengeState === "waiting");

  return (
    <div className="min-h-screen bg-ninja-bg text-ninja-text font-sans selection:bg-ninja-accent selection:text-white pb-20">
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: "url('/village.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "grayscale(100%) contrast(120%)",
        }}
      />
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 72% 30%, rgba(255,120,50,0.22), transparent 48%), linear-gradient(to bottom, rgba(0,0,0,0.12), rgba(0,0,0,0.65)), url('${UI_ASSETS.shadow}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          mixBlendMode: "screen",
        }}
      />

      <header className="fixed top-0 w-full z-40 bg-ninja-bg/80 backdrop-blur-md border-b border-ninja-border">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={UI_ASSETS.logo} alt="Shinobi Academy" className="w-10 h-10 object-contain" />
            <span className="font-bold tracking-tight text-lg text-white">SHINOBI ACADEMY</span>
          </Link>

          <div className="flex items-center gap-3">
            {screen === "playing" && (
              <div className="hidden md:flex items-center gap-2 bg-ninja-card border border-ninja-border rounded-full px-3 py-1">
                <Camera className="w-3 h-3 text-ninja-dim" />
                <span className="text-xs font-mono text-ninja-dim">{fps} FPS</span>
              </div>
            )}
            <Link
              href="/leaderboard"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-ninja-border bg-ninja-card hover:bg-ninja-hover"
            >
              <Trophy className="w-4 h-4 text-ninja-accent" /> Leaderboard
            </Link>
            {screen === "playing" ? (
              <button
                onClick={leavePlaying}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-ninja-border bg-ninja-card hover:bg-ninja-hover"
              >
                <ArrowLeft className="w-4 h-4" /> Library
              </button>
            ) : (
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-ninja-border bg-ninja-card hover:bg-ninja-hover"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-24 px-4 sm:px-6 container mx-auto max-w-6xl">
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-950/40 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-white">System Error</p>
              <p className="text-sm text-red-200">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-xs font-bold uppercase"
            >
              Reload
            </button>
          </div>
        )}

        {screen === "menu" && (
          <section className="relative max-w-3xl mx-auto rounded-3xl border border-ninja-border/80 overflow-hidden p-8 sm:p-10 text-center shadow-[0_28px_84px_rgba(0,0,0,0.62)]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(145deg, rgba(22,22,30,0.93), rgba(10,10,14,0.95)), url('${UI_ASSETS.panel}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-ninja-accent/20 blur-3xl" />
            <div className="absolute -bottom-28 -left-20 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl" />

            <div className="relative">
              <div className="perspective-container">
                <img
                  src={UI_ASSETS.logo}
                  alt="Shinobi Academy"
                  className="w-52 sm:w-64 mx-auto mb-6 drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-float-3d"
                />
              </div>

              <p className="text-xs uppercase tracking-[0.28em] text-ninja-accent font-bold">Main Menu</p>
              <h1 className="text-3xl sm:text-4xl font-black text-white mt-2">Jutsu Academy Console</h1>
              <p className="text-sm text-zinc-300 mt-3 max-w-xl mx-auto">
                Mode select first, then library, then live hand-sign execution. Same gameplay flow as main pygame.
              </p>

              <div className="mt-7 mx-auto w-full max-w-md rounded-xl border border-ninja-border bg-black/35 backdrop-blur-md p-3 flex items-center gap-3">
                <img
                  src={playerAvatarUrl || UI_ASSETS.shadow}
                  alt={playerName}
                  className="w-12 h-12 rounded-lg object-cover border border-ninja-border"
                />
                <div className="flex-1 text-left">
                  <p className="text-sm font-black text-white leading-none">{playerName || "Guest"}</p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {progression.rank} • LV.{progression.level} • {progression.xp.toLocaleString()} XP
                  </p>
                </div>
                {playerDiscordId === DEV_DISCORD_ID && (
                  <span className="text-[10px] font-black tracking-wider text-red-300 border border-red-400/40 bg-red-700/20 px-2 py-1 rounded-md">
                    DEV
                  </span>
                )}
              </div>

              <div className="mt-8 grid gap-3">
                <button
                  onClick={() => setScreen("mode_select")}
                  className="h-12 rounded-xl bg-ninja-accent hover:bg-ninja-accent-glow text-white font-bold uppercase tracking-wider"
                >
                  Enter Academy
                </button>
                <Link
                  href="/leaderboard"
                  className="h-12 rounded-xl border border-ninja-border bg-ninja-card/85 hover:bg-ninja-hover text-white font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <img src={UI_ASSETS.rankBadge} alt="" className="w-4 h-4 object-contain" />
                  Leaderboard
                </Link>
                <Link
                  href="/"
                  className="h-12 rounded-xl border border-ninja-border bg-black/35 hover:bg-black/55 text-zinc-200 font-bold uppercase tracking-wider flex items-center justify-center"
                >
                  Back To Base
                </Link>
              </div>
            </div>
          </section>
        )}

        {screen === "mode_select" && (
          <section className="relative max-w-4xl mx-auto rounded-3xl border border-ninja-border/80 overflow-hidden p-8 sm:p-10 shadow-[0_28px_84px_rgba(0,0,0,0.62)]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(150deg, rgba(20,20,28,0.94), rgba(10,10,14,0.95)), url('${UI_ASSETS.panel}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

            <div className="relative">
              <p className="text-xs uppercase tracking-[0.25em] text-ninja-accent font-bold text-center">Practice Selection</p>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 text-center">Select Your Path</h2>
              <p className="text-sm text-zinc-300 mt-3 text-center">Mode first, then choose jutsu from the library, then launch camera gameplay.</p>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Camera", icon: UI_ASSETS.cameraStep },
                  { label: "Signs", icon: UI_ASSETS.signsStep },
                  { label: "Execute", icon: UI_ASSETS.executeStep },
                  { label: "Challenge", icon: UI_ASSETS.challengeStep },
                ].map((step) => (
                  <div key={step.label} className="rounded-lg border border-ninja-border bg-black/35 px-2 py-2 text-center">
                    <img src={step.icon} alt={step.label} className="w-10 h-10 object-contain mx-auto" />
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300 font-bold">{step.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid sm:grid-cols-2 gap-4">
                <button
                  onClick={() => chooseMode("freeplay")}
                  className="rounded-2xl border border-ninja-border bg-ninja-card/85 hover:bg-ninja-hover p-6 text-left"
                >
                  <div className="flex items-center gap-3">
                    <img src={UI_ASSETS.fire} alt="" className="w-9 h-9 object-contain" />
                    <p className="text-xs uppercase tracking-[0.2em] text-ninja-accent font-bold">Free Play</p>
                  </div>
                  <p className="text-2xl font-black text-white mt-3">Master Combos</p>
                  <p className="text-sm text-zinc-300 mt-2">Practice any unlocked jutsu, rotate signs, and push your XP route.</p>
                </button>

                <button
                  onClick={() => chooseMode("challenge")}
                  className="rounded-2xl border border-ninja-border bg-ninja-card/85 hover:bg-ninja-hover p-6 text-left"
                >
                  <div className="flex items-center gap-3">
                    <img src={UI_ASSETS.challengeStep} alt="" className="w-9 h-9 object-contain" />
                    <p className="text-xs uppercase tracking-[0.2em] text-ninja-accent font-bold">Challenge</p>
                  </div>
                  <p className="text-2xl font-black text-white mt-3">Speedrun Timer</p>
                  <p className="text-sm text-zinc-300 mt-2">Countdown start, clear full sequence fast, and submit leaderboard time.</p>
                </button>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setScreen("menu")}
                  className="h-10 px-5 rounded-lg border border-ninja-border bg-black/30 hover:bg-black/50 text-xs font-bold uppercase tracking-wider"
                >
                  Back
                </button>
              </div>
            </div>
          </section>
        )}

        {screen === "library" && (
          <section className="relative rounded-3xl border border-ninja-border/80 overflow-hidden p-6 sm:p-8 shadow-[0_28px_84px_rgba(0,0,0,0.62)]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(150deg, rgba(16,16,24,0.95), rgba(8,8,12,0.94)), url('${UI_ASSETS.panel}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-ninja-accent font-bold">Jutsu Library</p>
                  <h2 className="text-3xl font-black text-white mt-1">{mode === "challenge" ? "Challenge Loadout" : "Freeplay Loadout"}</h2>
                  <p className="text-xs text-zinc-400 mt-1">Flow: pick a jutsu card, then launch camera gameplay.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScreen("mode_select")}
                    className="h-10 px-4 rounded-lg border border-ninja-border bg-ninja-card hover:bg-ninja-hover text-xs font-bold uppercase tracking-wider"
                  >
                    Change Mode
                  </button>
                  <button
                    onClick={() => setScreen("menu")}
                    className="h-10 px-4 rounded-lg border border-ninja-border bg-black/30 hover:bg-black/50 text-xs font-bold uppercase tracking-wider"
                  >
                    Main Menu
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                {tieredJutsu.map((tier) => (
                  <div key={tier.name} className="rounded-2xl border border-ninja-border bg-black/35 p-4">
                    <div className="flex items-center gap-2">
                      <img src={UI_ASSETS.quest} alt="" className="w-5 h-5 object-contain opacity-90" />
                      <p className="text-xs uppercase tracking-[0.18em] text-orange-200 font-bold">{tier.name}</p>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {tier.items.map(({ name, idx, config }) => {
                        const locked = progression.level < config.minLevel;
                        const selected = idx === jutsuIndex;
                        return (
                          <div
                            key={name}
                            className={`rounded-xl border p-4 transition-all ${selected ? "border-ninja-accent bg-ninja-accent/10" : "border-ninja-border bg-ninja-card/60"}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-lg font-black text-white">{titleCase(name)}</p>
                                <p className="text-xs text-zinc-400">Min LV.{config.minLevel} • {config.sequence.length} signs</p>
                              </div>

                              {locked && (
                                <div className="inline-flex items-center gap-1 rounded-md border border-red-400/25 bg-red-800/20 px-2 py-1">
                                  <img src={UI_ASSETS.lock} alt="" className="w-3.5 h-3.5 object-contain" />
                                  <span className="text-[10px] text-red-300 font-bold uppercase">Locked</span>
                                </div>
                              )}

                              <button
                                disabled={locked || !visionReady}
                                onClick={() => startFromLibrary(idx)}
                                className="h-10 px-4 rounded-lg text-xs font-bold uppercase tracking-wider border disabled:opacity-40 disabled:cursor-not-allowed bg-ninja-accent border-ninja-accent text-white hover:bg-ninja-accent-glow"
                              >
                                {locked ? `Locked (LV.${config.minLevel})` : mode === "challenge" ? "Start Challenge" : "Start Freeplay"}
                              </button>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {config.sequence.map((sign, signIdx) => (
                                <div key={`${name}-${sign}-${signIdx}`} className="h-10 min-w-10 px-2 rounded-md border border-ninja-border bg-black/35 flex items-center justify-center">
                                  {SIGN_ICON[sign] ? (
                                    <img src={SIGN_ICON[sign]} alt={sign} className="w-7 h-7 object-cover rounded-sm" />
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase text-zinc-300">{sign}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {screen === "playing" && (
          <>
            <section className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
              <div className="relative rounded-2xl overflow-hidden border border-ninja-border bg-ninja-panel shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                {loading && (
                  <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                    <div className="w-14 h-14 border-4 border-ninja-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs tracking-[0.2em] uppercase text-ninja-accent font-bold">Starting Camera...</p>
                  </div>
                )}

                <video ref={videoRef} className="hidden" autoPlay muted playsInline />
                <video ref={chidoriVideoRef} className="hidden" autoPlay muted playsInline loop preload="auto" src="/effects/chidori.mp4" />
                <video ref={rasenganVideoRef} className="hidden" autoPlay muted playsInline loop preload="auto" src="/effects/rasengan.mp4" />

                <div className="relative aspect-[4/3] sm:aspect-video bg-black">
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                  />

                  <div className="absolute left-4 right-4 top-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pointer-events-none">
                    <div className="rounded-xl border border-ninja-border bg-black/60 backdrop-blur-md px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-ninja-dim font-bold">Current Seal</p>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">{prediction}</p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-ninja-dim mt-1">Raw: {rawPrediction}</p>
                    </div>

                    <div className="rounded-xl border border-ninja-border bg-black/60 backdrop-blur-md px-3 py-2">
                      <p className={`text-[10px] uppercase tracking-[0.2em] font-bold ${statusColor(lighting.status)}`}>
                        Light: {lighting.status.replace("_", " ")}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-300 mt-1">Vote {voteHits}/{VOTE_WINDOW_SIZE}</p>
                      <p className="text-[11px] font-mono text-zinc-300">Hands: {detectedHands}</p>
                    </div>
                  </div>

                  {mode === "challenge" && challengeState === "waiting" && (
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center">
                      <div className="text-center rounded-2xl border border-ninja-border bg-black/70 p-6 max-w-md mx-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-ninja-accent font-bold mb-2">Challenge Mode</p>
                        <h3 className="text-xl font-black text-white mb-2">Press Space or Start</h3>
                        <p className="text-sm text-zinc-300 mb-5">Perform all signs in order. Timer starts at GO.</p>
                        <button
                          onClick={startChallenge}
                          className="h-11 px-6 rounded-lg bg-ninja-accent hover:bg-ninja-accent-glow text-white text-sm font-bold uppercase tracking-wider"
                        >
                          Start Challenge
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === "challenge" && challengeState === "countdown" && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-300 mb-3">Get Ready</p>
                        <p className="text-7xl sm:text-8xl font-black text-ninja-accent drop-shadow-[0_0_20px_rgba(255,120,50,0.6)]">{challengeCountdown}</p>
                      </div>
                    </div>
                  )}

                  {mode === "challenge" && challengeState === "results" && (
                    <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center">
                      <div className="rounded-2xl border border-ninja-border bg-black/75 p-6 w-[min(90%,460px)] text-center">
                        <p className="text-xs uppercase tracking-[0.2em] text-ninja-accent font-bold">Challenge Results</p>
                        <p className="mt-2 text-4xl font-black text-white">{formatClock(challengeFinalTimeRef.current)}</p>
                        <p className={`mt-2 text-sm ${challengeResult.pending ? "text-zinc-400" : "text-amber-300"}`}>
                          {challengeResult.text || "Awaiting score sync..."}
                        </p>
                        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
                          <button
                            onClick={tryAgainChallenge}
                            className="h-10 px-4 rounded-lg bg-ninja-accent hover:bg-ninja-accent-glow text-white text-xs font-bold uppercase tracking-wider"
                          >
                            Try Again
                          </button>
                          <Link
                            href="/leaderboard"
                            className="h-10 px-4 rounded-lg border border-ninja-border bg-ninja-card hover:bg-ninja-hover text-xs font-bold uppercase tracking-wider flex items-center justify-center"
                          >
                            View Leaderboard
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {rankPopup && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-green-600/85 border border-green-300/40 text-white text-xs font-black tracking-wider shadow-lg">
                      {rankPopup}
                    </div>
                  )}

                  <div className="absolute left-4 right-4 bottom-4">
                    {mode === "challenge" && challengeState === "active" && (
                      <div className="inline-flex items-center gap-2 rounded-lg border border-ninja-accent/50 bg-black/70 px-3 py-1.5 mb-3">
                        <Sparkles className="w-4 h-4 text-ninja-accent" />
                        <span className="text-sm font-mono font-bold text-white">SPEED {formatClock(challengeTime)}</span>
                      </div>
                    )}

                    <div className="rounded-xl border border-ninja-border bg-black/70 backdrop-blur-md px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-ninja-dim font-bold">
                          {jutsuActive ? "Jutsu Active" : "Next Sign"}
                        </p>
                        <p className="text-xs text-zinc-400">{currentStep}/{sequence.length}</p>
                      </div>

                      <p className="text-sm sm:text-base font-bold text-ninja-accent mt-1">
                        {jutsuActive ? jutsuDisplayRef.current : (sequence[currentStep] || "Ready").toUpperCase()}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {sequence.map((sign, idx) => {
                          const done = idx < currentStep;
                          const active = idx === currentStep && !jutsuActive;
                          return (
                            <div
                              key={`${sign}-${idx}`}
                              className={`h-11 min-w-11 px-2 rounded-lg border flex items-center justify-center transition-all ${done
                                ? "border-green-500 bg-green-700/25 opacity-70"
                                : active
                                  ? "border-ninja-accent bg-ninja-accent/20 shadow-[0_0_14px_rgba(255,120,50,0.35)]"
                                  : "border-ninja-border bg-ninja-card/50"
                                }`}
                            >
                              {SIGN_ICON[sign] ? (
                                <img
                                  src={SIGN_ICON[sign]}
                                  alt={sign}
                                  className={`w-7 h-7 object-contain ${done ? "opacity-45" : ""}`}
                                />
                              ) : (
                                <span className="text-[10px] font-bold uppercase text-zinc-200">{sign}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-ninja-border bg-ninja-panel p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-ninja-dim font-bold mb-2">Jutsu</p>

                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => modeCanSwitch && switchJutsu(-1)}
                      disabled={!modeCanSwitch}
                      className="h-10 w-10 rounded-lg border border-ninja-border bg-ninja-card hover:bg-ninja-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <select
                      value={jutsuIndex}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setJutsuIndex(idx);
                        jutsuIndexRef.current = idx;
                        resetRunState();
                      }}
                      className="flex-1 h-10 rounded-lg border border-ninja-border bg-ninja-card px-3 text-sm font-bold text-white focus:outline-none focus:border-ninja-accent"
                      disabled={!modeCanSwitch}
                    >
                      {JUTSU_NAMES.map((name, idx) => {
                        const locked = progression.level < OFFICIAL_JUTSUS[name].minLevel;
                        return (
                          <option key={name} value={idx}>
                            {titleCase(name)}{locked ? ` (LV.${OFFICIAL_JUTSUS[name].minLevel})` : ""}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      onClick={() => modeCanSwitch && switchJutsu(1)}
                      disabled={!modeCanSwitch}
                      className="h-10 w-10 rounded-lg border border-ninja-border bg-ninja-card hover:bg-ninja-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-sm font-black text-white">{titleCase(currentJutsuName)}</p>
                  <p className="text-xs text-zinc-400 mt-1">Min Level: {currentJutsu.minLevel}</p>
                  {isLocked && (
                    <p className="text-xs text-red-400 mt-2">
                      Locked until LV.{currentJutsu.minLevel}. Current LV.{progression.level}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-ninja-border bg-ninja-panel p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ninja-dim font-bold">Shinobi Path</p>
                    <span className="text-[11px] font-mono text-zinc-400">LV.{progression.level}</span>
                  </div>

                  <p className="text-sm font-bold text-white mt-1">{progression.rank}</p>
                  <div className="mt-3 h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-ninja-accent" style={{ width: `${xpPct * 100}%` }} />
                  </div>
                  <p className="text-[11px] font-mono text-zinc-400 mt-2">
                    {progression.xp.toLocaleString()} / {xpNext.toLocaleString()} XP
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-ninja-border bg-ninja-card p-2">
                      <p className="text-zinc-500 uppercase tracking-wide">Fastest</p>
                      <p className="text-zinc-200 font-mono">{formatClock(progression.fastestCombo)}</p>
                    </div>
                    <div className="rounded-lg border border-ninja-border bg-ninja-card p-2">
                      <p className="text-zinc-500 uppercase tracking-wide">Total Jutsu</p>
                      <p className="text-zinc-200 font-mono">{progression.totalJutsus}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-ninja-border bg-ninja-panel p-4 text-xs text-zinc-400 leading-relaxed">
                  <p className="font-bold uppercase tracking-[0.16em] text-zinc-300 mb-2">Controls</p>
                  <p><span className="text-zinc-200">Left/Right</span> switch jutsu</p>
                  <p><span className="text-zinc-200">R</span> reset sequence</p>
                  <p><span className="text-zinc-200">Space</span> start/try-again challenge</p>
                  <p><span className="text-zinc-200">Esc</span> back to library</p>
                </div>
              </aside>
            </section>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-2 rounded-full border border-ninja-border bg-black/30 px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Secure Client-Side AI
              </span>
              <button
                onClick={resetRunState}
                className="inline-flex items-center gap-2 rounded-full border border-ninja-border bg-black/30 px-3 py-1 hover:bg-black/50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset Run
              </button>
              {playerDiscordId === DEV_DISCORD_ID && (
                <span className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-600/20 px-3 py-1 text-red-300 font-bold tracking-widest">
                  DEV PROFILE
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-full border border-ninja-border bg-black/30 px-3 py-1">
                <Play className="w-3.5 h-3.5" /> {mode === "challenge" ? "Challenge" : "Freeplay"}
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
