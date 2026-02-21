"use client";

import { useState } from "react";
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
    X,
} from "lucide-react";

const DOWNLOAD_URL =
    "https://github.com/tysuprawee/Naruto-Hand-Signs/releases/download/v1.0.0-Windows/v1.0.0-JutsuAcademy-Portable-Win64.zip";

export default function WindowsDownloadPage() {
    const [showDiscordModal, setShowDiscordModal] = useState(false);

    return (
        <div className="min-h-screen bg-ninja-bg text-ninja-text font-sans selection:bg-ninja-accent selection:text-white">
            {/* Subtle background glow */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-blue-500/8 via-blue-400/4 to-transparent rounded-full blur-[120px]" />
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
                    {/* Windows logo badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-700/80 bg-blue-900/40 text-sm font-bold text-blue-300 backdrop-blur-sm">
                        <svg
                            className="w-4 h-4 fill-current"
                            viewBox="0 0 88 88"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path d="M0 12.402l35.687-4.86.016 34.423-35.67.216zm35.707 34.005l-.012 34.697-35.695-4.913V46.602zM39.98 6.01L87.314 0v41.527l-47.334.373zM87.314 46.223V88L39.98 81.385V46.613z" />
                        </svg>
                        Windows 10 / 11 (64-bit)
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1]">
                        <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400">
                            🥷 Jutsu Academy
                        </span>
                        <br />
                        <span className="text-blue-400 text-3xl md:text-4xl">
                            v1.0.0 — Portable Windows Build
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
                            id="download-win-button"
                            onClick={() => setTimeout(() => setShowDiscordModal(true), 500)}
                            className="group relative h-16 px-12 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white text-xl font-black rounded-2xl flex items-center gap-4 transition-all shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:shadow-[0_0_50px_rgba(59,130,246,0.3)] hover:-translate-y-1 border border-blue-500/30"
                        >
                            <Download className="w-6 h-6 group-hover:animate-bounce" />
                            DOWNLOAD FOR WINDOWS
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </a>

                        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm text-ninja-dim">
                            <span className="flex items-center gap-1.5">
                                <Monitor className="w-4 h-4" />
                                ~400 MB
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Cpu className="w-4 h-4" />
                                Windows 10 / 11 (64-bit)
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Shield className="w-4 h-4 text-green-500" />
                                Portable — No Install
                            </span>
                        </div>

                        {/* Architecture warning */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            Not compatible with 32-bit systems
                        </div>
                    </div>
                </section>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-ninja-border to-transparent mb-16" />

                {/* How to Run */}
                <section className="mb-16">
                    <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-blue-400" />
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
                                        <code className="px-2 py-0.5 bg-ninja-card rounded text-blue-400 text-sm font-mono">
                                            v1.0.0-JutsuAcademy-Portable-Win64.zip
                                        </code>
                                    </>
                                ),
                            },
                            {
                                step: "2",
                                title: "Launch the executable",
                                description: (
                                    <>
                                        Open the extracted folder and double-click{" "}
                                        <code className="px-2 py-0.5 bg-ninja-card rounded text-green-400 text-sm font-mono">
                                            JutsuAcademy.exe
                                        </code>
                                    </>
                                ),
                            },
                            {
                                step: "3",
                                title: "If Windows Defender blocks it",
                                description: (
                                    <>
                                        Click <span className="text-white font-bold">"More info"</span>{" "}
                                        → <span className="text-white font-bold">"Run anyway"</span>
                                    </>
                                ),
                            },
                        ].map((item) => (
                            <div
                                key={item.step}
                                className="flex items-start gap-4 p-5 bg-ninja-card/60 border border-ninja-border rounded-xl hover:border-blue-500/30 transition-colors group"
                            >
                                <div className="shrink-0 w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-lg group-hover:bg-blue-500/25 transition-colors">
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
                            },
                            {
                                icon: <Camera className="w-5 h-5 text-purple-400" />,
                                title: "Face tracking & selfie segmentation",
                                sub: "Immersive AR overlays",
                            },
                            {
                                icon: <Gamepad2 className="w-5 h-5 text-ninja-accent" />,
                                title: "Jutsu card progression system",
                                sub: "Unlock techniques as you train",
                            },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="flex items-start gap-4 p-5 bg-ninja-card/40 border border-ninja-border rounded-xl hover:border-blue-500/30 transition-colors"
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
                        <Monitor className="w-6 h-6 text-blue-400" />
                        Requirements
                    </h2>

                    <div className="bg-ninja-card/60 border border-ninja-border rounded-xl p-6 space-y-4">
                        {[
                            {
                                icon: <Cpu className="w-5 h-5 text-zinc-400" />,
                                label: "Windows 10 or 11 (64-bit)",
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    to run a calibration
                                </li>
                            </ul>
                        </div>

                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 space-y-3">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Shield className="w-5 h-5 text-blue-400" /> Antivirus block?
                            </h3>
                            <ul className="space-y-2 text-ninja-dim">
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-400 mt-1">•</span>
                                    Since this is an unsigned indie app, some antiviruses might falsely flag the executable. You may need to add an exception for the JutsuAcademy folder.
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Bottom CTA */}
                <section className="text-center space-y-6">
                    <div className="h-px bg-gradient-to-r from-transparent via-ninja-border to-transparent mb-8" />

                    <a
                        href={DOWNLOAD_URL}
                        onClick={() => setTimeout(() => setShowDiscordModal(true), 500)}
                        className="group inline-flex h-14 px-10 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white text-lg font-black rounded-xl items-center gap-3 transition-all shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:shadow-[0_0_50px_rgba(59,130,246,0.3)] hover:-translate-y-1 border border-blue-500/30"
                    >
                        <Download className="w-5 h-5" />
                        DOWNLOAD v1.0.0 FOR WINDOWS
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
            {/* Discord Modal Wrapper */}
            {showDiscordModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-ninja-panel border border-blue-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setShowDiscordModal(false)}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Download Started!
                        </h3>
                        <p className="text-zinc-300 leading-relaxed mb-6">
                            Thanks for downloading Jutsu Academy! While you wait, join our Ninja network on Discord to connect with developers, get updates, and share your ninja way.
                        </p>
                        <div className="flex flex-col gap-3">
                            <a
                                href="https://discord.gg/s6ZJUVG5U7"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setShowDiscordModal(false)}
                                className="w-full flex justify-center items-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5"
                            >
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-15.02-2.39-32.91-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                                </svg>
                                Join Discord Server
                            </a>
                            <button
                                onClick={() => setShowDiscordModal(false)}
                                className="w-full py-3 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 font-medium rounded-xl transition-colors border border-zinc-700/50"
                            >
                                Maybe Later
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
