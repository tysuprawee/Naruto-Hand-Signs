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
import { getXpForLevel } from "@/utils/progression";
import FireballThreeOverlay from "@/app/play/effects/fireball-three-overlay";
import SharinganCrowOverlay from "@/app/play/effects/sharingan-crow-overlay";
import WaterDragonOverlay from "@/app/play/effects/water-dragon-overlay";
import {
  applyTemporalVote,
  DEFAULT_FILTERS,
  evaluateLighting,
  finalizeCalibration,
  type CalibrationProfile,
  type CalibrationSample,
  type VoteEntry,
  type VoteStableState,
} from "@/utils/detection-filters";

type ArenaPhase = "loading" | "ready" | "countdown" | "active" | "casting" | "completed" | "error";
type PlayMode = "free" | "rank" | "calibration";
type CameraRuntimeFailure = "none" | "disconnected" | "blocked";

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
  detectForVideo?: (video: HTMLVideoElement, nowMs: number) => HandsResultShape;
  detect?: (video: HTMLVideoElement) => HandsResultShape;
  close?: () => void;
}

interface FaceResultShape {
  faceLandmarks?: Landmark[][];
  faceBlendshapes?: Array<{
    categories?: Array<{
      categoryName?: string;
      displayName?: string;
      category_name?: string;
      score?: number;
    }>;
  }>;
}

interface FaceLandmarkerLike {
  detectForVideo?: (video: HTMLVideoElement, nowMs: number) => FaceResultShape;
  detect?: (video: HTMLVideoElement) => FaceResultShape;
  close?: () => void;
}

interface SelfieSegmentationResultShape {
  segmentationMask: CanvasImageSource;
  image: CanvasImageSource;
}

interface SelfieSegmentationLike {
  setOptions?: (options: Record<string, unknown>) => void;
  onResults: (listener: (results: SelfieSegmentationResultShape) => void) => void;
  send: (options: { image: HTMLVideoElement }) => Promise<void> | void;
  close?: () => void;
}

interface EffectAnchor {
  x: number;
  y: number;
  scale: number;
}

interface HandSlotState {
  center: [number, number, number];
  coords: number[];
  missingFrames: number;
}

interface PhoenixBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface FaceMotionState {
  anchor: { x: number; y: number } | null;
  yaw: number;
  pitch: number;
}

interface SharinganVisualPose {
  angleDeg: number;
  leftEye: { x: number; y: number; sizePct: number };
  rightEye: { x: number; y: number; sizePct: number };
  leftBlood: { x: number; y: number; widthPct: number; heightPct: number };
  rightBlood: { x: number; y: number; widthPct: number; heightPct: number };
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
  effectDurationMs?: number;
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
  ramTigerShared: boolean;
  easyMode: boolean;
  debugHands: boolean;
  viewportFit?: boolean;
  noEffects?: boolean;
  busy?: boolean;
  sfxVolume?: number;
  cameraIdx?: number;
  resolutionIdx?: number;
  datasetVersion?: string;
  datasetChecksum?: string;
  datasetUrl?: string;
  datasetSyncedAt?: number;
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
const TWO_HANDS_GUIDE_DELAY_MS = 500;
const EFFECT_DEFAULT_DURATION_MS = 5000;
const CAMERA_STALL_TIMEOUT_MS = 1400;
const HAND_FEATURE_LENGTH = 63;
const HAND_SLOT_HOLD_FRAMES = 8;
const HAND_SLOT_DECAY_PER_FRAME = 0.92;
const GAME_MIN_CONFIDENCE = 0.2;
const VOTE_OCCLUSION_GRACE_MS = 240;
const VOTE_REUSE_CONF_DECAY = 0.90;
const LOW_FPS_ASSIST_THRESHOLD = 12;
const DEBUG_HANDS_MIN_FPS = 10;
const RENDER_FRAME_INTERVAL_MS = 1000 / 30;
const LOW_FPS_VOTE_TTL_MS = 1400;
const KNN_IDLE_DIST_THRESHOLD = 1.8;
const ONE_HAND_PASS_GATE_MIN_CONFIDENCE = 0.60;
const ONE_HAND_ASSIST_IDLE_THRESHOLD = 3.2;
const ONE_HAND_EXPECTED_SIGN_DIST_THRESHOLD = 2.4;
const ONE_HAND_EXPECTED_IDLE_MARGIN = 0.18;
const FULL_FEATURE_LENGTH = HAND_FEATURE_LENGTH * 2;
const TWO_HAND_EXEC_DISTANCE_MAX = 0.2;
const LEFT_HAND_FEATURE_MASK = Array.from({ length: HAND_FEATURE_LENGTH }, (_, i) => i);
const RIGHT_HAND_FEATURE_MASK = Array.from({ length: HAND_FEATURE_LENGTH }, (_, i) => i + HAND_FEATURE_LENGTH);
const FACE_ANCHOR_STICKY_MS = 2000;
const DEFAULT_MOUTH_ANCHOR = { x: 0.5, y: 0.5 };
const FIRE_MOUTH_OFFSET_X_PCT = -40.5;
const FIRE_MOUTH_OFFSET_Y_PCT = -35;
const CLONE_SEGMENTATION_INTERVAL_MS = 33;
const CLONE_SPAWN_DELAY_MS = 1500;
const COMBO_PART_EFFECT_DURATION_MS = 1700;
const COMBO_CLONE_HOLD_DURATION_MS = 120000;
const SHARINGAN_BLINK_THRESHOLD = 0.4;
const SHARINGAN_BLINK_HOLD_MS = 1500;
const SHARINGAN_BLOOD_BASE_NAME = "/eyeblood/f4aa41aa-86ca-4142-a969-2024f75bdf7b-";
const SHARINGAN_BLOOD_FRAME_START = 11;
const SHARINGAN_BLOOD_FRAME_END = 199;
const SHARINGAN_BLOOD_FRAME_RATE = 24;
const SHARINGAN_POSE_POS_LERP = 0.42;
const SHARINGAN_POSE_SIZE_LERP = 0.34;
const SHARINGAN_POSE_ANGLE_LERP = 0.28;
const SHARINGAN_LEFT_EYELID_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const SHARINGAN_RIGHT_EYELID_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const SHARINGAN_EYE_BLEND = 0.65;
const SHARINGAN_EYE_SHADOW = 0.4;
const SHARINGAN_EYE_LIGHT = 0.95;
const SHARINGAN_EYE_GLOW = 0.6;
const SHARINGAN_EYE_REFLECT = 0.35;

const SHADOW_CLONE_OFFSET_RATIO = 0.3;
const SHADOW_CLONE_SCALE = 1.0;
const SHADOW_CLONE_OPACITY = 0.92;
const SHADOW_CLONE_ENTER_DURATION_MS = 650;
const SHADOW_CLONE_BLINK_SPEED = 24.0;
const SHADOW_CLONE_BLINK_DEPTH = 0.5;
const SHADOW_CLONE_SMOKE_ENABLED = true;
const SHADOW_CLONE_SMOKE_OPACITY = 0.65;
const SHADOW_CLONE_SMOKE_SCALE = 1.2;
const SHADOW_CLONE_SMOKE_RISE = 0.14;
const SHADOW_CLONE_SMOKE_MASK_TO_CLONE = false;
const SHADOW_CLONE_SMOKE_BASE_NAME = "/smoke/cf7378e5-58a9-4967-af50-904b2d11ecdd-";
const SHADOW_CLONE_SMOKE_FRAME_START = 0;
const SHADOW_CLONE_SMOKE_FRAME_END = 55;

const REAPER_BG_IMAGE_PATH = "/effects/reaper_death_bg.jpg";
const REAPER_BG_BASE_SCALE = 1.03;
const REAPER_BG_ZOOM_AMP = 0.08;
const REAPER_BG_ZOOM_HZ = 0.22;
const REAPER_BG_FLOAT_X_AMP = 14;
const REAPER_BG_FLOAT_Y_AMP = 20;
const REAPER_BG_FLOAT_HZ = 0.16;
const REAPER_BG_Y_OFFSET = -30;
const REAPER_BG_KEEP_RATIO = 0.4;
const REAPER_BG_DARKEN_ALPHA = 0.42;
const REAPER_PERSON_BRIGHTNESS = 0.82;
const REAPER_PERSON_DARKNESS = 0.78;
const REAPER_FADE_IN_MS = 900;
const REAPER_FADE_OUT_MS = 900;

const CALIBRATION_DURATION_S = 12;
const CALIBRATION_MIN_SAMPLES = 100;
const CALIBRATION_MAX_SAMPLES = 1200;

const RESOLUTION_OPTIONS: Array<{ width: number; height: number }> = [
  { width: 640, height: 480 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

const MEDIAPIPE_CONSOLE_NOISE_PATTERNS: RegExp[] = [
  /Created TensorFlow Lite XNNPACK delegate for CPU\.?/i,
  /OpenGL error checking is disabled/i,
  /FaceBlendshapesGraph acceleration to xnnpack/i,
];

function shouldSuppressMediapipeConsoleNoise(args: unknown[]): boolean {
  if (!Array.isArray(args) || args.length === 0) return false;
  for (const arg of args) {
    const text = arg instanceof Error
      ? `${arg.name}: ${arg.message}`
      : String(arg ?? "");
    if (!text) continue;
    if (MEDIAPIPE_CONSOLE_NOISE_PATTERNS.some((pattern) => pattern.test(text))) {
      return true;
    }
  }
  return false;
}

function withSuppressedMediapipeConsole<T>(run: () => T): T {
  if (typeof window === "undefined") {
    return run();
  }

  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  const wrap = <TArgs extends unknown[]>(fn: (...args: TArgs) => void) => ((...args: TArgs) => {
    if (shouldSuppressMediapipeConsoleNoise(args)) return;
    fn(...args);
  });

  console.error = wrap(originalError);
  console.warn = wrap(originalWarn);
  console.info = wrap(originalInfo);

  try {
    return run();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
    console.info = originalInfo;
  }
}

async function withSuppressedMediapipeConsoleAsync<T>(run: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined") {
    return run();
  }

  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  const wrap = <TArgs extends unknown[]>(fn: (...args: TArgs) => void) => ((...args: TArgs) => {
    if (shouldSuppressMediapipeConsoleNoise(args)) return;
    fn(...args);
  });

  console.error = wrap(originalError);
  console.warn = wrap(originalWarn);
  console.info = wrap(originalInfo);

  try {
    return await run();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
    console.info = originalInfo;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function didPassPhase(prevPhase: number | null, currentPhase: number, targetPhase: number): boolean {
  if (prevPhase === null || prevPhase === undefined) return false;
  if (prevPhase <= currentPhase) {
    return prevPhase <= targetPhase && targetPhase <= currentPhase;
  }
  return prevPhase <= targetPhase || targetPhase <= currentPhase;
}

function toNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function shortDatasetChecksum(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
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

type DatasetRow = Record<string, string | number>;

const DATASET_LABEL_ROWS_CACHE = new Map<string, DatasetRow[]>();
const DATASET_FULL_ROWS_CACHE = new Map<string, DatasetRow[]>();
const SFX_AUDIO_CACHE = new Map<string, HTMLAudioElement>();
const SFX_PRELOAD_PROMISES = new Map<string, Promise<boolean>>();
const SFX_PERSISTED_READY_KEY = "jutsu-play-sfx-ready-v1";
const SFX_PERSISTED_READY_PATHS = new Set<string>();
let SFX_PERSISTED_READY_HYDRATED = false;

function hydratePersistedSfxReadyPaths(): void {
  if (SFX_PERSISTED_READY_HYDRATED || typeof window === "undefined") return;
  SFX_PERSISTED_READY_HYDRATED = true;
  try {
    const raw = window.localStorage.getItem(SFX_PERSISTED_READY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const value of parsed) {
      const path = String(value || "").trim();
      if (!path) continue;
      SFX_PERSISTED_READY_PATHS.add(path);
    }
  } catch {
    // Ignore malformed storage.
  }
}

function persistSfxReadyPath(path: string): void {
  if (typeof window === "undefined") return;
  const normalized = String(path || "").trim();
  if (!normalized) return;
  hydratePersistedSfxReadyPaths();
  if (SFX_PERSISTED_READY_PATHS.has(normalized)) return;
  SFX_PERSISTED_READY_PATHS.add(normalized);
  try {
    const trimmed = [...SFX_PERSISTED_READY_PATHS].slice(-80);
    window.localStorage.setItem(SFX_PERSISTED_READY_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore localStorage write failures.
  }
}

function getCachedDatasetRowsForVersion(versionToken: string): Map<string, DatasetRow[]> {
  const prefix = `${versionToken}:`;
  const out = new Map<string, DatasetRow[]>();
  for (const [cacheKey, rows] of DATASET_LABEL_ROWS_CACHE.entries()) {
    if (!cacheKey.startsWith(prefix)) continue;
    const label = cacheKey.slice(prefix.length);
    if (!label) continue;
    out.set(label, rows);
  }
  return out;
}

function parseCsv(text: string): DatasetRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: DatasetRow[] = [];

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

function buildDatasetVersionToken(version: string): string {
  const token = String(version || "").trim();
  return token || "local";
}

function appendDatasetVersion(url: string, versionToken: string): string {
  const base = String(url || "").trim() || "/mediapipe_signs_db.csv";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}v=${encodeURIComponent(versionToken)}`;
}

function isLikelyLowPowerMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = Number((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints || 0);
  const isIOS = /iPhone|iPod|iPad/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (!isIOS) return false;
  if (typeof window === "undefined") return true;
  const smallestEdge = Math.min(window.screen?.width || 0, window.screen?.height || 0);
  // iPhone-class screen sizes only; keep iPad on standard pipeline.
  return smallestEdge > 0 && smallestEdge <= 430;
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

function getRequiredDatasetLabels(sequence: string[], ramTigerShared: boolean): string[] {
  const labels = new Set<string>(["idle"]);
  for (const raw of sequence) {
    const normalized = normalizeLabel(raw);
    if (!normalized) continue;
    labels.add(normalized);
    if (ramTigerShared && (normalized === "ram" || normalized === "tiger")) {
      labels.add("ram");
      labels.add("tiger");
    }
  }
  return [...labels];
}

function signsEquivalent(a: string, b: string, ramTigerShared: boolean): boolean {
  if (a === b) return true;
  if (!ramTigerShared) return false;
  return (a === "ram" && b === "tiger") || (a === "tiger" && b === "ram");
}

function signsMatch(
  detectedSign: string,
  detectedConfidence: number,
  targetSign: string,
  rawDetectedSign: string,
  rawDetectedConfidence: number,
  voteMinConfidence: number,
  ramTigerShared: boolean,
): boolean {
  const target = normalizeLabel(targetSign);
  if (!target || target === "idle") return false;
  const minConf = clamp(Number(voteMinConfidence || 0), 0, 1);

  const stable = normalizeLabel(detectedSign);
  if (signsEquivalent(stable, target, ramTigerShared) && Number(detectedConfidence || 0) >= minConf) {
    return true;
  }

  const raw = normalizeLabel(rawDetectedSign);
  return signsEquivalent(raw, target, ramTigerShared) && Number(rawDetectedConfidence || 0) >= minConf;
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

function palmCenter(landmarks: Landmark[]): [number, number, number] {
  const idxs = [0, 5, 9, 13, 17];
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let count = 0;
  for (const idx of idxs) {
    const point = landmarks[idx];
    if (!point) continue;
    sx += point.x;
    sy += point.y;
    sz += point.z;
    count += 1;
  }
  if (count <= 0) return [0, 0, 0];
  return [sx / count, sy / count, sz / count];
}

function computeTwoHandDistance(
  landmarks: Landmark[][],
  frameWidth: number,
  frameHeight: number,
): { norm: number; px: number } | null {
  if (!Array.isArray(landmarks) || landmarks.length < 2) return null;
  const centers: Array<[number, number, number]> = [];
  for (const hand of landmarks) {
    if (!Array.isArray(hand) || hand.length < 21) continue;
    centers.push(palmCenter(hand));
    if (centers.length >= 2) break;
  }
  if (centers.length < 2) return null;

  const dx = centers[0][0] - centers[1][0];
  const dy = centers[0][1] - centers[1][1];
  const norm = Math.hypot(dx, dy);
  const px = Math.hypot(dx * Math.max(1, frameWidth), dy * Math.max(1, frameHeight));
  return { norm, px };
}

function centerDistanceSq(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = (a[2] - b[2]) * 0.5;
  return dx * dx + dy * dy + dz * dz;
}

function assignDetectionsToSlots(
  detections: Array<{ coords: number[]; center: [number, number, number]; handedness: string }>,
  slots: [HandSlotState | null, HandSlotState | null],
): Array<{ coords: number[]; center: [number, number, number]; handedness: string } | null> {
  const assigned: Array<{ coords: number[]; center: [number, number, number]; handedness: string } | null> = [null, null];
  if (detections.length <= 0) return assigned;

  const prev0 = slots[0]?.center || null;
  const prev1 = slots[1]?.center || null;

  if (detections.length === 1) {
    const det = detections[0];
    let slotIdx = 0;
    if (prev0 && prev1) {
      slotIdx = centerDistanceSq(det.center, prev0) <= centerDistanceSq(det.center, prev1) ? 0 : 1;
    } else if (prev0) {
      slotIdx = 0;
    } else if (prev1) {
      slotIdx = 1;
    } else if (det.handedness === "right") {
      slotIdx = 1;
    } else if (det.handedness === "left") {
      slotIdx = 0;
    } else {
      slotIdx = slots[0] ? 1 : 0;
    }
    assigned[slotIdx] = det;
    return assigned;
  }

  const detA = detections[0];
  const detB = detections[1];
  if (prev0 && prev1) {
    const nativeCost = centerDistanceSq(detA.center, prev0) + centerDistanceSq(detB.center, prev1);
    const swappedCost = centerDistanceSq(detA.center, prev1) + centerDistanceSq(detB.center, prev0);
    if (nativeCost <= swappedCost) {
      assigned[0] = detA;
      assigned[1] = detB;
    } else {
      assigned[0] = detB;
      assigned[1] = detA;
    }
    return assigned;
  }

  if (prev0 && !prev1) {
    const first = centerDistanceSq(detA.center, prev0) <= centerDistanceSq(detB.center, prev0) ? detA : detB;
    assigned[0] = first;
    assigned[1] = first === detA ? detB : detA;
    return assigned;
  }

  if (prev1 && !prev0) {
    const first = centerDistanceSq(detA.center, prev1) <= centerDistanceSq(detB.center, prev1) ? detA : detB;
    assigned[1] = first;
    assigned[0] = first === detA ? detB : detA;
    return assigned;
  }

  const left = detections.find((det) => det.handedness === "left");
  const right = detections.find((det) => det.handedness === "right");
  if (left && right) {
    assigned[0] = left;
    assigned[1] = right;
    return assigned;
  }

  const sortedByX = [...detections].sort((a, b) => a.center[0] - b.center[0]);
  assigned[0] = sortedByX[0] || null;
  assigned[1] = sortedByX[1] || null;
  return assigned;
}

function buildFeatures(
  result: HandsResultShape,
  slots: [HandSlotState | null, HandSlotState | null],
): { features: number[]; numHands: number; imputedHands: number; effectiveHands: number } {
  const landmarks = result.landmarks ?? [];
  const numHands = landmarks.length;
  if (numHands <= 0) {
    for (let slotIdx = 0; slotIdx < 2; slotIdx += 1) {
      const slot = slots[slotIdx];
      if (!slot) continue;
      slot.missingFrames += 1;
      if (slot.missingFrames > HAND_SLOT_HOLD_FRAMES) {
        slots[slotIdx] = null;
      }
    }
    return { features: [], numHands: 0, imputedHands: 0, effectiveHands: 0 };
  }

  const detections: Array<{ coords: number[]; center: [number, number, number]; handedness: string }> = [];
  for (let i = 0; i < landmarks.length; i += 1) {
    const hand = landmarks[i] ?? [];
    if (hand.length < 21) continue;
    const normalized = normalizeHand(hand);
    if (normalized.length !== HAND_FEATURE_LENGTH) continue;
    const handedness = getHandednessLabel(result, i);
    detections.push({
      coords: normalized,
      center: palmCenter(hand),
      handedness,
    });
    if (detections.length >= 2) break;
  }

  const assigned = assignDetectionsToSlots(detections, slots);
  const features: number[] = [];
  let imputedHands = 0;

  for (let slotIdx = 0; slotIdx < 2; slotIdx += 1) {
    const detected = assigned[slotIdx];
    if (detected) {
      slots[slotIdx] = {
        center: detected.center,
        coords: detected.coords,
        missingFrames: 0,
      };
      features.push(...detected.coords);
      continue;
    }

    const slot = slots[slotIdx];
    if (slot && slot.missingFrames < HAND_SLOT_HOLD_FRAMES) {
      const nextMissing = slot.missingFrames + 1;
      slot.missingFrames = nextMissing;
      const decay = HAND_SLOT_DECAY_PER_FRAME ** nextMissing;
      for (const value of slot.coords) {
        features.push(value * decay);
      }
      imputedHands += 1;
      continue;
    }

    slots[slotIdx] = null;
    for (let i = 0; i < HAND_FEATURE_LENGTH; i += 1) {
      features.push(0);
    }
  }

  return {
    features,
    numHands,
    imputedHands,
    effectiveHands: numHands + imputedHands,
  };
}

function mirrorNormalizedHand(hand: number[]): number[] {
  if (!Array.isArray(hand) || hand.length === 0) return [];
  const out = hand.slice();
  for (let i = 0; i < out.length; i += 3) {
    out[i] = -out[i];
  }
  return out;
}

type OneHandAssistCandidate = {
  features: number[];
  featureMask: number[] | null;
};

function buildOneHandAssistCandidates(result: HandsResultShape, baseFeatures: number[]): OneHandAssistCandidate[] {
  const landmarks = result.landmarks ?? [];
  const firstHand = landmarks[0] ?? null;
  if (!firstHand) return [{ features: baseFeatures, featureMask: null }];
  const normalized = normalizeHand(firstHand);
  if (normalized.length !== HAND_FEATURE_LENGTH) return [{ features: baseFeatures, featureMask: null }];

  const zeros = new Array(HAND_FEATURE_LENGTH).fill(0);
  const mirrored = mirrorNormalizedHand(normalized);
  const variants: OneHandAssistCandidate[] = [
    { features: baseFeatures, featureMask: null },
    { features: [...normalized, ...zeros], featureMask: LEFT_HAND_FEATURE_MASK },
    { features: [...zeros, ...normalized], featureMask: RIGHT_HAND_FEATURE_MASK },
    { features: [...mirrored, ...zeros], featureMask: LEFT_HAND_FEATURE_MASK },
    { features: [...zeros, ...mirrored], featureMask: RIGHT_HAND_FEATURE_MASK },
    // Fallback for symmetric two-hand rows.
    { features: [...normalized, ...normalized], featureMask: null },
    { features: [...mirrored, ...mirrored], featureMask: null },
  ];

  const seen = new Set<string>();
  const deduped: OneHandAssistCandidate[] = [];
  for (const candidate of variants) {
    if (candidate.features.length !== FULL_FEATURE_LENGTH) continue;
    const featureKey = candidate.features.map((value) => Number(value || 0).toFixed(6)).join("|");
    const maskKey = candidate.featureMask && candidate.featureMask.length > 0
      ? candidate.featureMask.join(",")
      : "all";
    const key = `${featureKey}::${maskKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function predictWithOneHandAssist(
  knn: KNNClassifier,
  result: HandsResultShape,
  baseFeatures: number[],
  expectedSignRaw: string,
  lowFpsMode: boolean,
) {
  const candidatesAll = buildOneHandAssistCandidates(result, baseFeatures);
  const candidates = lowFpsMode ? candidatesAll.slice(0, 3) : candidatesAll;
  const expectedSign = normalizeLabel(expectedSignRaw);
  let best: { label: string; confidence: number; distance: number } | null = null;
  let bestExpectedDist = Number.POSITIVE_INFINITY;
  let bestIdleDist = Number.POSITIVE_INFINITY;
  const trackedLabels = expectedSign && expectedSign !== "idle"
    ? ["idle", expectedSign]
    : ["idle"];

  for (const candidate of candidates) {
    const prediction = knn.predictNearestWithConfidence(candidate.features, {
      idleDistanceThreshold: ONE_HAND_ASSIST_IDLE_THRESHOLD,
      featureMask: candidate.featureMask,
      trackLabels: trackedLabels,
    });
    const label = normalizeLabel(prediction.label || "idle");
    const confidence = Math.max(0, Number(prediction.confidence || 0));
    const distance = Number.isFinite(prediction.distance) ? Number(prediction.distance) : Number.POSITIVE_INFINITY;
    const isIdle = label === "idle" || label === "unknown";
    const idleDist = Number(prediction.trackedDistances.idle);
    if (idleDist < bestIdleDist) {
      bestIdleDist = idleDist;
    }

    if (expectedSign && expectedSign !== "idle" && Number.isFinite(Number(prediction.trackedDistances[expectedSign]))) {
      const expectedDist = Number(prediction.trackedDistances[expectedSign]);
      if (expectedDist < bestExpectedDist) {
        bestExpectedDist = expectedDist;
      }
    }

    if (!best) {
      best = { label, confidence, distance };
      continue;
    }

    const bestIsIdle = best.label === "idle" || best.label === "unknown";
    if (bestIsIdle && !isIdle) {
      best = { label, confidence, distance };
      continue;
    }
    if (bestIsIdle === isIdle && confidence > best.confidence) {
      best = { label, confidence, distance };
      continue;
    }
    if (bestIsIdle === isIdle && Math.abs(confidence - best.confidence) <= 1e-9 && distance < best.distance) {
      best = { label, confidence, distance };
    }

  }

  if (
    expectedSign
    && expectedSign !== "idle"
    && best
    && (best.label === "idle" || best.label === "unknown")
    && Number.isFinite(bestExpectedDist)
    && Number.isFinite(bestIdleDist)
    && bestExpectedDist <= ONE_HAND_EXPECTED_SIGN_DIST_THRESHOLD
    && (bestExpectedDist + ONE_HAND_EXPECTED_IDLE_MARGIN) <= bestIdleDist
  ) {
    return {
      label: expectedSign,
      confidence: clamp(1 - (bestExpectedDist / ONE_HAND_EXPECTED_SIGN_DIST_THRESHOLD), 0, 1),
      distance: bestExpectedDist,
    };
  }

  return best || { label: "idle", confidence: 0, distance: Number.POSITIVE_INFINITY };
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

function computeFaceMotion(landmarks: Landmark[]): FaceMotionState {
  if (!Array.isArray(landmarks) || landmarks.length < 264) {
    return { anchor: null, yaw: 0, pitch: 0 };
  }

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[1];
  const mouthUpper = landmarks[13];
  const mouthLower = landmarks[14];

  if (!leftEye || !rightEye || !nose || !mouthUpper || !mouthLower) {
    return { anchor: null, yaw: 0, pitch: 0 };
  }

  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const mouthY = (mouthUpper.y + mouthLower.y) / 2;
  const eyeDist = Math.max(0.06, Math.abs(rightEye.x - leftEye.x));

  const yaw = clamp((eyeCenterX - nose.x) / eyeDist, -1, 1);
  const pitch = clamp((((mouthY - eyeCenterY) / eyeDist) - 0.35) * 1.2, -1, 1);

  return {
    anchor: {
      x: clamp(1 - ((mouthUpper.x + mouthLower.x) / 2), 0.04, 0.96),
      y: clamp(mouthY, 0.1, 0.9),
    },
    yaw,
    pitch,
  };
}

function getFaceBlendshapeScore(faceResult: FaceResultShape, targetName: string): number {
  const blendshapes = faceResult.faceBlendshapes ?? [];
  if (!Array.isArray(blendshapes) || blendshapes.length <= 0) return 0;
  const normalize = (value: string) => String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
  const wanted = normalize(targetName);
  for (const entry of blendshapes) {
    const categories = entry?.categories ?? [];
    if (!Array.isArray(categories)) continue;
    for (const category of categories) {
      const rawName = String(category?.categoryName ?? category?.displayName ?? category?.category_name ?? "");
      if (!rawName) continue;
      if (normalize(rawName) !== wanted) continue;
      return clamp(Number(category?.score || 0), 0, 1);
    }
  }
  return 0;
}

function buildSharinganVisualPose(landmarks: Landmark[]): SharinganVisualPose | null {
  if (!Array.isArray(landmarks) || landmarks.length < 474) return null;

  const leftIris = landmarks[468];
  const rightIris = landmarks[473];
  const leftOuter = landmarks[33];
  const leftInner = landmarks[133];
  const rightOuter = landmarks[362];
  const rightInner = landmarks[263];
  if (!leftIris || !rightIris || !leftOuter || !leftInner || !rightOuter || !rightInner) return null;

  const mirrorX = (x: number) => clamp(1 - x, 0.02, 0.98);
  const clampY = (y: number) => clamp(y, 0.04, 0.96);

  const leftSocketCenter = {
    x: mirrorX((leftOuter.x + leftInner.x) * 0.5),
    y: clampY((leftOuter.y + leftInner.y) * 0.5),
  };
  const rightSocketCenter = {
    x: mirrorX((rightOuter.x + rightInner.x) * 0.5),
    y: clampY((rightOuter.y + rightInner.y) * 0.5),
  };

  const leftIrisPos = { x: mirrorX(leftIris.x), y: clampY(leftIris.y) };
  const rightIrisPos = { x: mirrorX(rightIris.x), y: clampY(rightIris.y) };

  const leftSpan = Math.hypot(leftOuter.x - leftInner.x, leftOuter.y - leftInner.y);
  const rightSpan = Math.hypot(rightOuter.x - rightInner.x, rightOuter.y - rightInner.y);
  const leftEyeSizePct = clamp(leftSpan * 42, 5, 24);
  const rightEyeSizePct = clamp(rightSpan * 42, 5, 24);

  const bloodYOffsetLeft = leftSpan * 0.2016;
  const bloodYOffsetRight = rightSpan * 0.2016;

  const leftBloodWidthPct = clamp(leftEyeSizePct * 2.5, 8, 36);
  const leftBloodHeightPct = clamp(leftEyeSizePct * 7.0, 18, 70);
  const rightBloodWidthPct = clamp(rightEyeSizePct * 2.5, 8, 36);
  const rightBloodHeightPct = clamp(rightEyeSizePct * 7.0, 18, 70);

  const angleDeg = Math.atan2(
    rightSocketCenter.y - leftSocketCenter.y,
    rightSocketCenter.x - leftSocketCenter.x,
  ) * (180 / Math.PI);

  return {
    angleDeg,
    leftEye: {
      x: leftIrisPos.x,
      y: leftIrisPos.y,
      sizePct: leftEyeSizePct,
    },
    rightEye: {
      x: rightIrisPos.x,
      y: rightIrisPos.y,
      sizePct: rightEyeSizePct,
    },
    leftBlood: {
      x: leftSocketCenter.x,
      y: clampY(leftSocketCenter.y + bloodYOffsetLeft),
      widthPct: leftBloodWidthPct,
      heightPct: leftBloodHeightPct,
    },
    rightBlood: {
      x: rightSocketCenter.x,
      y: clampY(rightSocketCenter.y + bloodYOffsetRight),
      widthPct: rightBloodWidthPct,
      heightPct: rightBloodHeightPct,
    },
  };
}

function lerpValue(from: number, to: number, alpha: number): number {
  return from + ((to - from) * alpha);
}

function lerpAngleDeg(from: number, to: number, alpha: number): number {
  let delta = ((to - from + 540) % 360) - 180;
  if (!Number.isFinite(delta)) delta = 0;
  return from + (delta * alpha);
}

function smoothSharinganVisualPose(
  previous: SharinganVisualPose | null,
  next: SharinganVisualPose,
): SharinganVisualPose {
  if (!previous) return next;
  return {
    angleDeg: lerpAngleDeg(previous.angleDeg, next.angleDeg, SHARINGAN_POSE_ANGLE_LERP),
    leftEye: {
      x: lerpValue(previous.leftEye.x, next.leftEye.x, SHARINGAN_POSE_POS_LERP),
      y: lerpValue(previous.leftEye.y, next.leftEye.y, SHARINGAN_POSE_POS_LERP),
      sizePct: lerpValue(previous.leftEye.sizePct, next.leftEye.sizePct, SHARINGAN_POSE_SIZE_LERP),
    },
    rightEye: {
      x: lerpValue(previous.rightEye.x, next.rightEye.x, SHARINGAN_POSE_POS_LERP),
      y: lerpValue(previous.rightEye.y, next.rightEye.y, SHARINGAN_POSE_POS_LERP),
      sizePct: lerpValue(previous.rightEye.sizePct, next.rightEye.sizePct, SHARINGAN_POSE_SIZE_LERP),
    },
    leftBlood: {
      x: lerpValue(previous.leftBlood.x, next.leftBlood.x, SHARINGAN_POSE_POS_LERP),
      y: lerpValue(previous.leftBlood.y, next.leftBlood.y, SHARINGAN_POSE_POS_LERP),
      widthPct: lerpValue(previous.leftBlood.widthPct, next.leftBlood.widthPct, SHARINGAN_POSE_SIZE_LERP),
      heightPct: lerpValue(previous.leftBlood.heightPct, next.leftBlood.heightPct, SHARINGAN_POSE_SIZE_LERP),
    },
    rightBlood: {
      x: lerpValue(previous.rightBlood.x, next.rightBlood.x, SHARINGAN_POSE_POS_LERP),
      y: lerpValue(previous.rightBlood.y, next.rightBlood.y, SHARINGAN_POSE_POS_LERP),
      widthPct: lerpValue(previous.rightBlood.widthPct, next.rightBlood.widthPct, SHARINGAN_POSE_SIZE_LERP),
      heightPct: lerpValue(previous.rightBlood.heightPct, next.rightBlood.heightPct, SHARINGAN_POSE_SIZE_LERP),
    },
  };
}

function getCachedImage(cache: Map<string, HTMLImageElement>, src: string): HTMLImageElement {
  const existing = cache.get(src);
  if (existing) return existing;
  const image = new window.Image();
  image.decoding = "async";
  image.src = src;
  cache.set(src, image);
  return image;
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

const SIGN_IMAGE_OVERRIDES: Record<string, string> = {
  clap: "/pics/clap.jpg",
};

function signImageCandidates(sign: string): string[] {
  const normalized = normalizeLabel(sign);
  if (!normalized) return ["/pics/placeholder.png"];
  const overridePath = SIGN_IMAGE_OVERRIDES[normalized];
  if (overridePath) {
    return [overridePath, "/pics/placeholder.png"];
  }
  return [
    `/pics/signs/${normalized}.jpg`,
    "/pics/placeholder.png",
  ];
}

function SignTile({
  sign,
  state,
  iconSize,
}: {
  sign: string;
  state: "pending" | "active" | "done" | "casting";
  iconSize: number;
}) {
  const candidates = useMemo(() => signImageCandidates(sign), [sign]);
  const [candidateState, setCandidateState] = useState<{ sign: string; index: number }>({
    sign,
    index: 0,
  });
  const activeCandidateIndex = candidateState.sign === sign ? candidateState.index : 0;
  const src = candidates[Math.min(activeCandidateIndex, candidates.length - 1)] || "/pics/placeholder.png";
  const borderColor = state === "active"
    ? "rgba(245, 140, 40, 0.95)"
    : state === "done"
      ? "rgba(85, 210, 120, 0.95)"
      : state === "casting"
        ? "rgba(255, 206, 120, 0.95)"
        : "rgba(92, 102, 120, 0.9)";
  const borderGlow = state === "active"
    ? "0 0 0 2px rgba(245, 140, 40, 0.96), 0 0 18px rgba(245, 140, 40, 0.35)"
    : state === "done"
      ? "0 0 0 2px rgba(85, 210, 120, 0.9), 0 0 14px rgba(85, 210, 120, 0.22)"
      : state === "casting"
        ? "0 0 0 2px rgba(255, 206, 120, 0.95), 0 0 18px rgba(255, 206, 120, 0.28)"
        : "0 0 0 1px rgba(92, 102, 120, 0.55)";

  return (
    <div
      className="relative shrink-0"
      style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
    >
      {state === "casting" && (
        <span
          className="pointer-events-none absolute rounded-[12px]"
          style={{
            left: "-8px",
            top: "-8px",
            width: `${iconSize + 16}px`,
            height: `${iconSize + 16}px`,
            backgroundColor: "rgba(255, 190, 80, 0.22)",
            boxShadow: "0 0 22px rgba(255, 185, 80, 0.38)",
          }}
        />
      )}

      <span
        className="pointer-events-none absolute inset-0 rounded-[10px] border"
        style={{
          borderColor,
          borderWidth: "2px",
          boxShadow: borderGlow,
        }}
      />

      <div
        className="relative h-full w-full overflow-hidden rounded-[8px] bg-[#1b1e28] shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
      >
        <Image
          src={src}
          alt={toDisplayLabel(sign)}
          width={iconSize}
          height={iconSize}
          onError={() => {
            setCandidateState((prev) => {
              const base = prev.sign === sign ? prev.index : 0;
              return {
                sign,
                index: Math.min(base + 1, candidates.length - 1),
              };
            });
          }}
          className="h-full w-full object-cover"
          style={{ opacity: state === "done" ? 0.4 : 1 }}
        />
        {state === "casting" && (
          <span
            className="pointer-events-none absolute inset-0 rounded-[8px]"
            style={{ backgroundColor: "rgba(255, 170, 60, 0.13)" }}
          />
        )}
      </div>
    </div>
  );
}

async function getStreamWithPreferences(cameraIdx: number, resolutionIdx: number, preferLowResolution = false): Promise<MediaStream> {
  const requestedRes = RESOLUTION_OPTIONS[Math.max(0, Math.min(RESOLUTION_OPTIONS.length - 1, Math.floor(resolutionIdx)))]
    || RESOLUTION_OPTIONS[0];
  const res = preferLowResolution ? RESOLUTION_OPTIONS[0] : requestedRes;

  const baseVideo: MediaTrackConstraints = preferLowResolution
    ? {
      width: { ideal: 640, max: 960 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 24, max: 30 },
      facingMode: "user",
    }
    : {
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

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to document copy.
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

export default function PlayArena({
  jutsuName,
  mode,
  restrictedSigns,
  ramTigerShared = true,
  easyMode,
  debugHands,
  viewportFit = false,
  noEffects = false,
  busy = false,
  sfxVolume = 0.35,
  cameraIdx = 0,
  resolutionIdx = 0,
  datasetVersion = "",
  datasetChecksum = "",
  datasetUrl = "/mediapipe_signs_db.csv",
  datasetSyncedAt = 0,
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
  const isViewportFitSession = viewportFit && !isCalibrationMode;
  const jutsu = OFFICIAL_JUTSUS[jutsuName];
  const jutsuTitle = String(jutsu?.displayName || jutsuName || "");
  const sharinganModeName = useMemo(
    () => normalizeLabel(jutsuTitle).includes("mangekyou") ? "Mangekyou Sharingan" : "Sharingan",
    [jutsuTitle],
  );
  const sharinganEyeTexturePath = useMemo(
    () => (sharinganModeName === "Mangekyou Sharingan" ? "/mangekyou_eyes.png" : "/sharingan.png"),
    [sharinganModeName],
  );
  const sharinganChargeLabel = sharinganModeName === "Mangekyou Sharingan" ? "Mangekyou charge" : "Sharingan charge";
  const isSharinganChargedMode = useMemo(
    () => !isCalibrationMode
      && normalizeLabel(jutsuName).includes("sharingan")
      && normalizeLabel(String(jutsu?.effect || "")) === "eye",
    [isCalibrationMode, jutsu?.effect, jutsuName],
  );
  const shouldPrioritizeFaceAnchor = useMemo(
    () => !isCalibrationMode
      && normalizeLabel(String(jutsu?.effect || "")) === "fire",
    [isCalibrationMode, jutsu?.effect],
  );
  const sequence = useMemo(() => (jutsu?.sequence ?? []).map((s) => normalizeLabel(s)), [jutsu]);
  const sequenceKey = useMemo(() => sequence.join("|"), [sequence]);
  const datasetVersionToken = useMemo(() => buildDatasetVersionToken(datasetVersion), [datasetVersion]);
  const datasetChecksumHint = useMemo(
    () => String(datasetChecksum || "").trim().toUpperCase(),
    [datasetChecksum],
  );
  const datasetSourceUrl = useMemo(
    () => String(datasetUrl || "").trim() || "/mediapipe_signs_db.csv",
    [datasetUrl],
  );
  const isLikelyLowPowerMobile = useMemo(() => isLikelyLowPowerMobileDevice(), []);

  const activeCalibrationProfile = useMemo(
    () => sanitizeCalibrationProfile(calibrationProfile),
    [calibrationProfile],
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowCloneCanvasRef = useRef<HTMLCanvasElement>(null);
  const sharinganForegroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const reaperCompositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const knnRef = useRef<KNNClassifier | null>(null);
  const handsRef = useRef<HandLandmarkerLike | null>(null);
  const faceRef = useRef<FaceLandmarkerLike | null>(null);
  const selfieSegmentationRef = useRef<SelfieSegmentationLike | null>(null);
  const handBackendRef = useRef<"tasks_video" | "tasks_image" | "none">("none");
  const shadowCloneLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shadowCloneLayerCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const shadowCloneSmokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shadowCloneSmokeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sharinganForegroundLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sharinganForegroundLayerCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const reaperLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const reaperLayerCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const reaperBgImageRef = useRef<HTMLImageElement | null>(null);
  const reaperEffectStartAtRef = useRef(0);
  const sharinganFaceLandmarksRef = useRef<Landmark[] | null>(null);
  const sharinganSmoothEyesRef = useRef<{
    left: { x: number; y: number; s: number };
    right: { x: number; y: number; s: number };
  } | null>(null);
  const sharinganAssetImageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const shadowCloneSmokeFramesRef = useRef<HTMLImageElement[]>([]);
  const shadowCloneSegmentationBusyRef = useRef(false);
  const shadowCloneLastSendAtRef = useRef(0);
  const shadowCloneStartAtRef = useRef(0);
  const shadowCloneBlinkSettlePendingRef = useRef(false);
  const shadowCloneBlinkPhasePrevRef = useRef<number | null>(null);
  const showJutsuEffectRef = useRef(false);
  const activeEffectRef = useRef("");
  const renderRafRef = useRef(0);
  const detectRafRef = useRef(0);
  const lastRenderDrawAtRef = useRef(0);
  const lastDetectRef = useRef(0);
  const voteWindowRef = useRef<VoteEntry[]>([]);
  const voteStableRef = useRef<VoteStableState>({ label: "idle", confidence: 0, timeMs: 0 });
  const handSlotsRef = useRef<[HandSlotState | null, HandSlotState | null]>([null, null]);
  const latestLandmarksRef = useRef<Landmark[][]>([]);
  const loadedDatasetRowsByLabelRef = useRef<Map<string, DatasetRow[]>>(new Map());
  const datasetLoadingRef = useRef(false);
  const ensureDatasetRowsForSequenceRef = useRef<(targetSequence: string[]) => Promise<void>>(async () => { });
  const sequenceRef = useRef(sequence);
  const lightingLastRef = useRef(0);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const currentStepRef = useRef(0);
  const signsLandedRef = useRef(0);
  const phaseRef = useRef<ArenaPhase>("loading");
  const runStartRef = useRef(0);
  const elapsedRef = useRef(0);
  const castEffectDurationRef = useRef(0);
  const lastAcceptedAtRef = useRef(0);
  const oneHandSinceRef = useRef(0);
  const oneHandAssistUnlockedStepRef = useRef(-1);
  const showTwoHandsGuideRef = useRef(false);
  const sharinganBlinkHoldStartedAtRef = useRef(0);
  const sharinganBloodAnimStartAtRef = useRef(0);
  const sharinganBloodAnimRafRef = useRef(0);
  const sharinganPoseRef = useRef<SharinganVisualPose | null>(null);
  const sharinganEyeTexturePathRef = useRef("/sharingan.png");
  const sharinganBloodFrameRef = useRef(SHARINGAN_BLOOD_FRAME_START);
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
  const shareStatusTimerRef = useRef<number | null>(null);
  const phoenixRafRef = useRef(0);
  const phoenixLastAtRef = useRef(0);
  const cameraFpsWindowStartRef = useRef(0);
  const cameraFpsFrameCountRef = useRef(0);
  const fpsRef = useRef(0);
  const xpPopupTimerRef = useRef<number | null>(null);
  const runFinishedRef = useRef(false);
  const cameraFailureRef = useRef<CameraRuntimeFailure>("none");
  const cameraTrackCleanupRef = useRef<(() => void) | null>(null);
  const videoStallSinceRef = useRef(0);
  const lastVideoMediaTimeRef = useRef(-1);
  const calibrationDiagRestoreRef = useRef<boolean | null>(null);
  const comboCloneHoldRef = useRef(false);
  const comboChidoriTripleRef = useRef(false);
  const comboRasenganTripleRef = useRef(false);
  const effectAnchorRef = useRef<EffectAnchor | null>(null);
  const faceAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const lastGoodFaceAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const lastGoodFaceAnchorAtRef = useRef(0);
  const videoAspectRef = useRef(4 / 3);
  const sequenceStripRef = useRef<HTMLDivElement | null>(null);
  const sequenceTileRefs = useRef<Array<HTMLDivElement | null>>([]);
  const headYawRef = useRef(0);
  const headPitchRef = useRef(0);
  const pendingEffectTimersRef = useRef<number[]>([]);
  const pendingSoundTimersRef = useRef<number[]>([]);
  const autoSubmitTriggeredRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const submittedRef = useRef(false);

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
  const [shareBusy, setShareBusy] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [comboCue, setComboCue] = useState("");
  const [showTwoHandsGuide, setShowTwoHandsGuide] = useState(false);
  const [sharinganBlinkHoldMs, setSharinganBlinkHoldMs] = useState(0);
  const [sharinganVisualPose, setSharinganVisualPose] = useState<SharinganVisualPose | null>(null);
  const [sharinganBloodFrame, setSharinganBloodFrame] = useState(SHARINGAN_BLOOD_FRAME_START);
  const [calibrationSecondsLeft, setCalibrationSecondsLeft] = useState(CALIBRATION_DURATION_S);
  const [calibrationSamples, setCalibrationSamples] = useState(0);
  const [showDetectionPanel, setShowDetectionPanel] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [fps, setFps] = useState(0);
  const [detectorBackend, setDetectorBackend] = useState("TASKS VIDEO");
  const [detectorError, setDetectorError] = useState("");
  const [datasetChecksumDisplay, setDatasetChecksumDisplay] = useState("--------");
  const [loadedDatasetLabels, setLoadedDatasetLabels] = useState<string[]>([]);
  const [activeEffect, setActiveEffect] = useState("");
  const [showJutsuEffect, setShowJutsuEffect] = useState(false);
  const [effectAnchor, setEffectAnchor] = useState<EffectAnchor | null>(null);
  const [faceAnchor, setFaceAnchor] = useState<{ x: number; y: number } | null>(null);
  const [headYaw, setHeadYaw] = useState(0);
  const [headPitch, setHeadPitch] = useState(0);
  const [phoenixFireballs, setPhoenixFireballs] = useState<PhoenixBall[]>([]);
  const [comboTripleEffect, setComboTripleEffect] = useState<"none" | "chidori" | "rasengan">("none");
  const [xpPopupText, setXpPopupText] = useState("");
  const [xpPopupNonce, setXpPopupNonce] = useState(0);
  const [cameraFailure, setCameraFailure] = useState<CameraRuntimeFailure>("none");
  const [sfxReady, setSfxReady] = useState(false);
  const [sfxLoadCompleted, setSfxLoadCompleted] = useState(0);
  const [sfxLoadTotal, setSfxLoadTotal] = useState(0);
  const [sfxLoadFailed, setSfxLoadFailed] = useState(0);
  const [sfxRetryNonce, setSfxRetryNonce] = useState(0);
  const [videoAspect, setVideoAspect] = useState(4 / 3);

  const preloadSfx = useCallback((src: string): Promise<boolean> => {
    const path = String(src || "").trim();
    if (!path) return Promise.resolve(false);
    if (SFX_AUDIO_CACHE.has(path)) return Promise.resolve(true);
    const existing = SFX_PRELOAD_PROMISES.get(path);
    if (existing) return existing;

    const promise = new Promise<boolean>((resolve) => {
      try {
        const audio = new window.Audio();
        audio.preload = "auto";
        audio.src = path;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          cleanup();
          SFX_AUDIO_CACHE.set(path, audio);
          persistSfxReadyPath(path);
          resolve(true);
        };
        const fail = () => {
          if (done) return;
          done = true;
          cleanup();
          resolve(false);
        };
        const timeoutId = window.setTimeout(fail, 10000);
        const cleanup = () => {
          window.clearTimeout(timeoutId);
          audio.removeEventListener("canplaythrough", finish);
          audio.removeEventListener("loadeddata", finish);
          audio.removeEventListener("canplay", finish);
          audio.removeEventListener("error", fail);
        };
        audio.addEventListener("canplaythrough", finish);
        audio.addEventListener("loadeddata", finish);
        audio.addEventListener("canplay", finish);
        audio.addEventListener("error", fail);
        audio.load();
      } catch {
        resolve(false);
      }
    });

    const tracked = promise.finally(() => {
      SFX_PRELOAD_PROMISES.delete(path);
    });

    SFX_PRELOAD_PROMISES.set(path, tracked);
    return tracked;
  }, []);

  const playSfx = useCallback((src: string, volume = 1) => {
    try {
      const path = String(src || "").trim();
      if (!path) return;
      const cached = SFX_AUDIO_CACHE.get(path);
      const audio = cached
        ? (cached.cloneNode(true) as HTMLAudioElement)
        : new window.Audio(path);
      audio.preload = "auto";
      audio.volume = clamp(sfxVolume * volume, 0, 1);
      void audio.play().catch(() => { });
    } catch {
      // Ignore autoplay errors.
    }
  }, [sfxVolume]);

  const ensureDatasetRowsForSequence = useCallback(async (targetSequence: string[]) => {
    const requiredLabels = getRequiredDatasetLabels(targetSequence, ramTigerShared);
    const missingLabels = requiredLabels.filter((label) => !loadedDatasetRowsByLabelRef.current.has(label));
    if (missingLabels.length === 0) {
      setLoadedDatasetLabels([...loadedDatasetRowsByLabelRef.current.keys()].sort((a, b) => a.localeCompare(b)));
      const existing = [...loadedDatasetRowsByLabelRef.current.values()].flat();
      if (existing.length > 0) {
        knnRef.current = new KNNClassifier(existing, 3, KNN_IDLE_DIST_THRESHOLD);
      }
      return;
    }

    datasetLoadingRef.current = true;
    try {
      for (const label of missingLabels) {
        const normalizedLabel = normalizeLabel(label);
        const cacheKey = `${datasetVersionToken}:${normalizedLabel}`;
        let rows = DATASET_LABEL_ROWS_CACHE.get(cacheKey) || [];

        if (rows.length === 0) {
          const sliceUrl = `/api/mediapipe-dataset?labels=${encodeURIComponent(normalizedLabel)}&v=${encodeURIComponent(datasetVersionToken)}`;
          try {
            const sliceRes = await fetch(sliceUrl, { cache: "force-cache" });
            if (sliceRes.ok) {
              const sliceCsv = await sliceRes.text();
              rows = parseCsv(sliceCsv).filter((row) => normalizeLabel(String(row.label || "")) === normalizedLabel);
            }
          } catch {
            // Fall through to full-dataset fallback.
          }
        }

        if (rows.length === 0) {
          const fullCacheKey = `full:${datasetVersionToken}`;
          let allRows = DATASET_FULL_ROWS_CACHE.get(fullCacheKey) || [];
          if (allRows.length === 0) {
            const fullUrl = appendDatasetVersion(datasetSourceUrl, datasetVersionToken);
            const fullRes = await fetch(fullUrl, { cache: "force-cache" });
            if (!fullRes.ok) {
              throw new Error(`Dataset fetch failed (${fullRes.status})`);
            }
            const fullCsv = await fullRes.text();
            allRows = parseCsv(fullCsv);
            DATASET_FULL_ROWS_CACHE.set(fullCacheKey, allRows);
            if (!datasetChecksumHint) {
              setDatasetChecksumDisplay(shortDatasetChecksum(fullCsv));
            }
          }
          rows = allRows.filter((row) => normalizeLabel(String(row.label || "")) === normalizedLabel);
        }

        DATASET_LABEL_ROWS_CACHE.set(cacheKey, rows);
        loadedDatasetRowsByLabelRef.current.set(normalizedLabel, rows);
      }

      const mergedRows = [...loadedDatasetRowsByLabelRef.current.values()].flat();
      if (mergedRows.length <= 0) {
        throw new Error("dataset_empty");
      }
      knnRef.current = new KNNClassifier(mergedRows, 3, KNN_IDLE_DIST_THRESHOLD);
      setLoadedDatasetLabels([...loadedDatasetRowsByLabelRef.current.keys()].sort((a, b) => a.localeCompare(b)));

      if (datasetChecksumHint) {
        setDatasetChecksumDisplay(datasetChecksumHint.slice(0, 8));
      } else {
        const signature = [...loadedDatasetRowsByLabelRef.current.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, rows]) => `${name}:${rows.length}`)
          .join("|");
        setDatasetChecksumDisplay(shortDatasetChecksum(`${datasetVersionToken}|${signature}`));
      }
    } finally {
      datasetLoadingRef.current = false;
    }
  }, [datasetChecksumHint, datasetSourceUrl, datasetVersionToken, ramTigerShared]);

  const queueSfx = useCallback((src: string, delayMs = 0, volume = 1) => {
    const timer = window.setTimeout(() => {
      playSfx(src, volume);
      pendingSoundTimersRef.current = pendingSoundTimersRef.current.filter((id) => id !== timer);
    }, Math.max(0, Math.floor(delayMs)));
    pendingSoundTimersRef.current.push(timer);
  }, [playSfx]);

  const getJutsuSfxPath = useCallback((name: string, effectName: string): string => {
    const cfg = OFFICIAL_JUTSUS[name];
    const direct = String(cfg?.soundPath || "").trim();
    if (direct) return direct;
    if (normalizeLabel(effectName) === "clone") return "/sounds/each.mp3";
    return "";
  }, []);

  const triggerJutsuSignature = useCallback((
    name: string,
    effectName: string,
    options?: { delayMs?: number; volume?: number },
  ) => {
    if (noEffects) return;
    const path = getJutsuSfxPath(name, effectName);
    if (!path) return;
    const effectNorm = normalizeLabel(effectName);
    const baseDelay = Math.max(0, Math.floor(options?.delayMs ?? (effectNorm === "reaper" ? 0 : 500)));
    const volume = options?.volume ?? 1;
    queueSfx(path, baseDelay, volume);
  }, [getJutsuSfxPath, noEffects, queueSfx]);

  const requiredSfxPaths = useMemo(() => {
    const paths = new Set<string>();
    paths.add("/sounds/each.mp3");
    paths.add("/sounds/complete.mp3");
    const mainEffect = String(jutsu?.effect || "").toLowerCase();
    const mainSig = getJutsuSfxPath(jutsuName, mainEffect);
    if (mainSig) paths.add(mainSig);
    if (Array.isArray(jutsu?.comboParts)) {
      for (const part of jutsu.comboParts) {
        const partName = String(part?.name || jutsuName);
        const partEffect = String(part?.effect || "").toLowerCase();
        const sig = getJutsuSfxPath(partName, partEffect);
        if (sig) paths.add(sig);
      }
    }
    return [...paths];
  }, [getJutsuSfxPath, jutsu?.comboParts, jutsu?.effect, jutsuName]);

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

  const markCameraFailure = useCallback((kind: Exclude<CameraRuntimeFailure, "none">, detail = "") => {
    if (cameraFailureRef.current === kind) return;
    cameraFailureRef.current = kind;
    setCameraFailure(kind);
    if (detail) {
      setDetectorError((prev) => {
        const token = `cam_${kind}: ${detail}`;
        if (prev.includes(token)) return prev;
        return prev ? `${prev} | ${token}` : token;
      });
    }
  }, []);

  const clearCameraFailure = useCallback(() => {
    if (cameraFailureRef.current === "none") return;
    cameraFailureRef.current = "none";
    setCameraFailure("none");
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

  const clearShadowCloneOverlay = useCallback((resetState = false) => {
    const canvas = shadowCloneCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    if (resetState) {
      shadowCloneStartAtRef.current = 0;
      shadowCloneBlinkSettlePendingRef.current = false;
      shadowCloneBlinkPhasePrevRef.current = null;
      shadowCloneLastSendAtRef.current = 0;
      shadowCloneSegmentationBusyRef.current = false;
    }
  }, []);

  const clearSharinganForegroundOverlay = useCallback(() => {
    const canvas = sharinganForegroundCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const clearReaperCompositeOverlay = useCallback(() => {
    const canvas = reaperCompositeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const ensureReaperBackgroundImage = useCallback(() => {
    if (reaperBgImageRef.current) return reaperBgImageRef.current;
    const image = new window.Image();
    image.decoding = "async";
    image.src = REAPER_BG_IMAGE_PATH;
    reaperBgImageRef.current = image;
    return image;
  }, []);

  const ensureShadowCloneSmokeFrames = useCallback(() => {
    if (shadowCloneSmokeFramesRef.current.length > 0) return;
    const frames: HTMLImageElement[] = [];
    for (let i = SHADOW_CLONE_SMOKE_FRAME_START; i <= SHADOW_CLONE_SMOKE_FRAME_END; i += 1) {
      const image = new window.Image();
      image.src = `${SHADOW_CLONE_SMOKE_BASE_NAME}${i}.png`;
      frames.push(image);
    }
    shadowCloneSmokeFramesRef.current = frames;
  }, []);

  const drawShadowCloneFrame = useCallback((results: SelfieSegmentationResultShape) => {
    const effectToken = normalizeLabel(activeEffectRef.current);
    const comboClonePersistActive = showJutsuEffectRef.current
      && comboCloneHoldRef.current
      && (effectToken === "lightning" || effectToken === "rasengan");
    const cloneEffectActive = showJutsuEffectRef.current && (effectToken === "clone" || comboClonePersistActive);
    const sharinganEffectActive = showJutsuEffectRef.current && effectToken === "eye";
    const reaperEffectActive = showJutsuEffectRef.current && effectToken === "reaper";
    if (!cloneEffectActive && !sharinganEffectActive && !reaperEffectActive) {
      clearShadowCloneOverlay(false);
      clearSharinganForegroundOverlay();
      clearReaperCompositeOverlay();
      return;
    }

    if (reaperEffectActive) {
      const overlayCanvas = reaperCompositeCanvasRef.current;
      const overlayCtx = overlayCanvas?.getContext("2d") ?? null;
      if (overlayCanvas && overlayCtx && overlayCanvas.width > 0 && overlayCanvas.height > 0) {
        let layerCanvas = reaperLayerCanvasRef.current;
        let layerCtx = reaperLayerCtxRef.current;
        if (!layerCanvas || !layerCtx) {
          layerCanvas = document.createElement("canvas");
          layerCtx = layerCanvas.getContext("2d");
          reaperLayerCanvasRef.current = layerCanvas;
          reaperLayerCtxRef.current = layerCtx;
        }
        if (layerCanvas && layerCtx) {
          if (layerCanvas.width !== overlayCanvas.width || layerCanvas.height !== overlayCanvas.height) {
            layerCanvas.width = overlayCanvas.width;
            layerCanvas.height = overlayCanvas.height;
          }

          layerCtx.save();
          layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
          layerCtx.translate(layerCanvas.width, 0);
          layerCtx.scale(-1, 1);
          layerCtx.drawImage(
            results.segmentationMask,
            0,
            0,
            layerCanvas.width,
            layerCanvas.height,
          );
          layerCtx.globalCompositeOperation = "source-in";
          layerCtx.drawImage(
            results.image,
            0,
            0,
            layerCanvas.width,
            layerCanvas.height,
          );
          layerCtx.restore();
          layerCtx.globalCompositeOperation = "source-atop";
          layerCtx.fillStyle = `rgba(0, 0, 0, ${clamp(REAPER_PERSON_DARKNESS, 0, 0.95)})`;
          layerCtx.fillRect(0, 0, layerCanvas.width, layerCanvas.height);
          layerCtx.globalCompositeOperation = "source-over";

          const now = performance.now();
          if (!reaperEffectStartAtRef.current) {
            reaperEffectStartAtRef.current = now;
          }
          const elapsedMs = Math.max(0, now - reaperEffectStartAtRef.current);
          const totalDurationMs = Math.max(
            EFFECT_DEFAULT_DURATION_MS,
            Math.floor(castEffectDurationRef.current || EFFECT_DEFAULT_DURATION_MS),
          );
          const fadeIn = REAPER_FADE_IN_MS > 0
            ? clamp(elapsedMs / REAPER_FADE_IN_MS, 0, 1)
            : 1;
          const remainingMs = Math.max(0, totalDurationMs - elapsedMs);
          const fadeOut = REAPER_FADE_OUT_MS > 0
            ? clamp(remainingMs / REAPER_FADE_OUT_MS, 0, 1)
            : 1;
          const effectAlpha = clamp(Math.min(fadeIn, fadeOut), 0, 1);
          const bgImage = ensureReaperBackgroundImage();

          overlayCtx.save();
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          overlayCtx.globalAlpha = effectAlpha;

          if (bgImage.complete && bgImage.naturalWidth > 0) {
            const nowSec = now * 0.001;
            const zoom = Math.max(
              1,
              REAPER_BG_BASE_SCALE + (Math.sin(nowSec * Math.PI * 2 * REAPER_BG_ZOOM_HZ) * REAPER_BG_ZOOM_AMP),
            );
            const bgW = overlayCanvas.width * zoom;
            const bgH = overlayCanvas.height * zoom;
            const driftX = Math.sin(nowSec * Math.PI * 2 * REAPER_BG_FLOAT_HZ) * REAPER_BG_FLOAT_X_AMP;
            const driftY = (Math.cos(nowSec * Math.PI * 2 * REAPER_BG_FLOAT_HZ) * REAPER_BG_FLOAT_Y_AMP) + REAPER_BG_Y_OFFSET;
            const bgX = ((overlayCanvas.width - bgW) * 0.5) + driftX;
            const bgY = ((overlayCanvas.height - bgH) * 0.5) + driftY;
            overlayCtx.drawImage(bgImage, bgX, bgY, bgW, bgH);
          } else {
            const gradient = overlayCtx.createLinearGradient(0, 0, 0, overlayCanvas.height);
            gradient.addColorStop(0, "rgba(48,12,12,0.96)");
            gradient.addColorStop(0.5, "rgba(24,4,4,0.97)");
            gradient.addColorStop(1, "rgba(0,0,0,0.99)");
            overlayCtx.fillStyle = gradient;
            overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          }

          overlayCtx.globalAlpha = effectAlpha * clamp(REAPER_BG_KEEP_RATIO, 0, 1);
          overlayCtx.save();
          overlayCtx.translate(overlayCanvas.width, 0);
          overlayCtx.scale(-1, 1);
          overlayCtx.drawImage(results.image, 0, 0, overlayCanvas.width, overlayCanvas.height);
          overlayCtx.restore();

          overlayCtx.globalAlpha = effectAlpha * clamp(REAPER_BG_DARKEN_ALPHA, 0, 1);
          overlayCtx.fillStyle = "black";
          overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);

          overlayCtx.globalAlpha = effectAlpha;
          overlayCtx.filter = `brightness(${REAPER_PERSON_BRIGHTNESS}) contrast(1.02) saturate(0.92)`;
          overlayCtx.drawImage(layerCanvas, 0, 0, overlayCanvas.width, overlayCanvas.height);
          overlayCtx.filter = "none";
          overlayCtx.restore();
        }
      }
    } else {
      clearReaperCompositeOverlay();
    }

    if (sharinganEffectActive) {
      const foregroundCanvas = sharinganForegroundCanvasRef.current;
      const foregroundCtx = foregroundCanvas?.getContext("2d") ?? null;
      if (foregroundCanvas && foregroundCtx && foregroundCanvas.width > 0 && foregroundCanvas.height > 0) {
        let foregroundLayerCanvas = sharinganForegroundLayerCanvasRef.current;
        let foregroundLayerCtx = sharinganForegroundLayerCtxRef.current;
        if (!foregroundLayerCanvas || !foregroundLayerCtx) {
          foregroundLayerCanvas = document.createElement("canvas");
          foregroundLayerCtx = foregroundLayerCanvas.getContext("2d");
          sharinganForegroundLayerCanvasRef.current = foregroundLayerCanvas;
          sharinganForegroundLayerCtxRef.current = foregroundLayerCtx;
        }
        if (foregroundLayerCanvas && foregroundLayerCtx) {
          if (
            foregroundLayerCanvas.width !== foregroundCanvas.width
            || foregroundLayerCanvas.height !== foregroundCanvas.height
          ) {
            foregroundLayerCanvas.width = foregroundCanvas.width;
            foregroundLayerCanvas.height = foregroundCanvas.height;
          }

          foregroundLayerCtx.save();
          foregroundLayerCtx.clearRect(0, 0, foregroundLayerCanvas.width, foregroundLayerCanvas.height);
          foregroundLayerCtx.translate(foregroundLayerCanvas.width, 0);
          foregroundLayerCtx.scale(-1, 1);
          foregroundLayerCtx.drawImage(
            results.segmentationMask,
            0,
            0,
            foregroundLayerCanvas.width,
            foregroundLayerCanvas.height,
          );
          foregroundLayerCtx.globalCompositeOperation = "source-in";
          foregroundLayerCtx.drawImage(
            results.image,
            0,
            0,
            foregroundLayerCanvas.width,
            foregroundLayerCanvas.height,
          );
          foregroundLayerCtx.restore();
          foregroundLayerCtx.globalCompositeOperation = "source-over";

          foregroundCtx.save();
          foregroundCtx.clearRect(0, 0, foregroundCanvas.width, foregroundCanvas.height);
          foregroundCtx.drawImage(foregroundLayerCanvas, 0, 0, foregroundCanvas.width, foregroundCanvas.height);
          const faceLandmarks = sharinganFaceLandmarksRef.current;
          if (Array.isArray(faceLandmarks) && faceLandmarks.length >= 474) {
            const leftIris = faceLandmarks[468];
            const rightIris = faceLandmarks[473];
            const leftOuter = faceLandmarks[33];
            const leftInner = faceLandmarks[133];
            const rightOuter = faceLandmarks[362];
            const rightInner = faceLandmarks[263];

            if (leftIris && rightIris && leftOuter && leftInner && rightOuter && rightInner) {
              const canvasW = foregroundCanvas.width;
              const canvasH = foregroundCanvas.height;
              const mirrorPoint = (point: Landmark) => ({
                x: (1 - point.x) * canvasW,
                y: point.y * canvasH,
              });
              const mirrorNorm = (point: Landmark) => ({
                x: clamp(1 - point.x, 0.02, 0.98),
                y: clamp(point.y, 0.04, 0.96),
              });
              const leftIrisPx = mirrorPoint(leftIris);
              const rightIrisPx = mirrorPoint(rightIris);
              const leftOuterPx = mirrorPoint(leftOuter);
              const leftInnerPx = mirrorPoint(leftInner);
              const rightOuterPx = mirrorPoint(rightOuter);
              const rightInnerPx = mirrorPoint(rightInner);

              const leftSizeTarget = Math.hypot(leftOuterPx.x - leftInnerPx.x, leftOuterPx.y - leftInnerPx.y) * 0.42;
              const rightSizeTarget = Math.hypot(rightOuterPx.x - rightInnerPx.x, rightOuterPx.y - rightInnerPx.y) * 0.42;

              let smoothEyeState = sharinganSmoothEyesRef.current;
              if (!smoothEyeState) {
                smoothEyeState = {
                  left: { x: leftIrisPx.x, y: leftIrisPx.y, s: leftSizeTarget },
                  right: { x: rightIrisPx.x, y: rightIrisPx.y, s: rightSizeTarget },
                };
              } else {
                smoothEyeState.left.x = lerpValue(smoothEyeState.left.x, leftIrisPx.x, SHARINGAN_POSE_POS_LERP);
                smoothEyeState.left.y = lerpValue(smoothEyeState.left.y, leftIrisPx.y, SHARINGAN_POSE_POS_LERP);
                smoothEyeState.left.s = lerpValue(smoothEyeState.left.s, leftSizeTarget, SHARINGAN_POSE_SIZE_LERP);
                smoothEyeState.right.x = lerpValue(smoothEyeState.right.x, rightIrisPx.x, SHARINGAN_POSE_POS_LERP);
                smoothEyeState.right.y = lerpValue(smoothEyeState.right.y, rightIrisPx.y, SHARINGAN_POSE_POS_LERP);
                smoothEyeState.right.s = lerpValue(smoothEyeState.right.s, rightSizeTarget, SHARINGAN_POSE_SIZE_LERP);
              }
              sharinganSmoothEyesRef.current = smoothEyeState;

              const leftSocketCenterNorm = mirrorNorm({
                x: (leftOuter.x + leftInner.x) * 0.5,
                y: (leftOuter.y + leftInner.y) * 0.5,
                z: 0,
              });
              const rightSocketCenterNorm = mirrorNorm({
                x: (rightOuter.x + rightInner.x) * 0.5,
                y: (rightOuter.y + rightInner.y) * 0.5,
                z: 0,
              });

              const leftSocketCenterPx = {
                x: leftSocketCenterNorm.x * canvasW,
                y: leftSocketCenterNorm.y * canvasH,
              };
              const rightSocketCenterPx = {
                x: rightSocketCenterNorm.x * canvasW,
                y: rightSocketCenterNorm.y * canvasH,
              };

              const faceAngle = Math.atan2(
                rightSocketCenterPx.y - leftSocketCenterPx.y,
                rightSocketCenterPx.x - leftSocketCenterPx.x,
              );

              const eyeTexturePath = sharinganEyeTexturePathRef.current || "/sharingan.png";
              const eyeTextureImage = getCachedImage(sharinganAssetImageCacheRef.current, eyeTexturePath);
              const eyeTextureReady = eyeTextureImage.complete && eyeTextureImage.naturalWidth > 0;

              if (eyeTextureReady) {
                const drawSeamlessEye = (iris: { x: number; y: number }, size: number, lidIndices: number[]) => {
                  foregroundCtx.save();
                  foregroundCtx.beginPath();
                  for (let i = 0; i < lidIndices.length; i += 1) {
                    const point = faceLandmarks[lidIndices[i]];
                    if (!point) continue;
                    const px = (1 - point.x) * canvasW;
                    const py = point.y * canvasH;
                    if (i === 0) foregroundCtx.moveTo(px, py);
                    else foregroundCtx.lineTo(px, py);
                  }
                  foregroundCtx.closePath();
                  foregroundCtx.clip();

                  foregroundCtx.translate(iris.x, iris.y);
                  foregroundCtx.rotate(faceAngle);

                  foregroundCtx.globalCompositeOperation = "screen";
                  const glowGrad = foregroundCtx.createRadialGradient(0, 0, 0, 0, 0, size * 0.8);
                  glowGrad.addColorStop(0, `rgba(255, 0, 0, ${SHARINGAN_EYE_GLOW * SHARINGAN_EYE_BLEND})`);
                  glowGrad.addColorStop(0.4, `rgba(255, 0, 0, ${(SHARINGAN_EYE_GLOW * 0.33) * SHARINGAN_EYE_BLEND})`);
                  glowGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
                  foregroundCtx.fillStyle = glowGrad;
                  foregroundCtx.fillRect(-size, -size, size * 2, size * 2);

                  foregroundCtx.globalCompositeOperation = "multiply";
                  foregroundCtx.globalAlpha = SHARINGAN_EYE_SHADOW * SHARINGAN_EYE_BLEND;
                  foregroundCtx.drawImage(eyeTextureImage, -size / 2, -size / 2, size, size);

                  foregroundCtx.globalCompositeOperation = "hard-light";
                  foregroundCtx.globalAlpha = SHARINGAN_EYE_LIGHT * SHARINGAN_EYE_BLEND;
                  foregroundCtx.drawImage(eyeTextureImage, -size / 2, -size / 2, size, size);

                  const reflectionStrength = Math.max(0, Math.min(1, SHARINGAN_EYE_REFLECT * SHARINGAN_EYE_BLEND));
                  if (reflectionStrength > 0) {
                    foregroundCtx.globalCompositeOperation = "screen";
                    foregroundCtx.globalAlpha = reflectionStrength;

                    foregroundCtx.beginPath();
                    foregroundCtx.ellipse(-size * 0.16, -size * 0.18, size * 0.2, size * 0.12, -0.35, 0, Math.PI * 2);
                    let specularGrad = foregroundCtx.createRadialGradient(
                      -size * 0.18,
                      -size * 0.19,
                      0,
                      -size * 0.16,
                      -size * 0.18,
                      size * 0.22,
                    );
                    specularGrad.addColorStop(0, "rgba(255,255,255,0.95)");
                    specularGrad.addColorStop(0.5, "rgba(255,255,255,0.45)");
                    specularGrad.addColorStop(1, "rgba(255,255,255,0)");
                    foregroundCtx.fillStyle = specularGrad;
                    foregroundCtx.fill();

                    foregroundCtx.globalAlpha = reflectionStrength * 0.6;
                    foregroundCtx.beginPath();
                    foregroundCtx.ellipse(size * 0.06, -size * 0.03, size * 0.06, size * 0.04, 0.2, 0, Math.PI * 2);
                    specularGrad = foregroundCtx.createRadialGradient(
                      size * 0.05,
                      -size * 0.04,
                      0,
                      size * 0.06,
                      -size * 0.03,
                      size * 0.08,
                    );
                    specularGrad.addColorStop(0, "rgba(255,255,255,0.95)");
                    specularGrad.addColorStop(1, "rgba(255,255,255,0)");
                    foregroundCtx.fillStyle = specularGrad;
                    foregroundCtx.fill();
                  }
                  foregroundCtx.restore();
                };

                drawSeamlessEye(smoothEyeState.left, smoothEyeState.left.s, SHARINGAN_LEFT_EYELID_INDICES);
                drawSeamlessEye(smoothEyeState.right, smoothEyeState.right.s, SHARINGAN_RIGHT_EYELID_INDICES);
              }

              const bloodFrame = clamp(
                Math.round(sharinganBloodFrameRef.current),
                SHARINGAN_BLOOD_FRAME_START,
                SHARINGAN_BLOOD_FRAME_END,
              );
              const bloodTexturePath = `${SHARINGAN_BLOOD_BASE_NAME}${bloodFrame}.png`;
              const bloodTextureImage = getCachedImage(sharinganAssetImageCacheRef.current, bloodTexturePath);
              const bloodReady = bloodTextureImage.complete && bloodTextureImage.naturalWidth > 0;

              if (bloodReady) {
                const leftBloodCenter = {
                  x: leftSocketCenterPx.x,
                  y: clamp(
                    leftSocketCenterNorm.y + ((smoothEyeState.left.s / canvasW) * 0.48),
                    0.04,
                    0.98,
                  ) * canvasH,
                };
                const rightBloodCenter = {
                  x: rightSocketCenterPx.x,
                  y: clamp(
                    rightSocketCenterNorm.y + ((smoothEyeState.right.s / canvasW) * 0.48),
                    0.04,
                    0.98,
                  ) * canvasH,
                };
                const drawBlood = (center: { x: number; y: number }, eyeSize: number) => {
                  const width = Math.max(18, eyeSize * 2.5);
                  const height = Math.max(36, eyeSize * 7.0);
                  foregroundCtx.save();
                  foregroundCtx.translate(center.x, center.y);
                  foregroundCtx.rotate(faceAngle);
                  foregroundCtx.globalAlpha = 0.95;
                  foregroundCtx.filter = "saturate(1.35) contrast(1.15)";
                  foregroundCtx.drawImage(
                    bloodTextureImage,
                    -width * 0.5,
                    -height * 0.05,
                    width,
                    height,
                  );
                  foregroundCtx.filter = "none";
                  foregroundCtx.restore();
                };

                drawBlood(leftBloodCenter, smoothEyeState.left.s);
                drawBlood(rightBloodCenter, smoothEyeState.right.s);
              }
            } else {
              sharinganSmoothEyesRef.current = null;
            }
          } else {
            sharinganSmoothEyesRef.current = null;
          }
          foregroundCtx.restore();
        }
      }
    } else {
      clearSharinganForegroundOverlay();
    }

    if (!cloneEffectActive) {
      clearShadowCloneOverlay(false);
      return;
    }

    const overlayCanvas = shadowCloneCanvasRef.current;
    if (!overlayCanvas || overlayCanvas.width <= 0 || overlayCanvas.height <= 0) return;
    const overlayCtx = overlayCanvas.getContext("2d");
    if (!overlayCtx) return;

    let cloneLayerCanvas = shadowCloneLayerCanvasRef.current;
    let cloneLayerCtx = shadowCloneLayerCtxRef.current;
    if (!cloneLayerCanvas || !cloneLayerCtx) {
      cloneLayerCanvas = document.createElement("canvas");
      cloneLayerCtx = cloneLayerCanvas.getContext("2d");
      shadowCloneLayerCanvasRef.current = cloneLayerCanvas;
      shadowCloneLayerCtxRef.current = cloneLayerCtx;
    }

    let smokeCanvas = shadowCloneSmokeCanvasRef.current;
    let smokeCtx = shadowCloneSmokeCtxRef.current;
    if (!smokeCanvas || !smokeCtx) {
      smokeCanvas = document.createElement("canvas");
      smokeCtx = smokeCanvas.getContext("2d");
      shadowCloneSmokeCanvasRef.current = smokeCanvas;
      shadowCloneSmokeCtxRef.current = smokeCtx;
    }

    if (!cloneLayerCanvas || !cloneLayerCtx || !smokeCanvas || !smokeCtx) return;

    if (cloneLayerCanvas.width !== overlayCanvas.width || cloneLayerCanvas.height !== overlayCanvas.height) {
      cloneLayerCanvas.width = overlayCanvas.width;
      cloneLayerCanvas.height = overlayCanvas.height;
    }
    if (smokeCanvas.width !== overlayCanvas.width || smokeCanvas.height !== overlayCanvas.height) {
      smokeCanvas.width = overlayCanvas.width;
      smokeCanvas.height = overlayCanvas.height;
    }

    cloneLayerCtx.save();
    cloneLayerCtx.clearRect(0, 0, cloneLayerCanvas.width, cloneLayerCanvas.height);
    cloneLayerCtx.translate(cloneLayerCanvas.width, 0);
    cloneLayerCtx.scale(-1, 1);
    cloneLayerCtx.drawImage(results.segmentationMask, 0, 0, cloneLayerCanvas.width, cloneLayerCanvas.height);
    cloneLayerCtx.globalCompositeOperation = "source-in";
    cloneLayerCtx.drawImage(results.image, 0, 0, cloneLayerCanvas.width, cloneLayerCanvas.height);
    cloneLayerCtx.restore();
    cloneLayerCtx.globalCompositeOperation = "source-over";

    const cloneOffset = SHADOW_CLONE_OFFSET_RATIO;
    const cloneScale = SHADOW_CLONE_SCALE;
    const cloneOpacity = SHADOW_CLONE_OPACITY;
    const cloneEnterDurationMs = SHADOW_CLONE_ENTER_DURATION_MS;
    const cloneBlinkSpeed = SHADOW_CLONE_BLINK_SPEED;
    const cloneBlinkDepth = clamp(SHADOW_CLONE_BLINK_DEPTH, 0, 0.95);

    const drawWidth = overlayCanvas.width * cloneScale;
    const drawHeight = overlayCanvas.height * cloneScale;
    const centeredX = (overlayCanvas.width - drawWidth) * 0.5;
    const centeredY = (overlayCanvas.height - drawHeight) * 0.5;
    const sideOffsetPx = overlayCanvas.width * cloneOffset;

    const now = performance.now();
    const triggerStart = shadowCloneStartAtRef.current > 0 ? shadowCloneStartAtRef.current : now;
    if (!shadowCloneStartAtRef.current) {
      shadowCloneStartAtRef.current = now;
    }
    const elapsedSinceTrigger = Math.max(0, now - triggerStart);
    const entranceT = Math.min(1, elapsedSinceTrigger / cloneEnterDurationMs);
    const entranceEaseOut = 1 - Math.pow(1 - entranceT, 3);
    const animatedOffset = sideOffsetPx * entranceEaseOut;

    let smokeFrame: HTMLImageElement | null = null;
    const smokeFrames = shadowCloneSmokeFramesRef.current;
    if (SHADOW_CLONE_SMOKE_ENABLED && entranceT < 1 && smokeFrames.length > 0) {
      const targetFrameIndex = Math.max(
        0,
        Math.min(smokeFrames.length - 1, Math.floor(entranceT * (smokeFrames.length - 1))),
      );
      for (let i = targetFrameIndex; i >= 0; i -= 1) {
        const candidate = smokeFrames[i];
        if (candidate.complete && candidate.naturalWidth > 0) {
          smokeFrame = candidate;
          break;
        }
      }
    }

    const blinkPhase = (now * 0.001 * cloneBlinkSpeed) % (Math.PI * 2);
    const blinkPulse = (Math.sin(blinkPhase) + 1) * 0.5;
    const blinkOpacity = cloneOpacity * (1 - cloneBlinkDepth * blinkPulse);

    let leftAlpha = cloneOpacity;
    let rightAlpha = cloneOpacity;

    if (entranceT < 1) {
      shadowCloneBlinkSettlePendingRef.current = true;
      leftAlpha = blinkOpacity;
      rightAlpha = blinkOpacity;
    } else if (shadowCloneBlinkSettlePendingRef.current) {
      leftAlpha = blinkOpacity;
      rightAlpha = blinkOpacity;
      const fullOpacityPhase = (Math.PI * 3) / 2;
      if (didPassPhase(shadowCloneBlinkPhasePrevRef.current, blinkPhase, fullOpacityPhase)) {
        shadowCloneBlinkSettlePendingRef.current = false;
        shadowCloneBlinkPhasePrevRef.current = null;
        leftAlpha = cloneOpacity;
        rightAlpha = cloneOpacity;
      }
    }

    if (entranceT < 1 || shadowCloneBlinkSettlePendingRef.current) {
      shadowCloneBlinkPhasePrevRef.current = blinkPhase;
    }

    const drawCloneWithSmoke = (x: number, alpha: number) => {
      overlayCtx.globalCompositeOperation = "source-over";
      overlayCtx.globalAlpha = alpha;
      overlayCtx.drawImage(cloneLayerCanvas, x, centeredY, drawWidth, drawHeight);

      if (!SHADOW_CLONE_SMOKE_ENABLED || !smokeFrame) return;

      const spriteAspect = (smokeFrame.naturalWidth > 0 && smokeFrame.naturalHeight > 0)
        ? (smokeFrame.naturalWidth / smokeFrame.naturalHeight)
        : 1;
      const smokeH = drawHeight * SHADOW_CLONE_SMOKE_SCALE;
      const smokeW = smokeH * spriteAspect;
      const smokeX = x - ((smokeW - drawWidth) * 0.5);
      const smokeY = centeredY - (smokeH * SHADOW_CLONE_SMOKE_RISE);

      if (SHADOW_CLONE_SMOKE_MASK_TO_CLONE) {
        smokeCtx.clearRect(0, 0, smokeCanvas.width, smokeCanvas.height);
        smokeCtx.globalCompositeOperation = "source-over";
        smokeCtx.drawImage(smokeFrame, smokeX, smokeY, smokeW, smokeH);
        smokeCtx.globalCompositeOperation = "destination-in";
        smokeCtx.drawImage(cloneLayerCanvas, x, centeredY, drawWidth, drawHeight);
        smokeCtx.globalCompositeOperation = "source-over";
      }

      overlayCtx.globalCompositeOperation = "source-over";
      overlayCtx.globalAlpha = Math.min(1, alpha * SHADOW_CLONE_SMOKE_OPACITY);
      if (SHADOW_CLONE_SMOKE_MASK_TO_CLONE) {
        overlayCtx.drawImage(smokeCanvas, 0, 0);
      } else {
        overlayCtx.drawImage(smokeFrame, smokeX, smokeY, smokeW, smokeH);
      }
    };

    overlayCtx.save();
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    drawCloneWithSmoke(centeredX - animatedOffset, leftAlpha);
    drawCloneWithSmoke(centeredX + animatedOffset, rightAlpha);
    overlayCtx.restore();
  }, [clearReaperCompositeOverlay, clearShadowCloneOverlay, clearSharinganForegroundOverlay, ensureReaperBackgroundImage]);

  const ensureSelfieSegmentation = useCallback(async (): Promise<SelfieSegmentationLike | null> => {
    if (selfieSegmentationRef.current) return selfieSegmentationRef.current;
    try {
      const mp = await import("@mediapipe/selfie_segmentation");
      const SelfieSegmentationCtor = mp.SelfieSegmentation as unknown as new (options: {
        locateFile: (file: string) => string;
      }) => SelfieSegmentationLike;
      const segmenter = new SelfieSegmentationCtor({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });
      segmenter.setOptions?.({ modelSelection: 1 });
      segmenter.onResults(drawShadowCloneFrame);
      selfieSegmentationRef.current = segmenter;
      return segmenter;
    } catch (err) {
      const message = String((err as Error)?.message || err || "clone_segmentation_unavailable");
      setDetectorError((prev) => {
        const token = `clone_seg: ${message}`;
        if (prev.includes(token)) return prev;
        return prev ? `${prev} | ${token}` : token;
      });
      return null;
    }
  }, [drawShadowCloneFrame]);

  const triggerJutsuEffect = useCallback((effectName: string, durationMs = EFFECT_DEFAULT_DURATION_MS) => {
    if (noEffects || !effectName) return;
    const effectToken = normalizeLabel(effectName);
    if (effectToken === "clone") {
      shadowCloneStartAtRef.current = performance.now();
      shadowCloneBlinkSettlePendingRef.current = true;
      shadowCloneBlinkPhasePrevRef.current = null;
      ensureShadowCloneSmokeFrames();
      void ensureSelfieSegmentation();
      clearSharinganForegroundOverlay();
      clearReaperCompositeOverlay();
      reaperEffectStartAtRef.current = 0;
    } else if (effectToken === "eye") {
      clearShadowCloneOverlay(true);
      void ensureSelfieSegmentation();
      clearReaperCompositeOverlay();
      reaperEffectStartAtRef.current = 0;
    } else if (effectToken === "reaper") {
      clearShadowCloneOverlay(true);
      clearSharinganForegroundOverlay();
      reaperEffectStartAtRef.current = performance.now();
      ensureReaperBackgroundImage();
      void ensureSelfieSegmentation();
    } else {
      const keepCloneVisible = comboCloneHoldRef.current && (effectToken === "lightning" || effectToken === "rasengan");
      if (!keepCloneVisible) {
        clearShadowCloneOverlay(true);
      }
      clearSharinganForegroundOverlay();
      clearReaperCompositeOverlay();
      reaperEffectStartAtRef.current = 0;
    }
    setActiveEffect(effectToken);
    setShowJutsuEffect(true);
    if (effectTimerRef.current) {
      window.clearTimeout(effectTimerRef.current);
    }
    effectTimerRef.current = window.setTimeout(() => {
      setShowJutsuEffect(false);
      setActiveEffect("");
      clearShadowCloneOverlay(true);
      clearSharinganForegroundOverlay();
      clearReaperCompositeOverlay();
      reaperEffectStartAtRef.current = 0;
      setComboTripleEffect("none");
      comboCloneHoldRef.current = false;
      comboChidoriTripleRef.current = false;
      comboRasenganTripleRef.current = false;
      effectTimerRef.current = null;
    }, Math.max(600, durationMs));
  }, [
    clearReaperCompositeOverlay,
    clearShadowCloneOverlay,
    clearSharinganForegroundOverlay,
    ensureReaperBackgroundImage,
    ensureSelfieSegmentation,
    ensureShadowCloneSmokeFrames,
    noEffects,
  ]);

  const queueEffect = useCallback((effectName: string, delayMs: number, durationMs: number) => {
    const timer = window.setTimeout(() => {
      triggerJutsuEffect(effectName, durationMs);
      pendingEffectTimersRef.current = pendingEffectTimersRef.current.filter((id) => id !== timer);
    }, Math.max(0, Math.floor(delayMs)));
    pendingEffectTimersRef.current.push(timer);
  }, [triggerJutsuEffect]);

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

  useEffect(() => {
    if (!datasetChecksumHint) return;
    setDatasetChecksumDisplay(datasetChecksumHint.slice(0, 8));
  }, [datasetChecksumHint]);

  useEffect(() => {
    const hydratedRows = getCachedDatasetRowsForVersion(datasetVersionToken);
    loadedDatasetRowsByLabelRef.current = hydratedRows;

    const mergedRows = [...hydratedRows.values()].flat();
    if (mergedRows.length > 0) {
      knnRef.current = new KNNClassifier(mergedRows, 3, KNN_IDLE_DIST_THRESHOLD);
      setLoadedDatasetLabels([...hydratedRows.keys()].sort((a, b) => a.localeCompare(b)));
      return;
    }

    knnRef.current = null;
    setLoadedDatasetLabels([]);
  }, [datasetVersionToken]);

  const resetRunState = useCallback(() => {
    voteWindowRef.current = [];
    voteStableRef.current = { label: "idle", confidence: 0, timeMs: 0 };
    handSlotsRef.current = [null, null];
    currentStepRef.current = 0;
    signsLandedRef.current = 0;
    runStartRef.current = 0;
    elapsedRef.current = 0;
    castEffectDurationRef.current = 0;
    lastAcceptedAtRef.current = 0;
    oneHandSinceRef.current = 0;
    oneHandAssistUnlockedStepRef.current = -1;
    showTwoHandsGuideRef.current = false;
    sharinganBlinkHoldStartedAtRef.current = 0;
    sharinganBloodAnimStartAtRef.current = 0;
    reaperEffectStartAtRef.current = 0;
    sharinganPoseRef.current = null;
    sharinganFaceLandmarksRef.current = null;
    sharinganSmoothEyesRef.current = null;
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
    submitInFlightRef.current = false;
    submittedRef.current = false;
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
    if (shareStatusTimerRef.current) {
      window.clearTimeout(shareStatusTimerRef.current);
      shareStatusTimerRef.current = null;
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
    if (sharinganBloodAnimRafRef.current) {
      cancelAnimationFrame(sharinganBloodAnimRafRef.current);
      sharinganBloodAnimRafRef.current = 0;
    }
    for (const timer of pendingEffectTimersRef.current) {
      window.clearTimeout(timer);
    }
    pendingEffectTimersRef.current = [];
    for (const timer of pendingSoundTimersRef.current) {
      window.clearTimeout(timer);
    }
    pendingSoundTimersRef.current = [];

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
    setShareBusy(false);
    setShareStatus("");
    setComboCue("");
    setShowTwoHandsGuide(false);
    setSharinganBlinkHoldMs(0);
    setSharinganVisualPose(null);
    setSharinganBloodFrame(SHARINGAN_BLOOD_FRAME_START);
    setCalibrationSecondsLeft(CALIBRATION_DURATION_S);
    setCalibrationSamples(0);
    setRawDetectedLabel("Idle");
    setRawDetectedConfidence(0);
    setVoteHits(0);
    setShowModelInfo(false);
    setShowJutsuEffect(false);
    setActiveEffect("");
    clearShadowCloneOverlay(true);
    clearSharinganForegroundOverlay();
    clearReaperCompositeOverlay();
    setPhoenixFireballs([]);
    setXpPopupText("");
    setFaceAnchor(null);
    lastGoodFaceAnchorRef.current = null;
    lastGoodFaceAnchorAtRef.current = 0;
    setHeadYaw(0);
    setHeadPitch(0);
    clearCameraFailure();
    videoStallSinceRef.current = 0;
    lastVideoMediaTimeRef.current = -1;
  }, [clearCameraFailure, clearReaperCompositeOverlay, clearShadowCloneOverlay, clearSharinganForegroundOverlay, resetProofState]);

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
    // Match pygame flow: sequence resets to step 0 once all signs are completed.
    currentStepRef.current = 0;
    setCurrentStep(0);

    if (isRankMode) {
      appendProofEvent("run_finish", nowMs, {
        final_time: Number((elapsed / 1000).toFixed(4)),
        jutsu: String(jutsuName || "").toUpperCase(),
      });
    }

    playSfx("/sounds/complete.mp3", 1);
    if (isCalibrationMode) {
      castEffectDurationRef.current = 0;
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

    const effectDurationMs = Math.max(650, Math.round((Number(jutsu?.duration) || 5.0) * 1000));
    castEffectDurationRef.current = effectDurationMs;
    triggerJutsuSignature(jutsuName, finalEffect, { volume: 1 });
    if (normalizeLabel(finalEffect) === "clone") {
      const cloneSpawnDelayMs = Math.min(
        CLONE_SPAWN_DELAY_MS,
        Math.max(0, effectDurationMs - 650),
      );
      const cloneVisibleDurationMs = Math.max(650, effectDurationMs - cloneSpawnDelayMs);
      queueEffect(finalEffect, cloneSpawnDelayMs, cloneVisibleDurationMs);
    } else {
      triggerJutsuEffect(finalEffect, effectDurationMs);
    }

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
  }, [
    appendProofEvent,
    isCalibrationMode,
    isRankMode,
    jutsu?.duration,
    jutsu?.effect,
    jutsuName,
    playSfx,
    resetRunState,
    queueEffect,
    triggerJutsuEffect,
    triggerJutsuSignature,
  ]);

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
    if (datasetLoadingRef.current || !knnRef.current || !sfxReady) return;

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
  }, [appendProofEvent, forceCalibrationDiagnostics, isCalibrationMode, isRankMode, resetRunState, sfxReady, startActiveRun]);

  const handleSubmitResult = useCallback(async () => {
    if (isCalibrationMode || !onComplete) return;
    const phaseNow = phaseRef.current;
    const canSubmitDuringCasting = phaseNow === "casting" && runFinishedRef.current;
    if (submitInFlightRef.current || submittedRef.current || busy || (phaseNow !== "completed" && !canSubmitDuringCasting)) return;

    submitInFlightRef.current = true;
    setSubmitting(true);
    try {
      const runMode: "free" | "rank" = isRankMode ? "rank" : "free";
      const payload: PlayArenaResult = {
        mode: runMode,
        jutsuName,
        signsLanded: Math.max(signsLandedRef.current, sequence.length),
        expectedSigns: sequence.length,
        elapsedSeconds: Math.max(0, elapsedRef.current / 1000),
        effectDurationMs: Math.max(0, Math.floor(castEffectDurationRef.current || 0)),
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
        submittedRef.current = true;
        setSubmitted(true);
      }

      setSubmitStatus(statusText);
      setSubmitDetail(detailText);
      setRankInfo(rankText);
      if (xpAwarded > 0 && !isCalibrationMode) {
        setXpPopupNonce((prev) => prev + 1);
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
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }, [
    activeCalibrationProfile,
    busy,
    cameraIdx,
    isCalibrationMode,
    isRankMode,
    jutsuName,
    onComplete,
    resolutionIdx,
    restrictedSigns,
    sequence.length,
  ]);

  const handleShareResult = useCallback(async () => {
    if (shareBusy || isCalibrationMode) return;
    const elapsedText = formatElapsed(elapsedMs);
    const signsDone = Math.max(signsLandedRef.current, sequence.length);
    const modeLabel = isRankMode ? "rank mode" : "free mode";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${origin}/play`;
    const message = `I cleared ${jutsuTitle} in ${elapsedText} (${signsDone}/${sequence.length} signs) on Shinobi Academy ${modeLabel}. Can you beat this run? ${shareUrl}`;

    setShareBusy(true);
    try {
      let shared = false;
      let aborted = false;
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: "Shinobi Academy Challenge",
            text: message,
            url: shareUrl,
          });
          shared = true;
        } catch (err) {
          if (String((err as Error)?.name || "") === "AbortError") {
            aborted = true;
            setShareStatus("Share canceled.");
          }
        }
      }

      if (shared) {
        setShareStatus("Result shared.");
      } else if (!aborted) {
        const copied = await copyTextToClipboard(message);
        setShareStatus(copied
          ? "Result copied. Paste it to challenge friends."
          : "Share unavailable on this browser.");
      }
    } finally {
      setShareBusy(false);
      if (shareStatusTimerRef.current) {
        window.clearTimeout(shareStatusTimerRef.current);
      }
      shareStatusTimerRef.current = window.setTimeout(() => {
        setShareStatus("");
        shareStatusTimerRef.current = null;
      }, 2500);
    }
  }, [elapsedMs, isCalibrationMode, isRankMode, jutsuTitle, sequence.length, shareBusy]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    ensureDatasetRowsForSequenceRef.current = ensureDatasetRowsForSequence;
  }, [ensureDatasetRowsForSequence]);

  useEffect(() => {
    sequenceRef.current = sequence;
  }, [sequence, sequenceKey]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    signsLandedRef.current = signsLanded;
  }, [signsLanded]);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);

  useEffect(() => {
    submitInFlightRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    showTwoHandsGuideRef.current = showTwoHandsGuide;
  }, [showTwoHandsGuide]);

  useEffect(() => {
    lightingStatusRef.current = lightingStatus;
  }, [lightingStatus]);

  useEffect(() => {
    effectAnchorRef.current = effectAnchor;
  }, [effectAnchor]);

  useEffect(() => {
    showJutsuEffectRef.current = showJutsuEffect;
  }, [showJutsuEffect]);

  useEffect(() => {
    activeEffectRef.current = String(activeEffect || "").toLowerCase();
  }, [activeEffect]);

  useEffect(() => {
    faceAnchorRef.current = faceAnchor;
  }, [faceAnchor]);

  useEffect(() => {
    headYawRef.current = headYaw;
    headPitchRef.current = headPitch;
  }, [headYaw, headPitch]);

  useEffect(() => {
    let cancelled = false;
    const uniquePaths = [...new Set(requiredSfxPaths
      .map((path) => String(path || "").trim())
      .filter((path) => path.length > 0))];

    hydratePersistedSfxReadyPaths();
    setSfxLoadTotal(uniquePaths.length);
    setSfxLoadCompleted(0);
    setSfxLoadFailed(0);

    if (uniquePaths.length <= 0) {
      setSfxReady(true);
      return () => {
        cancelled = true;
      };
    }

    let completed = 0;
    let failed = 0;
    const pending: string[] = [];
    for (const path of uniquePaths) {
      if (SFX_AUDIO_CACHE.has(path)) {
        completed += 1;
        continue;
      }
      if (SFX_PERSISTED_READY_PATHS.has(path)) {
        try {
          const audio = new window.Audio(path);
          audio.preload = "auto";
          audio.load();
          SFX_AUDIO_CACHE.set(path, audio);
        } catch {
          pending.push(path);
          continue;
        }
        completed += 1;
        continue;
      }
      pending.push(path);
    }

    setSfxLoadCompleted(completed);
    setSfxLoadFailed(failed);
    if (completed >= uniquePaths.length) {
      setSfxReady(true);
      return () => {
        cancelled = true;
      };
    }

    setSfxReady(false);
    void (async () => {
      await Promise.all(pending.map(async (path) => {
        const ok = await preloadSfx(path);
        if (cancelled) return;
        completed += 1;
        if (!ok) failed += 1;
        setSfxLoadCompleted(completed);
        setSfxLoadFailed(failed);
      }));
      if (cancelled) return;
      setSfxReady(failed <= 0 && completed >= uniquePaths.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [preloadSfx, requiredSfxPaths, sfxRetryNonce]);

  useEffect(() => {
    const effectNow = normalizeLabel(String(activeEffect || jutsu?.effect || ""));
    const cloneEffectActive = showJutsuEffect && !noEffects && effectNow === "clone";
    const comboClonePersistActive = showJutsuEffect
      && !noEffects
      && comboCloneHoldRef.current
      && (effectNow === "lightning" || effectNow === "rasengan");
    const sharinganEffectActive = showJutsuEffect && !noEffects && effectNow === "eye";
    const reaperEffectActive = showJutsuEffect && !noEffects && effectNow === "reaper";
    const needsSegmentation = cloneEffectActive || comboClonePersistActive || sharinganEffectActive || reaperEffectActive;
    if (!needsSegmentation) {
      clearShadowCloneOverlay(true);
      clearSharinganForegroundOverlay();
      clearReaperCompositeOverlay();
      reaperEffectStartAtRef.current = 0;
      return;
    }

    if (cloneEffectActive || comboClonePersistActive) {
      ensureShadowCloneSmokeFrames();
    }
    void ensureSelfieSegmentation();

    let cancelled = false;
    let raf = 0;

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      if (cloneEffectActive || comboClonePersistActive) {
        const overlayCanvas = shadowCloneCanvasRef.current;
        if (!overlayCanvas) return;
        if (overlayCanvas.width !== video.videoWidth || overlayCanvas.height !== video.videoHeight) {
          overlayCanvas.width = video.videoWidth;
          overlayCanvas.height = video.videoHeight;
          clearShadowCloneOverlay(false);
        }
      }

      if (sharinganEffectActive) {
        const foregroundCanvas = sharinganForegroundCanvasRef.current;
        if (!foregroundCanvas) return;
        if (foregroundCanvas.width !== video.videoWidth || foregroundCanvas.height !== video.videoHeight) {
          foregroundCanvas.width = video.videoWidth;
          foregroundCanvas.height = video.videoHeight;
          clearSharinganForegroundOverlay();
        }
      }

      if (reaperEffectActive) {
        const reaperCanvas = reaperCompositeCanvasRef.current;
        if (!reaperCanvas) return;
        if (reaperCanvas.width !== video.videoWidth || reaperCanvas.height !== video.videoHeight) {
          reaperCanvas.width = video.videoWidth;
          reaperCanvas.height = video.videoHeight;
          clearReaperCompositeOverlay();
        }
      }

      if (shadowCloneSegmentationBusyRef.current) return;
      if (ts - shadowCloneLastSendAtRef.current < CLONE_SEGMENTATION_INTERVAL_MS) return;
      shadowCloneLastSendAtRef.current = ts;
      shadowCloneSegmentationBusyRef.current = true;

      void (async () => {
        try {
          const segmenter = await ensureSelfieSegmentation();
          if (!segmenter || cancelled || video.readyState < 2) return;
          await withSuppressedMediapipeConsoleAsync(async () => {
            await Promise.resolve(segmenter.send({ image: video }));
          });
        } catch (err) {
          const message = String((err as Error)?.message || err || "clone_segmentation_send_failed");
          setDetectorError((prev) => {
            const token = `clone_send: ${message}`;
            if (prev.includes(token)) return prev;
            return prev ? `${prev} | ${token}` : token;
          });
        } finally {
          shadowCloneSegmentationBusyRef.current = false;
        }
      })();
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      shadowCloneSegmentationBusyRef.current = false;
      shadowCloneLastSendAtRef.current = 0;
      reaperEffectStartAtRef.current = 0;
      clearShadowCloneOverlay(false);
      clearSharinganForegroundOverlay();
      clearReaperCompositeOverlay();
    };
  }, [
    activeEffect,
    clearReaperCompositeOverlay,
    clearShadowCloneOverlay,
    clearSharinganForegroundOverlay,
    ensureSelfieSegmentation,
    ensureShadowCloneSmokeFrames,
    jutsu?.effect,
    noEffects,
    showJutsuEffect,
  ]);

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
      if (canSubmitOnExit && !submittedRef.current && !submitInFlightRef.current) {
        await handleSubmitResult();
      }
    }
    if (isCalibrationMode) {
      restoreCalibrationDiagnostics();
    }
    onBack();
  }, [appendProofEvent, handleSubmitResult, isCalibrationMode, isRankMode, onBack, restoreCalibrationDiagnostics, submitted]);

  const canSwitchJutsuNow = useCallback((): boolean => {
    if (isCalibrationMode) return false;
    if (isRankMode) return false;
    if (phaseRef.current === "loading" || phaseRef.current === "error") return false;
    if (phaseRef.current === "countdown" || phaseRef.current === "active" || phaseRef.current === "casting") return false;
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
        setDetectorBackend("INIT");
        setDetectorError("");

        await ensureDatasetRowsForSequenceRef.current(sequenceRef.current);
        if (cancelled) return;

        setLoadingMessage("Loading hand tracker...");
        const vision = await import("@mediapipe/tasks-vision");
        const { FilesetResolver, HandLandmarker, FaceLandmarker } = vision as unknown as {
          FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
          HandLandmarker: {
            createFromOptions: (resolver: unknown, options: Record<string, unknown>) => Promise<HandLandmarkerLike>;
          };
          FaceLandmarker?: {
            createFromOptions: (resolver: unknown, options: Record<string, unknown>) => Promise<FaceLandmarkerLike>;
          };
        };
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const handErrors: string[] = [];
        let handLandmarker: HandLandmarkerLike | null = null;
        let backend: "tasks_video" | "tasks_image" | "none" = "none";
        const handModelPath = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
        const candidates: Array<{ runningMode: "VIDEO" | "IMAGE"; delegate: "GPU" | "CPU"; backend: "tasks_video" | "tasks_image" }> = isLikelyLowPowerMobile
          ? [
            { runningMode: "VIDEO", delegate: "CPU", backend: "tasks_video" },
            { runningMode: "VIDEO", delegate: "GPU", backend: "tasks_video" },
            { runningMode: "IMAGE", delegate: "CPU", backend: "tasks_image" },
            { runningMode: "IMAGE", delegate: "GPU", backend: "tasks_image" },
          ]
          : [
            { runningMode: "VIDEO", delegate: "GPU", backend: "tasks_video" },
            { runningMode: "VIDEO", delegate: "CPU", backend: "tasks_video" },
            { runningMode: "IMAGE", delegate: "GPU", backend: "tasks_image" },
            { runningMode: "IMAGE", delegate: "CPU", backend: "tasks_image" },
          ];
        for (const candidate of candidates) {
          try {
            handLandmarker = await withSuppressedMediapipeConsoleAsync(() => HandLandmarker.createFromOptions(filesetResolver, {
              baseOptions: {
                modelAssetPath: handModelPath,
                delegate: candidate.delegate,
              },
              runningMode: candidate.runningMode,
              numHands: 2,
              minHandDetectionConfidence: 0.25,
              minHandPresenceConfidence: 0.25,
              minTrackingConfidence: 0.25,
            }));
            backend = candidate.backend;
            break;
          } catch (err) {
            handErrors.push(`${candidate.runningMode.toLowerCase()}_${candidate.delegate.toLowerCase()}: ${String((err as Error)?.message || err)}`);
          }
        }
        if (!handLandmarker) {
          throw new Error(`hand_detector_unavailable: ${handErrors.join(" | ") || "no_backend"}`);
        }

        handsRef.current = handLandmarker;
        handBackendRef.current = backend;
        setDetectorBackend(backend === "tasks_image" ? "TASKS IMAGE" : "TASKS VIDEO");
        setDetectorError(handErrors.length > 0 ? handErrors.slice(0, 2).join(" | ") : "");
        if (cancelled) return;

        if ((isSharinganChargedMode || shouldPrioritizeFaceAnchor || !isLikelyLowPowerMobile) && FaceLandmarker?.createFromOptions) {
          const faceModelPath = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
          const faceCandidates: Array<"GPU" | "CPU"> = ["GPU", "CPU"];
          for (const delegate of faceCandidates) {
            try {
              faceRef.current = await withSuppressedMediapipeConsoleAsync(() => FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                  modelAssetPath: faceModelPath,
                  delegate,
                },
                runningMode: "VIDEO",
                numFaces: 1,
                minFaceDetectionConfidence: 0.35,
                minFacePresenceConfidence: 0.35,
                minTrackingConfidence: 0.35,
                outputFaceBlendshapes: isSharinganChargedMode,
              }));
              break;
            } catch (err) {
              const faceErr = `face_${delegate.toLowerCase()}: ${String((err as Error)?.message || err)}`;
              setDetectorError((prev) => (prev ? `${prev} | ${faceErr}` : faceErr));
            }
          }
        }

        setLoadingMessage("Starting camera...");
        const stream = await getStreamWithPreferences(cameraIdx, resolutionIdx, isLikelyLowPowerMobile);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        if (!videoRef.current) throw new Error("Video element unavailable");
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (cancelled) return;
        videoStallSinceRef.current = 0;
        lastVideoMediaTimeRef.current = -1;
        lastRenderDrawAtRef.current = 0;
        cameraFpsWindowStartRef.current = 0;
        cameraFpsFrameCountRef.current = 0;
        fpsRef.current = 0;
        setFps(0);
        clearCameraFailure();

        if (cameraTrackCleanupRef.current) {
          cameraTrackCleanupRef.current();
          cameraTrackCleanupRef.current = null;
        }
        const track = stream.getVideoTracks()[0] || null;
        if (!track) {
          markCameraFailure("disconnected", "camera_track_missing");
        } else {
          const onEnded = () => markCameraFailure("disconnected", "camera_track_ended");
          const onMute = () => markCameraFailure("blocked", "camera_track_muted");
          const onUnmute = () => {
            videoStallSinceRef.current = 0;
            clearCameraFailure();
          };
          track.addEventListener("ended", onEnded);
          track.addEventListener("mute", onMute);
          track.addEventListener("unmute", onUnmute);
          cameraTrackCleanupRef.current = () => {
            track.removeEventListener("ended", onEnded);
            track.removeEventListener("mute", onMute);
            track.removeEventListener("unmute", onUnmute);
          };
        }

        setErrorMessage("");
        setPhase("ready");
        phaseRef.current = "ready";
      } catch (err) {
        const message = String((err as Error)?.message || err || "Failed to initialize arena");
        setDetectorBackend("NONE");
        setDetectorError((prev) => prev || message);
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
      if (cameraTrackCleanupRef.current) {
        cameraTrackCleanupRef.current();
        cameraTrackCleanupRef.current = null;
      }
      if (handsRef.current && typeof handsRef.current.close === "function") {
        handsRef.current.close();
      }
      handsRef.current = null;
      if (faceRef.current && typeof faceRef.current.close === "function") {
        faceRef.current.close();
      }
      faceRef.current = null;
      if (selfieSegmentationRef.current && typeof selfieSegmentationRef.current.close === "function") {
        selfieSegmentationRef.current.close();
      }
      selfieSegmentationRef.current = null;
      shadowCloneLayerCanvasRef.current = null;
      shadowCloneLayerCtxRef.current = null;
      shadowCloneSmokeCanvasRef.current = null;
      shadowCloneSmokeCtxRef.current = null;
      sharinganForegroundLayerCanvasRef.current = null;
      sharinganForegroundLayerCtxRef.current = null;
      reaperLayerCanvasRef.current = null;
      reaperLayerCtxRef.current = null;
      reaperBgImageRef.current = null;
      shadowCloneSmokeFramesRef.current = [];
      reaperEffectStartAtRef.current = 0;
      clearShadowCloneOverlay(true);
      clearSharinganForegroundOverlay();
      clearReaperCompositeOverlay();
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
      if (sharinganBloodAnimRafRef.current) {
        cancelAnimationFrame(sharinganBloodAnimRafRef.current);
        sharinganBloodAnimRafRef.current = 0;
      }
      sharinganBloodAnimStartAtRef.current = 0;
      sharinganPoseRef.current = null;
      sharinganFaceLandmarksRef.current = null;
      sharinganSmoothEyesRef.current = null;
      phoenixLastAtRef.current = 0;
      if (xpPopupTimerRef.current) {
        window.clearTimeout(xpPopupTimerRef.current);
        xpPopupTimerRef.current = null;
      }
      for (const timer of pendingEffectTimersRef.current) {
        window.clearTimeout(timer);
      }
      pendingEffectTimersRef.current = [];
      for (const timer of pendingSoundTimersRef.current) {
        window.clearTimeout(timer);
      }
      pendingSoundTimersRef.current = [];
      runFinishedRef.current = false;
      calibrationDiagRestoreRef.current = null;
      autoSubmitTriggeredRef.current = false;
      submitInFlightRef.current = false;
      submittedRef.current = false;
      handBackendRef.current = "none";
      cameraFailureRef.current = "none";
      setCameraFailure("none");
      lastRenderDrawAtRef.current = 0;
      cameraFpsWindowStartRef.current = 0;
      cameraFpsFrameCountRef.current = 0;
      fpsRef.current = 0;
      setFps(0);
      voteWindowRef.current = [];
      voteStableRef.current = { label: "idle", confidence: 0, timeMs: 0 };
      handSlotsRef.current = [null, null];
      latestLandmarksRef.current = [];
      sampleCtxRef.current = null;
      sampleCanvasRef.current = null;
    };
  }, [
    cameraIdx,
    clearCameraFailure,
    clearReaperCompositeOverlay,
    clearShadowCloneOverlay,
    clearSharinganForegroundOverlay,
    isLikelyLowPowerMobile,
    isSharinganChargedMode,
    shouldPrioritizeFaceAnchor,
    markCameraFailure,
    resolutionIdx,
  ]);

  useEffect(() => {
    if (phaseRef.current === "loading" || phaseRef.current === "error") return;
    let cancelled = false;
    void (async () => {
      try {
        await ensureDatasetRowsForSequence(sequenceRef.current);
      } catch (err) {
        if (cancelled) return;
        const message = String((err as Error)?.message || err || "dataset_preload_failed");
        setDetectorError((prev) => {
          const token = `dataset: ${message}`;
          if (prev.includes(token)) return prev;
          return prev ? `${prev} | ${token}` : token;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureDatasetRowsForSequence, sequenceKey]);

  useEffect(() => {
    if (phase === "ready" && sfxReady && (mode === "free" || mode === "calibration")) {
      const timer = window.setTimeout(() => startRun(), 120);
      return () => window.clearTimeout(timer);
    }
    return;
  }, [mode, phase, sfxReady, startRun]);

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
    if (!videoRef.current || !canvasRef.current) return;

    const render = () => {
      renderRafRef.current = requestAnimationFrame(render);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const nowMs = performance.now();
      if ((nowMs - lastRenderDrawAtRef.current) < RENDER_FRAME_INTERVAL_MS) return;
      lastRenderDrawAtRef.current = nowMs;
      const stream = streamRef.current;
      const track = stream?.getVideoTracks?.()[0] ?? null;
      if (!stream || !track || track.readyState === "ended") {
        markCameraFailure("disconnected", "camera_track_unavailable");
        fpsRef.current = 0;
        setFps(0);
        return;
      }

      if (video.readyState < 2) {
        if (!videoStallSinceRef.current) {
          videoStallSinceRef.current = nowMs;
        }
        if ((nowMs - videoStallSinceRef.current) >= CAMERA_STALL_TIMEOUT_MS) {
          markCameraFailure("blocked", "video_not_ready");
          fpsRef.current = 0;
          setFps(0);
        }
        return;
      }

      const mediaTime = Number(video.currentTime || 0);
      if (mediaTime > (lastVideoMediaTimeRef.current + 0.0005)) {
        lastVideoMediaTimeRef.current = mediaTime;
        videoStallSinceRef.current = 0;
        clearCameraFailure();
        if (!cameraFpsWindowStartRef.current) {
          cameraFpsWindowStartRef.current = nowMs;
        }
        cameraFpsFrameCountRef.current += 1;
        const fpsWindowMs = nowMs - cameraFpsWindowStartRef.current;
        if (fpsWindowMs >= 1000) {
          const measured = Math.round((cameraFpsFrameCountRef.current * 1000) / fpsWindowMs);
          fpsRef.current = Math.max(0, measured);
          setFps(fpsRef.current);
          cameraFpsFrameCountRef.current = 0;
          cameraFpsWindowStartRef.current = nowMs;
        }
      } else {
        if (!videoStallSinceRef.current) {
          videoStallSinceRef.current = nowMs;
        }
        if ((nowMs - videoStallSinceRef.current) >= CAMERA_STALL_TIMEOUT_MS) {
          markCameraFailure(track.muted ? "blocked" : "disconnected", "video_frame_stalled");
          fpsRef.current = 0;
          setFps(0);
        }
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const nextAspect = video.videoWidth / video.videoHeight;
        if (Number.isFinite(nextAspect) && Math.abs(nextAspect - videoAspectRef.current) > 0.01) {
          videoAspectRef.current = nextAspect;
          setVideoAspect(nextAspect);
        }
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      if (debugHands && fpsRef.current >= DEBUG_HANDS_MIN_FPS) {
        for (const hand of latestLandmarksRef.current) {
          drawLandmarks(ctx, hand, canvas.width, canvas.height);
        }
      }
    };

    renderRafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(renderRafRef.current);
  }, [clearCameraFailure, debugHands, markCameraFailure]);

  useEffect(() => {
    const detect = (nowMs: number) => {
      detectRafRef.current = requestAnimationFrame(detect);
      if (nowMs - lastDetectRef.current < DETECTION_INTERVAL_MS) return;
      lastDetectRef.current = nowMs;

      const video = videoRef.current;
      const hands = handsRef.current;
      const knn = knnRef.current;
      if (!video || !hands || !knn || video.readyState < 2) return;
      if (cameraFailureRef.current !== "none") {
        latestLandmarksRef.current = [];
        voteWindowRef.current = [];
        voteStableRef.current = { label: "idle", confidence: 0, timeMs: 0 };
        handSlotsRef.current = [null, null];
        sharinganPoseRef.current = null;
        sharinganFaceLandmarksRef.current = null;
        sharinganSmoothEyesRef.current = null;
        setSharinganVisualPose(null);
        setDetectedHands(0);
        setRawDetectedLabel("No hands");
        setRawDetectedConfidence(0);
        setVoteHits(0);
        setDetectedLabel("No hands");
        setDetectedConfidence(0);
        setEffectAnchor(null);
        setFaceAnchor(null);
        lastGoodFaceAnchorRef.current = null;
        lastGoodFaceAnchorAtRef.current = 0;
        setHeadYaw(0);
        setHeadPitch(0);
        return;
      }

      const phaseNow = phaseRef.current;
      const shouldTrackHands = phaseNow === "active" || phaseNow === "casting";
      if (!shouldTrackHands) {
        latestLandmarksRef.current = [];
        voteWindowRef.current = [];
        voteStableRef.current = { label: "idle", confidence: 0, timeMs: 0 };
        handSlotsRef.current = [null, null];
        oneHandSinceRef.current = 0;
        oneHandAssistUnlockedStepRef.current = -1;
        sharinganBlinkHoldStartedAtRef.current = 0;
        if (showTwoHandsGuideRef.current) {
          showTwoHandsGuideRef.current = false;
          setShowTwoHandsGuide(false);
        }
        if (isSharinganChargedMode) {
          sharinganPoseRef.current = null;
          sharinganFaceLandmarksRef.current = null;
          sharinganSmoothEyesRef.current = null;
          setSharinganVisualPose(null);
          setSharinganBlinkHoldMs(0);
        }
        setDetectedHands(0);
        setRawDetectedLabel("Idle");
        setRawDetectedConfidence(0);
        setVoteHits(0);
        setDetectedLabel("Idle");
        setDetectedConfidence(0);
        setEffectAnchor(null);
        setFaceAnchor(null);
        lastGoodFaceAnchorRef.current = null;
        lastGoodFaceAnchorAtRef.current = 0;
        setHeadYaw(0);
        setHeadPitch(0);
        return;
      }

      let result: HandsResultShape = { landmarks: [], handedness: [] };
      try {
        if (handBackendRef.current === "tasks_image" && typeof hands.detect === "function") {
          result = withSuppressedMediapipeConsole(() => (hands.detect!(video) as HandsResultShape) || result);
        } else if (typeof hands.detectForVideo === "function") {
          result = withSuppressedMediapipeConsole(() => (hands.detectForVideo!(video, nowMs) as HandsResultShape) || result);
        } else if (typeof hands.detect === "function") {
          result = withSuppressedMediapipeConsole(() => (hands.detect!(video) as HandsResultShape) || result);
        }
      } catch (err) {
        const message = String((err as Error)?.message || err || "hand_detect_failed");
        setDetectorError((prev) => {
          const token = `detect: ${message}`;
          if (prev.includes(token)) return prev;
          return prev ? `${prev} | ${token}` : token;
        });
      }

      latestLandmarksRef.current = result.landmarks ?? [];
      const twoHandDistanceNow = computeTwoHandDistance(
        result.landmarks ?? [],
        Number(video.videoWidth || 0),
        Number(video.videoHeight || 0),
      );
      const face = faceRef.current;
      let faceMotion: FaceMotionState = { anchor: null, yaw: 0, pitch: 0 };
      let faceResult: FaceResultShape = { faceLandmarks: [], faceBlendshapes: [] };
      let blinkLeftScore = 0;
      let blinkRightScore = 0;
      const shouldUseFaceTracking = phaseNow === "casting" || (isSharinganChargedMode && phaseNow === "active");
      if (shouldUseFaceTracking && face) {
        try {
          faceResult = { faceLandmarks: [], faceBlendshapes: [] };
          if (typeof face.detectForVideo === "function") {
            faceResult = withSuppressedMediapipeConsole(() => (face.detectForVideo!(video, nowMs) as FaceResultShape) || faceResult);
          } else if (typeof face.detect === "function") {
            faceResult = withSuppressedMediapipeConsole(() => (face.detect!(video) as FaceResultShape) || faceResult);
          }
          const firstFace = faceResult.faceLandmarks?.[0];
          if (Array.isArray(firstFace) && firstFace.length > 0) {
            faceMotion = computeFaceMotion(firstFace);
            if (isSharinganChargedMode) {
              sharinganFaceLandmarksRef.current = firstFace;
              const rawPose = buildSharinganVisualPose(firstFace);
              if (rawPose) {
                const smoothedPose = smoothSharinganVisualPose(sharinganPoseRef.current, rawPose);
                sharinganPoseRef.current = smoothedPose;
                setSharinganVisualPose(smoothedPose);
              } else {
                sharinganPoseRef.current = null;
                sharinganFaceLandmarksRef.current = null;
                sharinganSmoothEyesRef.current = null;
                setSharinganVisualPose(null);
              }
            }
          } else if (isSharinganChargedMode) {
            sharinganPoseRef.current = null;
            sharinganFaceLandmarksRef.current = null;
            sharinganSmoothEyesRef.current = null;
            setSharinganVisualPose(null);
          }
          if (isSharinganChargedMode && phaseNow === "active") {
            blinkLeftScore = getFaceBlendshapeScore(faceResult, "eyeBlinkLeft");
            blinkRightScore = getFaceBlendshapeScore(faceResult, "eyeBlinkRight");
          }
        } catch (err) {
          if (isSharinganChargedMode) {
            sharinganPoseRef.current = null;
            sharinganFaceLandmarksRef.current = null;
            sharinganSmoothEyesRef.current = null;
            setSharinganVisualPose(null);
          }
          const message = String((err as Error)?.message || err || "face_detect_failed");
          setDetectorError((prev) => {
            const token = `face: ${message}`;
            if (prev.includes(token)) return prev;
            return prev ? `${prev} | ${token}` : token;
          });
        }
      }
      if (isSharinganChargedMode && !shouldUseFaceTracking) {
        sharinganPoseRef.current = null;
        sharinganFaceLandmarksRef.current = null;
        sharinganSmoothEyesRef.current = null;
        setSharinganVisualPose(null);
      }
      setFaceAnchor(faceMotion.anchor);
      if (faceMotion.anchor) {
        lastGoodFaceAnchorRef.current = faceMotion.anchor;
        lastGoodFaceAnchorAtRef.current = nowMs;
      }
      setHeadYaw(faceMotion.yaw);
      setHeadPitch(faceMotion.pitch);
      const handAnchor = computeEffectAnchor(result.landmarks ?? []);
      setEffectAnchor(handAnchor || (
        faceMotion.anchor
          ? { x: faceMotion.anchor.x, y: faceMotion.anchor.y, scale: 1 }
          : null
      ));
      const { features, numHands, imputedHands } = buildFeatures(result, handSlotsRef.current);
      setDetectedHands(numHands);
      const stepIdxForAssist = currentStepRef.current;
      const expectedStepSign = stepIdxForAssist < sequence.length ? sequence[stepIdxForAssist] : "";
      const assistModeEnabled = !restrictedSigns;
      const lowFpsAssistActive = isLikelyLowPowerMobile && fpsRef.current > 0 && fpsRef.current < LOW_FPS_ASSIST_THRESHOLD;
      const assistUnlockedForStep = assistModeEnabled && oneHandAssistUnlockedStepRef.current === stepIdxForAssist;
      const requiresTwoHandsNow = restrictedSigns;
      const exceedsTwoHandDistanceGate = Boolean(
        requiresTwoHandsNow
        && numHands >= 2
        && twoHandDistanceNow
        && Number.isFinite(twoHandDistanceNow.norm)
        && twoHandDistanceNow.norm > TWO_HAND_EXEC_DISTANCE_MAX,
      );
      const effectiveVoteMinConfidence = restrictedSigns
        ? GAME_MIN_CONFIDENCE
        : (numHands >= 2 ? GAME_MIN_CONFIDENCE : ONE_HAND_PASS_GATE_MIN_CONFIDENCE);
      const sharinganBlinkClosed = blinkLeftScore > SHARINGAN_BLINK_THRESHOLD && blinkRightScore > SHARINGAN_BLINK_THRESHOLD;

      if (phaseNow !== "active") {
        return;
      }

      if (isSharinganChargedMode) {
        oneHandSinceRef.current = 0;
        oneHandAssistUnlockedStepRef.current = -1;
        if (showTwoHandsGuideRef.current) {
          showTwoHandsGuideRef.current = false;
          setShowTwoHandsGuide(false);
        }

        const faceTracked = faceMotion.anchor !== null;
        if (!faceTracked) {
          sharinganBlinkHoldStartedAtRef.current = 0;
          setSharinganBlinkHoldMs(0);
          setRawDetectedLabel("Face not found");
          setRawDetectedConfidence(0);
          setVoteHits(0);
          setDetectedLabel("Center your face");
          setDetectedConfidence(0);
          return;
        }

        if (!sharinganBlinkClosed) {
          sharinganBlinkHoldStartedAtRef.current = 0;
          setSharinganBlinkHoldMs(0);
          setRawDetectedLabel("Open eyes");
          setRawDetectedConfidence(0);
          setVoteHits(0);
          setDetectedLabel("Close both eyes");
          setDetectedConfidence(0);
          return;
        }

        if (!sharinganBlinkHoldStartedAtRef.current) {
          sharinganBlinkHoldStartedAtRef.current = nowMs;
        }
        const holdMs = Math.max(0, nowMs - sharinganBlinkHoldStartedAtRef.current);
        const holdClamped = Math.min(SHARINGAN_BLINK_HOLD_MS, holdMs);
        const holdRatio = SHARINGAN_BLINK_HOLD_MS > 0 ? (holdClamped / SHARINGAN_BLINK_HOLD_MS) : 0;
        setSharinganBlinkHoldMs(holdClamped);
        setRawDetectedLabel("Eyes closed");
        setRawDetectedConfidence(holdRatio);
        setVoteHits(Math.min(VOTE_WINDOW_SIZE, Math.ceil(holdRatio * VOTE_WINDOW_SIZE)));
        setDetectedLabel(sharinganChargeLabel);
        setDetectedConfidence(holdRatio);

        if (holdMs < SHARINGAN_BLINK_HOLD_MS) {
          return;
        }
        if ((nowMs - lastAcceptedAtRef.current) < SIGN_ACCEPT_COOLDOWN_MS) {
          return;
        }

        lastAcceptedAtRef.current = nowMs;
        currentStepRef.current = sequence.length;
        signsLandedRef.current = sequence.length;
        setCurrentStep(sequence.length);
        setSignsLanded(sequence.length);
        if (isRankMode) {
          appendProofEvent("sharingan_blink_trigger", nowMs, {
            left: Number(blinkLeftScore.toFixed(3)),
            right: Number(blinkRightScore.toFixed(3)),
            hold_ms: Math.round(holdMs),
            threshold: SHARINGAN_BLINK_THRESHOLD,
          });
        }
        finishRun(nowMs);
        return;
      }

      if (requiresTwoHandsNow && numHands > 0 && numHands < 2) {
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
        voteStableRef.current = { label: "idle", confidence: 0, timeMs: 0 };
        setRawDetectedLabel("No hands");
        setRawDetectedConfidence(0);
        setVoteHits(0);
        setDetectedLabel("No hands");
        setDetectedConfidence(0);
      } else {
        const prediction = assistModeEnabled && numHands < 2
          ? predictWithOneHandAssist(knn, result, features, expectedStepSign, lowFpsAssistActive)
          : knn.predictWithConfidence(features);
        rawLabel = normalizeLabel(prediction.label || "idle");
        rawConfidence = Math.max(0, Number(prediction.confidence || 0));
        if (imputedHands > 0) {
          rawConfidence *= imputedHands >= 2 ? 0.72 : 0.88;
        }

      if (!isCalibrationMode && requiresTwoHandsNow && (numHands < 2 || exceedsTwoHandDistanceGate)) {
        if (numHands < 2) {
          const matchedExpectedWithOneHand = expectedStepSign
            ? signsMatch(
              rawLabel,
              rawConfidence,
              expectedStepSign,
              rawLabel,
              rawConfidence,
              effectiveVoteMinConfidence,
              ramTigerShared,
            )
            : false;
          if (assistModeEnabled && !assistUnlockedForStep && matchedExpectedWithOneHand) {
            oneHandAssistUnlockedStepRef.current = stepIdxForAssist;
          }
        }
        voteWindowRef.current = [];
        voteStableRef.current = { label: "idle", confidence: 0, timeMs: 0 };
        setRawDetectedLabel(exceedsTwoHandDistanceGate ? "Bring hands closer" : "Show both hands");
        setRawDetectedConfidence(0);
        setVoteHits(0);
        setDetectedLabel(exceedsTwoHandDistanceGate ? "Bring hands closer" : "Show both hands");
        setDetectedConfidence(0);
        return;
      }

        const lightingPass = !isRankMode || lightingStatusRef.current === "good";
        const allowDetection = lightingPass
          && numHands > 0
          && (!requiresTwoHandsNow || numHands >= 2)
          && (!requiresTwoHandsNow || !exceedsTwoHandDistanceGate);
        const voteTtlMs = lowFpsAssistActive ? LOW_FPS_VOTE_TTL_MS : VOTE_TTL_MS;
        const vote = applyTemporalVote(
          voteWindowRef.current,
          rawLabel,
          rawConfidence,
          nowMs,
          allowDetection,
          VOTE_WINDOW_SIZE,
          voteTtlMs,
          activeCalibrationProfile.voteRequiredHits,
          effectiveVoteMinConfidence,
          voteStableRef.current,
          VOTE_OCCLUSION_GRACE_MS,
          VOTE_REUSE_CONF_DECAY,
        );

        voteWindowRef.current = vote.nextWindow;
        voteStableRef.current = vote.nextStableState;
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
        stableConfidence,
        expected,
        rawLabel,
        rawConfidence,
        effectiveVoteMinConfidence,
        ramTigerShared,
      )) return;

      playSfx("/sounds/each.mp3", 0.9);
      lastAcceptedAtRef.current = nowMs;

      const nextStep = stepIdx + 1;
      const nextSigns = signsLandedRef.current + 1;
      oneHandAssistUnlockedStepRef.current = -1;
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
        const finalEffectToken = normalizeLabel(String(jutsu?.effect || ""));
        const isFinalStep = nextStep >= sequence.length;
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
            const partName = String(part.name || jutsuName);
            const partEffectName = String(part.effect || "").toLowerCase();
            const partEffectToken = normalizeLabel(partEffectName);
            const shouldDeferPartCastToFinish = isFinalStep && partEffectToken === finalEffectToken;
            if (!shouldDeferPartCastToFinish) {
              triggerJutsuSignature(partName, partEffectName, { volume: 0.95 });
              if (partEffectToken === "clone") {
                triggerJutsuEffect(partEffectName, COMBO_CLONE_HOLD_DURATION_MS);
              } else {
                triggerJutsuEffect(partEffectName, COMBO_PART_EFFECT_DURATION_MS);
              }
            }
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
    easyMode,
    isCalibrationMode,
    isRankMode,
    jutsu?.comboParts,
    jutsu?.effect,
    jutsuName,
    playSfx,
    pushComboCue,
    ramTigerShared,
    restrictedSigns,
    sequence,
    sharinganChargeLabel,
    isSharinganChargedMode,
    isLikelyLowPowerMobile,
    triggerJutsuSignature,
    triggerJutsuEffect,
  ]);

  useEffect(() => {
    const shouldAutoSubmit = !isCalibrationMode
      && !submittedRef.current
      && !submitInFlightRef.current
      && (
        phase === "completed"
        || (phase === "casting" && runFinishedRef.current)
      );
    if (!shouldAutoSubmit || autoSubmitTriggeredRef.current) return;
    autoSubmitTriggeredRef.current = true;
    const timer = window.setTimeout(() => {
      void handleSubmitResult();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [handleSubmitResult, isCalibrationMode, phase]);

  useEffect(() => {
    if (isCalibrationMode) return;

    const flushSubmitOnExit = () => {
      const phaseNow = phaseRef.current;
      const canSubmit = runFinishedRef.current
        && (phaseNow === "casting" || phaseNow === "completed");
      if (!canSubmit || busy) return;
      if (submittedRef.current || submitInFlightRef.current) return;
      autoSubmitTriggeredRef.current = true;
      void handleSubmitResult();
    };

    const onPageHide = () => {
      flushSubmitOnExit();
    };
    const onBeforeUnload = () => {
      flushSubmitOnExit();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushSubmitOnExit();
      }
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [busy, handleSubmitResult, isCalibrationMode]);

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

    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    const stickyFaceAnchor = lastGoodFaceAnchorRef.current
      && (nowMs - lastGoodFaceAnchorAtRef.current) <= FACE_ANCHOR_STICKY_MS
      ? lastGoodFaceAnchorRef.current
      : null;
    const anchor = faceAnchorRef.current || stickyFaceAnchor || DEFAULT_MOUTH_ANCHOR;
    const cx = anchor.x;
    const cy = anchor.y;
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
      const windBias = clamp(headYawRef.current, -1, 1) * 0.55;
      const pitchLift = clamp(headPitchRef.current, -1, 1) * 0.35;

      balls = balls.map((ball) => {
        const jitterX = (Math.random() - 0.5) * 0.5;
        const jitterY = (Math.random() - 0.5) * 0.4;
        let vx = ball.vx + ((jitterX + windBias) * dt);
        let vy = ball.vy + ((jitterY - pitchLift) * dt);
        if (Math.random() < (2 * dt)) {
          const impulse = 0.22 + (Math.random() * 0.34);
          const theta = (Math.random() * Math.PI * 2) - Math.PI;
          vx += Math.cos(theta) * impulse;
          vy += Math.sin(theta) * impulse;
        }
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

  const sequenceProgressStep = phase === "casting" ? sequence.length : currentStep;
  const sequenceProgressPct = sequence.length > 0
    ? Math.min(100, Math.round((sequenceProgressStep / sequence.length) * 100))
    : 0;
  const sharinganBlinkProgressPct = Math.min(
    100,
    Math.round((Math.max(0, Math.min(SHARINGAN_BLINK_HOLD_MS, sharinganBlinkHoldMs)) / SHARINGAN_BLINK_HOLD_MS) * 100),
  );
  const iconLayout = useMemo(() => {
    const n = Math.max(1, sequence.length);
    const maxIconSize = isViewportFitSession ? 68 : 80;
    const minIconSize = isViewportFitSession ? 34 : 40;
    const gap = isViewportFitSession ? 10 : 12;
    const maxTotalWidth = isViewportFitSession ? 760 : 840;
    let iconSize = maxIconSize;
    let totalWidth = (n * iconSize) + ((n - 1) * gap);
    if (totalWidth > maxTotalWidth) {
      iconSize = Math.floor((maxTotalWidth - ((n - 1) * gap)) / n);
      iconSize = Math.max(minIconSize, iconSize);
      totalWidth = (n * iconSize) + ((n - 1) * gap);
    }
    return { iconSize, gap, totalWidth };
  }, [isViewportFitSession, sequence.length]);
  const calibrationProgressPct = Math.min(
    100,
    Math.round((1 - (calibrationSecondsLeft / CALIBRATION_DURATION_S)) * 100),
  );
  const progressPct = isCalibrationMode
    ? calibrationProgressPct
    : isSharinganChargedMode
      ? sharinganBlinkProgressPct
      : sequenceProgressPct;
  const sfxLoadPct = sfxLoadTotal > 0
    ? Math.round((Math.max(0, Math.min(sfxLoadTotal, sfxLoadCompleted)) / sfxLoadTotal) * 100)
    : 100;

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

  const iconProgressStep = phase === "casting" ? sequence.length : currentStep;
  const nextSign = currentStep < sequence.length ? toDisplayLabel(sequence[currentStep]).toUpperCase() : "COMPLETE";
  const sharinganHoldSeconds = `${(Math.max(0, Math.min(SHARINGAN_BLINK_HOLD_MS, sharinganBlinkHoldMs)) / 1000).toFixed(1)}S`;
  const sharinganTargetSeconds = `${(SHARINGAN_BLINK_HOLD_MS / 1000).toFixed(1)}S`;

  const iconBarStatus = isCalibrationMode
    ? phase === "active"
      ? `CALIBRATING • ${Math.ceil(calibrationSecondsLeft)}S LEFT`
      : phase === "completed"
        ? "CALIBRATION COMPLETE"
        : "CAPTURE LIGHTING + CONFIDENCE PROFILE"
    : isSharinganChargedMode
      ? phase === "casting"
        ? `CASTING • ${String(jutsu?.displayText || "JUTSU").toUpperCase()}`
        : phase === "countdown"
          ? "GET READY..."
          : phase === "active"
            ? `CLOSE BOTH EYES • ${sharinganHoldSeconds} / ${sharinganTargetSeconds}`
            : `TRIGGER: CLOSE BOTH EYES FOR ${sharinganTargetSeconds}`
      : phase === "casting"
        ? `CASTING • ${String(jutsu?.displayText || "JUTSU").toUpperCase()}`
        : phase === "countdown"
          ? "GET READY..."
          : `NEXT SIGN: ${nextSign}`;
  const iconBarStatusColorClass = isCalibrationMode
    ? "text-ninja-accent"
    : phase === "casting"
      ? "text-orange-200"
      : isSharinganChargedMode
        ? "text-rose-100"
        : "text-white";

  const hudLevel = Math.max(0, Math.floor(Number(progressionHud?.level) || 0));
  const hudXp = Math.max(0, Math.floor(Number(progressionHud?.xp) || 0));
  const hudRank = String(progressionHud?.rank || "Academy Student");
  const hudPrevLevelXp = Math.max(0, getXpForLevel(hudLevel));
  const hudNextXp = Math.max(
    hudPrevLevelXp + 1,
    Math.floor(Number(progressionHud?.xpToNextLevel) || getXpForLevel(Math.max(1, hudLevel + 1))),
  );
  const hudXpRequired = Math.max(1, hudNextXp - hudPrevLevelXp);
  const hudXpIntoLevel = Math.max(0, Math.min(hudXpRequired, hudXp - hudPrevLevelXp));
  const hudProgressPct = Math.max(0, Math.min(100, ((hudXpIntoLevel / hudXpRequired) * 100)));
  const showNavArrows = !isCalibrationMode && canSwitchJutsuNow() && Boolean(onPrevJutsu || onNextJutsu);
  const datasetVersionLabel = datasetVersionToken === "local" ? "LOCAL" : datasetVersionToken;
  const datasetSyncLabel = datasetSyncedAt > 0
    ? new Date(datasetSyncedAt).toLocaleTimeString([], { hour12: false })
    : "--:--:--";

  const effectLabel = String(activeEffect || jutsu?.effect || "").toLowerCase();
  const effectVideo = effectLabel === "lightning"
    ? {
      webm: "/effects/chidori-alpha.webm",
      mp4: "/effects/chidori.mp4",
    }
    : effectLabel === "rasengan"
      ? {
        webm: "/effects/rasengan-alpha.webm",
        mp4: "/effects/rasengan.mp4",
      }
      : null;
  const isPhoenixFireEffect = effectLabel === "fire" && normalizeLabel(jutsuName).includes("phoenix");
  const showSpeedHud = isRankMode && phase !== "loading" && phase !== "error";
  const showSignChip = phase === "active"
    && !isCalibrationMode
    && !["idle", "unknown", "no hands"].includes(normalizeLabel(detectedLabel));
  const signChipTopClass = showSpeedHud ? "top-[98px] md:top-[15px]" : "top-[66px] md:top-[15px]";
  const detectionPanelTopClass = showSpeedHud || showSignChip
    ? "top-[132px] md:top-[56px]"
    : "top-[102px] md:top-[56px]";
  const detectedConfidencePct = Math.round(detectedConfidence * 100);
  const rawDetectedConfidencePct = Math.round(rawDetectedConfidence * 100);
  const effectiveVoteMinConfidence = restrictedSigns
    ? GAME_MIN_CONFIDENCE
    : (detectedHands >= 2 ? GAME_MIN_CONFIDENCE : ONE_HAND_PASS_GATE_MIN_CONFIDENCE);
  const voteMinConfidencePct = Math.round(effectiveVoteMinConfidence * 100);
  const diagCalibrationText = isCalibrationMode && phase === "active"
    ? `CALIBRATING ${calibrationProgressPct}%`
    : "PRESS C TO CALIBRATE";
  const cameraStatusText = cameraFailure === "none" ? "OK" : cameraFailure.toUpperCase();
  const effectAnchorX = Math.round((effectAnchor?.x ?? 0.5) * 1000) / 10;
  const effectAnchorY = Math.round((effectAnchor?.y ?? 0.64) * 1000) / 10;
  const faceAnchorSampleNowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const stickyFaceAnchor = lastGoodFaceAnchorRef.current
    && (faceAnchorSampleNowMs - lastGoodFaceAnchorAtRef.current) <= FACE_ANCHOR_STICKY_MS
    ? lastGoodFaceAnchorRef.current
    : null;
  const fireFaceAnchor = faceAnchor ?? stickyFaceAnchor ?? DEFAULT_MOUTH_ANCHOR;
  const fireAnchorX = Math.round((clamp(fireFaceAnchor.x, 0.04, 0.96) * 1000)) / 10;
  const fireAnchorY = Math.round((clamp(fireFaceAnchor.y, 0.08, 0.92) * 1000)) / 10;
  const fireAimYaw = clamp(-headYaw, -1, 1);
  const fireAimPitch = clamp(-headPitch, -1, 1);
  const fireAimShiftXPct = fireAimYaw * 4.2;
  const fireAimShiftYPct = fireAimPitch * 3.6;
  const fireOffsetX = FIRE_MOUTH_OFFSET_X_PCT;
  const fireOffsetY = FIRE_MOUTH_OFFSET_Y_PCT;
  const fireFinalX = Math.round((clamp((fireAnchorX + fireOffsetX + fireAimShiftXPct) / 100, 0, 1) * 1000)) / 10;
  const fireFinalY = Math.round((clamp((fireAnchorY + fireOffsetY + fireAimShiftYPct) / 100, 0, 1) * 1000)) / 10;
  const fireBlastWidth = Math.max(140, Math.min(250, Math.round(170 + (Math.abs(fireAimYaw) * 64))));
  const fireBlastHeight = Math.max(140, Math.min(250, Math.round(170 + (Math.abs(fireAimPitch) * 54))));
  const fireThreeSizePx = Math.max(260, Math.min(620, Math.round((fireBlastWidth + fireBlastHeight) * 1.45)));
  const detectorErrorShort = detectorError
    ? `${detectorError.slice(0, 120)}${detectorError.length > 120 ? "..." : ""}`
    : "none";
  const lowFpsAssistActive = isLikelyLowPowerMobile && fps > 0 && fps < LOW_FPS_ASSIST_THRESHOLD;
  const effectScale = effectAnchor?.scale ?? 1;
  const effectBaseSize = effectLabel === "lightning"
    ? 620
    : effectLabel === "rasengan"
      ? 520
      : 560;
  const effectSizePx = Math.max(280, Math.min(920, Math.round(effectBaseSize * effectScale)));

  useEffect(() => {
    sharinganEyeTexturePathRef.current = sharinganEyeTexturePath;
  }, [sharinganEyeTexturePath]);

  useEffect(() => {
    sharinganBloodFrameRef.current = sharinganBloodFrame;
  }, [sharinganBloodFrame]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cache = sharinganAssetImageCacheRef.current;
    getCachedImage(cache, "/sharingan.png");
    getCachedImage(cache, "/mangekyou_eyes.png");
  }, []);

  useEffect(() => {
    const isSharinganEffectActive = showJutsuEffect && effectLabel === "eye";
    if (!isSharinganEffectActive) {
      if (sharinganBloodAnimRafRef.current) {
        cancelAnimationFrame(sharinganBloodAnimRafRef.current);
        sharinganBloodAnimRafRef.current = 0;
      }
      sharinganBloodAnimStartAtRef.current = 0;
      setSharinganBloodFrame(SHARINGAN_BLOOD_FRAME_START);
      return;
    }

    sharinganBloodAnimStartAtRef.current = performance.now();
    setSharinganBloodFrame(SHARINGAN_BLOOD_FRAME_START);

    const tick = () => {
      if (!sharinganBloodAnimStartAtRef.current) return;
      const elapsedMs = Math.max(0, performance.now() - sharinganBloodAnimStartAtRef.current);
      const frameAdvance = Math.floor((elapsedMs / 1000) * SHARINGAN_BLOOD_FRAME_RATE);
      const frame = Math.min(SHARINGAN_BLOOD_FRAME_END, SHARINGAN_BLOOD_FRAME_START + frameAdvance);
      setSharinganBloodFrame(frame);
      if (frame >= SHARINGAN_BLOOD_FRAME_END) {
        sharinganBloodAnimRafRef.current = 0;
        return;
      }
      sharinganBloodAnimRafRef.current = requestAnimationFrame(tick);
    };

    sharinganBloodAnimRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (sharinganBloodAnimRafRef.current) {
        cancelAnimationFrame(sharinganBloodAnimRafRef.current);
        sharinganBloodAnimRafRef.current = 0;
      }
    };
  }, [effectLabel, showJutsuEffect]);

  useEffect(() => {
    if (typeof window === "undefined" || isCalibrationMode) return;
    const strip = sequenceStripRef.current;
    if (!strip) return;
    if (strip.scrollWidth <= strip.clientWidth + 4) return;

    const isMobileViewport = window.matchMedia("(max-width: 900px)").matches || isViewportFitSession;
    if (!isMobileViewport) return;

    const maxIndex = Math.max(0, sequence.length - 1);
    const targetIndex = Math.max(0, Math.min(maxIndex, iconProgressStep));
    const targetEl = sequenceTileRefs.current[targetIndex];
    if (!targetEl) return;

    const stripRect = strip.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const targetCenter =
      (targetRect.left - stripRect.left) + strip.scrollLeft + (targetRect.width / 2);
    const desiredLeft = targetCenter - (strip.clientWidth / 2);
    const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const clampedLeft = Math.max(0, Math.min(maxScrollLeft, desiredLeft));

    if (Math.abs(strip.scrollLeft - clampedLeft) < 2) return;
    strip.scrollTo({ left: clampedLeft, behavior: "smooth" });
  }, [iconProgressStep, isCalibrationMode, isViewportFitSession, sequence.length, sequenceKey]);
  const tripleOffsets = comboTripleEffect !== "none" ? [-24, 24] : [0];
  const arenaStageMaxWidthClass = isViewportFitSession ? "max-w-[1040px]" : "max-w-[900px] lg:max-w-[680px] xl:max-w-[720px]";
  const topControlChips = (
    <>
      <button
        type="button"
        onClick={() => setShowModelInfo(true)}
        className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border border-sky-300/70 bg-[#12182d]/95 text-sky-200 hover:bg-[#1a2545] md:h-[22px] md:w-[22px]"
      >
        <Info className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => setShowModelInfo(true)}
        className="inline-flex h-[30px] min-w-[128px] items-center justify-center rounded-[8px] border border-emerald-300/55 bg-[#1a1a23]/92 px-3 text-[10px] font-bold text-zinc-100 hover:bg-[#21212d] sm:min-w-[158px] md:w-[182px] md:text-[11px]"
      >
        MODEL: MEDIAPIPE
      </button>
      <button
        type="button"
        onClick={() => setShowDetectionPanel((prev) => !prev)}
        className="inline-flex h-[30px] min-w-[102px] items-center justify-center rounded-[8px] border border-zinc-500/55 bg-[#1b1b24]/90 px-3 text-[10px] font-bold text-zinc-200 hover:bg-[#242432] sm:min-w-[118px] md:w-[126px] md:text-[11px]"
      >
        DIAG: {showDetectionPanel ? "ON" : "OFF"}
      </button>
      {!isCalibrationMode && (
        <div className="inline-flex h-[30px] min-w-[82px] items-center justify-center rounded-[8px] border border-emerald-300/45 bg-black/72 px-3 text-[10px] font-mono text-emerald-300 md:text-[11px]">
          FPS {fps}
        </div>
      )}
    </>
  );

  return (
    <div className={`mx-auto w-full max-w-6xl rounded-3xl border border-ninja-border bg-ninja-panel/92 shadow-[0_18px_55px_rgba(0,0,0,0.5)] ${isViewportFitSession ? "flex h-full min-h-0 flex-col p-3 md:p-4" : "p-4 md:p-6"}`}>
      <div className={`flex flex-wrap items-start justify-between gap-3 ${isViewportFitSession ? "mb-1" : "mb-4"}`}>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-ninja-dim">
            {isCalibrationMode ? "Calibration Session" : isRankMode ? "Rank Session" : "Free Session"}
          </p>
          <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
            {isCalibrationMode ? "Detection Calibration" : jutsuTitle}
          </h2>
          <p className="mt-1 text-xs text-zinc-300">
            {isCalibrationMode
              ? "Capture environment profile for stable sign detection and voting thresholds."
              : (jutsu?.displayText || "Practice hand-sign execution.")}
          </p>
        </div>
        <div className={`flex flex-col items-end ${isViewportFitSession ? "gap-1" : ""}`}>
          <button
            type="button"
            onClick={() => void handleBackAction()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-ninja-border bg-ninja-card px-4 text-sm font-black text-zinc-100 hover:border-ninja-accent/40"
          >
            <ArrowLeft className="h-4 w-4" />
            BACK
          </button>
          {isViewportFitSession && (
            <div className="flex flex-wrap items-center justify-end gap-1.5 md:flex-nowrap">
              {topControlChips}
            </div>
          )}
          {!isCalibrationMode && isViewportFitSession && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <p className="whitespace-nowrap text-[10px] font-bold text-white md:text-[11px]">
                {hudRank} • LV.{hudLevel}
              </p>
              <div className="h-[8px] w-[42vw] min-w-[140px] max-w-[300px] rounded-full bg-zinc-700">
                <div className="h-[8px] rounded-full bg-orange-500" style={{ width: `${hudProgressPct}%` }} />
              </div>
              <p className="shrink-0 whitespace-nowrap text-[9px] font-mono text-zinc-200 md:text-[10px]">
                {hudXpIntoLevel} / {hudXpRequired} XP
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={isViewportFitSession ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-4"}>
        <div className={`relative mx-auto w-full ${arenaStageMaxWidthClass} ${isViewportFitSession ? "flex min-h-0 flex-1 flex-col" : ""}`}>
          {!isViewportFitSession && (
            <div className="mb-2 flex flex-wrap items-center justify-end gap-1.5 md:flex-nowrap">
              {topControlChips}
            </div>
          )}

          <div className={isViewportFitSession ? "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" : ""}>
            <div className={`relative overflow-hidden border border-ninja-border bg-black ${isViewportFitSession ? "aspect-[4/3] h-full w-auto max-w-full rounded-[10px]" : "aspect-[4/3] rounded-2xl"}`}>
              {!isCalibrationMode && !isViewportFitSession && (
                <div className="absolute inset-x-0 top-0 z-30 h-[58px] border-b border-white/10 bg-[#141419]/90 md:h-[45px]">
                  <p className="absolute left-3 top-[14px] text-[10px] font-bold text-white md:left-5 md:top-1/2 md:-translate-y-1/2 md:text-xs">
                    {hudRank} • LV.{hudLevel}
                  </p>
                  <div className="absolute left-1/2 top-[38px] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 md:top-1/2 md:gap-2">
                    <div className="h-[9px] w-[48vw] min-w-[120px] max-w-[230px] rounded-full bg-zinc-700 md:h-[10px] md:w-[58vw] md:min-w-[180px] md:max-w-[400px]">
                      <div className="h-[9px] rounded-full bg-orange-500 md:h-[10px]" style={{ width: `${hudProgressPct}%` }} />
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-[9px] font-mono text-zinc-200 md:text-[10px]">{hudXpIntoLevel} / {hudXpRequired} XP</p>
                  </div>
                </div>
              )}

              {showTwoHandsGuide && !isSharinganChargedMode && (
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
                <div className="absolute inset-x-0 top-[66px] z-30 flex justify-center md:top-[54px]">
                  <div className="rounded-lg border border-orange-300/45 bg-black/65 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-orange-200 md:px-4 md:py-2 md:text-xs">
                    {comboCue}
                  </div>
                </div>
              )}

              {showSpeedHud && (
                <div className="absolute left-2 top-[66px] z-50 rounded-[6px] border border-orange-300/55 bg-black/75 px-2 py-1 md:left-[15px] md:top-[15px] md:px-3 md:py-1.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200 md:text-[11px]">
                    TIMER: <span className="text-white">{formatElapsed(elapsedMs)}</span>
                  </p>
                </div>
              )}

              {showSignChip && (
                <div className={`absolute right-2 z-30 rounded-[8px] border border-emerald-300/55 bg-black/75 px-2 py-1 md:right-[18px] md:px-3 md:py-1.5 ${signChipTopClass}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200 md:text-[11px]">
                    SIGN: {detectedLabel.toUpperCase()}
                  </p>
                </div>
              )}

              {showDetectionPanel && (
                <div className={`absolute left-2 right-2 z-30 w-auto max-w-[320px] rounded-[10px] border border-zinc-400/45 bg-black/68 px-[10px] py-[8px] text-[10px] font-mono text-white/90 md:left-[12px] md:right-auto md:w-[320px] md:text-[11px] ${detectionPanelTopClass}`}>
                  <div>MODEL: MEDIAPIPE</div>
                  <div>DB VER: {datasetVersionLabel}</div>
                  <div>DB CRC: {datasetChecksumDisplay.slice(0, 8)}</div>
                  <div>DB SYNC: {datasetSyncLabel}</div>
                  <div>DB LOADED: {loadedDatasetLabels.length}</div>
                  <div>SFX: {sfxLoadCompleted}/{Math.max(1, sfxLoadTotal)} • {sfxLoadPct}%</div>
                  <div>MP BACKEND: {detectorBackend}</div>
                  <div>MP ERR: {detectorErrorShort.toUpperCase()}</div>
                  <div>CAM: {cameraStatusText}</div>
                  <div>HANDS: {detectedHands}</div>
                  <div>DEVICE: {isLikelyLowPowerMobile ? "LOW-POWER MOBILE" : "STANDARD"}</div>
                  <div>LOW FPS ASSIST: {(!isRankMode && lowFpsAssistActive) ? "ON" : "OFF"}</div>
                  <div>STRICT 2H: {restrictedSigns ? "ON" : "OFF"}</div>
                  <div>LIGHT: {lightingStatus.toUpperCase().replace("_", " ")}</div>
                  <div>VOTE {voteHits}/{VOTE_WINDOW_SIZE} • {detectedConfidencePct}%</div>
                  <div>PASS GATE: {activeCalibrationProfile.voteRequiredHits}/{VOTE_WINDOW_SIZE} @ {voteMinConfidencePct}%</div>
                  <div>AUTO IDLE DIST: ON (2H={KNN_IDLE_DIST_THRESHOLD.toFixed(1)} • 1H={ONE_HAND_ASSIST_IDLE_THRESHOLD.toFixed(1)})</div>
                  <div>1H EXPECT DIST: THR={ONE_HAND_EXPECTED_SIGN_DIST_THRESHOLD.toFixed(1)} • MARGIN={ONE_HAND_EXPECTED_IDLE_MARGIN.toFixed(2)}</div>
                  <div>{diagCalibrationText}</div>
                  <div>RAW: {rawDetectedLabel} {rawDetectedConfidencePct}%</div>
                  {effectLabel === "fire" && (
                    <>
                      <div>MOUTH: X {fireAnchorX.toFixed(1)}% • Y {fireAnchorY.toFixed(1)}%</div>
                      <div>FIRE OFF: X {fireOffsetX.toFixed(1)}% • Y {fireOffsetY.toFixed(1)}%</div>
                      <div>FIRE AIM: X {fireAimYaw.toFixed(2)} • Y {fireAimPitch.toFixed(2)}</div>
                      <div>FIRE POS: X {fireFinalX.toFixed(1)}% • Y {fireFinalY.toFixed(1)}%</div>
                    </>
                  )}
                  {effectLabel === "eye" && (
                    <>
                      <div>EYE TEX: {sharinganEyeTexturePath}</div>
                      <div>EYE POSE: {sharinganVisualPose ? "LOCKED" : "NONE"}</div>
                    </>
                  )}
                  <div>STATE: {phaseLabel}</div>
                  <div className="break-words">
                    LOADED SIGNS: {loadedDatasetLabels.length > 0 ? loadedDatasetLabels.join(", ") : "(none)"}
                  </div>
                </div>
              )}

              <video ref={videoRef} className="hidden" playsInline muted />
              <canvas ref={canvasRef} className="h-full w-full object-cover" />

              {showJutsuEffect && (
                <div className="pointer-events-none absolute inset-0 z-20">
                  {effectLabel === "water" && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/45 via-sky-500/16 to-transparent" />
                      <WaterDragonOverlay
                        leftPct={fireAnchorX}
                        topPct={Math.max(8, fireAnchorY - 4)}
                        lowPower={isLikelyLowPowerMobile}
                        mirroredInput={false}
                        sourceAspect={videoAspect}
                      />
                      <div
                        className="absolute rounded-full bg-cyan-300/30 blur-3xl"
                        style={{
                          width: "300px",
                          height: "220px",
                          left: `${Math.max(12, fireAnchorX - 6)}%`,
                          top: `${Math.max(10, fireAnchorY - 8)}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                    </>
                  )}
                  {effectLabel === "eye" && (
                    <div className="absolute inset-0 animate-[sharinganFadeIn_650ms_ease-out]">
                      <Image
                        src="/effects/m_sharingan.jpg"
                        alt={`${sharinganModeName} background`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 900px"
                        className="object-cover opacity-92"
                      />
                      <SharinganCrowOverlay lowPower={isLikelyLowPowerMobile} />
                      <div className="absolute inset-0 bg-gradient-to-br from-red-950/45 via-rose-700/18 to-black/40" />
                      <canvas
                        ref={sharinganForegroundCanvasRef}
                        className="absolute inset-0 z-[3] h-full w-full object-cover"
                      />
                    </div>
                  )}
                  {effectLabel === "clone" && (
                    <canvas
                      ref={shadowCloneCanvasRef}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  {effectLabel === "fire" && !isPhoenixFireEffect && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-orange-700/35 via-amber-500/20 to-transparent" />
                      <FireballThreeOverlay
                        leftPct={fireAnchorX}
                        topPct={fireAnchorY}
                        offsetXPct={fireOffsetX}
                        offsetYPct={fireOffsetY}
                        aimYaw={fireAimYaw}
                        aimPitch={fireAimPitch}
                        sizePx={fireThreeSizePx}
                        lowPower={isLikelyLowPowerMobile}
                        mirroredInput={false}
                        sourceAspect={videoAspect}
                      />
                      <div
                        className="absolute rounded-full bg-orange-400/45 blur-2xl"
                        style={{
                          width: `${fireBlastWidth}px`,
                          height: `${fireBlastHeight}px`,
                          left: `calc(${fireAnchorX}% + ${(fireOffsetX + fireAimShiftXPct).toFixed(2)}%)`,
                          top: `calc(${fireAnchorY}% + ${(fireOffsetY + fireAimShiftYPct).toFixed(2)}%)`,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                      <div
                        className="absolute rounded-full bg-amber-200/30 blur-3xl"
                        style={{
                          width: `${Math.round(fireBlastWidth * 0.72)}px`,
                          height: `${Math.round(fireBlastHeight * 0.72)}px`,
                          left: `calc(${fireAnchorX}% + ${((fireOffsetX * 1.2) + (fireAimShiftXPct * 1.25)).toFixed(2)}%)`,
                          top: `calc(${fireAnchorY}% + ${((fireOffsetY * 1.2) + (fireAimShiftYPct * 1.2)).toFixed(2)}%)`,
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
                  {effectLabel === "reaper" && (
                    <div className="absolute inset-0">
                      <canvas
                        ref={reaperCompositeCanvasRef}
                        className="absolute inset-0 z-[2] h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 z-[3] bg-gradient-to-br from-rose-900/18 via-red-700/10 to-black/20" />
                    </div>
                  )}
                  {(effectLabel === "lightning" || effectLabel === "rasengan") && effectVideo && (
                    <div className="absolute inset-0">
                      {tripleOffsets.map((offsetPct, idx) => (
                        <video
                          key={`effect-${effectLabel}-${idx}-${offsetPct}`}
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="absolute object-contain opacity-80 mix-blend-screen"
                          style={{
                            width: `${effectSizePx}px`,
                            height: `${effectSizePx}px`,
                            left: `calc(${effectAnchorX}% + ${offsetPct}%)`,
                            top: `${effectAnchorY}%`,
                            transform: "translate(-50%, -50%)",
                            filter: "brightness(1.15) contrast(1.3) saturate(1.2)",
                          }}
                        >
                          <source src={effectVideo.webm} type="video/webm" />
                          <source src={effectVideo.mp4} type="video/mp4" />
                        </video>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!!xpPopupText && (
                <div key={`xp-popup-${xpPopupNonce}`} className="pointer-events-none absolute inset-x-0 top-[90px] z-30 flex justify-center md:top-20">
                  <div
                    className="rounded-lg border border-orange-300/45 bg-black/60 px-4 py-2 text-base font-black text-orange-200"
                    style={{ animation: "xpFloatFade 1.9s ease-out forwards" }}
                  >
                    {xpPopupText}
                  </div>
                </div>
              )}

              {cameraFailure !== "none" && phase !== "loading" && phase !== "error" && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/68 px-5 text-center">
                  <Camera className="h-8 w-8 text-red-300" />
                  <p className="text-xl font-black text-red-200">
                    {cameraFailure === "disconnected" ? "Camera Disconnected" : "Camera blocked! Check OBS/Discord."}
                  </p>
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

              {phase === "ready" && !sfxReady && (
                <div className="absolute inset-0 z-45 flex items-center justify-center bg-black/62 px-4">
                  <div className="w-full max-w-md rounded-2xl border border-cyan-300/35 bg-zinc-950/85 p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
                    <p className="text-xl font-black text-cyan-100">LOADING SOUNDS</p>
                    <p className="mt-1 text-xs uppercase tracking-widest text-zinc-400">
                      Preparing all SFX before run start
                    </p>
                    <div className="mt-4 h-3 w-full overflow-hidden rounded-full border border-cyan-300/30 bg-zinc-900">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, sfxLoadPct))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs font-bold tracking-wider text-cyan-100">
                      {Math.max(0, sfxLoadCompleted)} / {Math.max(1, sfxLoadTotal)} • {sfxLoadPct}%
                    </p>
                    {sfxLoadFailed > 0 && (
                      <>
                        <p className="mt-2 text-xs text-red-200">
                          {sfxLoadFailed} sound file(s) failed to preload.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSfxRetryNonce((prev) => prev + 1)}
                          className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-cyan-300/45 bg-cyan-500/20 px-4 text-xs font-black uppercase tracking-wider text-cyan-100 hover:bg-cyan-400/25"
                        >
                          Retry Audio Load
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {phase === "ready" && isRankMode && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/58 px-4">
                  <div className="w-full max-w-md rounded-2xl border border-orange-300/45 bg-zinc-950/80 p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
                    <p className="text-2xl font-black text-orange-200">READY TO START</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Press [Space] or Tap Button</p>
                    <p className="mt-3 text-sm text-zinc-200">
                      {isSharinganChargedMode
                        ? `Close both eyes and hold to trigger ${sharinganModeName}.`
                        : "Perform the sequence as fast as possible."}
                    </p>
                    <div className="mt-4 text-left text-xs text-zinc-300">
                      <p>1. Timer starts on GO.</p>
                      {isSharinganChargedMode ? (
                        <>
                          <p>2. Close both eyes and hold for 1.5 seconds.</p>
                          <p>3. Timer stops when {sharinganModeName} triggers.</p>
                        </>
                      ) : (
                        <>
                          <p>2. Detect all signs in order.</p>
                          <p>3. Timer stops on final sign.</p>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => startRun()}
                      className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-black uppercase tracking-widest text-white shadow-[0_8px_20px_rgba(249,115,22,0.35)] transition-all hover:bg-orange-400 active:scale-95"
                    >
                      START RUN
                    </button>
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
                  <p
                    className="text-6xl font-black text-orange-300 drop-shadow-[0_0_18px_rgba(255,160,80,0.5)] md:text-7xl"
                    style={countdown > 0 ? { animation: "countdownPulse 1s linear infinite" } : undefined}
                  >
                    {countdown > 0 ? countdown : "GO"}
                  </p>
                </div>
              )}



              {phase === "completed" && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 px-5">
                  <div className={`w-full ${isRankMode ? "max-w-md" : "max-w-sm"} rounded-2xl border bg-zinc-950/82 p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.55)] ${isRankMode ? "border-orange-300/45" : "border-emerald-300/35"
                    }`}>
                    <CheckCircle2 className={`mx-auto h-10 w-10 ${isRankMode ? "text-orange-200" : "text-emerald-300"}`} />
                    <p className="mt-2 text-xl font-black text-white">
                      {isCalibrationMode ? "CALIBRATION COMPLETE" : isRankMode ? "RESULTS" : "RUN COMPLETE"}
                    </p>
                    {!isCalibrationMode && (
                      <>
                        <p className="mt-2 text-3xl font-black text-emerald-200">{formatElapsed(elapsedMs)}</p>
                        {isSharinganChargedMode ? (
                          <p className="mt-1 text-sm text-zinc-200">Trigger: Eyes closed for {sharinganTargetSeconds}</p>
                        ) : (
                          <p className="mt-1 text-sm text-zinc-200">Signs: {signsLanded}/{sequence.length}</p>
                        )}
                      </>
                    )}
                    {!!submitStatus && <p className="mt-3 text-sm font-bold text-emerald-200">{submitStatus}</p>}
                    {!!submitDetail && <p className="mt-1 text-xs text-zinc-200">{submitDetail}</p>}
                    {!!rankInfo && <p className="mt-1 text-xs font-bold text-amber-200">{rankInfo}</p>}
                    {isRankMode && (
                      <button
                        type="button"
                        onClick={() => void handleShareResult()}
                        disabled={shareBusy}
                        className="mt-4 flex h-10 w-full items-center justify-center rounded-xl border border-cyan-300/45 bg-cyan-500/20 text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {shareBusy ? "SHARING..." : "SHARE RESULT"}
                      </button>
                    )}
                    {isRankMode && !!shareStatus && (
                      <p className="mt-2 text-[11px] text-cyan-100">{shareStatus}</p>
                    )}
                    {isRankMode && (
                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handleBackAction?.()}
                          className="flex h-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-black uppercase tracking-widest text-zinc-300 hover:bg-zinc-800"
                        >
                          EXIT
                        </button>
                        <button
                          type="button"
                          onClick={() => startRun()}
                          className="flex h-11 items-center justify-center rounded-xl bg-orange-500 text-xs font-black uppercase tracking-widest text-white shadow-[0_4px_12px_rgba(249,115,22,0.25)] hover:bg-orange-400"
                        >
                          NEW RUN
                        </button>
                      </div>
                    )}
                    {isRankMode && (
                      <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                        Space to retry • Esc to exit
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
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

        <div className={isViewportFitSession ? "shrink-0 pt-1" : "rounded-2xl border border-ninja-border bg-[#14141e]/92 shrink-0 p-4 md:p-5"}>
          <p className={`text-center font-black uppercase tracking-[0.12em] ${isViewportFitSession ? "text-xs md:text-[13px]" : "text-sm md:text-[15px]"} ${iconBarStatusColorClass}`}>
            {iconBarStatus}
          </p>
          {!isViewportFitSession && (
            <div className="mx-auto mt-3 h-2 max-w-[860px] rounded-full bg-[#2e2a24]">
              <div className="h-2 rounded-full bg-orange-500/95 transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>
          )}

          {!isCalibrationMode && !isSharinganChargedMode && (
            <>
              <div
                ref={sequenceStripRef}
                className={`${isViewportFitSession ? "mt-2" : "mt-4"} overflow-x-auto scroll-smooth px-1 pb-1`}
              >
                <div
                  className="mx-auto flex w-max items-start justify-center"
                  style={{
                    columnGap: `${iconLayout.gap}px`,
                    minWidth: `${iconLayout.totalWidth}px`,
                  }}
                >
                  {sequence.map((sign, index) => {
                    const signState =
                      phase === "casting" && index < iconProgressStep
                        ? "casting"
                        : index < iconProgressStep
                          ? "done"
                          : index === iconProgressStep && phase === "active"
                            ? "active"
                            : "pending";
                    return (
                      <div
                        key={`${sign}-${index}`}
                        ref={(node) => {
                          sequenceTileRefs.current[index] = node;
                        }}
                        className="shrink-0"
                      >
                        <SignTile
                          sign={sign}
                          state={signState}
                          iconSize={iconLayout.iconSize}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isViewportFitSession && (
                <div className="mt-3 text-right text-xs font-mono text-zinc-400">
                  {iconProgressStep}/{sequence.length}
                </div>
              )}
            </>
          )}

          {!isCalibrationMode && isSharinganChargedMode && (
            <div className="mt-3 flex items-center justify-center">
              <div className="rounded-lg border border-rose-300/45 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-rose-100">
                Keep your face centered, then close both eyes for {sharinganTargetSeconds}
              </div>
            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-400 sm:text-[11px]">
            <span className="w-full text-center sm:w-auto sm:text-left">Press ESC to exit</span>
            <span className="w-full text-center sm:w-auto sm:text-right">[C] Calibrate</span>
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
            <div className="mt-3 rounded-lg border border-blue-300/30 bg-blue-950/20 px-3 py-2 text-[11px] font-mono text-blue-100/90">
              <div>BACKEND: {detectorBackend}</div>
              <div>ERROR: {detectorError || "none"}</div>
            </div>
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
      <style jsx global>{`
        @keyframes countdownPulse {
          0% { transform: scale(1.5); }
          100% { transform: scale(1); }
        }
        @keyframes xpFloatFade {
          0% { transform: translateY(0px); opacity: 1; }
          75% { opacity: 1; }
          100% { transform: translateY(-38px); opacity: 0; }
        }
        @keyframes sharinganFadeIn {
          0% { opacity: 0; filter: brightness(0.65) saturate(0.85); }
          100% { opacity: 1; filter: brightness(1) saturate(1.1); }
        }
        @keyframes sharinganSparkDrift {
          0% { transform: translate(0px, 0px) scale(0.8); opacity: 0.18; }
          45% { opacity: 0.7; }
          100% { transform: translate(0px, -26px) scale(1.12); opacity: 0.1; }
        }
      `}</style>
    </div>
  );
}
