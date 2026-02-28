"use client";

import { FormEvent, useMemo, useState } from "react";

interface TopModeRow {
  mode: string;
  runs: number;
}

interface DashboardMetrics {
  playersToday: number;
  newPlayersToday: number;
  returningPlayersToday: number;
  comebackPlayersToday: number;
  sessionsToday: number;
  playersYesterday: number;
  sessionsYesterday: number;
  activePlayers7d: number;
  activePlayers30d: number;
  avgScoreTimeToday: number;
  bestScoreTimeToday: number;
  topModesToday: TopModeRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function toFloat(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function parseTopModes(raw: unknown): TopModeRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: TopModeRow[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const mode = String(entry.mode || "").trim() || "UNKNOWN";
    rows.push({
      mode,
      runs: toInt(entry.runs),
    });
  }
  return rows;
}

function parseMetrics(raw: unknown): DashboardMetrics {
  const source = isRecord(raw) ? raw : {};
  return {
    playersToday: toInt(source.players_today),
    newPlayersToday: toInt(source.new_players_today),
    returningPlayersToday: toInt(source.returning_players_today),
    comebackPlayersToday: toInt(source.comeback_players_today),
    sessionsToday: toInt(source.sessions_today),
    playersYesterday: toInt(source.players_yesterday),
    sessionsYesterday: toInt(source.sessions_yesterday),
    activePlayers7d: toInt(source.active_players_7d),
    activePlayers30d: toInt(source.active_players_30d),
    avgScoreTimeToday: toFloat(source.avg_score_time_today),
    bestScoreTimeToday: toFloat(source.best_score_time_today),
    topModesToday: parseTopModes(source.top_modes_today),
  };
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return `${value.toFixed(3)}s`;
}

export default function AdminDashboardPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [generatedAt, setGeneratedAt] = useState("");
  const [timezoneUsed, setTimezoneUsed] = useState("UTC");

  const guessedTimezone = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return String(tz || "UTC").trim() || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const loadDashboard = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    if (!password.trim()) {
      setError("Enter admin password.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          password,
          timezone: guessedTimezone,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !isRecord(payload) || !Boolean(payload.ok)) {
        const reason = isRecord(payload) ? String(payload.reason || "") : "";
        if (reason === "invalid_password") {
          setError("Wrong admin password.");
        } else if (reason === "password_not_set") {
          setError("Admin password is not set in DB yet.");
        } else {
          setError(String(isRecord(payload) ? payload.detail : "Dashboard request failed."));
        }
        setMetrics(null);
        return;
      }

      setMetrics(parseMetrics(payload.metrics));
      setGeneratedAt(String(payload.generated_at || ""));
      setTimezoneUsed(String(payload.timezone || guessedTimezone));
    } catch (err) {
      setMetrics(null);
      setError(String((err as Error)?.message || err || "Request failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b1020] text-zinc-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-black tracking-tight">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Password is validated against DB via `public.admin_dashboard_stats`.
        </p>

        <form
          onSubmit={loadDashboard}
          className="mt-5 rounded-xl border border-white/15 bg-black/25 p-4"
        >
          <label className="block text-xs uppercase tracking-[0.16em] text-zinc-400" htmlFor="admin-password">
            Admin Password
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter dashboard password"
              className="h-11 w-full rounded-lg border border-white/20 bg-black/45 px-3 text-sm text-white outline-none focus:border-orange-400"
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-11 rounded-lg bg-orange-500 px-5 text-sm font-black tracking-wide text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "LOADING..." : "OPEN DASHBOARD"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMetrics(null);
                setGeneratedAt("");
                setError("");
              }}
              className="h-11 rounded-lg border border-white/20 px-5 text-sm font-black tracking-wide text-zinc-200 hover:bg-white/10"
            >
              LOCK
            </button>
          </div>
          {!!error && (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          )}
        </form>

        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-100">
          <p className="font-bold">Set/rotate password in DB:</p>
          <code className="mt-2 block rounded bg-black/35 p-2 text-[11px] text-emerald-200">
            select public.admin_set_dashboard_password('your-strong-password');
          </code>
        </div>

        {metrics && (
          <section className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
              <span>Timezone: {timezoneUsed}</span>
              <span>Generated: {generatedAt ? new Date(generatedAt).toLocaleString() : "-"}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Players Today</p>
                <p className="mt-2 text-3xl font-black">{metrics.playersToday}</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">New Today</p>
                <p className="mt-2 text-3xl font-black">{metrics.newPlayersToday}</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Returning Today</p>
                <p className="mt-2 text-3xl font-black">{metrics.returningPlayersToday}</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Comeback Today</p>
                <p className="mt-2 text-3xl font-black">{metrics.comebackPlayersToday}</p>
              </article>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Sessions Today</p>
                <p className="mt-2 text-3xl font-black">{metrics.sessionsToday}</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Players Yesterday</p>
                <p className="mt-2 text-3xl font-black">{metrics.playersYesterday}</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Sessions Yesterday</p>
                <p className="mt-2 text-3xl font-black">{metrics.sessionsYesterday}</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Active 7D / 30D</p>
                <p className="mt-2 text-3xl font-black">{metrics.activePlayers7d} / {metrics.activePlayers30d}</p>
              </article>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Avg Time Today</p>
                <p className="mt-2 text-3xl font-black">{formatSeconds(metrics.avgScoreTimeToday)}</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Best Time Today</p>
                <p className="mt-2 text-3xl font-black">{formatSeconds(metrics.bestScoreTimeToday)}</p>
              </article>
            </div>

            <article className="rounded-xl border border-white/15 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Top Modes Today</p>
              {metrics.topModesToday.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-300">No runs recorded today.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[360px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.14em] text-zinc-400">
                        <th className="px-2 py-2">Mode</th>
                        <th className="px-2 py-2 text-right">Runs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.topModesToday.map((row) => (
                        <tr key={row.mode} className="border-b border-white/5">
                          <td className="px-2 py-2 font-semibold text-zinc-100">{row.mode}</td>
                          <td className="px-2 py-2 text-right text-zinc-200">{row.runs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
