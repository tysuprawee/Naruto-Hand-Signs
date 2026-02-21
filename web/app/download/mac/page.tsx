"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Monitor,
  Cpu,
  Wifi,
  Camera,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Shield,
  Zap,
  Eye,
  Gamepad2,
} from "lucide-react";

const DOWNLOAD_URL =
  "https://github.com/tysuprawee/Naruto-Hand-Signs/releases/download/v1.0.0/v1.0.0-JutsuAcademy-Portable-mac-AppleSilicon.zip";

export default function MacDownloadPage() {
  return (
    <div className="min-h-screen bg-ninja-bg text-ninja-text font-sans selection:bg-ninja-accent selection:text-white">
      {/* Subtle background glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-zinc-500/8 via-zinc-400/4 to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-ninja-accent/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-ninja-bg/80 backdrop-blur-md border-b border-ninja-border">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="h-10 w-10 relative">
              <img
                src="/logo2.png"
                alt="Jutsu Academy"
                className="object-contain w-full h-full"
              />
            </div>
            <span className="font-bold tracking-tight text-lg text-zinc-100">
              Jutsu Academy
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-ninja-dim hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="relative z-10 pt-32 pb-20 px-6 container mx-auto max-w-4xl">
        {/* Hero */}
        <section className="text-center mb-16 space-y-6">
          {/* Apple logo badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-700/80 bg-zinc-900/60 text-sm font-bold text-zinc-300 backdrop-blur-sm">
            <svg
              className="w-4 h-4 fill-current"
              viewBox="0 0 814 1000"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57.8-155.5-127.4c-58.3-81-105.6-207.4-105.6-328.1 0-192.8 125.5-295.1 248.3-295.1 65.4 0 119.9 42.8 160.8 42.8 39.2 0 100.4-45.3 174.6-45.3 28.2 0 129.4 2.5 196.5 96.1zM554.1 159.4c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.8 32.4-54.4 83.7-54.4 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.8-30.4 134.8-71.3z" />
            </svg>
            macOS • Apple Silicon
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1]">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400">
              🥷 Jutsu Academy
            </span>
            <br />
            <span className="text-ninja-accent text-3xl md:text-4xl">
              v1.0.0 — Portable macOS Build
            </span>
          </h1>

          <p className="text-lg text-ninja-dim max-w-xl mx-auto">
            The full desktop experience, bundled and ready to run. No
            installation required — just unzip and train.
          </p>

          {/* Download CTA */}
          <div className="pt-4 flex flex-col items-center gap-4">
            <a
              href={DOWNLOAD_URL}
              id="download-mac-button"
              className="group relative h-16 px-12 bg-gradient-to-r from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500 text-white text-xl font-black rounded-2xl flex items-center gap-4 transition-all shadow-[0_0_30px_rgba(255,255,255,0.06)] hover:shadow-[0_0_50px_rgba(255,255,255,0.12)] hover:-translate-y-1 border border-zinc-500/30"
            >
              <Download className="w-6 h-6 group-hover:animate-bounce" />
              DOWNLOAD FOR macOS
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>

            <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm text-ninja-dim">
              <span className="flex items-center gap-1.5">
                <Monitor className="w-4 h-4" />
                ~439 MB
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4" />
                Apple Silicon (M1/M2/M3/M4)
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-green-500" />
                Portable — No Install
              </span>
            </div>

            {/* Intel warning */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Not compatible with Intel Macs (pre-2020)
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-ninja-border to-transparent mb-16" />

        {/* How to Run */}
        <section className="mb-16">
          <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-ninja-accent" />
            How to Run
          </h2>

          <div className="space-y-4">
            {[
              {
                step: "1",
                title: "Download and unzip",
                description: (
                  <>
                    Download{" "}
                    <code className="px-2 py-0.5 bg-ninja-card rounded text-ninja-accent text-sm font-mono">
                      v1.0.0-JutsuAcademy-Portable-mac-AppleSilicon.zip
                    </code>
                  </>
                ),
              },
              {
                step: "2",
                title: "Launch the app",
                description: (
                  <>
                    Double-click{" "}
                    <code className="px-2 py-0.5 bg-ninja-card rounded text-green-400 text-sm font-mono">
                      Start-JutsuAcademyLauncher.command
                    </code>
                  </>
                ),
              },
              {
                step: "3",
                title: "If macOS blocks it",
                description: (
                  <>
                    Right-click →{" "}
                    <span className="text-white font-bold">Open</span> →
                    Confirm in the dialog
                  </>
                ),
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex items-start gap-4 p-5 bg-ninja-card/60 border border-ninja-border rounded-xl hover:border-ninja-accent/30 transition-colors group"
              >
                <div className="shrink-0 w-10 h-10 rounded-full bg-ninja-accent/15 border border-ninja-accent/30 flex items-center justify-center text-ninja-accent font-black text-lg group-hover:bg-ninja-accent/25 transition-colors">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">
                    {item.title}
                  </h3>
                  <p className="text-ninja-dim mt-1">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
            <Zap className="w-6 h-6 text-ninja-accent" />
            Features
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: <Eye className="w-5 h-5 text-blue-400" />,
                title: "Real-time hand sign recognition",
                sub: "Powered by MediaPipe",
                color: "blue",
              },
              {
                icon: (
                  <svg
                    className="w-5 h-5 fill-indigo-400"
                    viewBox="0 0 127.14 96.36"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-15.02-2.39-32.91-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                ),
                title: "Discord login integration",
                sub: "Sync your progress & rank",
                color: "indigo",
              },
              {
                icon: <Camera className="w-5 h-5 text-purple-400" />,
                title: "Face tracking & selfie segmentation",
                sub: "Immersive AR overlays",
                color: "purple",
              },
              {
                icon: <Gamepad2 className="w-5 h-5 text-ninja-accent" />,
                title: "Jutsu card progression system",
                sub: "Unlock techniques as you train",
                color: "orange",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-5 bg-ninja-card/40 border border-ninja-border rounded-xl hover:border-ninja-accent/30 transition-colors"
              >
                <div className="shrink-0 mt-0.5">{feature.icon}</div>
                <div>
                  <h3 className="text-white font-bold">{feature.title}</h3>
                  <p className="text-sm text-ninja-dim mt-0.5">
                    {feature.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Requirements */}
        <section className="mb-16">
          <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
            <Monitor className="w-6 h-6 text-ninja-accent" />
            Requirements
          </h2>

          <div className="bg-ninja-card/60 border border-ninja-border rounded-xl p-6 space-y-4">
            {[
              {
                icon: <Cpu className="w-5 h-5 text-zinc-400" />,
                label: "macOS with Apple Silicon (M1 or later)",
              },
              {
                icon: <Camera className="w-5 h-5 text-zinc-400" />,
                label: "Webcam access for hand tracking",
              },
              {
                icon: <Wifi className="w-5 h-5 text-zinc-400" />,
                label: "Internet connection for Discord login",
              },
            ].map((req, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <span className="flex items-center gap-2 text-zinc-200">
                  {req.icon}
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="mb-16">
          <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            Troubleshooting
          </h2>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <span className="text-amber-400">⚠️</span> Signs not progressing?
            </h3>
            <ul className="space-y-2 text-ninja-dim">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                Ensure good lighting and proper webcam access
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                Press{" "}
                <kbd className="px-2 py-0.5 bg-ninja-card border border-ninja-border rounded text-white text-sm font-mono font-bold">
                  C
                </kbd>{" "}
                to open the calibration panel
              </li>
            </ul>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center space-y-6">
          <div className="h-px bg-gradient-to-r from-transparent via-ninja-border to-transparent mb-8" />

          <a
            href={DOWNLOAD_URL}
            className="group inline-flex h-14 px-10 bg-gradient-to-r from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500 text-white text-lg font-black rounded-xl items-center gap-3 transition-all shadow-[0_0_30px_rgba(255,255,255,0.06)] hover:shadow-[0_0_50px_rgba(255,255,255,0.12)] hover:-translate-y-1 border border-zinc-500/30"
          >
            <Download className="w-5 h-5" />
            DOWNLOAD v1.0.0 FOR macOS
          </a>

          <p className="text-sm text-ninja-muted">
            By downloading you acknowledge this is an unofficial fan project.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-ninja-border bg-ninja-bg py-8">
        <div className="container mx-auto px-6 text-center text-ninja-muted text-sm">
          <p>&copy; 2026 Jutsu Academy. Built with Google MediaPipe.</p>
        </div>
      </footer>
    </div>
  );
}
