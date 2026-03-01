"use client";

import { useEffect, useState } from "react";

interface RasenshurikenOverlayProps {
  leftPct: number;
  topPct: number;
  sizePx: number;
}

export default function RasenshurikenOverlay({
  leftPct,
  topPct,
  sizePx,
}: RasenshurikenOverlayProps) {
  const [powering, setPowering] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const liveTimer = window.setTimeout(() => {
      setLive(true);
    }, 720);
    const powerTimer = window.setTimeout(() => {
      setPowering(false);
    }, 1800);
    return () => {
      window.clearTimeout(liveTimer);
      window.clearTimeout(powerTimer);
    };
  }, []);

  const clampedSize = Math.max(260, Math.min(760, Math.floor(Number(sizePx) || 420)));
  const effectClass = [
    "rsk-effect",
    powering ? "powering" : "",
    live ? "live" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={effectClass}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${clampedSize}px`,
        height: `${clampedSize}px`,
      }}
    >
      <div className="rsk-scene">
        <div className="rsk-tilt-wrap">
          <div className="rsk-rasenshuriken">
            <div className="rsk-aura" />
            <div className="rsk-blade rsk-blade-a" />
            <div className="rsk-blade rsk-blade-b" />
            <div className="rsk-blade-inner-wrap">
              <div className="rsk-blade-inner" />
              <div className="rsk-blade-inner" />
            </div>
            <div className="rsk-core" />
          </div>
        </div>
      </div>

      <style jsx>{`
        .rsk-effect {
          position: absolute;
          transform: translate(-50%, -50%);
          transform-style: preserve-3d;
          pointer-events: none;
          z-index: 5;
          filter: drop-shadow(0 16px 34px rgba(14, 165, 233, 0.22));
        }

        .rsk-scene {
          position: relative;
          width: 100%;
          height: 100%;
          margin: 0 auto;
          perspective: 500px;
          perspective-origin: center center;
        }

        .rsk-tilt-wrap {
          position: absolute;
          inset: 0;
          transform: rotateX(55deg);
          transform-style: preserve-3d;
        }

        .rsk-rasenshuriken {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 68.75%;
          height: 68.75%;
          transform: translate(-50%, -50%);
          transform-origin: center center;
          transform-style: preserve-3d;
          animation: rsk-spin 0.15s linear infinite;
          transition: opacity 700ms ease, filter 850ms ease;
        }

        .rsk-rasenshuriken::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 16.4%;
          height: 16.4%;
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0.1);
          border: 2px solid rgba(208, 246, 255, 0.6);
          opacity: 0;
          pointer-events: none;
        }

        .rsk-aura {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 78.125%;
          height: 78.125%;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transform-origin: center center;
          background: radial-gradient(
            circle at center,
            rgba(214, 242, 255, 0.26) 0%,
            rgba(130, 211, 248, 0.18) 28%,
            rgba(84, 186, 238, 0.11) 52%,
            rgba(42, 148, 214, 0.06) 74%,
            rgba(14, 165, 233, 0.02) 88%,
            rgba(14, 165, 233, 0) 100%
          );
          filter: blur(16px);
          animation: rsk-aura-pulse 0.25s ease-in-out infinite alternate;
          z-index: 0;
          transition: opacity 1100ms ease, transform 1100ms cubic-bezier(0.2, 0.65, 0.2, 1), filter 1100ms ease;
        }

        .rsk-core {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 20%;
          height: 20%;
          margin: -10% 0 0 -10%;
          border-radius: 50%;
          background: radial-gradient(
            circle at 40% 35%,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(230, 247, 255, 0.95) 16%,
            rgba(156, 220, 250, 0.72) 38%,
            rgba(92, 189, 238, 0.38) 62%,
            rgba(32, 140, 211, 0.12) 82%,
            rgba(14, 165, 233, 0) 100%
          );
          box-shadow:
            0 0 20px rgba(255, 255, 255, 0.95),
            0 0 46px rgba(173, 233, 255, 0.78),
            0 0 86px rgba(61, 179, 233, 0.52);
          filter: blur(1.1px);
          animation: rsk-core-strain 0.2s ease-in-out infinite alternate;
          z-index: 10;
          transition: opacity 680ms ease, filter 680ms ease;
        }

        .rsk-core::before {
          content: "";
          position: absolute;
          inset: 28%;
          border-radius: 50%;
          background: radial-gradient(
            circle at center,
            rgba(255, 255, 255, 0.92) 0%,
            rgba(232, 249, 255, 0.45) 55%,
            rgba(232, 249, 255, 0) 100%
          );
          filter: blur(3px);
        }

        .rsk-core::after {
          content: "";
          position: absolute;
          inset: -36%;
          border-radius: 50%;
          background: radial-gradient(
            circle at center,
            rgba(168, 231, 255, 0.24) 0%,
            rgba(76, 190, 241, 0.11) 46%,
            rgba(14, 165, 233, 0) 100%
          );
          filter: blur(8px);
          z-index: -1;
        }

        .rsk-blade {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 12.727%;
          height: 85.455%;
          margin: -42.727% 0 0 -6.364%;
          transform-origin: center center;
          transition: opacity 520ms ease, filter 620ms ease;
        }

        .rsk-blade::before {
          content: "";
          position: absolute;
          inset: -10px;
          background: radial-gradient(
            ellipse 40% 60% at 50% 50%,
            rgba(255, 255, 255, 0.95) 0%,
            rgba(186, 230, 253, 0.7) 40%,
            rgba(125, 211, 252, 0.3) 70%,
            transparent 100%
          );
          filter: blur(12px) drop-shadow(0 0 11px rgba(255, 255, 255, 0.82))
            drop-shadow(0 0 24px rgba(125, 211, 252, 0.56));
        }

        .rsk-blade-a {
          transform: rotate(0deg);
        }

        .rsk-blade-b {
          transform: rotate(180deg);
        }

        .rsk-blade-inner-wrap {
          position: absolute;
          inset: 0;
          animation: rsk-spin-inner 0.1s linear infinite reverse;
          transition: opacity 560ms ease, filter 650ms ease;
        }

        .rsk-blade-inner {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 9.091%;
          height: 64.545%;
          margin: -32.272% 0 0 -4.545%;
          transform-origin: center center;
        }

        .rsk-blade-inner::before {
          content: "";
          position: absolute;
          inset: -9px;
          background: radial-gradient(
            ellipse 35% 55% at 50% 50%,
            rgba(255, 255, 255, 0.9) 0%,
            rgba(186, 230, 253, 0.6) 45%,
            transparent 100%
          );
          filter: blur(9px) drop-shadow(0 0 7px rgba(255, 255, 255, 0.82));
        }

        .rsk-blade-inner:nth-child(1) {
          transform: rotate(90deg);
        }

        .rsk-blade-inner:nth-child(2) {
          transform: rotate(270deg);
        }

        .rsk-effect.powering .rsk-rasenshuriken {
          opacity: 0.34;
          filter: blur(8px) brightness(0.6);
          animation-duration: 0.52s;
        }

        .rsk-effect.powering .rsk-rasenshuriken::after {
          animation: rsk-power-ring 1s ease-out 0.1s 1;
        }

        .rsk-effect.powering .rsk-aura {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.2);
          filter: blur(26px);
        }

        .rsk-effect.powering .rsk-core {
          opacity: 0.22;
          filter: blur(5px) brightness(1.35);
        }

        .rsk-effect.powering .rsk-blade,
        .rsk-effect.powering .rsk-blade-inner-wrap {
          opacity: 0;
          filter: blur(4px);
        }

        .rsk-effect.live .rsk-rasenshuriken {
          opacity: 1;
          filter: none;
          animation-duration: 0.15s;
        }

        .rsk-effect.live .rsk-aura,
        .rsk-effect.live .rsk-core,
        .rsk-effect.live .rsk-blade,
        .rsk-effect.live .rsk-blade-inner-wrap {
          opacity: 1;
        }

        @keyframes rsk-spin {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes rsk-spin-inner {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes rsk-core-strain {
          from {
            transform: scale(0.96);
            opacity: 0.92;
            box-shadow:
              0 0 16px rgba(255, 255, 255, 0.88),
              0 0 40px rgba(173, 233, 255, 0.7),
              0 0 76px rgba(61, 179, 233, 0.44);
          }
          to {
            transform: scale(1.08);
            opacity: 1;
            box-shadow:
              0 0 28px rgba(255, 255, 255, 1),
              0 0 62px rgba(173, 233, 255, 0.9),
              0 0 110px rgba(61, 179, 233, 0.66);
          }
        }

        @keyframes rsk-aura-pulse {
          from {
            opacity: 0.75;
            transform: translate(-50%, -50%) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.03);
          }
        }

        @keyframes rsk-power-ring {
          0% {
            opacity: 0.78;
            transform: translate(-50%, -50%) scale(0.15);
          }
          70% {
            opacity: 0.52;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(5.1);
          }
        }
      `}</style>
    </div>
  );
}
