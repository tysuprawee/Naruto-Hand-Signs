"use client";

import { useEffect, useRef } from "react";

interface WaterDragonOverlayProps {
  leftPct: number;
  topPct: number;
  lowPower?: boolean;
  mirroredInput?: boolean;
  sourceAspect?: number;
}

type Point = { x: number; y: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function lerp(from: number, to: number, alpha: number): number {
  return from + ((to - from) * alpha);
}

function mapSourceToView(
  xNorm: number,
  yNorm: number,
  sourceAspect: number,
  viewAspect: number,
): Point {
  let mappedX = xNorm;
  let mappedY = yNorm;
  if (sourceAspect > viewAspect) {
    const renderedW = sourceAspect / viewAspect;
    const cropX = (renderedW - 1) * 0.5;
    mappedX = (xNorm * renderedW) - cropX;
  } else if (sourceAspect < viewAspect) {
    const renderedH = viewAspect / sourceAspect;
    const cropY = (renderedH - 1) * 0.5;
    mappedY = (yNorm * renderedH) - cropY;
  }
  return { x: clamp01(mappedX), y: clamp01(mappedY) };
}

function cubicPoint(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const inv = 1 - t;
  const inv2 = inv * inv;
  const inv3 = inv2 * inv;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: (inv3 * a.x) + (3 * inv2 * t * b.x) + (3 * inv * t2 * c.x) + (t3 * d.x),
    y: (inv3 * a.y) + (3 * inv2 * t * b.y) + (3 * inv * t2 * c.y) + (t3 * d.y),
  };
}

function cubicTangent(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const inv = 1 - t;
  return {
    x: (3 * inv * inv * (b.x - a.x)) + (6 * inv * t * (c.x - b.x)) + (3 * t * t * (d.x - c.x)),
    y: (3 * inv * inv * (b.y - a.y)) + (6 * inv * t * (c.y - b.y)) + (3 * t * t * (d.y - c.y)),
  };
}

function drawDragonHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  phase: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const jawOpen = (Math.sin(phase * 3.4) + 1) * 0.5;
  const jawDrop = size * (0.06 + (jawOpen * 0.08));

  const headGrad = ctx.createLinearGradient(-size * 0.55, -size * 0.36, size * 0.6, size * 0.34);
  headGrad.addColorStop(0, "rgba(16, 78, 140, 0.92)");
  headGrad.addColorStop(0.5, "rgba(58, 202, 255, 0.88)");
  headGrad.addColorStop(1, "rgba(196, 246, 255, 0.95)");

  ctx.beginPath();
  ctx.moveTo(-size * 0.45, -size * 0.03);
  ctx.quadraticCurveTo(-size * 0.16, -size * 0.42, size * 0.44, -size * 0.13);
  ctx.quadraticCurveTo(size * 0.63, 0, size * 0.46, size * 0.12);
  ctx.quadraticCurveTo(size * 0.08, size * 0.45 + jawDrop, -size * 0.48, size * 0.16);
  ctx.closePath();
  ctx.fillStyle = headGrad;
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, size * 0.028);
  ctx.strokeStyle = "rgba(180, 247, 255, 0.78)";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-size * 0.22, -size * 0.14);
  ctx.quadraticCurveTo(-size * 0.08, -size * 0.55, size * 0.02, -size * 0.18);
  ctx.moveTo(size * 0.02, -size * 0.12);
  ctx.quadraticCurveTo(size * 0.14, -size * 0.56, size * 0.2, -size * 0.14);
  ctx.strokeStyle = "rgba(208, 252, 255, 0.82)";
  ctx.lineWidth = Math.max(0.8, size * 0.02);
  ctx.stroke();

  const whiskerWobble = Math.sin(phase * 2.2) * size * 0.05;
  ctx.beginPath();
  ctx.moveTo(size * 0.2, size * 0.02);
  ctx.bezierCurveTo(
    size * 0.56,
    -size * 0.06 + whiskerWobble,
    size * 0.66,
    -size * 0.22,
    size * 0.88,
    -size * 0.28,
  );
  ctx.moveTo(size * 0.18, size * 0.1);
  ctx.bezierCurveTo(
    size * 0.56,
    size * 0.2 - whiskerWobble,
    size * 0.64,
    size * 0.33,
    size * 0.86,
    size * 0.38,
  );
  ctx.strokeStyle = "rgba(187, 245, 255, 0.72)";
  ctx.lineWidth = Math.max(0.7, size * 0.013);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(size * 0.2, -size * 0.08, Math.max(2, size * 0.06), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(14, 20, 28, 0.92)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(size * 0.218, -size * 0.095, Math.max(1.2, size * 0.02), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(235, 255, 255, 0.95)";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(size * 0.33, size * 0.04);
  ctx.lineTo(size * 0.42, size * 0.12 + jawDrop * 0.35);
  ctx.lineTo(size * 0.46, size * 0.02);
  ctx.closePath();
  ctx.fillStyle = "rgba(247, 255, 255, 0.86)";
  ctx.fill();

  ctx.globalCompositeOperation = "screen";
  const glow = ctx.createRadialGradient(size * 0.24, 0, size * 0.02, size * 0.2, 0, size * 0.68);
  glow.addColorStop(0, "rgba(198, 248, 255, 0.52)");
  glow.addColorStop(1, "rgba(77, 220, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
}

export default function WaterDragonOverlay({
  leftPct,
  topPct,
  lowPower = false,
  mirroredInput = false,
  sourceAspect = 4 / 3,
}: WaterDragonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftPctRef = useRef(leftPct);
  const topPctRef = useRef(topPct);
  const mirroredInputRef = useRef(mirroredInput);
  const sourceAspectRef = useRef(sourceAspect);

  useEffect(() => {
    leftPctRef.current = leftPct;
    topPctRef.current = topPct;
    mirroredInputRef.current = mirroredInput;
    sourceAspectRef.current = sourceAspect;
  }, [leftPct, topPct, mirroredInput, sourceAspect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cssWidth = 1;
    let cssHeight = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssWidth = Math.max(1, Math.floor(rect.width));
      cssHeight = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.3 : 1.9);
      const nextWidth = Math.max(1, Math.floor(cssWidth * dpr));
      const nextHeight = Math.max(1, Math.floor(cssHeight * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const streams = lowPower ? 2 : 3;
    const segments = lowPower ? 28 : 44;
    const droplets = lowPower ? 20 : 36;
    const startAt = performance.now();
    let rafId = 0;

    const draw = () => {
      const elapsed = (performance.now() - startAt) / 1000;
      const phase = elapsed * (lowPower ? 1.08 : 1.42);
      const viewAspect = Math.max(0.1, cssWidth / cssHeight);

      const rawX = clamp01(leftPctRef.current / 100);
      const rawY = clamp01(topPctRef.current / 100);
      const inputX = mirroredInputRef.current ? (1 - rawX) : rawX;
      const mapped = mapSourceToView(inputX, rawY, Math.max(0.1, sourceAspectRef.current), viewAspect);
      const targetX = mapped.x * cssWidth;
      const targetY = mapped.y * cssHeight;

      const start: Point = {
        x: cssWidth * (0.08 + (Math.sin(phase * 0.55) * 0.03)),
        y: cssHeight * (0.9 + (Math.cos(phase * 0.5) * 0.02)),
      };
      const end: Point = {
        x: targetX + (cssWidth * (0.15 + (Math.sin(phase * 1.17) * 0.05))),
        y: Math.max(cssHeight * 0.16, targetY - (cssHeight * (0.05 + (Math.cos(phase * 1.3) * 0.02)))),
      };
      const controlA: Point = {
        x: cssWidth * (0.24 + (Math.cos(phase * 1.3) * 0.08)),
        y: cssHeight * (0.94 - (Math.sin(phase * 1.15) * 0.11)),
      };
      const controlB: Point = {
        x: lerp(start.x, end.x, 0.62) + (Math.cos((phase * 1.8) + 0.9) * cssWidth * 0.09),
        y: lerp(start.y, end.y, 0.2) - (cssHeight * (0.28 + (Math.sin(phase * 1.45) * 0.09))),
      };
      const amp = cssHeight * (lowPower ? 0.034 : 0.055);

      const pointAt = (u: number, streamOffset: number): Point => {
        const base = cubicPoint(start, controlA, controlB, end, u);
        const tan = cubicTangent(start, controlA, controlB, end, u);
        const len = Math.max(1e-4, Math.hypot(tan.x, tan.y));
        const tx = tan.x / len;
        const ty = tan.y / len;
        const nx = -ty;
        const ny = tx;
        const fade = 1 - (u * 0.6);
        const swirl = Math.sin((u * 12.2) + (phase * 2.5) + streamOffset) * amp * fade;
        const wobble = Math.cos((u * 7.6) - (phase * 1.65) + (streamOffset * 1.4)) * amp * 0.24 * fade;
        return {
          x: base.x + (nx * swirl) + (tx * wobble),
          y: base.y + (ny * swirl) + (ty * wobble),
        };
      };

      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.globalCompositeOperation = "screen";

      for (let stream = 0; stream < streams; stream += 1) {
        const streamOffset = stream * 2.3;
        const lineWidth = (stream === 0 ? 30 : 22) * (lowPower ? 0.7 : 1);
        const alphaScale = stream === 0 ? 0.58 : 0.34;

        ctx.beginPath();
        for (let i = 0; i <= segments; i += 1) {
          const u = i / segments;
          const p = pointAt(u, streamOffset);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }

        const grad = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
        grad.addColorStop(0, `rgba(14, 90, 170, ${0.1 * alphaScale})`);
        grad.addColorStop(0.5, `rgba(58, 225, 255, ${0.5 * alphaScale})`);
        grad.addColorStop(1, `rgba(218, 250, 255, ${0.8 * alphaScale})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = "rgba(112, 234, 255, 0.52)";
        ctx.shadowBlur = lowPower ? 12 : 24;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < droplets; i += 1) {
        const seed = (i * 0.229) + (Math.sin(i * 27.1) * 0.31);
        const u = ((phase * 0.18) + seed) % 1;
        const p = pointAt(u, seed * 3.2);
        const radius = 1 + ((1 - u) * (lowPower ? 1.8 : 2.8));
        const alpha = 0.18 + ((1 - u) * 0.4);
        ctx.beginPath();
        ctx.fillStyle = `rgba(192, 248, 255, ${alpha.toFixed(3)})`;
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const headU = 0.92 + (Math.sin(phase * 0.95) * 0.03);
      const head = pointAt(headU, 0);
      const prev = pointAt(Math.max(0.01, headU - 0.05), 0);
      const headAngle = Math.atan2(head.y - prev.y, head.x - prev.x);
      const headSize = Math.max(66, cssHeight * (lowPower ? 0.1 : 0.14));
      drawDragonHead(ctx, head.x, head.y, headAngle, headSize, phase);

      ctx.globalCompositeOperation = "source-over";
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [lowPower]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <canvas ref={canvasRef} className="h-full w-full object-cover" />
    </div>
  );
}
