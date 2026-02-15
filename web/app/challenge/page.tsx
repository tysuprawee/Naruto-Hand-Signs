"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, CheckCircle2, Hand, Loader2, Volume2, VolumeX, Lightbulb, AlertTriangle, X, Sparkles } from "lucide-react";
import { KNNClassifier, normalizeHand } from "../../utils/knn";

type SignName =
  | "Bird"
  | "Boar"
  | "Clap"
  | "Dog"
  | "Dragon"
  | "Hare"
  | "Horse"
  | "Monkey"
  | "Ox"
  | "Ram"
  | "Rat"
  | "Snake"
  | "Tiger";

interface DetectionResult {
  label: string;
  confidence: number;
  distance: number;
}

interface HistoryEntry {
  sign: SignName;
  time: number;
}

interface SignLoreEntry {
  title: string;
  history: string;
}

interface VoteEntry {
  label: string;
  conf: number;
  timeMs: number;
}

interface VoteResult {
  window: VoteEntry[];
  label: string;
  confidence: number;
  hits: number;
}

interface LightingResult {
  status: "good" | "low_light" | "overexposed" | "low_contrast";
  mean: number;
  contrast: number;
}

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

const ALL_SIGNS: SignName[] = [
  "Bird",
  "Boar",
  "Clap",
  "Dog",
  "Dragon",
  "Hare",
  "Horse",
  "Monkey",
  "Ox",
  "Ram",
  "Rat",
  "Snake",
  "Tiger",
];

const SIGN_IMAGES: Record<string, string> = ALL_SIGNS.reduce((acc, sign) => {
  const lower = sign.toLowerCase();
  acc[sign] = sign === "Clap" ? `/pics/${lower}.jpg` : `/pics/${lower}.jpeg`;
  return acc;
}, {} as Record<string, string>);

const SIGN_LORE: Record<SignName, SignLoreEntry> = {
  Bird: {
    title: "Bird (Tori)",
    history:
      "Bird is associated with speed, focus, and precision in many fan and anime-era sign guides. It appears in high-tempo sequences where chakra needs sharp directional control.",
  },
  Boar: {
    title: "Boar (I)",
    history:
      "Boar is one of the zodiac-derived seals used in Naruto hand-sign chains. It is commonly treated as a stabilizing transition sign before stronger elemental release steps.",
  },
  Clap: {
    title: "Clap (Fusion Seal)",
    history:
      "Clap is depicted as a direct palm-to-palm chakra alignment gesture. In training contexts it is used as a strong commitment cue before execution, similar to forcing chakra synchronization.",
  },
  Dog: {
    title: "Dog (Inu)",
    history:
      "Dog appears frequently in ninjutsu combinations and is often linked with disciplined chakra shaping. It is a foundational connector sign in many classic sequences.",
  },
  Dragon: {
    title: "Dragon (Tatsu)",
    history:
      "Dragon is traditionally associated with power amplification and high-level elemental output. In Naruto sign flow, it often appears near climax points of a technique.",
  },
  Hare: {
    title: "Hare (U)",
    history:
      "Hare is commonly used as a quick-forming control sign in several combinations. It is often interpreted as a speed step that helps bridge aggressive and stable chakra states.",
  },
  Horse: {
    title: "Horse (Uma)",
    history:
      "Horse is one of the most recognizable Naruto seals and is regularly used across fire-style and mixed sequences. It represents a clean, centered focus phase for chakra molding.",
  },
  Monkey: {
    title: "Monkey (Saru)",
    history:
      "Monkey is used in many multi-sign chains and is associated with adaptive transitions. It commonly appears where a jutsu sequence changes tempo or chakra pressure.",
  },
  Ox: {
    title: "Ox (Ushi)",
    history:
      "Ox is a firm grounding seal linked with control and force. It is often used to anchor a sequence before major release signs in elemental techniques.",
  },
  Ram: {
    title: "Ram (Hitsuji)",
    history:
      "The Ram hand sign in Naruto, based on the Chinese zodiac goat, is a fundamental seal for molding chakra, frequently used by Naruto Uzumaki for summoning shadow clones and by others for various ninjutsu. It is created by joining index and middle fingers, with left-hand fingers bending over the right to focus energy.",
  },
  Rat: {
    title: "Rat (Ne)",
    history:
      "Rat is usually treated as an initiating sign that starts or primes a chakra sequence. It appears in many combinations where rapid setup is required before stronger seals.",
  },
  Snake: {
    title: "Snake (Mi)",
    history:
      "Snake is one of the most iconic hand signs in Naruto and is strongly tied to concentrated chakra control. It is frequently seen in techniques that require finesse and precision.",
  },
  Tiger: {
    title: "Tiger (Tora)",
    history:
      "Tiger is widely associated with release moments, especially in fire-style depictions. It often appears as a finishing or near-finishing sign when chakra output is finalized.",
  },
};

const DETECTION_INTERVAL_MS = 60; // ~16 FPS
const RESTRICTED_SIGNS = true; // Match pygame default behavior

const LIGHTING_MIN = 45.0;
const LIGHTING_MAX = 210.0;
const LIGHTING_MIN_CONTRAST = 22.0;
const LIGHTING_INTERVAL_MS = 250;
const LIGHTING_SAMPLE_WIDTH = 96;
const LIGHTING_SAMPLE_HEIGHT = 72;
const FPS_UPDATE_INTERVAL_MS = 500;

const VOTE_WINDOW_SIZE = 5;
const VOTE_REQUIRED_HITS = 3;
const VOTE_MIN_CONFIDENCE = 0.45;
const VOTE_ENTRY_TTL_MS = 700;

const HOLD_THRESHOLD = 8;

function parseCSV(text: string): Record<string, string | number>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string | number>[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(",");
    if (values.length < headers.length) continue;
    const row: Record<string, string | number> = {};
    for (let j = 0; j < headers.length; j += 1) {
      const val = values[j]?.trim() ?? "";
      row[headers[j]] = j === 0 ? val : Number(val);
    }
    rows.push(row);
  }

  return rows;
}

function toDisplayLabel(label: string): string {
  const normalized = String(label || "idle").trim().toLowerCase();
  if (!normalized || normalized === "idle") return "Idle";
  if (normalized === "unknown") return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function evaluateLighting(imageData: Uint8ClampedArray): LightingResult {
  let count = 0;
  let sum = 0;
  let sumSq = 0;

  // Sample every N pixels for speed.
  const pixelStride = 12;
  for (let i = 0; i < imageData.length; i += 4 * pixelStride) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += lum;
    sumSq += lum * lum;
    count += 1;
  }

  const mean = count > 0 ? sum / count : 0;
  const variance = count > 0 ? Math.max(0, sumSq / count - mean * mean) : 0;
  const contrast = Math.sqrt(variance);

  let status: LightingResult["status"] = "good";
  if (mean < LIGHTING_MIN) status = "low_light";
  else if (mean > LIGHTING_MAX) status = "overexposed";
  else if (contrast < LIGHTING_MIN_CONTRAST) status = "low_contrast";

  return { status, mean, contrast };
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

    // Match python recorder behavior: Left -> h1, Right -> h2.
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

    // Fallback if handedness metadata is missing.
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

function applyTemporalVote(
  window: VoteEntry[],
  rawSign: string,
  rawConf: number,
  allowDetection: boolean,
  nowMs: number
): VoteResult {
  const filtered = window.filter((item) => nowMs - item.timeMs <= VOTE_ENTRY_TTL_MS);
  const normalized = String(rawSign || "idle").trim().toLowerCase();

  if (!allowDetection || normalized === "idle" || normalized === "unknown") {
    return { window: [], label: "idle", confidence: 0, hits: 0 };
  }

  const nextWindow = [
    ...filtered,
    { label: normalized, conf: Math.max(0, rawConf), timeMs: nowMs },
  ].slice(-VOTE_WINDOW_SIZE);

  const counts = new Map<string, number>();
  const confSums = new Map<string, number>();

  for (const item of nextWindow) {
    counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
    confSums.set(item.label, (confSums.get(item.label) ?? 0) + item.conf);
  }

  if (counts.size === 0) {
    return { window: nextWindow, label: "idle", confidence: 0, hits: 0 };
  }

  let bestLabel = "idle";
  let bestHits = 0;
  let bestConfSum = 0;

  for (const [label, hits] of counts.entries()) {
    const sum = confSums.get(label) ?? 0;
    if (hits > bestHits || (hits === bestHits && sum > bestConfSum)) {
      bestLabel = label;
      bestHits = hits;
      bestConfSum = sum;
    }
  }

  const avgConf = bestHits > 0 ? bestConfSum / bestHits : 0;
  // Keep pygame-style vote+confidence gate, but if consensus is 5/5
  // we still accept to avoid "5/5 but no change" UX stalls.
  const hasHardConsensus = bestHits >= VOTE_WINDOW_SIZE;
  if ((bestHits >= VOTE_REQUIRED_HITS && avgConf >= VOTE_MIN_CONFIDENCE) || hasHardConsensus) {
    return { window: nextWindow, label: bestLabel, confidence: avgConf, hits: bestHits };
  }

  return { window: nextWindow, label: "idle", confidence: avgConf, hits: bestHits };
}

function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number
): void {
  const CONNECTIONS = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],
    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],
    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],
    [0, 17],
  ];

  const points = landmarks.map((lm) => ({
    x: (1 - lm.x) * width,
    y: lm.y * height,
  }));

  ctx.strokeStyle = "rgba(255, 120, 50, 0.6)";
  ctx.lineWidth = 2;
  for (const [start, end] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(points[start].x, points[start].y);
    ctx.lineTo(points[end].x, points[end].y);
    ctx.stroke();
  }

  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ff7832";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function getConfColor(confidence: number): string {
  if (confidence > 0.7) return "#32c878";
  if (confidence > 0.4) return "#ffaa22";
  return "#dc3c3c";
}

export default function ChallengePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const knnRef = useRef<KNNClassifier | null>(null);
  const handsRef = useRef<HandLandmarkerLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const holdRef = useRef<{ label: string; count: number }>({ label: "", count: 0 });
  const triggeredSignRef = useRef<string>("");
  const voteWindowRef = useRef<VoteEntry[]>([]);
  const lightingLastTimeRef = useRef<number>(0);
  const lightingRef = useRef<LightingResult>({ status: "good", mean: 0, contrast: 0 });
  const lightingSampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightingSampleCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const fpsLastUpdateRef = useRef<number>(0);
  const fpsFrameCountRef = useRef<number>(0);

  const [loading, setLoading] = useState(true);
  const [loadMsg, setLoadMsg] = useState("Initializing...");
  const [cameraActive, setCameraActive] = useState(false);
  const [detection, setDetection] = useState<DetectionResult>({
    label: "Idle",
    confidence: 0,
    distance: Number.POSITIVE_INFINITY,
  });
  const [confirmedSign, setConfirmedSign] = useState<string | null>(null);
  const [selectedSign, setSelectedSign] = useState<SignName | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lightingStatus, setLightingStatus] = useState<LightingResult["status"]>("good");
  const [lightingMean, setLightingMean] = useState(0);
  const [lightingContrast, setLightingContrast] = useState(0);
  const [voteHits, setVoteHits] = useState(0);
  const [detectedHands, setDetectedHands] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showFps, setShowFps] = useState(false);
  const [fps, setFps] = useState(0);

  const dismissInstructions = useCallback(() => {
    setShowInstructions(false);
  }, []);

  const playSfx = useCallback(
    (src: string) => {
      if (!soundOn) return;
      try {
        const audio = new Audio(src);
        audio.volume = 0.4;
        void audio.play().catch(() => { });
      } catch {
        // No-op for autoplay/security restrictions.
      }
    },
    [soundOn]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoadMsg("Loading sign database...");
        const csvResp = await fetch("/mediapipe_signs_db.csv");
        const csvText = await csvResp.text();
        const rows = parseCSV(csvText);
        // Match pygame recorder behavior (k=3, distance threshold=1.8).
        knnRef.current = new KNNClassifier(rows, 3, 1.8);

        if (cancelled) return;

        setLoadMsg("Loading MediaPipe Hands...");
        const vision = await import("@mediapipe/tasks-vision");
        const { FilesetResolver, HandLandmarker } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
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

        setLoadMsg("Starting camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        });
        streamRef.current = stream;

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setCameraActive(true);
        setLoading(false);
      } catch (error) {
        console.error("Challenge init error:", error);
        setLoadMsg(`Error: ${(error as Error).message}`);
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (handsRef.current && typeof handsRef.current.close === "function") {
        handsRef.current.close();
      }
      lightingSampleCtxRef.current = null;
      lightingSampleCanvasRef.current = null;
      lightingLastTimeRef.current = 0;
      lightingRef.current = { status: "good", mean: 0, contrast: 0 };
      fpsLastUpdateRef.current = 0;
      fpsFrameCountRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (cameraActive) return;
    fpsLastUpdateRef.current = 0;
    fpsFrameCountRef.current = 0;
    setFps(0);
  }, [cameraActive]);

  useEffect(() => {
    if (!cameraActive) return;

    function detect() {
      rafIdRef.current = requestAnimationFrame(detect);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const hands = handsRef.current;
      const knn = knnRef.current;
      if (!video || !canvas || !hands || !knn) return;
      if (video.readyState < 2) return;

      const now = performance.now();
      if (now - lastTimeRef.current < DETECTION_INTERVAL_MS) return;
      lastTimeRef.current = now;

      if (!fpsLastUpdateRef.current) fpsLastUpdateRef.current = now;
      fpsFrameCountRef.current += 1;
      if (now - fpsLastUpdateRef.current >= FPS_UPDATE_INTERVAL_MS) {
        const elapsed = Math.max(1, now - fpsLastUpdateRef.current);
        setFps((fpsFrameCountRef.current * 1000) / elapsed);
        fpsFrameCountRef.current = 0;
        fpsLastUpdateRef.current = now;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      if (now - lightingLastTimeRef.current >= LIGHTING_INTERVAL_MS) {
        lightingLastTimeRef.current = now;

        if (!lightingSampleCanvasRef.current) {
          const sampleCanvas = document.createElement("canvas");
          sampleCanvas.width = LIGHTING_SAMPLE_WIDTH;
          sampleCanvas.height = LIGHTING_SAMPLE_HEIGHT;
          lightingSampleCanvasRef.current = sampleCanvas;
          lightingSampleCtxRef.current = sampleCanvas.getContext("2d", { willReadFrequently: true });
        }

        const sampleCtx = lightingSampleCtxRef.current;
        if (sampleCtx) {
          sampleCtx.drawImage(video, 0, 0, LIGHTING_SAMPLE_WIDTH, LIGHTING_SAMPLE_HEIGHT);
          const frameData = sampleCtx.getImageData(
            0,
            0,
            LIGHTING_SAMPLE_WIDTH,
            LIGHTING_SAMPLE_HEIGHT
          ).data;
          const lighting = evaluateLighting(frameData);
          lightingRef.current = lighting;
          setLightingStatus(lighting.status);
          setLightingMean(lighting.mean);
          setLightingContrast(lighting.contrast);
        }
      }

      const lightingOk = lightingRef.current.status === "good";

      const result = hands.detectForVideo(video, now) as HandsResultShape;

      if (result.landmarks && result.landmarks.length > 0) {
        for (const hand of result.landmarks) {
          drawLandmarks(ctx, hand, canvas.width, canvas.height);
        }
      }

      const { features, numHands } = buildFeatures(result);
      setDetectedHands(numHands);

      if (numHands < 1) {
        voteWindowRef.current = [];
        triggeredSignRef.current = "";
        setVoteHits(0);
        holdRef.current = { label: "", count: 0 };
        setDetection({
          label: "No hands",
          confidence: 0,
          distance: Number.POSITIVE_INFINITY,
        });
        return;
      }

      const rawPrediction = knn.predictWithConfidence(features);
      let rawSign = String(rawPrediction.label || "Idle").trim().toLowerCase();
      let rawConf = Math.max(0, Number(rawPrediction.confidence || 0));

      if (RESTRICTED_SIGNS && numHands < 2) {
        rawSign = "idle";
        rawConf = 0;
      }

      let allowDetection = lightingOk && numHands > 0;
      if (RESTRICTED_SIGNS) {
        allowDetection = allowDetection && numHands >= 2;
      }

      const vote = applyTemporalVote(voteWindowRef.current, rawSign, rawConf, allowDetection, now);
      voteWindowRef.current = vote.window;
      setVoteHits(vote.hits);

      const displayLabel = toDisplayLabel(vote.label);
      setDetection({
        label: displayLabel,
        confidence: vote.confidence,
        distance: Number(rawPrediction.distance ?? Number.POSITIVE_INFINITY),
      });

      if (vote.label !== "idle" && vote.label !== "unknown" && vote.confidence > 0) {
        const liveConfirmed = toDisplayLabel(vote.label);
        // Show detected valid sign immediately in the right panel.
        setConfirmedSign(liveConfirmed);

        // Prevent repeated trigger while user keeps holding the same sign.
        if (triggeredSignRef.current === vote.label) {
          return;
        }

        if (holdRef.current.label === vote.label) {
          holdRef.current.count += 1;
        } else {
          holdRef.current = { label: vote.label, count: 1 };
        }

        if (holdRef.current.count >= HOLD_THRESHOLD) {
          setShowFlash(true);
          playSfx("/sounds/each.mp3");
          setHistory((prev) => {
            const sign = liveConfirmed as SignName;
            if (!ALL_SIGNS.includes(sign)) return prev;
            const next = [
              {
                sign,
                time: Date.now(),
              },
              ...prev,
            ];
            return next.slice(0, 200);
          });
          triggeredSignRef.current = vote.label;
          holdRef.current.count = HOLD_THRESHOLD;
        }
      } else {
        triggeredSignRef.current = "";
        holdRef.current = { label: "", count: 0 };
      }
    }

    detect();

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [cameraActive, playSfx]);

  useEffect(() => {
    if (!showFlash) return;
    const timer = setTimeout(() => setShowFlash(false), 1200);
    return () => clearTimeout(timer);
  }, [showFlash]);

  const isValidSign =
    detection.label !== "Idle" && detection.label !== "Unknown" && detection.label !== "No hands";
  const confPct = Math.round(detection.confidence * 100);
  const needsTwoHandsHint = cameraActive && RESTRICTED_SIGNS && detectedHands < 2;
  const detectedSign =
    confirmedSign && ALL_SIGNS.includes(confirmedSign as SignName)
      ? (confirmedSign as SignName)
      : null;

  return (
    <div className="min-h-screen bg-ninja-bg text-ninja-text font-sans">

      {/* ── Instruction Modal ── */}
      {showInstructions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-ninja-bg border-2 border-ninja-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Accent top bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-ninja-accent via-orange-400 to-red-500" />

            {/* Close button */}
            <button
              onClick={dismissInstructions}
              className="absolute top-4 right-4 text-ninja-dim hover:text-white transition-colors z-10"
              aria-label="Close instructions"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 md:p-8 space-y-6">
              {/* Header */}
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <Hand className="w-6 h-6 text-ninja-accent" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-ninja-accent to-orange-300">
                    Before You Begin
                  </span>
                </h2>
                <p className="text-sm text-ninja-dim">
                  Quick tips to get the best detection results.
                </p>
              </div>

              {/* Tips */}
              <div className="space-y-4">
                {/* Lighting */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-yellow-300">Good Lighting Required</p>
                    <p className="text-xs text-ninja-dim mt-0.5 leading-relaxed">
                      Make sure your face and hands are well-lit. Avoid backlighting (like windows behind you). Front-facing light works best.
                    </p>
                  </div>
                </div>

                {/* Hands */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-300">Show Both Hands</p>
                    <p className="text-xs text-ninja-dim mt-0.5 leading-relaxed">
                      Hold both hands clearly in front of the camera. If detection isn&apos;t working, try moving your hands closer or adjusting the angle until they&apos;re tracked.
                    </p>
                  </div>
                </div>

                {/* Detection tips */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-300">Hold Signs Steady</p>
                    <p className="text-xs text-ninja-dim mt-0.5 leading-relaxed">
                      Once your hands are detected, form the sign and hold it still for about half a second. The system needs a moment to confirm your sign.
                    </p>
                  </div>
                </div>

                {/* Demo disclaimer */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-ninja-card/60 border border-ninja-border">
                  <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-orange-300">Demo Version</p>
                    <p className="text-xs text-ninja-dim mt-0.5 leading-relaxed">
                      This is a demo version of the Sign Tester and may be glitchy at times. Detection accuracy can vary depending on your device, browser, and environment.
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={dismissInstructions}
                className="w-full h-12 bg-ninja-accent hover:bg-ninja-accent-glow text-white text-base font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,120,50,0.25)] hover:shadow-[0_0_30px_rgba(255,120,50,0.45)] cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                Got It, Let&apos;s Go
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="fixed top-0 w-full z-50 bg-ninja-bg/90 backdrop-blur-md border-b border-ninja-border">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-ninja-dim hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-bold">Back</span>
          </Link>
          <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
            <Hand className="w-5 h-5 text-ninja-accent" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-ninja-accent to-orange-300">
              SIGN TESTER
            </span>
          </h1>
          <button
            onClick={() => setSoundOn((prev) => !prev)}
            className="text-ninja-dim hover:text-white transition-colors"
            aria-label="Toggle sound"
          >
            {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="pt-16 pb-8 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="relative rounded-2xl overflow-hidden border-2 border-ninja-border bg-black aspect-[4/3]">
              {loading && (
                <div className="absolute inset-0 z-20 bg-ninja-bg/95 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-10 h-10 text-ninja-accent animate-spin" />
                  <p className="text-ninja-dim text-sm font-mono">{loadMsg}</p>
                </div>
              )}

              {showFlash && (
                <div className="absolute inset-0 z-30 pointer-events-none animate-flash">
                  <div className="absolute inset-0 bg-ninja-accent/20 rounded-2xl" />
                </div>
              )}

              <video ref={videoRef} className="hidden" playsInline muted />
              <canvas ref={canvasRef} className="w-full h-full object-cover" />

              {cameraActive && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                  <div
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-black uppercase tracking-wider
                      backdrop-blur-md border transition-all duration-300
                      ${isValidSign
                        ? "bg-green-500/20 border-green-500/50 text-green-400 shadow-[0_0_20px_rgba(50,200,120,0.3)]"
                        : "bg-ninja-card/80 border-ninja-border text-ninja-dim"
                      }
                    `}
                  >
                    {isValidSign ? (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        {detection.label} • {confPct}%
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Camera className="w-4 h-4" />
                        {detection.label}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {cameraActive && (
                <div className="absolute top-16 left-4 z-10 rounded-lg bg-black/55 border border-white/10 px-3 py-2 text-[11px] font-mono text-white/85 leading-4">
                  <div>LIGHT: {lightingStatus.toUpperCase().replace("_", " ")}</div>
                  <div>VOTE: {voteHits}/{VOTE_WINDOW_SIZE}</div>
                  <div>HANDS: {detectedHands} | 2H MODE: {RESTRICTED_SIGNS ? "ON" : "OFF"}</div>
                </div>
              )}

              {cameraActive && isValidSign && (
                <div className="absolute bottom-4 left-4 right-4 z-10">
                  <div className="h-2 bg-ninja-card/80 rounded-full overflow-hidden backdrop-blur-md">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${confPct}%`,
                        backgroundColor: getConfColor(detection.confidence),
                        boxShadow: `0 0 12px ${getConfColor(detection.confidence)}`,
                      }}
                    />
                  </div>
                </div>
              )}

              {cameraActive && (
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowFps((prev) => !prev)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${showFps
                      ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-200"
                      : "border-white/15 bg-black/45 text-white/70 hover:text-white"
                      }`}
                    aria-pressed={showFps}
                    aria-label="Toggle FPS display"
                  >
                    FPS
                  </button>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                  <span className="text-xs font-mono text-red-400 uppercase">Live</span>
                </div>
              )}

              {cameraActive && showFps && (
                <div className="absolute top-14 right-4 z-10 rounded-md border border-cyan-400/40 bg-black/60 px-2 py-1 text-[10px] font-mono font-bold text-cyan-200">
                  FPS: {fps.toFixed(1)}
                </div>
              )}
            </div>

            <div className="hidden lg:block bg-ninja-card/50 border border-ninja-border rounded-xl p-4">
              <p className="text-sm text-ninja-dim leading-relaxed">
                <span className="text-ninja-accent font-bold">About this:</span>{" "}
                This tester uses the same strategy as the main game for sign recognition: lighting quality gate,
                temporal vote consensus, and two-hand restriction. No score submission or database writes
                run on this page.
              </p>
              <div
                className={`mt-2 rounded-md border px-3 py-2 text-xs ${needsTwoHandsHint
                  ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
                  : "border-ninja-border bg-ninja-bg/30 text-ninja-dim"
                  }`}
              >
                Two hands are required for sign detection. Keep both hands fully visible in frame with
                a little space between them.
              </div>
              <p className="text-xs text-ninja-dim/80 mt-2 font-mono">
                Brightness: {lightingMean.toFixed(1)} | Contrast: {lightingContrast.toFixed(1)}
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div
              className={`
                relative rounded-2xl border-2 overflow-hidden transition-all duration-500
                ${detectedSign ? "border-ninja-accent/60 shadow-[0_0_40px_rgba(255,120,50,0.15)]" : "border-ninja-border"}
              `}
            >
              <div className="bg-ninja-card p-6 h-[320px] xl:h-[360px] flex flex-col">
                {detectedSign ? (
                  <div className="h-full flex flex-col gap-4 min-h-0">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-black text-white flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                        {detectedSign}
                      </h2>
                      <span className="text-xs font-mono text-ninja-dim bg-ninja-bg px-2 py-1 rounded-full">
                        LIVE DETECTION
                      </span>
                    </div>
                    <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden bg-black/50 border border-ninja-border">
                      <img
                        src={SIGN_IMAGES[detectedSign] || "/pics/placeholder.png"}
                        alt={detectedSign}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ninja-accent/10 to-transparent pointer-events-none" />
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-ninja-bg border-2 border-dashed border-ninja-border flex items-center justify-center">
                      <Hand className="w-8 h-8 text-ninja-dim" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">Waiting for detection...</p>
                      <p className="text-sm text-ninja-dim mt-1">
                        This panel updates only from live camera detection.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:hidden bg-ninja-card/50 border border-ninja-border rounded-xl p-4">
              <p className="text-sm text-ninja-dim leading-relaxed">
                <span className="text-ninja-accent font-bold">About this:</span>{" "}
                This tester uses the same strategy as the main game for sign recognition: lighting quality gate,
                temporal vote consensus, and two-hand restriction. No score submission or database writes
                run on this page.
              </p>
              <div
                className={`mt-2 rounded-md border px-3 py-2 text-xs ${needsTwoHandsHint
                  ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
                  : "border-ninja-border bg-ninja-bg/30 text-ninja-dim"
                  }`}
              >
                Two hands are required for sign detection. Keep both hands fully visible in frame with
                a little space between them.
              </div>
              <p className="text-xs text-ninja-dim/80 mt-2 font-mono">
                Brightness: {lightingMean.toFixed(1)} | Contrast: {lightingContrast.toFixed(1)}
              </p>
            </div>

            <div className="bg-ninja-card/30 border border-ninja-border rounded-xl p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-ninja-dim mb-3">
                All {ALL_SIGNS.length} Signs
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3">
                {ALL_SIGNS.map((sign) => (
                  <button
                    key={sign}
                    onClick={() => setSelectedSign(sign)}
                    className={`
                      group relative rounded-lg overflow-hidden border transition-all aspect-[4/3]
                      ${selectedSign === sign
                        ? "border-ninja-accent shadow-[0_0_18px_rgba(255,120,50,0.32)] scale-[1.01]"
                        : "border-ninja-border hover:border-ninja-accent/40"
                      }
                    `}
                  >
                    <img
                      src={SIGN_IMAGES[sign]}
                      alt={sign}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                      <span className="text-[10px] font-black uppercase text-white/90">{sign}</span>
                    </div>
                    {history.some((item) => item.sign === sign) && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 drop-shadow-lg" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-ninja-card/30 border border-ninja-border rounded-xl p-4 text-xs text-ninja-dim">
              Click any sign card to open its image and Naruto hand-sign history.
            </div>
          </div>
        </div>
      </main>

      {selectedSign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Close sign details"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedSign(null)}
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-ninja-border bg-ninja-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ninja-border bg-ninja-bg/40">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                {SIGN_LORE[selectedSign].title}
              </h3>
              <button
                onClick={() => setSelectedSign(null)}
                className="text-xs font-mono uppercase px-2 py-1 rounded-md bg-ninja-bg text-ninja-dim hover:text-white border border-ninja-border"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[260px,1fr] gap-0">
              <div className="relative border-b md:border-b-0 md:border-r border-ninja-border bg-black/35">
                <img
                  src={SIGN_IMAGES[selectedSign] || "/pics/placeholder.png"}
                  alt={selectedSign}
                  className="w-full h-full object-cover aspect-[4/3] md:aspect-auto"
                />
              </div>
              <div className="p-4 md:p-5">
                <p className="text-sm text-ninja-text leading-relaxed">
                  {SIGN_LORE[selectedSign].history}
                </p>
                <p className="text-xs text-ninja-dim mt-4">
                  Seen in this session:{" "}
                  <span className="text-white font-semibold">
                    {history.filter((item) => item.sign === selectedSign).length}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes flash {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .animate-flash {
          animation: flash 1.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
