"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";

import { KNNClassifier, normalizeHand } from "@/utils/knn";
import { OFFICIAL_JUTSUS } from "@/utils/jutsu-registry";
import {
  applyTemporalVote,
  DEFAULT_FILTERS,
  evaluateLighting,
  finalizeCalibration,
  type CalibrationProfile,
  type CalibrationSample,
  type VoteEntry,
} from "@/utils/detection-filters";

type ArenaPhase = "loading" | "ready" | "countdown" | "active" | "casting" | "completed" | "error";
type PlayMode = "free" | "rank" | "calibration";

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface HandednessCategory {
  categoryName?: string;
  displayName?: string;
  category_name?: string;
}

interface HandsResultShape {
  landmarks?: Landmark[][];
  handedness?: HandednessCategory[][];
  handednesses?: HandednessCategory[][];
}

interface HandLandmarkerLike {
  detectForVideo: (video: HTMLVideoElement, nowMs: number) => HandsResultShape;
  close?: () => void;
}

interface EffectAnchor {
  x: number;
  y: number;
  scale: number;
}

interface PhoenixBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface PlayArenaProofEvent {
  t: number;
  type: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface PlayArenaProof {
  runToken: string;
  tokenSource: string;
  tokenIssueReason: string;
  clientStartedAtIso: string;
  events: PlayArenaProofEvent[];
  eventOverflow: boolean;
  cooldownMs: number;
  voteRequiredHits: number;
  voteMinConfidence: number;
  restrictedSigns: boolean;
  cameraIdx: number;
  resolutionIdx: number;
}

export interface PlayArenaResult {
  mode: "free" | "rank";
  jutsuName: string;
  signsLanded: number;
  expectedSigns: number;
  elapsedSeconds: number;
  proof?: PlayArenaProof;
}

export interface PlayArenaCompleteFeedback {
  ok?: boolean;
  statusText?: string;
  detailText?: string;
  rankText?: string;
  xpAwarded?: number;
}

interface PlayArenaProps {
  jutsuName: string;
  mode: PlayMode;
  restrictedSigns: boolean;
  debugHands: boolean;
  busy?: boolean;
  sfxVolume?: number;
  cameraIdx?: number;
  resolutionIdx?: number;
  calibrationProfile?: Partial<CalibrationProfile> | null;
  progressionHud?: {
    xp: number;
    level: number;
    rank: string;
    xpToNextLevel?: number;
  };
  onBack: () => void;
  onPrevJutsu?: () => void;
  onNextJutsu?: () => void;
  onQuickCalibrate?: () => void;
  onComplete?: (result: PlayArenaResult) => Promise<boolean | PlayArenaCompleteFeedback | void> | boolean | PlayArenaCompleteFeedback | void;
  onCalibrationComplete?: (profile: CalibrationProfile) => Promise<boolean | void> | boolean | void;
  onRequestRunToken?: (payload: {
    mode: "rank";
    jutsuName: string;
    clientStartedAtIso: string;
  }) => Promise<{ token?: string; source?: string; reason?: string } | void>;
}

const DETECTION_INTERVAL_MS = 70;
const VOTE_WINDOW_SIZE = 2;
const VOTE_TTL_MS = 700;
const SIGN_ACCEPT_COOLDOWN_MS = 500;
const LIGHTING_INTERVAL_MS = 240;
const TWO_HANDS_GUIDE_DELAY_MS = 2000;
const EFFECT_DEFAULT_DURATION_MS = 2200;

const CALIBRATION_DURATION_S = 12;
const CALIBRATION_MIN_SAMPLES = 100;
const CALIBRATION_MAX_SAMPLES = 1200;

const RESOLUTION_OPTIONS: Array<{ width: number; height: number }> = [
  { width: 640, height: 480 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sanitizeCalibrationProfile(raw: Partial<CalibrationProfile> | null | undefined): CalibrationProfile {
  return {
    version: Math.max(1, Math.floor(toNumber(raw?.version, DEFAULT_FILTERS.version))),
    samples: Math.max(0, Math.floor(toNumber(raw?.samples, DEFAULT_FILTERS.samples))),
    updatedAt: String(raw?.updatedAt || ""),
    lightingMin: clamp(toNumber(raw?.lightingMin, DEFAULT_FILTERS.lightingMin), 25, 120),
    lightingMax: clamp(toNumber(raw?.lightingMax, DEFAULT_FILTERS.lightingMax), 120, 245),
    lightingMinContrast: clamp(toNumber(raw?.lightingMinContrast, DEFAULT_FILTERS.lightingMinContrast), 10, 80),
    voteMinConfidence: clamp(toNumber(raw?.voteMinConfidence, DEFAULT_FILTERS.voteMinConfidence), 0.2, 0.9),
    voteRequiredHits: Math.floor(clamp(toNumber(raw?.voteRequiredHits, DEFAULT_FILTERS.voteRequiredHits), 2, VOTE_WINDOW_SIZE)),
  };
}

function parseCsv(text: string): Record<string, string | number>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string | number>[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const values = line.split(",");
    if (values.length < headers.length) continue;
    const row: Record<string, string | number> = {};
    for (let j = 0; j < headers.length; j += 1) {
      const raw = values[j]?.trim() ?? "";
      row[headers[j]] = j === 0 ? raw : Number(raw);
    }
    rows.push(row);
  }

  return rows;
}

function normalizeLabel(label: string): string {
  const token = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
  if (!token) return "";
  const aliases: Record<string, string> = {
    none: "idle",
    unknown: "idle",
    rabbit: "hare",
    pig: "boar",
    sheep: "ram",
    bull: "ox",
    "hand clap": "clap",
    "hands clap": "clap",
    handclap: "clap",
    "clap hands": "clap",
  };
  return aliases[token] || token;
}

function signsMatch(
  detectedSign: string,
  targetSign: string,
  rawDetectedSign: string,
  rawDetectedConfidence: number,
  voteMinConfidence: number,
): boolean {
  const target = normalizeLabel(targetSign);
  if (!target || target === "idle") return false;

  const stable = normalizeLabel(detectedSign);
  if (stable === target) return true;

  const raw = normalizeLabel(rawDetectedSign);
  if (raw !== target) return false;
  const minConf = Math.max(0.30, Number(voteMinConfidence || 0.45) - 0.10);
  return Number(rawDetectedConfidence || 0) >= minConf;
}

function toDisplayLabel(label: string): string {
  const normalized = normalizeLabel(label);
  if (!normalized) return "Idle";
  if (normalized === "idle") return "Idle";
  if (normalized === "unknown") return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getHandednessLabel(result: HandsResultShape, handIndex: number): string {
  const handedness = result.handednesses ?? result.handedness ?? [];
  const first = handedness?.[handIndex]?.[0];
  if (!first) return "";
  const raw = first.categoryName ?? first.displayName ?? first.category_name ?? "";
  return String(raw).trim().toLowerCase();
}

function buildFeatures(result: HandsResultShape): { features: number[]; numHands: number } {
  const landmarks = result.landmarks ?? [];
  const numHands = landmarks.length;

  let h1 = new Array(63).fill(0);
  let h2 = new Array(63).fill(0);
  let h1Set = false;
  let h2Set = false;

  for (let i = 0; i < landmarks.length; i += 1) {
    const normalized = normalizeHand(landmarks[i] ?? []);
    const handedness = getHandednessLabel(result, i);

    if (handedness === "left") {
      h1 = normalized;
      h1Set = true;
      continue;
    }
    if (handedness === "right") {
      h2 = normalized;
      h2Set = true;
      continue;
    }

    if (!h1Set) {
      h1 = normalized;
      h1Set = true;
    } else if (!h2Set) {
      h2 = normalized;
      h2Set = true;
    }
  }

  return { features: [...h1, ...h2], numHands };
}

function computeEffectAnchor(landmarks: Landmark[][]): EffectAnchor | null {
  const hand = landmarks[0];
  if (!hand || hand.length < 21) return null;

  const anchorIndices = [0, 5, 9, 13, 17];
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const idx of anchorIndices) {
    const point = hand[idx];
    if (!point) continue;
    sumX += point.x;
    sumY += point.y;
    count += 1;
  }

  if (count <= 0) return null;
  const avgX = sumX / count;
  const avgY = sumY / count;

  const p5 = hand[5] || hand[0];
  const p17 = hand[17] || hand[9] || hand[0];
  const palmSpan = Math.hypot((p5?.x || 0) - (p17?.x || 0), (p5?.y || 0) - (p17?.y || 0));
  const scale = clamp(palmSpan / 0.23, 0.75, 1.8);

  return {
    x: clamp(1 - avgX, 0.02, 0.98),
    y: clamp(avgY, 0.06, 0.94),
    scale,
  };
}

function drawLandmarks(ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number): void {
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17],
  ];

  const points = landmarks.map((lm) => ({
    x: (1 - lm.x) * width,
    y: lm.y * height,
  }));

  ctx.strokeStyle = "rgba(255, 120, 50, 0.65)";
  ctx.lineWidth = 2;
  for (const [start, end] of connections) {
    ctx.beginPath();
    ctx.moveTo(points[start].x, points[start].y);
    ctx.lineTo(points[end].x, points[end].y);
    ctx.stroke();
  }

  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ff7832";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, ms);
  const sec = Math.floor(total / 1000);
  const cent = Math.floor((total % 1000) / 10);
  return `${sec}.${String(cent).padStart(2, "0")}s`;
}

function signImageCandidates(sign: string): string[] {
  const normalized = normalizeLabel(sign);
  if (!normalized) return ["/pics/placeholder.png"];
  return [
    `/pics/signs/${normalized}.jpg`,
    `/pics/signs/${normalized}.jpeg`,
    `/pics/signs/${normalized}.png`,
    `/pics/${normalized}.jpg`,
    `/pics/${normalized}.jpeg`,
    `/pics/${normalized}.png`,
    "/pics/placeholder.png",
  ];
}

function SignTile({
  sign,
  index,
  state,
}: {
  sign: string;
  index: number;
  state: "pending" | "active" | "done" | "casting";
}) {
  const candidates = useMemo(() => signImageCandidates(sign), [sign]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  const src = candidates[Math.min(candidateIndex, candidates.length - 1)] || "/pics/placeholder.png";

  return (
    <div className="flex min-w-[84px] flex-col items-center gap-2">
      <div
        className={`rounded-xl border p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.35)] ${
          state === "done"
            ? "border-emerald-400/55 bg-emerald-500/12"
            : state === "casting"
              ? "border-amber-300/70 bg-amber-500/15"
              : state === "active"
                ? "border-orange-400/65 bg-orange-500/12"
                : "border-ninja-border bg-ninja-card/55"
        }`}
      >
        <Image
          src={src}
          alt={toDisplayLabel(sign)}
          width={68}
          height={68}
          onError={() => {
            setCandidateIndex((prev) => Math.min(prev + 1, candidates.length - 1));
          }}
          className={`h-[68px] w-[68px] rounded-lg object-cover ${
            state === "done" ? "opacity-45" : ""
          }`}
        />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-200">
        {index + 1}. {toDisplayLabel(sign)}
      </p>
    </div>
  );
}

async function getStreamWithPreferences(cameraIdx: number, resolutionIdx: number): Promise<MediaStream> {
  const res = RESOLUTION_OPTIONS[Math.max(0, Math.min(RESOLUTION_OPTIONS.length - 1, Math.floor(resolutionIdx)))]
    || RESOLUTION_OPTIONS[0];

  const baseVideo: MediaTrackConstraints = {
    width: { ideal: res.width },
    height: { ideal: res.height },
    facingMode: "user",
  };

  const safeIdx = Math.max(0, Math.floor(cameraIdx));

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === "videoinput");
    if (videoInputs.length > 0 && safeIdx < videoInputs.length) {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          ...baseVideo,
          deviceId: { exact: videoInputs[safeIdx].deviceId },
        },
      });
    }
  } catch {
    // Fall back to default camera request.
  }

  return await navigator.mediaDevices.getUserMedia({ video: baseVideo });
}

export default function PlayArena({
  jutsuName,
  mode,
  restrictedSigns,
  debugHands,
  busy = false,
  sfxVolume = 0.35,
  cameraIdx = 0,
  resolutionIdx = 0,
  calibrationProfile,
  progressionHud,
  onBack,
  onPrevJutsu,
  onNextJutsu,
  onQuickCalibrate,
  onComplete,
  onCalibrationComplete,
  onRequestRunToken,
}: PlayArenaProps) {
  const isRankMode = mode === "rank";
  const isCalibrationMode = mode === "calibration";
  const jutsu = OFFICIAL_JUTSUS[jutsuName];
  const sequence = useMemo(() => (jutsu?.sequence ?? []).map((s) => normalizeLabel(s)), [jutsu]);

  const activeCalibrationProfile = useMemo(
    () => sanitizeCalibrationProfile(calibrationProfile),
    [calibrationProfile],
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const knnRef = useRef<KNNClassifier | null>(null);
  const handsRef = useRef<HandLandmarkerLike | null>(null);
  const renderRafRef = useRef(0);
  const detectRafRef = useRef(0);
  const lastDetectRef = useRef(0);
  const voteWindowRef = useRef<VoteEntry[]>([]);
  const latestLandmarksRef = useRef<Landmark[][]>([]);
  const lightingLastRef = useRef(0);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const currentStepRef = useRef(0);
  const signsLandedRef = useRef(0);
  const phaseRef = useRef<ArenaPhase>("loading");
  const runStartRef = useRef(0);
  const elapsedRef = useRef(0);
  const lastAcceptedAtRef = useRef(0);
  const oneHandSinceRef = useRef(0);
  const showTwoHandsGuideRef = useRef(false);
  const lightingStatusRef = useRef<"good" | "low_light" | "overexposed" | "low_contrast">("good");
  const lightingMeanRef = useRef(0);
  const lightingContrastRef = useRef(0);

  const calibrationStartedAtRef = useRef(0);
  const calibrationSamplesRef = useRef<CalibrationSample[]>([]);
  const calibrationFinalizeBusyRef = useRef(false);

  const proofEventsRef = useRef<PlayArenaProofEvent[]>([]);
  const proofEventOverflowRef = useRef(false);
  const proofRunTokenRef = useRef("");
  const proofTokenSourceRef = useRef("none");
  const proofTokenReasonRef = useRef("");
  const proofStartedAtIsoRef = useRef("");
  const lastCountdownLoggedRef = useRef<number | null>(null);

  const comboCueTimerRef = useRef<number | null>(null);
  const effectTimerRef = useRef<number | null>(null);
  const castResultTimerRef = useRef<number | null>(null);
  const calibrationReturnTimerRef = useRef<number | null>(null);
  const phoenixRafRef = useRef(0);
  const phoenixLastAtRef = useRef(0);
  const fpsRafRef = useRef(0);
  const fpsLastAtRef = useRef(0);
  const fpsFramesRef = useRef(0);
  const xpPopupTimerRef = useRef<number | null>(null);
  const runFinishedRef = useRef(false);
  const calibrationDiagRestoreRef = useRef<boolean | null>(null);
  const comboCloneHoldRef = useRef(false);
  const comboChidoriTripleRef = useRef(false);
  const comboRasenganTripleRef = useRef(false);
  const effectAnchorRef = useRef<EffectAnchor | null>(null);
  const autoSubmitTriggeredRef = useRef(false);

  const [phase, setPhase] = useState<ArenaPhase>("loading");
  const [loadingMessage, setLoadingMessage] = useState("Loading arena...");
  const [errorMessage, setErrorMessage] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [detectedLabel, setDetectedLabel] = useState("Idle");
  const [detectedConfidence, setDetectedConfidence] = useState(0);
  const [rawDetectedLabel, setRawDetectedLabel] = useState("Idle");
  const [rawDetectedConfidence, setRawDetectedConfidence] = useState(0);
  const [voteHits, setVoteHits] = useState(0);
  const [detectedHands, setDetectedHands] = useState(0);
  const [lightingStatus, setLightingStatus] = useState<"good" | "low_light" | "overexposed" | "low_contrast">("good");
  const [currentStep, setCurrentStep] = useState(0);
  const [signsLanded, setSignsLanded] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitDetail, setSubmitDetail] = useState("");
  const [rankInfo, setRankInfo] = useState("");
  const [comboCue, setComboCue] = useState("");
  const [showTwoHandsGuide, setShowTwoHandsGuide] = useState(false);
  const [calibrationSecondsLeft, setCalibrationSecondsLeft] = useState(CALIBRATION_DURATION_S);
  const [calibrationSamples, setCalibrationSamples] = useState(0);
  const [showDetectionPanel, setShowDetectionPanel] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [fps, setFps] = useState(0);
  const [activeEffect, setActiveEffect] = useState("");
  const [showJutsuEffect, setShowJutsuEffect] = useState(false);
  const [effectAnchor, setEffectAnchor] = useState<EffectAnchor | null>(null);
  const [phoenixFireballs, setPhoenixFireballs] = useState<PhoenixBall[]>([]);
  const [comboTripleEffect, setComboTripleEffect] = useState<"none" | "chidori" | "rasengan">("none");
  const [xpPopupText, setXpPopupText] = useState("");

  const playSfx = useCallback((src: string, volume = 1) => {
    try {
      const audio = new Audio(src);
      audio.volume = clamp(sfxVolume * volume, 0, 1);
      void audio.play().catch(() => {});
    } catch {
      // Ignore autoplay errors.
    }
  }, [sfxVolume]);

  const pushComboCue = useCallback((message: string) => {
    setComboCue(message);
    if (comboCueTimerRef.current) {
      window.clearTimeout(comboCueTimerRef.current);
    }
    comboCueTimerRef.current = window.setTimeout(() => {
      setComboCue("");
      comboCueTimerRef.current = null;
    }, 1200);
  }, []);

  const forceCalibrationDiagnostics = useCallback(() => {
    if (!isCalibrationMode) return;
    if (calibrationDiagRestoreRef.current === null) {
      calibrationDiagRestoreRef.current = showDetectionPanel;
    }
    setShowDetectionPanel(true);
  }, [isCalibrationMode, showDetectionPanel]);

  const restoreCalibrationDiagnostics = useCallback(() => {
    if (!isCalibrationMode) return;
    if (calibrationDiagRestoreRef.current === null) return;
    setShowDetectionPanel(Boolean(calibrationDiagRestoreRef.current));
    calibrationDiagRestoreRef.current = null;
  }, [isCalibrationMode]);

  const triggerJutsuEffect = useCallback((effectName: string, durationMs = EFFECT_DEFAULT_DURATION_MS) => {
    if (!effectName) return;
    setActiveEffect(String(effectName).toLowerCase());
    setShowJutsuEffect(true);
    if (effectTimerRef.current) {
      window.clearTimeout(effectTimerRef.current);
    }
    effectTimerRef.current = window.setTimeout(() => {
      setShowJutsuEffect(false);
      setActiveEffect("");
      setComboTripleEffect("none");
      comboCloneHoldRef.current = false;
      comboChidoriTripleRef.current = false;
      comboRasenganTripleRef.current = false;
      effectTimerRef.current = null;
    }, Math.max(600, durationMs));
  }, []);

  const resetProofState = useCallback(() => {
    proofEventsRef.current = [];
    proofEventOverflowRef.current = false;
    proofRunTokenRef.current = "";
    proofTokenSourceRef.current = "none";
    proofTokenReasonRef.current = "";
    proofStartedAtIsoRef.current = "";
  }, []);

  const appendProofEvent = useCallback((eventType: string, nowMs: number, extra?: Record<string, string | number | boolean>) => {
    if (!isRankMode) return;

    const maxEvents = 256;
    if (proofEventsRef.current.length >= maxEvents) {
      if (!proofEventOverflowRef.current) {
        proofEventOverflowRef.current = true;
        const overflowTime = runStartRef.current > 0
          ? Math.max(0, (nowMs - runStartRef.current) / 1000)
          : 0;
        proofEventsRef.current.push({
          t: Number(overflowTime.toFixed(3)),
          type: "event_overflow",
        });
      }
      return;
    }

    const relSec = runStartRef.current > 0
      ? Math.max(0, (nowMs - runStartRef.current) / 1000)
      : 0;
    const event: PlayArenaProofEvent = {
      t: Number(relSec.toFixed(3)),
      type: String(eventType || ""),
    };

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        event[key] = value;
      }
    }

    proofEventsRef.current.push(event);
  }, [isRankMode]);

  const beginRankProof = useCallback(async (nowMs: number) => {
    if (!isRankMode) return;

    resetProofState();
    const startedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    proofStartedAtIsoRef.current = startedAt;

    appendProofEvent("run_start", nowMs, {
      mode: String(jutsuName || "").toUpperCase(),
      expected_signs: sequence.length,
    });

    if (!onRequestRunToken) return;

    try {
      const res = await onRequestRunToken({
        mode: "rank",
        jutsuName,
        clientStartedAtIso: startedAt,
      });
      proofRunTokenRef.current = String(res?.token || "");
      proofTokenSourceRef.current = String(res?.source || "none");
      proofTokenReasonRef.current = String(res?.reason || "");
    } catch (err) {
      proofRunTokenRef.current = "";
      proofTokenSourceRef.current = "none";
      proofTokenReasonRef.current = String((err as Error)?.message || "token_request_failed");
    }
  }, [appendProofEvent, isRankMode, jutsuName, onRequestRunToken, resetProofState, sequence.length]);

  const resetRunState = useCallback(() => {
    voteWindowRef.current = [];
    currentStepRef.current = 0;
    signsLandedRef.current = 0;
    runStartRef.current = 0;
    elapsedRef.current = 0;
    lastAcceptedAtRef.current = 0;
    oneHandSinceRef.current = 0;
    showTwoHandsGuideRef.current = false;
    calibrationStartedAtRef.current = 0;
    calibrationSamplesRef.current = [];
    calibrationFinalizeBusyRef.current = false;
    lastCountdownLoggedRef.current = null;
    runFinishedRef.current = false;
    comboCloneHoldRef.current = false;
    comboChidoriTripleRef.current = false;
    comboRasenganTripleRef.current = false;
    calibrationDiagRestoreRef.current = null;
    autoSubmitTriggeredRef.current = false;
    setComboTripleEffect("none");
    setEffectAnchor(null);
    setPhoenixFireballs([]);

    if (comboCueTimerRef.current) {
      window.clearTimeout(comboCueTimerRef.current);
      comboCueTimerRef.current = null;
    }
    if (effectTimerRef.current) {
      window.clearTimeout(effectTimerRef.current);
      effectTimerRef.current = null;
    }
    if (castResultTimerRef.current) {
      window.clearTimeout(castResultTimerRef.current);
      castResultTimerRef.current = null;
    }
    if (calibrationReturnTimerRef.current) {
      window.clearTimeout(calibrationReturnTimerRef.current);
      calibrationReturnTimerRef.current = null;
    }
    if (phoenixRafRef.current) {
      cancelAnimationFrame(phoenixRafRef.current);
      phoenixRafRef.current = 0;
    }
    phoenixLastAtRef.current = 0;
    if (xpPopupTimerRef.current) {
      window.clearTimeout(xpPopupTimerRef.current);
      xpPopupTimerRef.current = null;
    }

    resetProofState();

    setCurrentStep(0);
    setSignsLanded(0);
    setElapsedMs(0);
    setDetectedLabel("Idle");
    setDetectedConfidence(0);
    setSubmitted(false);
    setSubmitting(false);
    setSubmitStatus("");
    setSubmitDetail("");
    setRankInfo("");
    setComboCue("");
    setShowTwoHandsGuide(false);
    setCalibrationSecondsLeft(CALIBRATION_DURATION_S);
    setCalibrationSamples(0);
    setRawDetectedLabel("Idle");
    setRawDetectedConfidence(0);
    setVoteHits(0);
    setShowModelInfo(false);
    setShowJutsuEffect(false);
    setActiveEffect("");
    setPhoenixFireballs([]);
    setXpPopupText("");
  }, [resetProofState]);

  const finalizeCalibrationRun = useCallback(async () => {
    if (!isCalibrationMode) return;
    if (calibrationFinalizeBusyRef.current) return;

    calibrationFinalizeBusyRef.current = true;

    const profile = finalizeCalibration(
      calibrationSamplesRef.current,
      VOTE_WINDOW_SIZE,
    );

    setSubmitting(true);
    let accepted = true;
    try {
      if (onCalibrationComplete) {
        const res = await onCalibrationComplete(profile);
        accepted = res !== false;
      }
      setSubmitted(accepted);
      setSubmitStatus(accepted ? "Calibration synced" : "Calibration sync failed");
      setSubmitDetail(accepted ? "Profile is now active for detection filtering." : "Retry calibration or check connectivity.");
    } catch (err) {
      accepted = false;
      setSubmitted(false);
      setSubmitStatus("Calibration sync failed");
      setSubmitDetail(String((err as Error)?.message || "unknown_error"));
    } finally {
      setSubmitting(false);
      restoreCalibrationDiagnostics();
      phaseRef.current = "completed";
      setPhase("completed");
      if (accepted) {
        if (calibrationReturnTimerRef.current) {
          window.clearTimeout(calibrationReturnTimerRef.current);
          calibrationReturnTimerRef.current = null;
        }
        calibrationReturnTimerRef.current = window.setTimeout(() => {
          calibrationReturnTimerRef.current = null;
          onBack();
        }, 900);
      }
    }
  }, [isCalibrationMode, onBack, onCalibrationComplete, restoreCalibrationDiagnostics]);

  const finishRun = useCallback((nowMs: number) => {
    const elapsed = runStartRef.current > 0 ? Math.max(0, nowMs - runStartRef.current) : elapsedRef.current;
    elapsedRef.current = elapsed;
    setElapsedMs(elapsed);
    runFinishedRef.current = true;

    if (isRankMode) {
      appendProofEvent("run_finish", nowMs, {
        final_time: Number((elapsed / 1000).toFixed(4)),
        jutsu: String(jutsuName || "").toUpperCase(),
      });
    }

    playSfx("/sounds/complete.mp3", 1);
    if (isCalibrationMode) {
      phaseRef.current = "completed";
      setPhase("completed");
      return;
    }

    const finalEffect = String(jutsu?.effect || "").toLowerCase();
    if (finalEffect === "lightning" && comboChidoriTripleRef.current) {
      setComboTripleEffect("chidori");
    } else if (finalEffect === "rasengan" && comboRasenganTripleRef.current) {
      setComboTripleEffect("rasengan");
    } else if (finalEffect !== "lightning" && finalEffect !== "rasengan") {
      setComboTripleEffect("none");
    }

    const effectDurationMs = Math.max(650, Math.round((Number(jutsu?.duration) || 2.2) * 1000));
    triggerJutsuEffect(finalEffect, effectDurationMs);

    if (castResultTimerRef.current) {
      window.clearTimeout(castResultTimerRef.current);
      castResultTimerRef.current = null;
    }
    phaseRef.current = "casting";
    setPhase("casting");
    castResultTimerRef.current = window.setTimeout(() => {
      if (isRankMode) {
        phaseRef.current = "completed";
        setPhase("completed");
      } else {
        resetRunState();
        const restartAt = performance.now();
        runStartRef.current = restartAt;
        elapsedRef.current = 0;
        phaseRef.current = "active";
        setPhase("active");
      }
      castResultTimerRef.current = null;
    }, effectDurationMs);
  }, [appendProofEvent, isCalibrationMode, isRankMode, jutsu?.duration, jutsu?.effect, jutsuName, playSfx, resetRunState, triggerJutsuEffect]);

  const startActiveRun = useCallback(() => {
    resetRunState();
    const nowMs = performance.now();
    runStartRef.current = nowMs;
    elapsedRef.current = 0;

    if (isCalibrationMode) {
      calibrationStartedAtRef.current = nowMs;
      calibrationSamplesRef.current = [];
    }

    if (isRankMode) {
      void beginRankProof(nowMs);
    }

    phaseRef.current = "active";
    setPhase("active");
  }, [beginRankProof, isCalibrationMode, isRankMode, resetRunState]);

  const startRun = useCallback(() => {
    if (phaseRef.current === "loading" || phaseRef.current === "error") return;

    if (isRankMode) {
      if (phaseRef.current === "completed") {
        resetRunState();
        phaseRef.current = "ready";
        setPhase("ready");
        return;
      }
      resetRunState();
      appendProofEvent("countdown_start", performance.now(), { count: 3 });
      setCountdown(3);
      phaseRef.current = "countdown";
      setPhase("countdown");
      return;
    }

    if (isCalibrationMode) {
      forceCalibrationDiagnostics();
    }
    startActiveRun();
  }, [appendProofEvent, forceCalibrationDiagnostics, isCalibrationMode, isRankMode, resetRunState, startActiveRun]);

  const handleSubmitResult = useCallback(async () => {
    if (isCalibrationMode || !onComplete) return;
    const canSubmitDuringCasting = phase === "casting" && runFinishedRef.current;
    if (submitting || busy || submitted || (phase !== "completed" && !canSubmitDuringCasting)) return;

    setSubmitting(true);
    try {
      const runMode: "free" | "rank" = isRankMode ? "rank" : "free";
      const payload: PlayArenaResult = {
        mode: runMode,
        jutsuName,
        signsLanded: Math.max(signsLanded, sequence.length),
        expectedSigns: sequence.length,
        elapsedSeconds: elapsedMs / 1000,
      };

      if (isRankMode) {
        payload.proof = {
          runToken: proofRunTokenRef.current,
          tokenSource: proofTokenSourceRef.current,
          tokenIssueReason: proofTokenReasonRef.current,
          clientStartedAtIso: proofStartedAtIsoRef.current,
          events: [...proofEventsRef.current],
          eventOverflow: proofEventOverflowRef.current,
          cooldownMs: SIGN_ACCEPT_COOLDOWN_MS,
          voteRequiredHits: activeCalibrationProfile.voteRequiredHits,
          voteMinConfidence: activeCalibrationProfile.voteMinConfidence,
          restrictedSigns,
          cameraIdx,
          resolutionIdx,
        };
      }

      const feedback = await onComplete(payload);

      let accepted = true;
      let statusText = isRankMode ? "Run submitted" : "XP applied";
      let detailText = "";
      let rankText = "";
      let xpAwarded = 0;

      if (feedback === false) {
        accepted = false;
      } else if (feedback && typeof feedback === "object") {
        if (typeof feedback.ok === "boolean") accepted = feedback.ok;
        if (feedback.statusText) statusText = feedback.statusText;
        if (feedback.detailText) detailText = feedback.detailText;
        if (feedback.rankText) rankText = feedback.rankText;
        if (Number.isFinite(Number(feedback.xpAwarded))) {
          xpAwarded = Math.max(0, Math.floor(Number(feedback.xpAwarded)));
        }
      }

      if (accepted) {
        setSubmitted(true);
      }

      setSubmitStatus(statusText);
      setSubmitDetail(detailText);
      setRankInfo(rankText);
      if (xpAwarded > 0 && !isCalibrationMode) {
        setXpPopupText(`+${xpAwarded} XP`);
        if (xpPopupTimerRef.current) {
          window.clearTimeout(xpPopupTimerRef.current);
        }
        xpPopupTimerRef.current = window.setTimeout(() => {
          setXpPopupText("");
          xpPopupTimerRef.current = null;
        }, 1900);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    activeCalibrationProfile,
    busy,
    cameraIdx,
    elapsedMs,
    isCalibrationMode,
    isRankMode,
    jutsuName,
    onComplete,
    phase,
    resolutionIdx,
    restrictedSigns,
    sequence.length,
    signsLanded,
    submitted,
    submitting,
  ]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    signsLandedRef.current = signsLanded;
  }, [signsLanded]);

  useEffect(() => {
    showTwoHandsGuideRef.current = showTwoHandsGuide;
  }, [showTwoHandsGuide]);

  useEffect(() => {
    lightingStatusRef.current = lightingStatus;
  }, [lightingStatus]);

  useEffect(() => {
    effectAnchorRef.current = effectAnchor;
  }, [effectAnchor]);

  const handleResetRun = useCallback(() => {
    if (isRankMode) {
      appendProofEvent("run_reset", performance.now(), {
        phase: phaseRef.current,
      });
    }
    startRun();
  }, [appendProofEvent, isRankMode, startRun]);

  const handleBackAction = useCallback(async () => {
    if (isRankMode) {
      appendProofEvent("run_exit", performance.now(), {
        phase: phaseRef.current,
        submitted,
      });
      const canSubmitOnExit = runFinishedRef.current
        && (phaseRef.current === "casting" || phaseRef.current === "completed");
      if (canSubmitOnExit && !submitted && !submitting) {
        await handleSubmitResult();
      }
    }
    if (isCalibrationMode) {
      restoreCalibrationDiagnostics();
    }
    onBack();
  }, [appendProofEvent, handleSubmitResult, isCalibrationMode, isRankMode, onBack, restoreCalibrationDiagnostics, submitted, submitting]);

  const canSwitchJutsuNow = useCallback((): boolean => {
    if (isCalibrationMode) return false;
    if (phaseRef.current === "loading" || phaseRef.current === "error") return false;
    if (phaseRef.current === "countdown" || phaseRef.current === "active" || phaseRef.current === "casting") return false;
    if (isRankMode && phaseRef.current !== "ready") return false;
    return true;
  }, [isCalibrationMode, isRankMode]);

  const handleSwitchJutsu = useCallback((dir: "prev" | "next") => {
    if (!canSwitchJutsuNow()) return;
    if (dir === "prev") {
      onPrevJutsu?.();
      return;
    }
    onNextJutsu?.();
  }, [canSwitchJutsuNow, onNextJutsu, onPrevJutsu]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        void handleBackAction();
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        handleSwitchJutsu("prev");
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        handleSwitchJutsu("next");
        return;
      }

      if (event.code === "KeyR") {
        if (!isCalibrationMode && (phaseRef.current === "active" || phaseRef.current === "casting" || phaseRef.current === "completed")) {
          event.preventDefault();
          handleResetRun();
        }
        return;
      }

      if (event.code === "KeyC") {
        if (!isCalibrationMode) {
          event.preventDefault();
          onQuickCalibrate?.();
        }
        return;
      }

      if (event.code === "KeyM") {
        event.preventDefault();
        setShowModelInfo(true);
        return;
      }

      if (event.code === "Space") {
        if (phaseRef.current === "loading" || phaseRef.current === "error") return;
        event.preventDefault();
        if (phaseRef.current === "ready" || phaseRef.current === "completed") {
          startRun();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleBackAction, handleResetRun, handleSwitchJutsu, isCalibrationMode, onQuickCalibrate, startRun]);

  useEffect(() => {
    let cancelled = false;

    async function initArena() {
      try {
        setPhase("loading");
        setLoadingMessage("Loading sign dataset...");

        const csvResp = await fetch("/mediapipe_signs_db.csv", { cache: "force-cache" });
        if (!csvResp.ok) throw new Error(`Dataset fetch failed (${csvResp.status})`);
        const csvText = await csvResp.text();
        if (cancelled) return;
        const rows = parseCsv(csvText);
        knnRef.current = new KNNClassifier(rows, 3, 1.8);

        setLoadingMessage("Loading hand tracker...");
        const vision = await import("@mediapipe/tasks-vision");
        const { FilesetResolver, HandLandmarker } = vision;
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );
        const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        handsRef.current = handLandmarker;
        if (cancelled) return;

        setLoadingMessage("Starting camera...");
        const stream = await getStreamWithPreferences(cameraIdx, resolutionIdx);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        if (!videoRef.current) throw new Error("Video element unavailable");
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (cancelled) return;

        setErrorMessage("");
        setPhase("ready");
        phaseRef.current = "ready";
      } catch (err) {
        const message = String((err as Error)?.message || err || "Failed to initialize arena");
        setErrorMessage(message);
        setPhase("error");
        phaseRef.current = "error";
      }
    }

    void initArena();

    return () => {
      cancelled = true;
      if (renderRafRef.current) cancelAnimationFrame(renderRafRef.current);
      if (detectRafRef.current) cancelAnimationFrame(detectRafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (handsRef.current && typeof handsRef.current.close === "function") {
        handsRef.current.close();
      }
      if (comboCueTimerRef.current) {
        window.clearTimeout(comboCueTimerRef.current);
        comboCueTimerRef.current = null;
      }
      if (effectTimerRef.current) {
        window.clearTimeout(effectTimerRef.current);
        effectTimerRef.current = null;
      }
      if (castResultTimerRef.current) {
        window.clearTimeout(castResultTimerRef.current);
        castResultTimerRef.current = null;
      }
      if (calibrationReturnTimerRef.current) {
        window.clearTimeout(calibrationReturnTimerRef.current);
        calibrationReturnTimerRef.current = null;
      }
      if (phoenixRafRef.current) {
        cancelAnimationFrame(phoenixRafRef.current);
        phoenixRafRef.current = 0;
      }
      phoenixLastAtRef.current = 0;
      if (xpPopupTimerRef.current) {
        window.clearTimeout(xpPopupTimerRef.current);
        xpPopupTimerRef.current = null;
      }
      runFinishedRef.current = false;
      calibrationDiagRestoreRef.current = null;
      autoSubmitTriggeredRef.current = false;
      voteWindowRef.current = [];
      latestLandmarksRef.current = [];
      sampleCtxRef.current = null;
      sampleCanvasRef.current = null;
    };
  }, [cameraIdx, resolutionIdx]);

  useEffect(() => {
    if (phase === "ready" && (mode === "free" || mode === "calibration")) {
      const timer = window.setTimeout(() => startRun(), 120);
      return () => window.clearTimeout(timer);
    }
    return;
  }, [mode, phase, startRun]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown > 0 && lastCountdownLoggedRef.current !== countdown) {
      lastCountdownLoggedRef.current = countdown;
      appendProofEvent("countdown_tick", performance.now(), { count: countdown });
    }
    if (countdown <= 0) {
      appendProofEvent("countdown_go", performance.now());
      startActiveRun();
      return;
    }
    const timer = window.setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [appendProofEvent, countdown, phase, startActiveRun]);

  useEffect(() => {
    if (phase === "active" && runStartRef.current > 0) {
      let raf = 0;
      const tick = () => {
        if (phaseRef.current === "active") {
          const next = Math.max(0, performance.now() - runStartRef.current);
          elapsedRef.current = next;
          setElapsedMs(next);
          raf = requestAnimationFrame(tick);
        }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    return;
  }, [phase]);

  useEffect(() => {
    const trackFps = (ts: number) => {
      if (!fpsLastAtRef.current) fpsLastAtRef.current = ts;
      fpsFramesRef.current += 1;
      if (ts - fpsLastAtRef.current >= 1000) {
        setFps(fpsFramesRef.current);
        fpsFramesRef.current = 0;
        fpsLastAtRef.current = ts;
      }
      fpsRafRef.current = requestAnimationFrame(trackFps);
    };
    fpsRafRef.current = requestAnimationFrame(trackFps);
    return () => {
      if (fpsRafRef.current) cancelAnimationFrame(fpsRafRef.current);
      fpsRafRef.current = 0;
      fpsFramesRef.current = 0;
      fpsLastAtRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const render = () => {
      renderRafRef.current = requestAnimationFrame(render);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      if (debugHands) {
        for (const hand of latestLandmarksRef.current) {
          drawLandmarks(ctx, hand, canvas.width, canvas.height);
        }
      }
    };

    renderRafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(renderRafRef.current);
  }, [debugHands]);

  useEffect(() => {
    const detect = (nowMs: number) => {
      detectRafRef.current = requestAnimationFrame(detect);
      if (nowMs - lastDetectRef.current < DETECTION_INTERVAL_MS) return;
      lastDetectRef.current = nowMs;

      const video = videoRef.current;
      const hands = handsRef.current;
      const knn = knnRef.current;
      if (!video || !hands || !knn || video.readyState < 2) return;

      const phaseNow = phaseRef.current;
      const shouldTrackHands = phaseNow === "active" || phaseNow === "casting";
      if (!shouldTrackHands) {
        latestLandmarksRef.current = [];
        voteWindowRef.current = [];
        oneHandSinceRef.current = 0;
        if (showTwoHandsGuideRef.current) {
          showTwoHandsGuideRef.current = false;
          setShowTwoHandsGuide(false);
        }
        setDetectedHands(0);
        setRawDetectedLabel("Idle");
        setRawDetectedConfidence(0);
        setVoteHits(0);
        setDetectedLabel("Idle");
        setDetectedConfidence(0);
        setEffectAnchor(null);
        return;
      }

      const result = hands.detectForVideo(video, nowMs) as HandsResultShape;
      latestLandmarksRef.current = result.landmarks ?? [];
      setEffectAnchor(computeEffectAnchor(result.landmarks ?? []));
      const { features, numHands } = buildFeatures(result);
      setDetectedHands(numHands);

      if (phaseNow !== "active") {
        return;
      }

      if (restrictedSigns && numHands === 1) {
        if (!oneHandSinceRef.current) {
          oneHandSinceRef.current = nowMs;
        } else if ((nowMs - oneHandSinceRef.current) >= TWO_HANDS_GUIDE_DELAY_MS && !showTwoHandsGuideRef.current) {
          showTwoHandsGuideRef.current = true;
          setShowTwoHandsGuide(true);
        }
      } else {
        oneHandSinceRef.current = 0;
        if (showTwoHandsGuideRef.current) {
          showTwoHandsGuideRef.current = false;
          setShowTwoHandsGuide(false);
        }
      }

      if (nowMs - lightingLastRef.current >= LIGHTING_INTERVAL_MS) {
        lightingLastRef.current = nowMs;
        if (!sampleCanvasRef.current) {
          const sampleCanvas = document.createElement("canvas");
          sampleCanvas.width = 96;
          sampleCanvas.height = 72;
          sampleCanvasRef.current = sampleCanvas;
          sampleCtxRef.current = sampleCanvas.getContext("2d", { willReadFrequently: true });
        }
        const sampleCtx = sampleCtxRef.current;
        if (sampleCtx) {
          sampleCtx.drawImage(video, 0, 0, 96, 72);
          const stats = evaluateLighting(
            sampleCtx.getImageData(0, 0, 96, 72).data,
            96,
            72,
            activeCalibrationProfile,
          );
          lightingStatusRef.current = stats.status;
          lightingMeanRef.current = stats.mean;
          lightingContrastRef.current = stats.contrast;
          setLightingStatus(stats.status);
        }
      }

      let rawLabel = "idle";
      let rawConfidence = 0;
      let stableLabel = "idle";
      let stableConfidence = 0;

      if (features.length === 0) {
        voteWindowRef.current = [];
        setRawDetectedLabel("No hands");
        setRawDetectedConfidence(0);
        setVoteHits(0);
        setDetectedLabel("No hands");
        setDetectedConfidence(0);
      } else {
        const prediction = knn.predictWithConfidence(features);
        rawLabel = normalizeLabel(prediction.label || "idle");
        rawConfidence = Math.max(0, Number(prediction.confidence || 0));

        if (restrictedSigns && numHands < 2) {
          rawLabel = "idle";
          rawConfidence = 0;
        }

        const lightingPass = !isRankMode || lightingStatusRef.current === "good";
        const allowDetection = lightingPass && (!restrictedSigns || numHands >= 2);
        const vote = applyTemporalVote(
          voteWindowRef.current,
          rawLabel,
          rawConfidence,
          nowMs,
          allowDetection,
          VOTE_WINDOW_SIZE,
          VOTE_TTL_MS,
          activeCalibrationProfile.voteRequiredHits,
          activeCalibrationProfile.voteMinConfidence,
        );

        voteWindowRef.current = vote.nextWindow;
        stableLabel = vote.label;
        stableConfidence = vote.confidence;
        setRawDetectedLabel(toDisplayLabel(rawLabel));
        setRawDetectedConfidence(rawConfidence);
        setVoteHits(vote.hits);
        setDetectedLabel(toDisplayLabel(vote.label));
        setDetectedConfidence(vote.confidence);
      }

      if (isCalibrationMode && phaseRef.current === "active") {
        const sample: CalibrationSample = {
          brightness: lightingMeanRef.current,
          contrast: lightingContrastRef.current,
        };
        if (rawLabel !== "idle" && rawLabel !== "unknown" && rawConfidence > 0) {
          sample.confidence = rawConfidence;
        }

        calibrationSamplesRef.current.push(sample);
        if (calibrationSamplesRef.current.length > CALIBRATION_MAX_SAMPLES) {
          calibrationSamplesRef.current = calibrationSamplesRef.current.slice(-CALIBRATION_MAX_SAMPLES);
        }

        const elapsedSeconds = runStartRef.current > 0
          ? Math.max(0, (nowMs - runStartRef.current) / 1000)
          : 0;

        setCalibrationSecondsLeft(Math.max(0, CALIBRATION_DURATION_S - elapsedSeconds));
        setCalibrationSamples(calibrationSamplesRef.current.length);

        const enoughTime = elapsedSeconds >= CALIBRATION_DURATION_S;
        const enoughSamples = calibrationSamplesRef.current.length >= CALIBRATION_MIN_SAMPLES;
        const timeoutExceeded = elapsedSeconds >= (CALIBRATION_DURATION_S * 1.7);

        if ((enoughTime && enoughSamples) || timeoutExceeded) {
          void finalizeCalibrationRun();
          return;
        }
      }

      if (isCalibrationMode) return;
      if (stableLabel === "idle" || stableLabel === "unknown") return;
      if ((nowMs - lastAcceptedAtRef.current) < SIGN_ACCEPT_COOLDOWN_MS) return;

      const stepIdx = currentStepRef.current;
      if (stepIdx >= sequence.length) return;
      const expected = sequence[stepIdx];
      if (!signsMatch(
        stableLabel,
        expected,
        rawLabel,
        rawConfidence,
        activeCalibrationProfile.voteMinConfidence,
      )) return;

      playSfx("/sounds/each.mp3", 0.9);
      lastAcceptedAtRef.current = nowMs;

      const nextStep = stepIdx + 1;
      const nextSigns = signsLandedRef.current + 1;
      currentStepRef.current = nextStep;
      signsLandedRef.current = nextSigns;
      setCurrentStep(nextStep);
      setSignsLanded(nextSigns);

      if (isRankMode) {
        appendProofEvent("sign_ok", nowMs, {
          step: nextStep,
          sign: expected,
          confidence: Number(stableConfidence.toFixed(4)),
          hands: numHands,
          light: lightingStatusRef.current,
        });
      }

      if (Array.isArray(jutsu?.comboParts) && jutsu.comboParts.length > 0) {
        for (const part of jutsu.comboParts) {
          if (nextStep === part.atStep) {
            const partEffect = normalizeLabel(String(part.effect || ""));
            const partNameNorm = normalizeLabel(String(part.name || ""));
            if (partEffect === "clone") {
              comboCloneHoldRef.current = true;
            } else if (partEffect === "lightning" && partNameNorm.includes("chidori")) {
              comboChidoriTripleRef.current = comboCloneHoldRef.current;
              if (comboChidoriTripleRef.current) {
                setComboTripleEffect("chidori");
              }
            } else if (partEffect === "rasengan" && partNameNorm.includes("rasengan")) {
              comboRasenganTripleRef.current = comboCloneHoldRef.current;
              if (comboRasenganTripleRef.current) {
                setComboTripleEffect("rasengan");
              }
            }
            const cue = `${String(part.name || "Combo").toUpperCase()} CHECKPOINT`;
            pushComboCue(cue);
            playSfx("/sounds/complete.mp3", 0.7);
            triggerJutsuEffect(String(part.effect || "").toLowerCase(), 1700);
            if (isRankMode) {
              appendProofEvent("combo_trigger", nowMs, {
                step: nextStep,
                combo: String(part.name || "combo"),
                effect: String(part.effect || ""),
              });
            }
          }
        }
      }

      if (nextStep >= sequence.length) {
        finishRun(nowMs);
      }
    };

    detectRafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(detectRafRef.current);
  }, [
    activeCalibrationProfile,
    appendProofEvent,
    finalizeCalibrationRun,
    finishRun,
    isCalibrationMode,
    isRankMode,
    jutsu?.comboParts,
    playSfx,
    pushComboCue,
    restrictedSigns,
    sequence,
    triggerJutsuEffect,
  ]);

  useEffect(() => {
    const shouldAutoSubmit = !isCalibrationMode
      && !submitted
      && !submitting
      && (
        phase === "completed"
        || (!isRankMode && phase === "casting")
      );
    if (!shouldAutoSubmit || autoSubmitTriggeredRef.current) return;
    autoSubmitTriggeredRef.current = true;
    const timer = window.setTimeout(() => {
      void handleSubmitResult();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [handleSubmitResult, isCalibrationMode, isRankMode, phase, submitted, submitting]);

  useEffect(() => {
    const effect = String(activeEffect || jutsu?.effect || "").toLowerCase();
    const phoenixActive = showJutsuEffect && effect === "fire" && normalizeLabel(jutsuName).includes("phoenix");
    if (!phoenixActive) {
      if (phoenixRafRef.current) {
        cancelAnimationFrame(phoenixRafRef.current);
        phoenixRafRef.current = 0;
      }
      phoenixLastAtRef.current = 0;
      setPhoenixFireballs([]);
      return;
    }

    const anchor = effectAnchorRef.current;
    const cx = anchor?.x ?? 0.5;
    const cy = anchor?.y ?? 0.68;
    const count = 5;
    let balls: PhoenixBall[] = Array.from({ length: count }, (_, i) => {
      const spread = ((i / Math.max(1, count - 1)) * 2) - 1;
      const speed = 0.22 + (Math.random() * 0.34);
      return {
        id: i + 1,
        x: clamp(cx + ((Math.random() - 0.5) * 0.03), 0.08, 0.92),
        y: clamp(cy + ((Math.random() - 0.5) * 0.03), 0.14, 0.9),
        vx: Math.sin(spread) * speed,
        vy: -(speed * (0.7 + (Math.random() * 0.5))),
        radius: 24 + (Math.random() * 18),
      };
    });
    setPhoenixFireballs(balls);
    phoenixLastAtRef.current = 0;

    const tick = (ts: number) => {
      const prev = phoenixLastAtRef.current || ts;
      const dt = clamp((ts - prev) / 1000, 0.008, 0.035);
      phoenixLastAtRef.current = ts;
      const windBias = ((effectAnchorRef.current?.x || 0.5) - 0.5) * 0.5;

      balls = balls.map((ball) => {
        const jitterX = (Math.random() - 0.5) * 0.5;
        const jitterY = (Math.random() - 0.5) * 0.4;
        let vx = ball.vx + ((jitterX + windBias) * dt);
        let vy = ball.vy + (jitterY * dt);
        const speed = Math.hypot(vx, vy);
        if (speed > 0.78) {
          const scale = 0.78 / Math.max(0.0001, speed);
          vx *= scale;
          vy *= scale;
        }

        let x = ball.x + (vx * dt * 2.4);
        let y = ball.y + (vy * dt * 2.4);
        const minX = 0.06;
        const maxX = 0.94;
        const minY = 0.1;
        const maxY = 0.95;
        if (x < minX) {
          x = minX;
          vx = Math.abs(vx) * 0.96;
        } else if (x > maxX) {
          x = maxX;
          vx = -Math.abs(vx) * 0.96;
        }
        if (y < minY) {
          y = minY;
          vy = Math.abs(vy) * 0.96;
        } else if (y > maxY) {
          y = maxY;
          vy = -Math.abs(vy) * 0.96;
        }

        return { ...ball, x, y, vx, vy };
      });

      setPhoenixFireballs(balls);
      phoenixRafRef.current = requestAnimationFrame(tick);
    };

    phoenixRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (phoenixRafRef.current) {
        cancelAnimationFrame(phoenixRafRef.current);
        phoenixRafRef.current = 0;
      }
      phoenixLastAtRef.current = 0;
      setPhoenixFireballs([]);
    };
  }, [activeEffect, jutsu?.effect, jutsuName, showJutsuEffect]);

  const sequenceProgressPct = sequence.length > 0
    ? Math.min(100, Math.round((currentStep / sequence.length) * 100))
    : 0;
  const calibrationProgressPct = Math.min(
    100,
    Math.round((1 - (calibrationSecondsLeft / CALIBRATION_DURATION_S)) * 100),
  );
  const progressPct = isCalibrationMode ? calibrationProgressPct : sequenceProgressPct;

  const phaseLabel = phase === "active"
    ? "RUNNING"
    : phase === "casting"
      ? "CASTING"
    : phase === "completed"
      ? "COMPLETE"
      : phase === "countdown"
        ? "COUNTDOWN"
        : phase === "ready"
          ? (isRankMode ? "WAITING" : "READY")
          : phase === "error"
            ? "ERROR"
            : "LOADING";

  const iconProgressStep = (phase === "completed" || phase === "casting") ? sequence.length : currentStep;
  const nextSign = currentStep < sequence.length ? toDisplayLabel(sequence[currentStep]).toUpperCase() : "COMPLETE";

  const iconBarStatus = isCalibrationMode
    ? phase === "active"
      ? `CALIBRATING • ${Math.ceil(calibrationSecondsLeft)}S LEFT`
      : phase === "completed"
        ? "CALIBRATION COMPLETE"
        : "CAPTURE LIGHTING + CONFIDENCE PROFILE"
    : phase === "casting"
      ? `CASTING • ${String(jutsu?.displayText || "JUTSU").toUpperCase()}`
      : phase === "completed"
        ? "RUN COMPLETE"
      : phase === "countdown"
        ? "GET READY..."
        : `NEXT SIGN: ${nextSign}`;

  const hudLevel = Math.max(0, Math.floor(Number(progressionHud?.level) || 0));
  const hudXp = Math.max(0, Math.floor(Number(progressionHud?.xp) || 0));
  const hudRank = String(progressionHud?.rank || "Academy Student");
  const hudNextXp = Math.max(hudXp + 1, Math.floor(Number(progressionHud?.xpToNextLevel) || (hudXp + 1200)));
  const hudProgressPct = Math.max(0, Math.min(100, ((hudXp / hudNextXp) * 100)));
  const showNavArrows = !isCalibrationMode && canSwitchJutsuNow() && Boolean(onPrevJutsu || onNextJutsu);

  const effectLabel = String(activeEffect || jutsu?.effect || "").toLowerCase();
  const effectVideoSrc = effectLabel === "lightning"
    ? "/effects/chidori.mp4"
    : effectLabel === "rasengan"
      ? "/effects/rasengan.mp4"
      : "";
  const isPhoenixFireEffect = effectLabel === "fire" && normalizeLabel(jutsuName).includes("phoenix");
  const showSpeedHud = isRankMode && phase === "active";
  const showSignChip = phase === "active"
    && !isCalibrationMode
    && !["idle", "unknown", "no hands"].includes(normalizeLabel(detectedLabel));
  const detectedConfidencePct = Math.round(detectedConfidence * 100);
  const rawDetectedConfidencePct = Math.round(rawDetectedConfidence * 100);
  const diagCalibrationText = isCalibrationMode && phase === "active"
    ? `CALIBRATING ${calibrationProgressPct}%`
    : "PRESS C TO CALIBRATE";
  const effectAnchorX = Math.round((effectAnchor?.x ?? 0.5) * 1000) / 10;
  const effectAnchorY = Math.round((effectAnchor?.y ?? 0.64) * 1000) / 10;
  const effectScale = effectAnchor?.scale ?? 1;
  const effectBaseSize = effectLabel === "lightning"
    ? 620
    : effectLabel === "rasengan"
      ? 520
      : 560;
  const effectSizePx = Math.max(280, Math.min(920, Math.round(effectBaseSize * effectScale)));
  const tripleOffsets = comboTripleEffect !== "none" ? [-28, 0, 28] : [0];

  return (
    <div className="mx-auto w-full max-w-6xl rounded-3xl border border-ninja-border bg-ninja-panel/92 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.5)] md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-ninja-dim">
            {isCalibrationMode ? "Calibration Session" : isRankMode ? "Rank Session" : "Free Session"}
          </p>
          <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
            {isCalibrationMode ? "Detection Calibration" : jutsuName}
          </h2>
          <p className="mt-1 text-xs text-zinc-300">
            {isCalibrationMode
              ? "Capture environment profile for stable sign detection and voting thresholds."
              : (jutsu?.displayText || "Practice hand-sign execution.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleBackAction()}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-ninja-border bg-ninja-card px-4 text-sm font-black text-zinc-100 hover:border-ninja-accent/40"
        >
          <ArrowLeft className="h-4 w-4" />
          BACK
        </button>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <div className="absolute right-2 top-2 z-40 flex items-center gap-1.5 md:right-4 md:-top-[42px] md:top-auto">
            <button
              type="button"
              onClick={() => setShowModelInfo(true)}
              className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-sky-300/70 bg-[#12182d]/95 text-sky-200 hover:bg-[#1a2545]"
            >
              <Info className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setShowModelInfo(true)}
              className="inline-flex h-[30px] w-[182px] items-center justify-center rounded-[8px] border border-emerald-300/55 bg-[#1a1a23]/92 px-3 text-[11px] font-bold text-zinc-100 hover:bg-[#21212d]"
            >
              MODEL: MEDIAPIPE
            </button>
            <button
              type="button"
              onClick={() => setShowDetectionPanel((prev) => !prev)}
              className="inline-flex h-[30px] w-[126px] items-center justify-center rounded-[8px] border border-zinc-500/55 bg-[#1b1b24]/90 px-3 text-[11px] font-bold text-zinc-200 hover:bg-[#242432]"
            >
              DIAG: {showDetectionPanel ? "ON" : "OFF"}
            </button>
          </div>

          {!isCalibrationMode && (
            <div className="absolute right-2 top-11 z-40 rounded-md border border-emerald-300/40 bg-black/72 px-2 py-1 text-[10px] font-mono text-emerald-300 md:right-[5px] md:-top-[18px] md:top-auto">
              FPS {fps}
            </div>
          )}

          <div className="relative overflow-hidden rounded-2xl border border-ninja-border bg-black aspect-[4/3]">
          {!isCalibrationMode && (
            <div className="absolute inset-x-0 top-0 z-30 h-[45px] border-b border-white/10 bg-[#141419]/90">
              <p className="absolute left-5 top-1/2 -translate-y-1/2 text-xs font-bold text-white">
                {hudRank} • LV.{hudLevel}
              </p>
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
                <div className="h-[10px] w-[58vw] min-w-[180px] max-w-[400px] rounded-full bg-zinc-700">
                  <div className="h-[10px] rounded-full bg-orange-500" style={{ width: `${hudProgressPct}%` }} />
                </div>
                <p className="text-[10px] font-mono text-zinc-200">{hudXp} / {hudNextXp} XP</p>
              </div>
            </div>
          )}

          {showTwoHandsGuide && (
            <div className="absolute inset-0 z-10">
              <Image
                src="/pics/hands_layout.png"
                alt="Show both hands"
                fill
                sizes="(max-width: 1024px) 100vw, 900px"
                className="object-cover opacity-70"
              />
              <div className="absolute inset-x-0 bottom-4 flex justify-center">
                <div className="rounded-lg border border-amber-300/55 bg-black/75 px-4 py-2 text-sm font-black text-amber-200">
                  SHOW BOTH HANDS
                </div>
              </div>
            </div>
          )}

          {!!comboCue && (
            <div className="absolute inset-x-0 top-3 z-30 flex justify-center">
              <div className="rounded-lg border border-orange-300/45 bg-black/65 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-orange-200">
                {comboCue}
              </div>
            </div>
          )}

          {showSpeedHud && (
            <div className="absolute left-[15px] top-[15px] z-30 rounded-[6px] border border-orange-300/55 bg-black/75 px-3 py-1.5">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-200">
                SPEED: <span className="text-white">{formatElapsed(elapsedMs)}</span>
              </p>
            </div>
          )}

          {showSignChip && (
            <div className="absolute right-[18px] top-[15px] z-30 rounded-[8px] border border-emerald-300/55 bg-black/75 px-3 py-1.5">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-200">
                SIGN: {detectedLabel.toUpperCase()}
              </p>
            </div>
          )}

          {showDetectionPanel && (
            <div className="absolute left-[12px] top-[14px] z-30 w-[320px] rounded-[10px] border border-zinc-400/45 bg-black/68 px-[10px] py-[8px] text-[11px] font-mono text-white/90">
              <div>MODEL: MEDIAPIPE</div>
              <div>HANDS: {detectedHands}</div>
              <div>STRICT 2H: {restrictedSigns ? "ON" : "OFF"}</div>
              <div>LIGHT: {lightingStatus.toUpperCase().replace("_", " ")}</div>
              <div>VOTE {voteHits}/{VOTE_WINDOW_SIZE} • {detectedConfidencePct}%</div>
              <div>{diagCalibrationText}</div>
              <div>RAW: {rawDetectedLabel} {rawDetectedConfidencePct}%</div>
              <div>STATE: {phaseLabel}</div>
            </div>
          )}

          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={canvasRef} className="h-full w-full object-cover" />

          {showJutsuEffect && (
            <div className="pointer-events-none absolute inset-0 z-20">
              {(effectLabel === "water" || effectLabel === "clone" || effectLabel === "eye") && (
                <div
                  className={`absolute inset-0 ${
                    effectLabel === "water"
                        ? "bg-gradient-to-t from-sky-800/35 via-cyan-500/15 to-transparent"
                        : effectLabel === "clone"
                          ? "bg-gradient-to-r from-violet-500/15 via-indigo-400/15 to-violet-500/15"
                          : "bg-gradient-to-br from-red-700/20 via-fuchsia-500/15 to-transparent"
                  }`}
                />
              )}
              {effectLabel === "fire" && !isPhoenixFireEffect && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-orange-700/35 via-amber-500/20 to-transparent" />
                  <div
                    className="absolute rounded-full bg-orange-400/45 blur-2xl"
                    style={{
                      width: "160px",
                      height: "160px",
                      left: `${effectAnchorX}%`,
                      top: `${effectAnchorY}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </>
              )}
              {isPhoenixFireEffect && (
                <div className="absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-t from-orange-900/30 via-orange-500/10 to-transparent" />
                  {phoenixFireballs.map((ball) => (
                    <div
                      key={`phoenix-${ball.id}`}
                      className="absolute rounded-full mix-blend-screen"
                      style={{
                        left: `${ball.x * 100}%`,
                        top: `${ball.y * 100}%`,
                        width: `${ball.radius * 2}px`,
                        height: `${ball.radius * 2}px`,
                        transform: "translate(-50%, -50%)",
                        background: "radial-gradient(circle, rgba(255,255,220,0.86) 0%, rgba(255,165,60,0.75) 44%, rgba(255,80,30,0.24) 100%)",
                        boxShadow: "0 0 18px rgba(255,110,30,0.55), 0 0 44px rgba(255,90,20,0.35)",
                      }}
                    />
                  ))}
                </div>
              )}
              {(effectLabel === "lightning" || effectLabel === "rasengan") && effectVideoSrc && (
                <div className="absolute inset-0">
                  {tripleOffsets.map((offsetPct, idx) => (
                    <video
                      key={`effect-${effectVideoSrc}-${idx}-${offsetPct}`}
                      src={effectVideoSrc}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="absolute object-contain opacity-70 mix-blend-screen"
                      style={{
                        width: `${effectSizePx}px`,
                        height: `${effectSizePx}px`,
                        left: `calc(${effectAnchorX}% + ${offsetPct}%)`,
                        top: `${effectAnchorY}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!!xpPopupText && (
            <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center">
              <div className="rounded-lg border border-orange-300/45 bg-black/60 px-4 py-2 text-base font-black text-orange-200">
                {xpPopupText}
              </div>
            </div>
          )}

          {(phase === "loading" || phase === "error") && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70">
              {phase === "loading" ? (
                <Loader2 className="h-8 w-8 animate-spin text-ninja-accent" />
              ) : (
                <Camera className="h-8 w-8 text-red-300" />
              )}
              <p className={`px-4 text-center text-sm ${phase === "error" ? "text-red-200" : "text-zinc-200"}`}>
                {phase === "error" ? errorMessage : loadingMessage}
              </p>
            </div>
          )}

          {phase === "ready" && isRankMode && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/58 px-4">
              <div className="w-full max-w-md rounded-2xl border border-orange-300/45 bg-zinc-950/80 p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
                <p className="text-2xl font-black text-orange-200">PRESS [SPACE] TO START</p>
                <p className="mt-2 text-sm text-zinc-200">Perform the sequence as fast as possible.</p>
                <div className="mt-3 text-left text-xs text-zinc-300">
                  <p>1. Timer starts on GO.</p>
                  <p>2. Detect all signs in order.</p>
                  <p>3. Timer stops on final sign.</p>
                </div>
              </div>
            </div>
          )}

          {phase === "ready" && isCalibrationMode && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-black/58 text-center">
              <p className="text-2xl font-black text-amber-200">CALIBRATION READY</p>
              <p className="max-w-xl px-4 text-sm text-zinc-200">
                Keep both hands visible and perform signs naturally for 12 seconds.
              </p>
            </div>
          )}

          {phase === "countdown" && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55">
              <p className="text-7xl font-black text-orange-300 drop-shadow-[0_0_18px_rgba(255,160,80,0.5)]">
                {countdown > 0 ? countdown : "GO"}
              </p>
            </div>
          )}

          {phase === "casting" && !isCalibrationMode && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 px-5">
              <div className="w-full max-w-md rounded-2xl border border-orange-300/40 bg-zinc-950/82 p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-orange-200">Casting</p>
                <p className="mt-2 text-2xl font-black text-white">{String(jutsu?.displayText || "JUTSU")}</p>
                <p className="mt-2 text-sm text-zinc-200">{formatElapsed(elapsedMs)} • {signsLanded}/{sequence.length} signs</p>
              </div>
            </div>
          )}

          {phase === "completed" && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 px-5">
              <div className={`w-full ${isRankMode ? "max-w-md" : "max-w-sm"} rounded-2xl border bg-zinc-950/82 p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.55)] ${
                isRankMode ? "border-orange-300/45" : "border-emerald-300/35"
              }`}>
                <CheckCircle2 className={`mx-auto h-10 w-10 ${isRankMode ? "text-orange-200" : "text-emerald-300"}`} />
                <p className="mt-2 text-xl font-black text-white">
                  {isCalibrationMode ? "CALIBRATION COMPLETE" : isRankMode ? "RESULTS" : "RUN COMPLETE"}
                </p>
                {!isCalibrationMode && (
                  <>
                    <p className="mt-2 text-3xl font-black text-emerald-200">{formatElapsed(elapsedMs)}</p>
                    <p className="mt-1 text-sm text-zinc-200">Signs: {signsLanded}/{sequence.length}</p>
                  </>
                )}
                {!!submitStatus && <p className="mt-3 text-sm font-bold text-emerald-200">{submitStatus}</p>}
                {!!submitDetail && <p className="mt-1 text-xs text-zinc-200">{submitDetail}</p>}
                {!!rankInfo && <p className="mt-1 text-xs font-bold text-amber-200">{rankInfo}</p>}
                {isRankMode && (
                  <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    Press Space to ready up • Esc to exit
                  </p>
                )}
              </div>
            </div>
          )}
          </div>

          {showNavArrows && (
            <>
              <button
                type="button"
                onClick={() => handleSwitchJutsu("prev")}
                className="absolute left-0 top-1/2 z-30 hidden h-[60px] w-[50px] -translate-x-[70px] -translate-y-1/2 items-center justify-center rounded-[10px] border-2 border-orange-300/65 bg-black/55 text-white hover:bg-black/75 md:inline-flex"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleSwitchJutsu("next")}
                className="absolute right-0 top-1/2 z-30 hidden h-[60px] w-[50px] translate-x-[70px] -translate-y-1/2 items-center justify-center rounded-[10px] border-2 border-orange-300/65 bg-black/55 text-white hover:bg-black/75 md:inline-flex"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-ninja-border bg-ninja-bg/45 p-4">
          <p className="text-center text-sm font-black uppercase tracking-[0.12em] text-ninja-accent">
            {iconBarStatus}
          </p>
          <div className="mt-3 h-2 rounded-full bg-zinc-700">
            <div className="h-2 rounded-full bg-orange-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>

          {!isCalibrationMode && (
            <>
              <div className="mt-4 flex items-start justify-start gap-3 overflow-x-auto pb-2">
                {sequence.map((sign, index) => {
                  const signState =
                    (phase === "completed" || phase === "casting") && index < iconProgressStep
                      ? "casting"
                      : index < iconProgressStep
                        ? "done"
                        : index === iconProgressStep && phase === "active"
                          ? "active"
                          : "pending";
                  return (
                    <SignTile
                      key={`${sign}-${index}`}
                      sign={sign}
                      index={index}
                      state={signState}
                    />
                  );
                })}
              </div>

              <div className="mt-3 text-right text-xs font-mono text-zinc-300">
                {iconProgressStep}/{sequence.length}
              </div>
            </>
          )}

          {isCalibrationMode && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-ninja-border bg-black/30 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Time Left</p>
                <p className="text-lg font-black text-white">{Math.max(0, Math.ceil(calibrationSecondsLeft))}s</p>
              </div>
              <div className="rounded-lg border border-ninja-border bg-black/30 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Samples</p>
                <p className="text-lg font-black text-white">{calibrationSamples}</p>
              </div>
              <div className="rounded-lg border border-ninja-border bg-black/30 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Vote Rule</p>
                <p className="text-lg font-black text-white">
                  {activeCalibrationProfile.voteRequiredHits} / {Math.round(activeCalibrationProfile.voteMinConfidence * 100)}%
                </p>
              </div>
            </div>
          )}
        </div>

        {!isCalibrationMode && (
          <div className="relative h-5 text-[11px] text-zinc-400">
            <span className="absolute left-1/2 -translate-x-1/2">Press ESC to exit</span>
            <span className="absolute right-0">[C] Calibrate</span>
          </div>
        )}

        {isCalibrationMode && (
          <div className="text-[11px] text-zinc-400">
            {phase === "active"
              ? "Calibrating..."
              : "Press ESC to exit"}
          </div>
        )}
      </div>

      {showModelInfo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close model info"
            onClick={() => setShowModelInfo(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-blue-300/35 bg-zinc-950/95 p-5 shadow-[0_20px_55px_rgba(0,0,0,0.6)]">
            <p className="text-sm font-black uppercase tracking-wide text-blue-200">Model Locked</p>
            <p className="mt-2 text-sm text-zinc-200">
              YOLO switching is disabled in web play. MediaPipe is enforced to keep detection timing and leaderboard validation standardized.
            </p>
            <button
              type="button"
              onClick={() => setShowModelInfo(false)}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-blue-300/45 bg-blue-900/35 px-4 text-xs font-black uppercase tracking-wide text-blue-100 hover:bg-blue-800/45"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
