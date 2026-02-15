"use client";

import { useEffect, useRef } from "react";

function randomRange(from: number, to: number, seed?: number) {
    return Math.floor((seed ?? Math.random()) * (to - from + 1) + from);
}

interface AshParticle {
    x: number;
    y: number;
    a: number;
    r: number;
    g: number;
    b: number;
    dp: { x: number; y: number }[];
}

function createAsh(W: number, H: number, opts?: Partial<Pick<AshParticle, "x" | "y" | "a" | "dp">>): AshParticle {
    const m = Math.random();
    const p = randomRange(4, 8, m);

    const x = opts?.x ?? m * W;
    const y = opts?.y ?? m * H;
    const a = opts?.a ?? m * (p - 4) + 1;
    const r = randomRange(233, 255, m);
    const g = randomRange(181, 192, m);
    const b = randomRange(72, 88, m);

    let dp: { x: number; y: number }[];
    if (opts?.dp) {
        dp = opts.dp;
    } else {
        dp = [{ x: 0, y: 0 }];
        for (let i = 0; i < p; i++) {
            const j = i === 0 || p / 2 > i ? 1 : -1;
            dp.push({
                x: dp[i].x + randomRange(5, 30) * j,
                y: dp[i].y + randomRange(5, 30) * j,
            });
        }
    }

    return { x, y, a, r, g, b, dp };
}

interface AshParticlesProps {
    className?: string;
    particleCount?: number;
}

export default function AshParticles({ className = "", particleCount = 50 }: AshParticlesProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bufferRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        const buffer = bufferRef.current;
        if (!canvas || !buffer) return;

        const parent = canvas.parentElement;
        if (!parent) return;

        let W = parent.offsetWidth;
        let H = parent.offsetHeight;

        canvas.width = W;
        canvas.height = H;
        buffer.width = W;
        buffer.height = H;

        const ctxs = [canvas.getContext("2d")!, buffer.getContext("2d")!];
        const canvases = [canvas, buffer];
        let C = 0;
        let angle = 0;

        const A: AshParticle[] = [];
        for (let i = 0; i < particleCount; i++) A.push(createAsh(W, H));

        function update() {
            angle += 0.01;
            for (let i = 0; i < A.length; i++) {
                const p = A[i];
                p.y += Math.cos(angle + A.length) + 1 + p.a / 2;
                p.x += Math.sin(angle) * 2;

                if (p.x > W + 5 || p.x < -5 || p.y > H) {
                    if (i % 3 > 0) {
                        A[i] = createAsh(W, H, { y: -10, a: p.a, dp: p.dp });
                    } else {
                        if (Math.sin(angle) > 0) {
                            A[i] = createAsh(W, H, { x: -5, a: p.a, dp: p.dp });
                        } else {
                            A[i] = createAsh(W, H, { x: W + 5, a: p.a, dp: p.dp });
                        }
                    }
                }
            }
        }

        function draw() {
            if (C === 0) {
                canvases[0].style.visibility = "visible";
                canvases[1].style.visibility = "hidden";
                C = 1;
            } else {
                canvases[1].style.visibility = "visible";
                canvases[0].style.visibility = "hidden";
                C = 0;
            }

            const ctx = ctxs[C];
            ctx.clearRect(0, 0, W, H);

            for (let i = 0; i < A.length; i++) {
                const p = A[i];
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.a);
                grad.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, 1)`);
                grad.addColorStop(0.9, `rgba(${p.r}, ${p.g}, ${p.b}, ${randomRange(1, 10) / 10})`);
                grad.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0)`);

                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                for (let j = 1; j < p.dp.length; j++) {
                    ctx.lineTo(p.x + p.dp[j].x, p.y + p.dp[j].y);
                }
                ctx.closePath();
                ctx.fillStyle = grad;
                ctx.globalAlpha = 0.7;
                ctx.fill();
            }

            update();
        }

        const interval = setInterval(draw, 33);

        const ro = new ResizeObserver(() => {
            W = parent.offsetWidth;
            H = parent.offsetHeight;
            canvas.width = W;
            canvas.height = H;
            buffer.width = W;
            buffer.height = H;
        });
        ro.observe(parent);

        return () => {
            clearInterval(interval);
            cancelAnimationFrame(rafRef.current);
            ro.disconnect();
        };
    }, [particleCount]);

    return (
        <div
            className={className}
            style={{ position: "relative", width: "100%", height: "100%", pointerEvents: "none" }}
        >
            <canvas
                ref={bufferRef}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
            <canvas
                ref={canvasRef}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
        </div>
    );
}
