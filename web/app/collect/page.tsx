"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Download, Hand, Pause, Play, Trash2 } from "lucide-react";

import { normalizeHand } from "@/utils/knn";

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

interface CapturedSample {
  id: string;
  label: string;
  features: number[];
  hands: number;
  fps: number;
  capturedAt: string;
  device: string;
  sessionId: string;
}

const SIGNS = [
  "Bird",
  "Boar",
  "Clap",
  "Dog",
  "Dragon",
  "Hare",
  "Horse",
  "Idle",
  "Monkey",
  "Ox",
  "Ram",
  "Rat",
  "Snake",
  "Tiger",
] as const;

const FEATURE_KEYS: string[] = (() => {
  const keys: string[] = [];
  for (let hand = 1; hand <= 2; hand += 1) {
    for (let i = 0; i < 21; i += 1) {
      keys.push(`h${hand}_${i}_x`, `h${hand}_${i}_y`, `h${hand}_${i}_z`);
    }
  }
  return keys;
})();

const DETECT_INTERVAL_MS = 70;
const AUTO_CAPTURE_DEFAULT_MS = 220;
const AUTO_CAPTURE_MIN_MS = 120;
const AUTO_CAPTURE_MAX_MS = 1000;
const AUTO_START_COUNTDOWN_SECONDS = 3;
const DEDUPE_DISTANCE_THRESHOLD = 0.035;

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

function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
): void {
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

  ctx.strokeStyle = "rgba(255, 120, 50, 0.75)";
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

function l2Distance(a: number[], b: number[]): number {
  if (!a.length || !b.length) return Number.POSITIVE_INFINITY;
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / len);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function toGzipBlob(text: string): Promise<Blob> {
  if (typeof CompressionStream === "undefined") {
    return new Blob([text], { type: "application/x-ndjson" });
  }
  const source = new Blob([text], { type: "application/x-ndjson" });
  const stream = source.stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Blob([buffer], { type: "application/gzip" });
}

function buildDeviceLabel(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/iPhone/i.test(ua)) return "iphone";
  if (/iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ipad";
  if (/Mac/i.test(ua)) return "mac";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export default function CollectPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<HandLandmarkerLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const renderRafRef = useRef<number>(0);
  const detectRafRef = useRef<number>(0);
  const lastDetectRef = useRef<number>(0);
  const latestLandmarksRef = useRef<Landmark[][]>([]);
  const latestFeaturesRef = useRef<number[]>([]);
  const latestHandsRef = useRef(0);
  const lastAutoCaptureAtRef = useRef(0);
  const autoStartTimerRef = useRef<number | null>(null);
  const lastCapturedFeaturesRef = useRef<number[]>([]);
  const fpsWindowStartRef = useRef(0);
  const fpsFramesRef = useRef(0);

  const [status, setStatus] = useState("Initializing...");
  const [ready, setReady] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("Ram");
  const [autoCapture, setAutoCapture] = useState(false);
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);
  const [autoIntervalMs, setAutoIntervalMs] = useState(AUTO_CAPTURE_DEFAULT_MS);
  const [minHands, setMinHands] = useState<1 | 2>(1);
  const [detectedHands, setDetectedHands] = useState(0);
  const [fps, setFps] = useState(0);
  const [samples, setSamples] = useState<CapturedSample[]>([]);
  const [deviceLabel, setDeviceLabel] = useState("unknown");

  const sessionIdRef = useRef(`capture-${Date.now().toString(36)}`);

  useEffect(() => {
    setDeviceLabel(buildDeviceLabel());
  }, []);

  const countsByLabel = useMemo(() => {
    const map = new Map<string, number>();
    for (const sign of SIGNS) {
      map.set(sign, 0);
    }
    for (const s of samples) {
      map.set(s.label, (map.get(s.label) || 0) + 1);
    }
    return map;
  }, [samples]);

  const appendSample = useCallback((features: number[], hands: number, reason: "auto" | "manual") => {
    if (!features.length || features.length !== FEATURE_KEYS.length) return false;
    if (hands < minHands) return false;
    if (!selectedLabel) return false;

    const prev = lastCapturedFeaturesRef.current;
    if (prev.length === features.length) {
      const dist = l2Distance(prev, features);
      if (dist < DEDUPE_DISTANCE_THRESHOLD && reason === "auto") {
        return false;
      }
    }

    const sample: CapturedSample = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: selectedLabel,
      features: [...features],
      hands,
      fps,
      capturedAt: new Date().toISOString(),
      device: deviceLabel,
      sessionId: sessionIdRef.current,
    };
    lastCapturedFeaturesRef.current = [...features];
    setSamples((prevSamples) => [...prevSamples, sample]);
    return true;
  }, [deviceLabel, fps, minHands, selectedLabel]);

  const handleManualCapture = useCallback(() => {
    void appendSample(latestFeaturesRef.current, latestHandsRef.current, "manual");
  }, [appendSample]);

  const clearAutoStartCountdown = useCallback(() => {
    if (autoStartTimerRef.current !== null) {
      window.clearInterval(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
    setAutoStartCountdown(null);
  }, []);

  const handleAutoCaptureToggle = useCallback(() => {
    if (autoCapture) {
      setAutoCapture(false);
      return;
    }
    if (autoStartCountdown !== null) {
      clearAutoStartCountdown();
      return;
    }

    let next = AUTO_START_COUNTDOWN_SECONDS;
    setAutoStartCountdown(next);
    autoStartTimerRef.current = window.setInterval(() => {
      next -= 1;
      if (next <= 0) {
        if (autoStartTimerRef.current !== null) {
          window.clearInterval(autoStartTimerRef.current);
          autoStartTimerRef.current = null;
        }
        setAutoStartCountdown(null);
        lastAutoCaptureAtRef.current = 0;
        setAutoCapture(true);
        return;
      }
      setAutoStartCountdown(next);
    }, 1000);
  }, [autoCapture, autoStartCountdown, clearAutoStartCountdown]);

  const handleExportCsv = useCallback(() => {
    if (samples.length === 0) return;
    const header = ["label", ...FEATURE_KEYS].join(",");
    const lines = samples.map((s) => {
      const nums = s.features.map((v) => Number(v).toFixed(8));
      return [s.label, ...nums].join(",");
    });
    const csv = `${header}\n${lines.join("\n")}\n`;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `mediapipe_capture_${deviceLabel}_${stamp}.csv`);
  }, [deviceLabel, samples]);

  const handleExportJsonlGz = useCallback(async () => {
    if (samples.length === 0) return;
    const payload = samples.map((s) => JSON.stringify({
      label: s.label,
      features: s.features,
      hands: s.hands,
      fps: s.fps,
      captured_at: s.capturedAt,
      device: s.device,
      session_id: s.sessionId,
      source: "web_collect",
      schema: "v1",
    })).join("\n");

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const blob = await toGzipBlob(payload);
    const ext = blob.type === "application/gzip" ? "jsonl.gz" : "jsonl";
    downloadBlob(blob, `mediapipe_capture_${deviceLabel}_${stamp}.${ext}`);
  }, [deviceLabel, samples]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setStatus("Loading MediaPipe Hands...");
        const vision = await import("@mediapipe/tasks-vision");
        const { FilesetResolver, HandLandmarker } = vision as unknown as {
          FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
          HandLandmarker: {
            createFromOptions: (resolver: unknown, options: Record<string, unknown>) => Promise<HandLandmarkerLike>;
          };
        };

        const resolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const landmarker = await HandLandmarker.createFromOptions(resolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
        handsRef.current = landmarker;
        if (cancelled) return;

        setStatus("Starting camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 24, max: 30 },
            facingMode: "user",
          },
        });
        streamRef.current = stream;
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (!videoRef.current) throw new Error("Video element unavailable");
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (cancelled) return;

        setReady(true);
        setStatus("Ready");
      } catch (err) {
        setStatus(`Init failed: ${String((err as Error)?.message || err)}`);
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (renderRafRef.current) cancelAnimationFrame(renderRafRef.current);
      if (detectRafRef.current) cancelAnimationFrame(detectRafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (handsRef.current && typeof handsRef.current.close === "function") {
        handsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (autoStartTimerRef.current !== null) {
        window.clearInterval(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

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

      for (const hand of latestLandmarksRef.current) {
        drawLandmarks(ctx, hand, canvas.width, canvas.height);
      }
    };

    const detect = (nowMs: number) => {
      detectRafRef.current = requestAnimationFrame(detect);
      if (nowMs - lastDetectRef.current < DETECT_INTERVAL_MS) return;
      lastDetectRef.current = nowMs;

      const video = videoRef.current;
      const hands = handsRef.current;
      if (!video || !hands || video.readyState < 2) return;

      if (!fpsWindowStartRef.current) {
        fpsWindowStartRef.current = nowMs;
      }
      fpsFramesRef.current += 1;
      const elapsed = nowMs - fpsWindowStartRef.current;
      if (elapsed >= 1000) {
        setFps(Math.round((fpsFramesRef.current * 1000) / elapsed));
        fpsFramesRef.current = 0;
        fpsWindowStartRef.current = nowMs;
      }

      let result: HandsResultShape = { landmarks: [], handedness: [] };
      try {
        if (typeof hands.detectForVideo === "function") {
          result = hands.detectForVideo(video, nowMs) || result;
        } else if (typeof hands.detect === "function") {
          result = hands.detect(video) || result;
        }
      } catch {
        return;
      }

      latestLandmarksRef.current = result.landmarks ?? [];
      const { features, numHands } = buildFeatures(result);
      latestFeaturesRef.current = features;
      latestHandsRef.current = numHands;
      setDetectedHands(numHands);

      if (!autoCapture) return;
      if (numHands < minHands) return;
      if (!features.length) return;
      const intervalMs = Math.max(AUTO_CAPTURE_MIN_MS, Math.min(AUTO_CAPTURE_MAX_MS, autoIntervalMs));
      if (nowMs - lastAutoCaptureAtRef.current < intervalMs) return;
      const appended = appendSample(features, numHands, "auto");
      if (appended) {
        lastAutoCaptureAtRef.current = nowMs;
      }
    };

    renderRafRef.current = requestAnimationFrame(render);
    detectRafRef.current = requestAnimationFrame(detect);
    return () => {
      if (renderRafRef.current) cancelAnimationFrame(renderRafRef.current);
      if (detectRafRef.current) cancelAnimationFrame(detectRafRef.current);
    };
  }, [appendSample, autoCapture, autoIntervalMs, minHands, ready]);

  return (
    <div className="min-h-screen bg-ninja-bg text-ninja-text">
      <header className="border-b border-ninja-border bg-ninja-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              BACK
            </Link>
            <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">Dataset Capture</span>
          </div>
          <div className="text-xs font-mono text-emerald-300">{status}</div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-4 p-4 md:grid-cols-[1fr_360px] md:p-6">
        <section className="rounded-xl border border-ninja-border bg-ninja-panel/90 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
            <div className="inline-flex items-center gap-2 rounded-lg border border-ninja-border px-2 py-1">
              <Camera className="h-3.5 w-3.5 text-zinc-400" />
              FPS {fps} • HANDS {detectedHands}
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-ninja-border px-2 py-1">
              <Hand className="h-3.5 w-3.5 text-zinc-400" />
              DEVICE {deviceLabel.toUpperCase()} • SESSION {sessionIdRef.current}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-ninja-border bg-black">
            <video ref={videoRef} className="hidden" playsInline muted />
            <canvas ref={canvasRef} className="aspect-[4/3] h-auto w-full object-cover" />
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Fast transfer mode: this captures landmarks only (no video uploads). Export once per session.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-ninja-border bg-ninja-panel/90 p-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">Target Sign</label>
            <select
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
              className="h-10 w-full rounded-lg border border-ninja-border bg-ninja-card px-3 text-sm text-white"
            >
              {SIGNS.map((sign) => (
                <option key={sign} value={sign}>{sign}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">Min Hands</label>
              <select
                value={String(minHands)}
                onChange={(e) => setMinHands(e.target.value === "2" ? 2 : 1)}
                className="h-10 w-full rounded-lg border border-ninja-border bg-ninja-card px-3 text-sm text-white"
              >
                <option value="1">1 hand</option>
                <option value="2">2 hands</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">Auto Interval</label>
              <input
                type="number"
                value={autoIntervalMs}
                onChange={(e) => setAutoIntervalMs(Math.max(80, Math.min(2000, Number(e.target.value) || AUTO_CAPTURE_DEFAULT_MS)))}
                className="h-10 w-full rounded-lg border border-ninja-border bg-ninja-card px-3 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleManualCapture}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-sm font-bold text-emerald-200 hover:bg-emerald-500/20"
            >
              <Camera className="h-4 w-4" />
              Capture One
            </button>
            <button
              type="button"
              onClick={handleAutoCaptureToggle}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-bold ${
                autoCapture
                  ? "border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                  : autoStartCountdown !== null
                    ? "border-yellow-400/40 bg-yellow-500/10 text-yellow-100 hover:bg-yellow-500/20"
                  : "border-sky-400/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
              }`}
            >
              {autoCapture ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {autoCapture ? "Stop Auto" : autoStartCountdown !== null ? `Cancel (${autoStartCountdown})` : "Start Auto"}
            </button>
          </div>

          {autoStartCountdown !== null ? (
            <p className="text-[11px] text-yellow-200/90">
              Auto capture starts in {autoStartCountdown}...
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={samples.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ninja-border bg-ninja-card text-sm font-bold text-zinc-100 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void handleExportJsonlGz()}
              disabled={samples.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ninja-border bg-ninja-card text-sm font-bold text-zinc-100 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export JSONL.GZ
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setSamples([]);
              lastCapturedFeaturesRef.current = [];
            }}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-400/35 bg-red-500/10 text-sm font-bold text-red-200 hover:bg-red-500/20"
          >
            <Trash2 className="h-4 w-4" />
            Clear Session Samples
          </button>

          <div className="rounded-lg border border-ninja-border bg-black/30 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
              Session Counts • {samples.length} total
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-300">
              {SIGNS.map((sign) => (
                <div key={sign} className="flex items-center justify-between">
                  <span>{sign}</span>
                  <span className="font-mono text-zinc-100">{countsByLabel.get(sign) || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
