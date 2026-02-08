"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabase";
import Link from "next/link";
import { ArrowLeft, Trophy, Clock, Zap, Crown, ChevronDown } from "lucide-react";

interface LeaderboardEntry {
    id: string;
    created_at: string;
    username: string;
    score_time: number;
    mode: string;
    discord_id?: string;
    avatar_url?: string;
}

interface ProfileEntry {
    id: string;
    username: string;
    xp: number;
    level: number;
    rank?: string;
    discord_id?: string;
    avatar_url?: string;
}

interface ModeRow {
    mode: string;
}

export default function LeaderboardPage() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState("");
    const [modeOptions, setModeOptions] = useState<string[]>([]);
    const [view, setView] = useState<"speed" | "level">("speed");
    const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
    const modeDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchModes() {
            if (!supabase) return;

            const { data, error } = await supabase
                .from('leaderboard')
                .select('mode')
                .not('mode', 'is', null)
                .limit(200);

            if (error) {
                console.error("Error fetching jutsu modes:", error);
                return;
            }

            const uniqueModes = Array.from(
                new Set(
                    ((data || []) as ModeRow[])
                        .map((row) => String(row.mode || "").trim().toUpperCase())
                        .filter(Boolean)
                )
            ).sort();

            setModeOptions(uniqueModes);

            if (uniqueModes.length > 0) {
                setMode((current) => current || uniqueModes[0]);
            }
        }

        fetchModes();
    }, []);

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            if (!modeDropdownRef.current) return;
            if (!modeDropdownRef.current.contains(event.target as Node)) {
                setModeDropdownOpen(false);
            }
        }

        window.addEventListener("mousedown", handleOutsideClick);
        return () => window.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    useEffect(() => {
        async function fetchLeaderboard() {
            setLoading(true);

            if (!supabase) {
                console.error("Supabase env vars are missing. Leaderboard is unavailable.");
                setEntries([]);
                setProfiles([]);
                setLoading(false);
                return;
            }

            if (view === "speed") {
                if (!mode) {
                    setEntries([]);
                    setProfiles([]);
                    setLoading(false);
                    return;
                }

                const { data: leaderboardData, error: leaderboardError } = await supabase
                    .from('leaderboard')
                    .select('*')
                    .eq('mode', mode)
                    .order('score_time', { ascending: true })
                    .limit(50);

                if (leaderboardError) {
                    console.error("Error fetching speed leaderboard:", leaderboardError);
                    setLoading(false);
                    return;
                }

                setEntries(leaderboardData || []);
                setProfiles([]);
            } else {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .order('level', { ascending: false })
                    .order('xp', { ascending: false })
                    .limit(100);

                if (profileError) {
                    console.error("Error fetching level leaderboard:", profileError);
                    setLoading(false);
                    return;
                }

                setProfiles((profileData || []) as ProfileEntry[]);
                setEntries([]);
            }

            setLoading(false);
        }

        fetchLeaderboard();
    }, [mode, view]);

    function formatModeLabel(rawMode: string) {
        return rawMode
            .toLowerCase()
            .split(/[_\s]+/)
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    return (
        <div className="min-h-screen bg-ninja-bg text-ninja-text font-sans selection:bg-ninja-accent selection:text-white pb-20">
            {/* Background Image (matches home page) */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: "url('/village.jpg')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'grayscale(100%) contrast(120%)'
                }}
            ></div>

            {/* Header */}
            <header className="fixed top-0 w-full z-50 bg-ninja-bg/80 backdrop-blur-md border-b border-ninja-border">
                <div className="container mx-auto flex h-16 items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-70 transition-opacity">
                        <div className="h-10 w-10 relative">
                            <img src="/logo2.png" alt="Shinobi Academy" className="object-contain w-full h-full" />
                        </div>
                        <span className="font-bold tracking-tight text-lg text-white">SHINOBI ACADEMY</span>
                    </Link>
                    <nav className="flex gap-4">
                        <Link href="/" className="text-sm font-medium text-ninja-dim hover:text-white flex items-center gap-1">
                            <ArrowLeft className="w-4 h-4" /> Back to Base
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="relative z-10 pt-32 px-6 container mx-auto max-w-4xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-2 flex items-center gap-3 text-white">
                            <Trophy className="w-10 h-10 text-ninja-accent" />
                            LEADERBOARD
                        </h1>
                        <p className="text-ninja-dim">Top ranking Shinobi from around the world.</p>
                    </div>

                    <div className="flex flex-col gap-3 items-center">
                        {/* Layout Selector */}
                        <div className="flex flex-wrap gap-2 justify-center">
                            <button
                                onClick={() => setView("speed")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border
                                ${view === "speed"
                                        ? "bg-ninja-accent text-white border-ninja-accent shadow-[0_0_15px_rgba(255,120,50,0.3)] scale-105"
                                        : "bg-ninja-card text-ninja-dim border-ninja-border hover:border-ninja-hover hover:text-white"}
                                `}
                            >
                                Speedrun
                            </button>
                            <button
                                onClick={() => setView("level")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border
                                ${view === "level"
                                        ? "bg-ninja-accent text-white border-ninja-accent shadow-[0_0_15px_rgba(255,120,50,0.3)] scale-105"
                                        : "bg-ninja-card text-ninja-dim border-ninja-border hover:border-ninja-hover hover:text-white"}
                                `}
                            >
                                Top Level
                            </button>
                        </div>

                        {/* Mode Selector (speed leaderboard only) */}
                        {view === "speed" && (
                            <div ref={modeDropdownRef} className="w-full max-w-xs relative">
                                <label className="block mb-2 text-[10px] uppercase tracking-[0.16em] text-ninja-dim font-bold">
                                    Jutsu Mode
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setModeDropdownOpen((prev) => !prev)}
                                    className="w-full h-11 px-4 rounded-lg bg-ninja-card border border-ninja-border text-white font-bold text-sm focus:outline-none focus:border-ninja-accent flex items-center justify-between"
                                >
                                    <span className="truncate">
                                        {mode ? formatModeLabel(mode) : "No modes found"}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-ninja-dim transition-transform ${modeDropdownOpen ? "rotate-180" : ""}`} />
                                </button>

                                {modeDropdownOpen && modeOptions.length > 0 && (
                                    <div className="absolute left-0 right-0 mt-2 z-20 rounded-lg border border-ninja-border bg-ninja-panel shadow-2xl max-h-64 overflow-y-auto">
                                        {modeOptions.map((m) => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => {
                                                    setMode(m);
                                                    setModeDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2 text-sm font-bold transition-colors
                                                ${mode === m ? "bg-ninja-accent text-white" : "text-ninja-dim hover:bg-ninja-hover hover:text-white"}
                                                `}
                                            >
                                                {formatModeLabel(m)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-ninja-panel border border-ninja-border shadow-2xl rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="p-16 text-center text-ninja-dim animate-pulse flex flex-col items-center gap-4">
                            <Zap className="w-8 h-8 text-ninja-accent animate-bounce" />
                            <p>{view === "speed" ? "Fetching Scroll Records..." : "Fetching Rank Records..."}</p>
                        </div>
                    ) : (view === "speed" ? entries.length === 0 : profiles.length === 0) ? (
                        <div className="p-16 text-center text-ninja-dim border-t border-dashed border-ninja-border">
                            <p className="mb-4 text-lg">
                                {view === "speed" ? "No records found for this Jutsu." : "No rank records found yet."}
                            </p>
                            <div className="text-sm opacity-50">
                                {view === "speed" ? "Be the first to master it!" : "Play and gain XP to appear here."}
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-ninja-bg border-b border-ninja-border text-xs uppercase text-ninja-dim font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 w-20 text-center">Rank</th>
                                        <th className="px-6 py-4">Shinobi</th>
                                        {view === "speed" ? (
                                            <>
                                                <th className="px-6 py-4 text-right">Time</th>
                                                <th className="px-6 py-4 text-center">Date</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-6 py-4 text-right">Level</th>
                                                <th className="px-6 py-4 text-right">XP</th>
                                                <th className="px-6 py-4 text-center">Rank Title</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ninja-border">
                                    {view === "speed"
                                        ? entries.map((entry, index) => (
                                            <tr key={entry.id} className="hover:bg-ninja-hover/30 transition-colors group">
                                                <td className="px-6 py-5 text-center font-bold text-ninja-dim group-hover:text-white">
                                                    {index === 0 ? (
                                                        <div className="relative inline-block">
                                                            <Crown className="w-6 h-6 text-yellow-400 mx-auto drop-shadow-md" />
                                                            <div className="absolute inset-0 bg-yellow-400/20 blur-md rounded-full"></div>
                                                        </div>
                                                    ) : (
                                                        `#${index + 1}`
                                                    )}
                                                </td>
                                                <td className="px-6 py-5 font-medium text-white flex items-center gap-4">
                                                    {entry.avatar_url ? (
                                                        <div className={`w-10 h-10 rounded-lg overflow-hidden shadow-lg border border-white/10
                                                        ${index === 0 ? "ring-2 ring-yellow-400" : ""}
                                                    `}>
                                                            <img
                                                                src={entry.avatar_url}
                                                                alt={entry.username}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-lg border border-white/10
                                                        ${index === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600" :
                                                                index === 1 ? "bg-gradient-to-br from-gray-300 to-gray-500" :
                                                                    index === 2 ? "bg-gradient-to-br from-orange-400 to-orange-600" :
                                                                        "bg-ninja-card border-ninja-border text-ninja-dim"}
                                                    `}>
                                                            {entry.username.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <span className={index < 3 ? "text-ninja-accent-glow font-bold" : ""}>{entry.username}</span>
                                                        {entry.discord_id === "[REDACTED_DISCORD_ID]" && (
                                                            <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black tracking-wider shadow-sm border border-red-400">DEV</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right font-mono font-bold text-white">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Clock className="w-4 h-4 text-ninja-dim" />
                                                        <span className={index === 0 ? "text-yellow-400 text-lg" : ""}>{entry.score_time.toFixed(2)}s</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center text-xs text-ninja-dim font-mono">
                                                    {new Date(entry.created_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))
                                        : profiles.map((entry, index) => (
                                            <tr key={entry.id} className="hover:bg-ninja-hover/30 transition-colors group">
                                                <td className="px-6 py-5 text-center font-bold text-ninja-dim group-hover:text-white">
                                                    {index === 0 ? (
                                                        <div className="relative inline-block">
                                                            <Crown className="w-6 h-6 text-yellow-400 mx-auto drop-shadow-md" />
                                                            <div className="absolute inset-0 bg-yellow-400/20 blur-md rounded-full"></div>
                                                        </div>
                                                    ) : (
                                                        `#${index + 1}`
                                                    )}
                                                </td>
                                                <td className="px-6 py-5 font-medium text-white flex items-center gap-4">
                                                    {entry.avatar_url ? (
                                                        <div className={`w-10 h-10 rounded-lg overflow-hidden shadow-lg border border-white/10
                                                        ${index === 0 ? "ring-2 ring-yellow-400" : ""}
                                                    `}>
                                                            <img
                                                                src={entry.avatar_url}
                                                                alt={entry.username}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-lg border border-white/10
                                                        ${index === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600" :
                                                                index === 1 ? "bg-gradient-to-br from-gray-300 to-gray-500" :
                                                                    index === 2 ? "bg-gradient-to-br from-orange-400 to-orange-600" :
                                                                        "bg-ninja-card border-ninja-border text-ninja-dim"}
                                                    `}>
                                                            {entry.username.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <span className={index < 3 ? "text-ninja-accent-glow font-bold" : ""}>{entry.username}</span>
                                                        {entry.discord_id === "[REDACTED_DISCORD_ID]" && (
                                                            <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black tracking-wider shadow-sm border border-red-400">DEV</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right font-mono font-bold text-white">
                                                    LV.{entry.level}
                                                </td>
                                                <td className="px-6 py-5 text-right font-mono text-ninja-accent-glow font-bold">
                                                    {entry.xp.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-5 text-center text-xs text-ninja-dim font-mono uppercase">
                                                    {entry.rank || "Student"}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
