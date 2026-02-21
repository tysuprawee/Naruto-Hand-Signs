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

              <div className="flex items-center gap-4">
                <Link
                  href="https://github.com/tysuprawee/Naruto-Hand-Signs/releases/download/v1.0.0-Windows/v1.0.0-JutsuAcademy-Portable-Win64.zip"
                  onClick={() => trackClick("download_windows")}
                  className="h-14 px-8 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 text-lg font-bold rounded-lg flex items-center gap-3 hover:bg-zinc-800/80 hover:text-white transition-all cursor-pointer select-none"
                >
                  {/* Windows/Microsoft Logo */}
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.216zm35.707 34.005l-.012 34.697-35.695-4.913V46.602zM39.98 6.01L87.314 0v41.527l-47.334.373zM87.314 46.223V88L39.98 81.385V46.613z" />
                  </svg>
                  Windows
                </Link>

                <Link
                  href="/download/mac"
                  onClick={() => trackClick("download_mac")}
                  className="h-14 px-8 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 text-lg font-bold rounded-lg flex items-center gap-3 hover:bg-zinc-800/80 hover:text-white transition-all"
                >
                  {/* Apple Logo */}
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57.8-155.5-127.4c-58.3-81-105.6-207.4-105.6-328.1 0-192.8 125.5-295.1 248.3-295.1 65.4 0 119.9 42.8 160.8 42.8 39.2 0 100.4-45.3 174.6-45.3 28.2 0 129.4 2.5 196.5 96.1zM554.1 159.4c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.8 32.4-54.4 83.7-54.4 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.8-30.4 134.8-71.3z" />
                  </svg>
                  macOS (Apple Silicon)
                </Link>
              </div>

              <a
                href="https://github.com/tysuprawee/Naruto-Hand-Signs"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick("github_repo")}
                className="h-14 px-8 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 text-lg font-bold rounded-lg flex items-center gap-3 hover:bg-zinc-800/80 hover:text-white transition-all"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GITHUB
              </a>

              <div className="flex items-center gap-3">
                <a href="https://www.youtube.com/@James_Uzumaki" target="_blank" onClick={() => trackClick("youtube_hero")} className="h-14 w-14 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 hover:text-red-500 hover:border-red-500/50 rounded-lg flex items-center justify-center transition-all opacity-85 hover:opacity-100">
                  <Youtube className="w-6 h-6" />
                </a>
                <a href="https://www.instagram.com/james.uzumaki_/" target="_blank" onClick={() => trackClick("instagram_hero")} className="h-14 w-14 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 hover:text-pink-500 hover:border-pink-500/50 rounded-lg flex items-center justify-center transition-all opacity-85 hover:opacity-100">
                  <Instagram className="w-6 h-6" />
                </a>
                <a
                  href="https://discord.gg/s6ZJUVG5U7"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackClick("discord_hero")}
                  className="h-14 w-14 bg-zinc-900/70 border border-zinc-700/80 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/50 rounded-lg flex items-center justify-center transition-all opacity-85 hover:opacity-100 group"
                >
                  <svg className="w-6 h-6 fill-current group-hover:fill-indigo-400" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-15.02-2.39-32.91-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                </a>
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
        <div className="relative -mx-6 mb-32" style={{ height: "160px" }}>
          <div
            className="absolute inset-0"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.32) 20%, rgba(0,0,0,0.72) 52%, rgba(0,0,0,0.96) 82%, rgba(0,0,0,1) 100%)",
              maskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.32) 20%, rgba(0,0,0,0.72) 52%, rgba(0,0,0,0.96) 82%, rgba(0,0,0,1) 100%)",
            }}
          >
            <FireShader height="160px" opacity={1} enableAudio={false} />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-ninja-border/70 z-20 pointer-events-none" />
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

        {/* Gallery / Screenshots */}
        <section id="gallery" className="mb-32">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight">
              INSIDE <span className="text-ninja-accent">JUTSU ACADEMY</span>
            </h2>
            <p className="text-lg text-ninja-dim max-w-2xl mx-auto">
              A fully featured desktop app bringing shinobi training to life.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group space-y-4">
              <div className="relative aspect-video rounded-xl overflow-hidden border border-ninja-border/50 group-hover:border-ninja-accent transition-colors shadow-xl">
                <img src="/apppics/page1.png" alt="Academy Dashboard" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-ninja-accent transition-colors">Academy Dashboard</h3>
                <p className="text-sm text-ninja-dim mt-1">Navigate through various modes seamlessly. Practice at your own pace in Free Play or challenge the clock in Rank Mode.</p>
              </div>
            </div>

            <div className="group space-y-4">
              <div className="relative aspect-video rounded-xl overflow-hidden border border-ninja-border/50 group-hover:border-blue-400 transition-colors shadow-xl">
                <img src="/apppics/page2.png" alt="Jutsu Library" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">Jutsu Library</h3>
                <p className="text-sm text-ninja-dim mt-1">Browse and unlock dozens of iconic techniques. Each jutsu is fully animated with real hand sign sequences to learn.</p>
              </div>
            </div>

            <div className="group space-y-4">
              <div className="relative aspect-video rounded-xl overflow-hidden border border-ninja-border/50 group-hover:border-green-400 transition-colors shadow-xl">
                <img src="/apppics/page3.png" alt="Leaderboards" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-green-400 transition-colors">Global Leaderboards</h3>
                <p className="text-sm text-ninja-dim mt-1">Compete against other shinobi worldwide in speedrun challenges and prove your hand sign execution speed.</p>
              </div>
            </div>

            <div className="group space-y-4 lg:col-start-1 lg:col-span-1 lg:translate-x-1/2">
              <div className="relative aspect-video rounded-xl overflow-hidden border border-ninja-border/50 group-hover:border-purple-400 transition-colors shadow-xl">
                <img src="/apppics/page4.png" alt="Progression & Quests" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">Progression & Quests</h3>
                <p className="text-sm text-ninja-dim mt-1">Complete daily and weekly quests. Earn EXP, rank up from Academy Student to Jonin, and claim rewards.</p>
              </div>
            </div>

            <div className="group space-y-4 lg:col-span-1 lg:translate-x-1/2">
              <div className="relative aspect-video rounded-xl overflow-hidden border border-ninja-border/50 group-hover:border-orange-400 transition-colors shadow-xl">
                <img src="/apppics/page5.png" alt="Real-time Training" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors">Real-Time Training</h3>
                <p className="text-sm text-ninja-dim mt-1">Practice signs in front of your camera to trigger Spectacular AR effects like fireballs and lightning on your webcam stream.</p>
              </div>
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
              <a href="https://discord.gg/s6ZJUVG5U7" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-15.02-2.39-32.91-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
              </a>
            </div>
          </div>
          <p>&copy; 2026 Shinobi Academy. Built with Google MediaPipe.</p>
        </div>
      </footer>
    </div >
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
