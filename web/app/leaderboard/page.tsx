"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { supabase } from "@/utils/supabase";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function LeaderboardContent() {
    const DEV_DISCORD_ID = (process.env.NEXT_PUBLIC_DEV_DISCORD_ID || "").trim();
    const PAGE_SIZE = 10;

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const initialViewParam: "speed" | "level" = searchParams.get("view") === "level" ? "level" : "speed";
    const initialPageRaw = Number(searchParams.get("page") || "1");
    const initialPageParam = Number.isFinite(initialPageRaw) && initialPageRaw > 0 ? Math.floor(initialPageRaw) : 1;
    const initialModeParam = (searchParams.get("mode") || "").trim().toUpperCase();

    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const [mode, setMode] = useState(initialModeParam);
    const [modeOptions, setModeOptions] = useState<string[]>([]);
    const [view, setView] = useState<"speed" | "level">(initialViewParam);
    const [page, setPage] = useState(initialPageParam);

    const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
    const modeDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchModes() {
            if (!supabase) return;

            const { data, error } = await supabase
                .from("leaderboard")
                .select("mode")
                .not("mode", "is", null)
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
            setMode((current) => {
                if (uniqueModes.length === 0) return "";
                if (current && uniqueModes.includes(current)) return current;
                if (initialModeParam && uniqueModes.includes(initialModeParam)) return initialModeParam;
                return uniqueModes[0];
            });
        }

        fetchModes();
    }, [initialModeParam]);

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
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", view);
        params.set("page", String(page));

        if (view === "speed" && mode) {
            params.set("mode", mode);
        } else {
            params.delete("mode");
        }

        const nextQuery = params.toString();
        if (nextQuery !== searchParams.toString()) {
            router.replace(`${pathname}?${nextQuery}`, { scroll: false });
        }
    }, [view, page, mode, pathname, router, searchParams]);

    useEffect(() => {
        async function fetchLeaderboard() {
            setLoading(true);

            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            if (!supabase) {
                console.error("Supabase env vars are missing. Leaderboard is unavailable.");
                setEntries([]);
                setProfiles([]);
                setTotalCount(0);
                setLoading(false);
                return;
            }

            if (view === "speed") {
                if (!mode) {
                    setEntries([]);
                    setProfiles([]);
                    setTotalCount(0);
                    setLoading(false);
                    return;
                }

                const { data: leaderboardData, error: leaderboardError, count } = await supabase
                    .from("leaderboard")
                    .select("*", { count: "exact" })
                    .eq("mode", mode)
                    .order("score_time", { ascending: true })
                    .range(from, to);

                if (leaderboardError) {
                    console.error("Error fetching speed leaderboard:", leaderboardError);
                    setEntries([]);
                    setTotalCount(0);
                    setLoading(false);
                    return;
                }

                setEntries((leaderboardData || []) as LeaderboardEntry[]);
                setProfiles([]);
                setTotalCount(count || 0);
            } else {
                const { data: profileData, error: profileError, count } = await supabase
                    .from("profiles")
                    .select("*", { count: "exact" })
                    .order("level", { ascending: false })
                    .order("xp", { ascending: false })
                    .range(from, to);

                if (profileError) {
                    console.error("Error fetching level leaderboard:", profileError);
                    setProfiles([]);
                    setTotalCount(0);
                    setLoading(false);
                    return;
                }

                const { data: avatarRows, error: avatarError } = await supabase
                    .from("leaderboard")
                    .select("username, discord_id, avatar_url, created_at")
                    .not("avatar_url", "is", null)
                    .order("created_at", { ascending: false })
                    .limit(300);

                if (avatarError) {
                    console.error("Error fetching avatar fallbacks:", avatarError);
                }

                const avatarByDiscordId = new Map<string, string>();
                const avatarByUsername = new Map<string, string>();
                const discordIdByUsername = new Map<string, string>();

                for (const row of (avatarRows || []) as LeaderboardEntry[]) {
                    const avatar = row.avatar_url?.trim();
                    const dId = row.discord_id?.trim();
                    const uname = row.username?.trim().toLowerCase();

                    if (dId && uname && !discordIdByUsername.has(uname)) {
                        discordIdByUsername.set(uname, dId);
                    }

                    if (!avatar) continue;

                    if (dId && !avatarByDiscordId.has(dId)) {
                        avatarByDiscordId.set(dId, avatar);
                    }
                    if (uname && !avatarByUsername.has(uname)) {
                        avatarByUsername.set(uname, avatar);
                    }
                }

                const enrichedProfiles = ((profileData || []) as ProfileEntry[]).map((p) => {
                    if (p.avatar_url) return p;

                    const dId = p.discord_id?.trim() || "";
                    const uname = p.username?.trim().toLowerCase() || "";
                    const fallbackDiscordId = dId || (uname ? discordIdByUsername.get(uname) : undefined);
                    const fallbackAvatar =
                        (fallbackDiscordId ? avatarByDiscordId.get(fallbackDiscordId) : undefined) ||
                        (uname ? avatarByUsername.get(uname) : undefined);

                    return {
                        ...p,
                        discord_id: fallbackDiscordId || p.discord_id,
                        avatar_url: fallbackAvatar || p.avatar_url,
                    };
                });

                setProfiles(enrichedProfiles);
                setEntries([]);
                setTotalCount(count || 0);
            }

            setLoading(false);
        }

        fetchLeaderboard();
    }, [mode, view, page]);

    function formatModeLabel(rawMode: string) {
        return rawMode
            .toLowerCase()
            .split(/[_\s]+/)
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const canGoPrev = page > 1;
    const canGoNext = page < totalPages;

    return (
        <div className="min-h-screen bg-ninja-bg text-ninja-text font-sans selection:bg-ninja-accent selection:text-white pb-20">
            <div
                className="fixed inset-0 z-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: "url('/village.jpg')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "grayscale(100%) contrast(120%)",
                }}
            ></div>

            <header className="fixed top-0 w-full z-50 bg-ninja-bg/80 backdrop-blur-md border-b border-ninja-border">
                <div className="container mx-auto flex h-16 items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-70 transition-opacity">
                        <div className="h-10 w-10 relative">
                            <img src="/logo2.png" alt="Shinobi Academy" className="object-contain w-full h-full" />
                        </div>
                        <span className="font-bold tracking-tight text-lg text-white">Jutsu Academy</span>
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
                        <div className="flex flex-wrap gap-2 justify-center">
                            <button
                                onClick={() => {
                                    setView("speed");
                                    setPage(1);
                                }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border
                                ${view === "speed"
                                        ? "bg-ninja-accent text-white border-ninja-accent shadow-[0_0_15px_rgba(255,120,50,0.3)] scale-105"
                                        : "bg-ninja-card text-ninja-dim border-ninja-border hover:border-ninja-hover hover:text-white"
                                    }
                                `}
                            >
                                Speedrun
                            </button>
                            <button
                                onClick={() => {
                                    setView("level");
                                    setPage(1);
                                }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border
                                ${view === "level"
                                        ? "bg-ninja-accent text-white border-ninja-accent shadow-[0_0_15px_rgba(255,120,50,0.3)] scale-105"
                                        : "bg-ninja-card text-ninja-dim border-ninja-border hover:border-ninja-hover hover:text-white"
                                    }
                                `}
                            >
                                Top Level
                            </button>
                        </div>

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
                                    <span className="truncate">{mode ? formatModeLabel(mode) : "No modes found"}</span>
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
                                                    setPage(1);
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

                <div className="bg-ninja-panel border border-ninja-border shadow-2xl rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="p-16 text-center text-ninja-dim animate-pulse flex flex-col items-center gap-4">
                            <Zap className="w-8 h-8 text-ninja-accent animate-bounce" />
                            <p>{view === "speed" ? "Fetching Scroll Records..." : "Fetching Rank Records..."}</p>
                        </div>
                    ) : (view === "speed" ? entries.length === 0 : profiles.length === 0) ? (
                        <div className="p-16 text-center text-ninja-dim border-t border-dashed border-ninja-border">
                            <p className="mb-4 text-lg">{view === "speed" ? "No records found for this Jutsu." : "No rank records found yet."}</p>
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
                                        ? entries.map((entry, index) => {
                                            const rank = (page - 1) * PAGE_SIZE + index + 1;
                                            return (
                                                <tr key={entry.id} className="hover:bg-ninja-hover/30 transition-colors group">
                                                    <td className="px-6 py-5 text-center font-bold text-ninja-dim group-hover:text-white">
                                                        {rank === 1 ? (
                                                            <div className="relative inline-block">
                                                                <Crown className="w-6 h-6 text-yellow-400 mx-auto drop-shadow-md" />
                                                                <div className="absolute inset-0 bg-yellow-400/20 blur-md rounded-full"></div>
                                                            </div>
                                                        ) : (
                                                            `#${rank}`
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 font-medium text-white flex items-center gap-4">
                                                        {entry.avatar_url ? (
                                                            <div
                                                                className={`w-10 h-10 rounded-lg overflow-hidden shadow-lg border border-white/10
                                                        ${rank === 1 ? "ring-2 ring-yellow-400" : ""}
                                                    `}
                                                            >
                                                                <img src={entry.avatar_url} alt={entry.username} className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-lg border border-white/10
                                                        ${rank === 1
                                                                        ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                                                                        : rank === 2
                                                                            ? "bg-gradient-to-br from-gray-300 to-gray-500"
                                                                            : rank === 3
                                                                                ? "bg-gradient-to-br from-orange-400 to-orange-600"
                                                                                : "bg-ninja-card border-ninja-border text-ninja-dim"
                                                                    }
                                                    `}
                                                            >
                                                                {entry.username.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2">
                                                            <span className={rank <= 3 ? "text-ninja-accent-glow font-bold" : ""}>{entry.username}</span>
                                                            {entry.discord_id === DEV_DISCORD_ID && (
                                                                <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black tracking-wider shadow-sm border border-red-400">
                                                                    DEV
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-mono font-bold text-white">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Clock className="w-4 h-4 text-ninja-dim" />
                                                            <span className={rank === 1 ? "text-yellow-400 text-lg" : ""}>{entry.score_time.toFixed(2)}s</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center text-xs text-ninja-dim font-mono">
                                                        {new Date(entry.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                        : profiles.map((entry, index) => {
                                            const rank = (page - 1) * PAGE_SIZE + index + 1;
                                            return (
                                                <tr key={entry.id} className="hover:bg-ninja-hover/30 transition-colors group">
                                                    <td className="px-6 py-5 text-center font-bold text-ninja-dim group-hover:text-white">
                                                        {rank === 1 ? (
                                                            <div className="relative inline-block">
                                                                <Crown className="w-6 h-6 text-yellow-400 mx-auto drop-shadow-md" />
                                                                <div className="absolute inset-0 bg-yellow-400/20 blur-md rounded-full"></div>
                                                            </div>
                                                        ) : (
                                                            `#${rank}`
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 font-medium text-white flex items-center gap-4">
                                                        {entry.avatar_url ? (
                                                            <div
                                                                className={`w-10 h-10 rounded-lg overflow-hidden shadow-lg border border-white/10
                                                        ${rank === 1 ? "ring-2 ring-yellow-400" : ""}
                                                    `}
                                                            >
                                                                <img src={entry.avatar_url} alt={entry.username} className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-lg border border-white/10
                                                        ${rank === 1
                                                                        ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                                                                        : rank === 2
                                                                            ? "bg-gradient-to-br from-gray-300 to-gray-500"
                                                                            : rank === 3
                                                                                ? "bg-gradient-to-br from-orange-400 to-orange-600"
                                                                                : "bg-ninja-card border-ninja-border text-ninja-dim"
                                                                    }
                                                    `}
                                                            >
                                                                {entry.username.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2">
                                                            <span className={rank <= 3 ? "text-ninja-accent-glow font-bold" : ""}>{entry.username}</span>
                                                            {entry.discord_id === DEV_DISCORD_ID && (
                                                                <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black tracking-wider shadow-sm border border-red-400">
                                                                    DEV
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-mono font-bold text-white">LV.{entry.level}</td>
                                                    <td className="px-6 py-5 text-right font-mono text-ninja-accent-glow font-bold">{entry.xp.toLocaleString()}</td>
                                                    <td className="px-6 py-5 text-center text-xs text-ninja-dim font-mono uppercase">{entry.rank || "Student"}</td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {!loading && totalCount > 0 && (
                    <div className="mt-6 flex items-center justify-between gap-4">
                        <p className="text-xs text-ninja-dim">Page {page} of {totalPages}</p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => canGoPrev && setPage((p) => p - 1)}
                                disabled={!canGoPrev}
                                className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border border-ninja-border bg-ninja-card text-ninja-dim hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Prev
                            </button>
                            <button
                                type="button"
                                onClick={() => canGoNext && setPage((p) => p + 1)}
                                disabled={!canGoNext}
                                className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border border-ninja-border bg-ninja-card text-ninja-dim hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function LeaderboardPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-ninja-bg flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-ninja-accent border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-white font-bold tracking-widest animate-pulse">LOADING CHAKRA...</p>
                </div>
            </div>
        }>
            <LeaderboardContent />
        </Suspense>
    );
}
