"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sword, Scroll, ArrowRight, Video, Trophy, UploadCloud, Youtube, Instagram, Shield, Info, Hand } from "lucide-react";

import { ModalProvider, useModal } from "./components/modal-provider";
import FireShader from "./components/fire-shader";
import AshParticles from "./components/ash-particles";

export default function Home() {
  const { openModal, trackClick } = useModal();
  const targetDate = useMemo(() => new Date(2026, 1, 21, 21, 0, 0), []);
  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft> | null>(null);

  useEffect(() => {
    setTimeLeft(getTimeLeft(targetDate));
    const timer = window.setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [targetDate]);

  const countdownLabel = !timeLeft
    ? "LOADING…"
    : timeLeft.expired
      ? "LIVE NOW"
      : `${pad(timeLeft.days)}D ${pad(timeLeft.hours)}H ${pad(timeLeft.minutes)}M ${pad(timeLeft.seconds)}S`;

  return (
    <div className="min-h-screen bg-ninja-bg text-ninja-text font-sans selection:bg-ninja-accent selection:text-white">
      {/* Background Image */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "url('/village.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'grayscale(100%) contrast(120%)' // Stylized look
        }}
      ></div>

      {/* Floating ash/ember particles */}
      <div className="fixed inset-0 z-[1] pointer-events-none">
        <AshParticles particleCount={60} />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-ninja-bg/80 backdrop-blur-md border-b border-ninja-border">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 relative">
              <img src="/logo2.png" alt="Shinobi Academy" className="object-contain w-full h-full" />
            </div>
            <span className="font-bold tracking-tight text-lg text-zinc-100 drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)]">Jutsu Academy</span>
          </a>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-zinc-200/90">
            <Link href="#showcase" className="hover:text-ninja-accent transition-colors drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">Features</Link>
            <Link href="#dev" className="hover:text-ninja-accent transition-colors drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">Dev</Link>
            <Link href="/challenge" className="flex items-center gap-2 text-green-400 font-bold hover:text-green-300 transition-colors">
              <Hand className="w-4 h-4" />
              Sign Tester
            </Link>
            <Link href="/leaderboard" className="flex items-center gap-2 text-ninja-accent font-bold hover:text-ninja-accent-glow transition-colors">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 pt-32 pb-20 px-6 container mx-auto max-w-6xl">

        {/* Hero Section */}
        <section className="mb-32 flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 space-y-8">
            {/* Badges Container */}
            <div className="flex flex-col items-start gap-4">
              {/* Global Launch Date Pill */}
              <div className="inline-flex w-full max-w-[42rem] flex-col gap-2 px-4 py-3 rounded-2xl border-2 border-ninja-accent/80 bg-ninja-accent/10 backdrop-blur-xl shadow-[0_0_40px_rgba(255,120,50,0.4)] transition-shadow duration-500 sm:w-full sm:flex-row sm:items-center sm:gap-3 sm:px-6 sm:py-4 sm:rounded-full hover:shadow-[0_0_60px_rgba(255,120,50,0.6)]">
                <span className="flex h-4 w-4 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ninja-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-ninja-accent"></span>
                </span>
                <span className="flex-1 min-w-0 text-ninja-accent font-black tracking-[0.07em] text-[10px] sm:text-[11px] uppercase leading-tight drop-shadow-[0_0_10px_rgba(255,120,50,0.8)]">
                  <span className="block whitespace-nowrap">Early Access • Feb 21 • 9:00 PM</span>
                </span>
                <div className="hidden sm:block w-0.5 h-8 mx-1 bg-ninja-accent/50"></div>
                <span className="shrink-0 text-white font-black font-mono tabular-nums tracking-[0.05em] text-lg sm:text-xl md:text-2xl whitespace-nowrap min-w-[15ch] text-left sm:text-right drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {countdownLabel}
                </span>
              </div>

              {/* System Status */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-ninja-border bg-ninja-card/95 text-[10px] font-bold font-mono text-zinc-200/85 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                v1.0 SYSTEM ONLINE • UNOFFICIAL FANGAME
              </div>
            </div>

            <div className="relative inline-block isolate">
              <h1 className="relative z-10 text-5xl md:text-7xl font-black tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-300 drop-shadow-[0_2px_18px_rgba(0,0,0,0.95)]">
                MASTER YOUR <br />
                <span className="inline-block text-orange-300">
                  JUTSUS
                </span>
              </h1>

              <div
                className="pointer-events-none absolute -inset-x-[6%] -top-[22%] -bottom-[30%] -left-[50%] z-20 mix-blend-multiply opacity-100"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.98) 22%, rgba(0,0,0,0.92) 58%, rgba(0,0,0,0.35) 78%, rgba(0,0,0,0) 100%)",
                  maskImage:
                    "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.98) 22%, rgba(0,0,0,0.92) 58%, rgba(0,0,0,0.35) 78%, rgba(0,0,0,0) 100%)",
                }}
              >
                <FireShader className="h-full" height="100%" opacity={1} enableAudio={false} />
              </div>
            </div>

            <p className="text-xl text-zinc-200/90 max-w-lg leading-relaxed drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)]">
              Train real hand signs using AI computer vision. Level up, unlock jutsus, and climb the ranks from Student to Hokage.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">

              {/* Play Button Removed for now */}
              {/* <Link
                href="/play"
                className="group h-14 px-8 bg-ninja-accent hover:bg-ninja-accent-glow text-white text-lg font-bold rounded-lg flex items-center gap-3 transition-all shadow-[0_0_20px_rgba(255,120,50,0.3)] hover:shadow-[0_0_30px_rgba(255,120,50,0.5)] hover:-translate-y-1"
              >
                PLAY NOW
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link> */}


              <Link
                href="/challenge"
                className="group h-14 px-8 bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 text-green-400 hover:text-green-300 text-lg font-bold rounded-lg flex items-center gap-3 transition-all shadow-[0_0_20px_rgba(50,200,120,0.15)] hover:shadow-[0_0_30px_rgba(50,200,120,0.25)] hover:-translate-y-0.5"
              >
                <Hand className="w-5 h-5" />
                TRY SIGN TESTER
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/leaderboard"
                className="h-14 px-8 bg-ninja-card hover:bg-ninja-hover border border-ninja-border text-white text-lg font-bold rounded-lg flex items-center gap-3 transition-all"
              >
                <Trophy className="w-5 h-5 text-ninja-dim" />
                VIEW RANKS
              </Link>

              <button
                type="button"
                onClick={() => {
                  trackClick("download_beta");
                  openModal("Beta Access", "The beta version of the game will be released on the official launch date.");
                }}
                className="h-14 px-8 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 text-lg font-bold rounded-lg flex items-center gap-3 hover:bg-zinc-800/80 hover:text-white transition-all cursor-pointer select-none"
              >
                {/* Windows/Microsoft Logo */}
                <svg className="w-5 h-5 fill-current" viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 12.402l35.687-4.86.016 34.423-35.67.216zm35.707 34.005l-.012 34.697-35.695-4.913V46.602zM39.98 6.01L87.314 0v41.527l-47.334.373zM87.314 46.223V88L39.98 81.385V46.613z" />
                </svg>
                DOWNLOAD BETA
              </button>

              <button
                type="button"
                onClick={() => {
                  trackClick("github_repo");
                  openModal("Source Code", "The GitHub repository will be revealed on beta launch day.");
                }}
                title="Source code available later"
                className="h-14 px-8 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 text-lg font-bold rounded-lg flex items-center gap-3 hover:bg-zinc-800/80 hover:text-white transition-all cursor-pointer select-none"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GITHUB
              </button>

              <div className="flex items-center gap-3">
                <a href="https://www.youtube.com/@James_Uzumaki" target="_blank" onClick={() => trackClick("youtube_hero")} className="h-14 w-14 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 hover:text-red-500 hover:border-red-500/50 rounded-lg flex items-center justify-center transition-all opacity-85 hover:opacity-100">
                  <Youtube className="w-6 h-6" />
                </a>
                <a href="https://www.instagram.com/james.uzumaki_/" target="_blank" onClick={() => trackClick("instagram_hero")} className="h-14 w-14 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 hover:text-pink-500 hover:border-pink-500/50 rounded-lg flex items-center justify-center transition-all opacity-85 hover:opacity-100">
                  <Instagram className="w-6 h-6" />
                </a>
                <button
                  onClick={() => {
                    trackClick("discord_hero");
                    openModal("Discord Community", "Stay tuned, we're working on it!");
                  }}
                  className="h-14 w-14 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 hover:text-indigo-500 hover:border-indigo-500/50 rounded-lg flex items-center justify-center transition-all opacity-85 hover:opacity-100 group"
                >
                  <svg className="w-6 h-6 fill-current group-hover:fill-indigo-500" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-15.02-2.39-32.91-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium text-ninja-dim pt-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-ninja-success" /> Privacy First (Local AI)
              </div>
            </div>
          </div>

          {/* Hero Visual */}
          {/* Hero Visual */}
          <div className="flex-1 relative flex flex-col justify-center items-center perspective-container">
            <div className="absolute inset-0 bg-ninja-accent/20 blur-[150px] rounded-full opacity-40"></div>

            <div className="relative w-full max-w-[800px] aspect-square flex items-center justify-center p-0 animate-float-3d">
              <img
                src="/logo2.png"
                alt="Shinobi Academy Emblem"
                className="w-full h-full object-contain"
              />
            </div>


          </div>
        </section>

        {/* Fire divider between hero and showcase */}
        <div className="relative -mx-6 mb-32" style={{ height: '200px' }}>
          {/* Top fade into background */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-ninja-bg to-transparent z-10 pointer-events-none" />
          <FireShader height="200px" opacity={1} enableAudio={true} />
          {/* Bottom fade into background */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-ninja-bg to-transparent z-10 pointer-events-none" />
        </div>
        {/* Game Introduction / Showcase */}
        <section id="showcase" className="mb-32 space-y-24">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl md:text-4xl font-black text-white">
                <span className="text-ninja-accent">REAL-TIME</span> HAND SIGN DETECTION
              </h2>
              <p className="text-lg text-ninja-dim leading-relaxed">
                We have switched to <strong>MediaPipe</strong> to ensure fairness and consistent detection for all users.
                Jutsu Academy tracks your hands with millisecond precision.
                Form the signs <strong>(Seal of RAM, BOAR, DOG...)</strong> in front of your webcam, and the system recognizes them instantly.
                No controllers, no gloves, just you and your chakra.
              </p>
              <div className="flex items-center gap-4 text-sm font-bold text-ninja-accent">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full bg-ninja-card border border-ninja-border flex items-center justify-center">✋</div>
                  <div className="w-10 h-10 rounded-full bg-ninja-card border border-ninja-border flex items-center justify-center">✌️</div>
                  <div className="w-10 h-10 rounded-full bg-ninja-card border border-ninja-border flex items-center justify-center">👌</div>
                </div>
                <span>12 Unique Signs</span>
              </div>
            </div>
            <div className="flex-1 relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-ninja-accent to-purple-600 rounded-3xl opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500"></div>
              <img
                src="/fea2.png"
                alt="AI Detection Gameplay"
                className="relative rounded-2xl border border-ninja-border shadow-2xl w-full object-cover aspect-video bg-black/50"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row-reverse items-center gap-12">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl md:text-4xl font-black text-white">
                CAST <span className="text-blue-400">EPIC JUTSUS</span>
              </h2>
              <p className="text-lg text-ninja-dim leading-relaxed">
                Combine signs in the correct sequence to unleash powerful techniques.
                Master the <strong>Fireball Jutsu</strong>, summon a <strong>Shadow Clone</strong>, or charge up a <strong>Chidori</strong>.
                Visual and sound effects react dynamically to your movements.
              </p>
              <ul className="grid grid-cols-2 gap-3 text-sm font-bold text-white/80">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Fire Style</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Lightning Style</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Clone Jutsu</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Others</li>
              </ul>
            </div>
            <div className="flex-1 relative group">
              <div className="absolute -inset-4 bg-gradient-to-l from-blue-400 to-cyan-600 rounded-3xl opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500"></div>
              <img
                src="/fea1.png"
                alt="Jutsu Casting Gameplay"
                className="relative rounded-2xl border border-ninja-border shadow-2xl w-full object-cover aspect-video bg-black/50"
              />
            </div>
          </div>
        </section>

        {/* Features / Stats */}
        <section id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-32">
          {[
            { label: "Hand Signs", value: "12", sub: "Real-time Detection", icon: "✋" },
            { label: "Jutsu Arts", value: "5+", sub: "Fireball, Chidori & More", icon: "🔥" },
            { label: "Latency", value: "~15ms", sub: "Powered by MediaPipe", icon: "⚡" },
          ].map((stat, i) => (
            <div key={i} className="bg-ninja-card border border-ninja-border p-8 rounded-2xl hover:border-ninja-accent/50 transition-colors group">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300 inline-block">{stat.icon}</div>
              <div className="text-4xl font-black font-mono text-white mb-2">{stat.value}</div>
              <div className="text-lg font-bold text-ninja-accent mb-1">{stat.label}</div>
              <div className="text-sm text-ninja-dim">{stat.sub}</div>
            </div>
          ))}
        </section>

        {/* Dev Section */}
        <section id="dev" className="bg-ninja-panel border border-ninja-border rounded-3xl p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-ninja-accent/10 blur-[80px] rounded-full pointer-events-none"></div>

          <div className="flex flex-col md:flex-row gap-12 items-center relative z-10">
            <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-ninja-bg overflow-hidden shadow-2xl shrink-0">
              <img src="/me1.png" alt="Dev" className="w-full h-full object-cover" />
            </div>

            <div className="space-y-6 text-center md:text-left">
              <h2 className="text-3xl font-black text-white flex items-center justify-center md:justify-start gap-3">
                <Scroll className="w-8 h-8 text-ninja-accent" />
                DEV
              </h2>
              <p className="text-lg text-ninja-dim max-w-2xl leading-relaxed space-y-4">
                <span className="block">
                  &quot;I built the Shinobi Academy as a <strong>non-profit fan project</strong> to prove that advanced AI can be fun, accessible, and private.
                </span>
                <span className="block text-sm opacity-70 italic">
                  Disclaimer: This project is not affiliated with, endorsed, sponsored, or specifically approved by Masashi Kishimoto, Shueisha, Viz Media, or the Naruto franchise. All original character names and designs are the property of their respective owners.
                </span>
                <span className="block mt-4">
                  The game launches on <span className="text-white font-bold">February 21st</span>. Get ready to master the signs!&quot;
                </span>
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <a href="https://www.youtube.com/@James_Uzumaki" target="_blank" className="bg-red-600/10 hover:bg-red-600/20 text-red-500 hover:text-red-400 px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors border border-red-600/20">
                  <Youtube className="w-5 h-5" /> YouTube
                </a>
                <a href="https://www.instagram.com/james.uzumaki_/" target="_blank" className="bg-pink-600/10 hover:bg-pink-600/20 text-pink-500 hover:text-pink-400 px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors border border-pink-600/20">
                  <Instagram className="w-5 h-5" /> Instagram
                </a>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Fire edge above footer */}
      <div className="relative" style={{ height: '160px' }}>
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-ninja-bg to-transparent z-10 pointer-events-none" />
        <FireShader height="160px" opacity={1} enableAudio={false} />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-ninja-bg to-transparent z-10 pointer-events-none" />
      </div>

      {/* Footer */}
      {/* Footer */}
      <footer className="border-t border-ninja-border bg-ninja-bg py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-ninja-muted text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-mono">SYSTEM OPERATIONAL</span>
            </div>

            <div className="flex items-center gap-4 border-l border-ninja-border pl-6">
              <a href="https://www.youtube.com/@James_Uzumaki" target="_blank" className="hover:text-red-500 transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/james.uzumaki_/" target="_blank" className="hover:text-pink-500 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>
          <p>&copy; 2026 Shinobi Academy. Built with Google MediaPipe.</p>
        </div>
      </footer>
    </div>
  );
}

function getTimeLeft(target: Date) {
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, expired: false };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
