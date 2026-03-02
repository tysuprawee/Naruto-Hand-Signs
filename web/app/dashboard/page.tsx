"use client";

import { FormEvent, useMemo, useState } from "react";

interface TopModeRow {
  mode: string;
  runs: number;
}

interface TrendPoint {
  day: string;
  players: number;
  sessions: number;
  newPlayers: number;
  returningPlayers: number;
  comebackPlayers: number;
}

interface ModeBreakdownRow {
  mode: string;
  runs: number;
  uniquePlayers: number;
  avgScoreTime: number;
  bestScoreTime: number;
}

interface ActivityRow {
  username: string;
  runs: number;
}

interface FastestRow {
  username: string;
  mode: string;
  scoreTime: number;
  createdAt: string;
}

interface NewGrinderRow {
  username: string;
  runs7d: number;
  firstSeenAt: string;
}

interface RetentionBucket {
  cohortSize: number;
  returned: number;
  retentionPct: number;
}

interface FunnelToday {
  playVisitsToday: number;
  playVisitorsToday: number;
  runStartsToday: number;
  runCompletionsToday: number;
  visitToStartPct: number;
  startToCompletionPct: number;
}

interface AlertRow {
  severity: string;
  code: string;
  message: string;
}

interface LoginAttemptRow {
  attemptedAt: string;
  clientId: string;
  success: boolean;
  reason: string;
  ip: string;
}

interface SecurityData {
  failedInvalidPasswordLastHour: number;
  clientsWithFailuresLastHour: number;
  lockoutPolicy: string;
  rateLimitPolicy: string;
  recentLoginAttempts: LoginAttemptRow[];
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

interface DashboardData {
  generatedAt: string;
  timezone: string;
  metrics: DashboardMetrics;
  trends14d: TrendPoint[];
  modeBreakdown30d: ModeBreakdownRow[];
  mostActive7d: ActivityRow[];
  fastestToday: FastestRow[];
  newGrinders7d: NewGrinderRow[];
  retention: {
    d1: RetentionBucket;
    d7: RetentionBucket;
    d30: RetentionBucket;
  };
  funnelToday: FunnelToday;
  alerts: AlertRow[];
  security: SecurityData;
}

interface ConfigRow {
  id: string;
  type: string;
  message: string;
  version: string;
  url: string;
  checksum: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

interface ReportRow {
  id: string;
  reportText: string;
  pagePath: string;
  userAgent: string;
  authUserId: string;
  status: string;
  createdAt: string;
}

interface ConfigFormState {
  type: "announcement" | "maintenance" | "version" | "dataset";
  message: string;
  version: string;
  url: string;
  checksum: string;
  isActive: boolean;
  priority: number;
}

interface ApiError {
  ok: false;
  reason?: string;
  detail?: string;
  retry_seconds?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return `${value.toFixed(3)}s`;
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(2)}%`;
}

function parseTopModes(raw: unknown): TopModeRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      mode: toText(row.mode) || "UNKNOWN",
      runs: toInt(row.runs),
    }));
}

function parseTrends(raw: unknown): TrendPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      day: toText(row.day),
      players: toInt(row.players),
      sessions: toInt(row.sessions),
      newPlayers: toInt(row.new_players),
      returningPlayers: toInt(row.returning_players),
      comebackPlayers: toInt(row.comeback_players),
    }));
}

function parseModeBreakdown(raw: unknown): ModeBreakdownRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      mode: toText(row.mode) || "UNKNOWN",
      runs: toInt(row.runs),
      uniquePlayers: toInt(row.unique_players),
      avgScoreTime: toNumber(row.avg_score_time),
      bestScoreTime: toNumber(row.best_score_time),
    }));
}

function parseActivityRows(raw: unknown): ActivityRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      username: toText(row.username),
      runs: toInt(row.runs),
    }));
}

function parseFastestRows(raw: unknown): FastestRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      username: toText(row.username),
      mode: toText(row.mode),
      scoreTime: toNumber(row.score_time),
      createdAt: toText(row.created_at),
    }));
}

function parseNewGrinders(raw: unknown): NewGrinderRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      username: toText(row.username),
      runs7d: toInt(row.runs_7d),
      firstSeenAt: toText(row.first_seen_at),
    }));
}

function parseRetentionBucket(raw: unknown): RetentionBucket {
  const source = isRecord(raw) ? raw : {};
  return {
    cohortSize: toInt(source.cohort_size),
    returned: toInt(source.returned),
    retentionPct: toNumber(source.retention_pct),
  };
}

function parseFunnel(raw: unknown): FunnelToday {
  const source = isRecord(raw) ? raw : {};
  return {
    playVisitsToday: toInt(source.play_visits_today),
    playVisitorsToday: toInt(source.play_visitors_today),
    runStartsToday: toInt(source.run_starts_today),
    runCompletionsToday: toInt(source.run_completions_today),
    visitToStartPct: toNumber(source.visit_to_start_pct),
    startToCompletionPct: toNumber(source.start_to_completion_pct),
  };
}

function parseAlerts(raw: unknown): AlertRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      severity: toText(row.severity) || "info",
      code: toText(row.code),
      message: toText(row.message),
    }));
}

function parseLoginAttempts(raw: unknown): LoginAttemptRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      attemptedAt: toText(row.attempted_at),
      clientId: toText(row.client_id),
      success: Boolean(row.success),
      reason: toText(row.reason),
      ip: toText(row.ip),
    }));
}

function parseSecurity(raw: unknown): SecurityData {
  const source = isRecord(raw) ? raw : {};
  return {
    failedInvalidPasswordLastHour: toInt(source.failed_invalid_password_last_hour),
    clientsWithFailuresLastHour: toInt(source.clients_with_failures_last_hour),
    lockoutPolicy: toText(source.lockout_policy),
    rateLimitPolicy: toText(source.rate_limit_policy),
    recentLoginAttempts: parseLoginAttempts(source.recent_login_attempts),
  };
}

function parseDashboardPayload(raw: unknown): DashboardData {
  const source = isRecord(raw) ? raw : {};
  const metricsRaw = isRecord(source.metrics) ? source.metrics : {};
  const insightsRaw = isRecord(source.player_insights) ? source.player_insights : {};
  const retentionRaw = isRecord(source.retention) ? source.retention : {};

  return {
    generatedAt: toText(source.generated_at),
    timezone: toText(source.timezone) || "UTC",
    metrics: {
      playersToday: toInt(metricsRaw.players_today),
      newPlayersToday: toInt(metricsRaw.new_players_today),
      returningPlayersToday: toInt(metricsRaw.returning_players_today),
      comebackPlayersToday: toInt(metricsRaw.comeback_players_today),
      sessionsToday: toInt(metricsRaw.sessions_today),
      playersYesterday: toInt(metricsRaw.players_yesterday),
      sessionsYesterday: toInt(metricsRaw.sessions_yesterday),
      activePlayers7d: toInt(metricsRaw.active_players_7d),
      activePlayers30d: toInt(metricsRaw.active_players_30d),
      avgScoreTimeToday: toNumber(metricsRaw.avg_score_time_today),
      bestScoreTimeToday: toNumber(metricsRaw.best_score_time_today),
      topModesToday: parseTopModes(metricsRaw.top_modes_today),
    },
    trends14d: parseTrends(source.trends_14d),
    modeBreakdown30d: parseModeBreakdown(source.mode_breakdown_30d),
    mostActive7d: parseActivityRows(insightsRaw.most_active_7d),
    fastestToday: parseFastestRows(insightsRaw.fastest_today),
    newGrinders7d: parseNewGrinders(insightsRaw.new_grinders_7d),
    retention: {
      d1: parseRetentionBucket(retentionRaw.d1),
      d7: parseRetentionBucket(retentionRaw.d7),
      d30: parseRetentionBucket(retentionRaw.d30),
    },
    funnelToday: parseFunnel(source.funnel_today),
    alerts: parseAlerts(source.alerts),
    security: parseSecurity(source.security),
  };
}

function parseConfigRows(raw: unknown): ConfigRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      id: toText(row.id),
      type: toText(row.type),
      message: toText(row.message),
      version: toText(row.version),
      url: toText(row.url),
      checksum: toText(row.checksum),
      isActive: Boolean(row.is_active),
      priority: toInt(row.priority),
      createdAt: toText(row.created_at),
    }));
}

function parseReportRows(raw: unknown): ReportRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      id: toText(row.id),
      reportText: toText(row.report_text),
      pagePath: toText(row.page_path),
      userAgent: toText(row.user_agent),
      authUserId: toText(row.auth_user_id),
      status: toText(row.status) || "new",
      createdAt: toText(row.created_at),
    }));
}

function buildSparkline(values: number[]): string {
  if (values.length <= 0) return "";
  const width = 160;
  const height = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  return values
    .map((value, idx) => {
      const x = values.length <= 1 ? 0 : (idx / (values.length - 1)) * width;
      const y = height - (((value - min) / span) * height);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function TrendCard({ title, points, color }: { title: string; points: number[]; color: string }) {
  const polyline = useMemo(() => buildSparkline(points), [points]);
  const latest = points.length > 0 ? points[points.length - 1] : 0;

  return (
    <article className="rounded-xl border border-white/15 bg-black/25 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">{title}</p>
      <p className="mt-1 text-2xl font-black">{latest}</p>
      <svg viewBox="0 0 160 44" className="mt-3 h-14 w-full rounded bg-black/35 p-1">
        {polyline ? (
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            points={polyline}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
    </article>
  );
}

export default function AdminDashboardPage() {
  const [password, setPassword] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [configRows, setConfigRows] = useState<ConfigRow[]>([]);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);
  const [error, setError] = useState("");
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [configForm, setConfigForm] = useState<ConfigFormState>({
    type: "announcement",
    message: "",
    version: "",
    url: "",
    checksum: "",
    isActive: true,
    priority: 100,
  });

  const guessedTimezone = useMemo(() => {
    try {
      return String(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC").trim() || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const apiPost = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/dashboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    return { res, json };
  };

  const handleApiError = (json: unknown): string => {
    if (!isRecord(json)) return "Request failed.";
    const reason = toText(json.reason);
    const detail = toText(json.detail);
    setRetrySeconds(toInt(json.retry_seconds));

    if (reason === "invalid_password") return "Wrong admin password.";
    if (reason === "password_not_set") return "Admin password is not set in DB yet.";
    if (reason === "locked_out") return `Locked out temporarily. Retry in ${Math.max(1, toInt(json.retry_seconds))}s.`;
    if (reason === "rate_limited") return `Too many attempts. Retry in ${Math.max(1, toInt(json.retry_seconds))}s.`;
    return detail || reason || "Request failed.";
  };

  const isReportsUnavailableError = (json: unknown): boolean => {
    if (!isRecord(json)) return false;
    const reason = toText(json.reason).toLowerCase();
    const detail = toText(json.detail).toLowerCase();
    if (reason === "missing_user_reports_table" || reason === "missing_admin_stats_function") {
      return true;
    }
    return reason === "rpc_error"
      && detail.includes("admin_get_user_reports")
      && detail.includes("does not exist");
  };

  const loadStats = async (): Promise<boolean> => {
    const { res, json } = await apiPost({
      action: "stats",
      password,
      timezone: guessedTimezone,
    });
    if (!res.ok || !isRecord(json) || !Boolean(json.ok)) {
      setError(handleApiError(json));
      setDashboard(null);
      return false;
    }
    setRetrySeconds(0);
    setDashboard(parseDashboardPayload(json));
    return true;
  };

  const loadConfigRows = async (): Promise<boolean> => {
    const { res, json } = await apiPost({
      action: "config_list",
      password,
    });
    if (!res.ok || !isRecord(json) || !Boolean(json.ok)) {
      setError(handleApiError(json));
      setConfigRows([]);
      return false;
    }
    setConfigRows(parseConfigRows(json.rows));
    return true;
  };

  const loadReportRows = async (): Promise<boolean> => {
    const { res, json } = await apiPost({
      action: "reports_list",
      password,
      limit: 120,
    });
    if (!res.ok || !isRecord(json) || !Boolean(json.ok)) {
      if (isReportsUnavailableError(json)) {
        setReportRows([]);
        return true;
      }
      setError(handleApiError(json));
      setReportRows([]);
      return false;
    }
    setReportRows(parseReportRows(json.rows));
    return true;
  };

  const openDashboard = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    if (!password.trim()) {
      setError("Enter admin password.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const [statsOk, configOk, reportsOk] = await Promise.all([loadStats(), loadConfigRows(), loadReportRows()]);
      if (!statsOk || !configOk || !reportsOk) return;
    } catch (err) {
      setError(String((err as Error)?.message || err || "Request failed."));
    } finally {
      setBusy(false);
    }
  };

  const refreshDashboard = async () => {
    if (!password.trim()) return;
    setBusy(true);
    setError("");
    try {
      await Promise.all([loadStats(), loadConfigRows(), loadReportRows()]);
    } finally {
      setBusy(false);
    }
  };

  const submitConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) {
      setError("Enter admin password first.");
      return;
    }

    setConfigBusy(true);
    setError("");
    try {
      const { res, json } = await apiPost({
        action: "config_upsert",
        password,
        config: {
          type: configForm.type,
          message: configForm.message,
          version: configForm.version,
          url: configForm.url,
          checksum: configForm.checksum,
          is_active: configForm.isActive,
          priority: configForm.priority,
        },
      });
      if (!res.ok || !isRecord(json) || !Boolean(json.ok)) {
        setError(handleApiError(json));
        return;
      }
      await loadConfigRows();
    } catch (err) {
      setError(String((err as Error)?.message || err || "Config update failed."));
    } finally {
      setConfigBusy(false);
    }
  };

  const trendValues = useMemo(() => {
    const points = dashboard?.trends14d || [];
    return {
      players: points.map((p) => p.players),
      sessions: points.map((p) => p.sessions),
      newPlayers: points.map((p) => p.newPlayers),
      returning: points.map((p) => p.returningPlayers),
      comeback: points.map((p) => p.comebackPlayers),
    };
  }, [dashboard]);

  return (
    <main className="min-h-screen bg-[#0b1020] text-zinc-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-black tracking-tight">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Game analytics and runtime controls. Reaper Death Seal background resolution is untouched by this dashboard work.
        </p>

        <form onSubmit={openDashboard} className="mt-5 rounded-xl border border-white/15 bg-black/25 p-4">
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
              {busy ? "LOADING..." : "OPEN"}
            </button>
            <button
              type="button"
              onClick={refreshDashboard}
              disabled={busy || !password.trim()}
              className="h-11 rounded-lg border border-white/20 px-5 text-sm font-black tracking-wide text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              REFRESH
            </button>
            <button
              type="button"
              onClick={() => {
                setDashboard(null);
                setConfigRows([]);
                setReportRows([]);
                setError("");
                setRetrySeconds(0);
              }}
              className="h-11 rounded-lg border border-white/20 px-5 text-sm font-black tracking-wide text-zinc-200 hover:bg-white/10"
            >
              LOCK
            </button>
          </div>
          {!!error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          {retrySeconds > 0 && !error && (
            <p className="mt-3 text-sm text-amber-300">Retry after {retrySeconds}s.</p>
          )}
        </form>

        {dashboard && (
          <section className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
              <span>Timezone: {dashboard.timezone}</span>
              <span>Generated: {dashboard.generatedAt ? new Date(dashboard.generatedAt).toLocaleString() : "-"}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Players Today</p>
                <p className="mt-2 text-3xl font-black">{dashboard.metrics.playersToday}</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">New / Returning / Comeback</p>
                <p className="mt-2 text-2xl font-black">
                  {dashboard.metrics.newPlayersToday} / {dashboard.metrics.returningPlayersToday} / {dashboard.metrics.comebackPlayersToday}
                </p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Sessions Today / Yesterday</p>
                <p className="mt-2 text-2xl font-black">
                  {dashboard.metrics.sessionsToday} / {dashboard.metrics.sessionsYesterday}
                </p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Active 7D / 30D</p>
                <p className="mt-2 text-2xl font-black">
                  {dashboard.metrics.activePlayers7d} / {dashboard.metrics.activePlayers30d}
                </p>
              </article>
            </div>

            <div className="rounded-xl border border-white/15 bg-black/25 p-4">
              <h2 className="text-sm font-black tracking-[0.14em] text-zinc-200">Alerts</h2>
              {dashboard.alerts.length <= 0 ? (
                <p className="mt-2 text-sm text-zinc-300">No alerts right now.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {dashboard.alerts.map((alert) => (
                    <div
                      key={`${alert.code}-${alert.message}`}
                      className={`rounded-lg border px-3 py-2 text-sm ${alert.severity === "high"
                        ? "border-red-500/40 bg-red-500/10 text-red-200"
                        : alert.severity === "medium"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                          : "border-sky-500/35 bg-sky-500/10 text-sky-200"}`}
                    >
                      <p className="font-bold uppercase tracking-[0.1em]">{alert.severity}</p>
                      <p>{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/15 bg-black/25 p-4">
              <h2 className="text-sm font-black tracking-[0.14em] text-zinc-200">14-Day Trends</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <TrendCard title="Players" points={trendValues.players} color="#60a5fa" />
                <TrendCard title="Sessions" points={trendValues.sessions} color="#f59e0b" />
                <TrendCard title="New" points={trendValues.newPlayers} color="#22c55e" />
                <TrendCard title="Returning" points={trendValues.returning} color="#a78bfa" />
                <TrendCard title="Comeback" points={trendValues.comeback} color="#fb7185" />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Retention D1</p>
                <p className="mt-1 text-3xl font-black">{formatPct(dashboard.retention.d1.retentionPct)}</p>
                <p className="mt-1 text-xs text-zinc-400">{dashboard.retention.d1.returned}/{dashboard.retention.d1.cohortSize}</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Retention D7</p>
                <p className="mt-1 text-3xl font-black">{formatPct(dashboard.retention.d7.retentionPct)}</p>
                <p className="mt-1 text-xs text-zinc-400">{dashboard.retention.d7.returned}/{dashboard.retention.d7.cohortSize}</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Retention D30</p>
                <p className="mt-1 text-3xl font-black">{formatPct(dashboard.retention.d30.retentionPct)}</p>
                <p className="mt-1 text-xs text-zinc-400">{dashboard.retention.d30.returned}/{dashboard.retention.d30.cohortSize}</p>
              </article>
            </div>

            <div className="rounded-xl border border-white/15 bg-black/25 p-4">
              <h2 className="text-sm font-black tracking-[0.14em] text-zinc-200">Funnel (Today)</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <article className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Play Visits</p>
                  <p className="mt-1 text-2xl font-black">{dashboard.funnelToday.playVisitsToday}</p>
                  <p className="text-xs text-zinc-500">Visitors: {dashboard.funnelToday.playVisitorsToday}</p>
                </article>
                <article className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Run Starts (Rank Tokens)</p>
                  <p className="mt-1 text-2xl font-black">{dashboard.funnelToday.runStartsToday}</p>
                  <p className="text-xs text-zinc-500">Visit-&gt;Start: {formatPct(dashboard.funnelToday.visitToStartPct)}</p>
                </article>
                <article className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Run Completions</p>
                  <p className="mt-1 text-2xl font-black">{dashboard.funnelToday.runCompletionsToday}</p>
                  <p className="text-xs text-zinc-500">Start-&gt;Complete: {formatPct(dashboard.funnelToday.startToCompletionPct)}</p>
                </article>
              </div>
            </div>

            <div className="rounded-xl border border-white/15 bg-black/25 p-4">
              <h2 className="text-sm font-black tracking-[0.14em] text-zinc-200">Mode Breakdown (30 Days)</h2>
              {dashboard.modeBreakdown30d.length <= 0 ? (
                <p className="mt-2 text-sm text-zinc-300">No mode data.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.14em] text-zinc-400">
                        <th className="px-2 py-2">Mode</th>
                        <th className="px-2 py-2 text-right">Runs</th>
                        <th className="px-2 py-2 text-right">Unique Players</th>
                        <th className="px-2 py-2 text-right">Avg Time</th>
                        <th className="px-2 py-2 text-right">Best Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.modeBreakdown30d.map((row) => (
                        <tr key={row.mode} className="border-b border-white/5">
                          <td className="px-2 py-2 font-semibold text-zinc-100">{row.mode}</td>
                          <td className="px-2 py-2 text-right">{row.runs}</td>
                          <td className="px-2 py-2 text-right">{row.uniquePlayers}</td>
                          <td className="px-2 py-2 text-right">{formatSeconds(row.avgScoreTime)}</td>
                          <td className="px-2 py-2 text-right">{formatSeconds(row.bestScoreTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-zinc-300">Most Active (7D)</h3>
                <div className="mt-2 space-y-2">
                  {dashboard.mostActive7d.map((row) => (
                    <div key={`${row.username}-${row.runs}`} className="flex items-center justify-between text-sm">
                      <span className="truncate text-zinc-200">{row.username}</span>
                      <span className="font-black text-white">{row.runs}</span>
                    </div>
                  ))}
                  {dashboard.mostActive7d.length === 0 && <p className="text-sm text-zinc-400">No data.</p>}
                </div>
              </article>

              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-zinc-300">Fastest Today</h3>
                <div className="mt-2 space-y-2">
                  {dashboard.fastestToday.map((row) => (
                    <div key={`${row.username}-${row.mode}-${row.createdAt}-${row.scoreTime}`} className="text-sm">
                      <p className="truncate font-semibold text-zinc-100">{row.username}</p>
                      <p className="text-xs text-zinc-400">{row.mode} • {formatSeconds(row.scoreTime)}</p>
                    </div>
                  ))}
                  {dashboard.fastestToday.length === 0 && <p className="text-sm text-zinc-400">No data.</p>}
                </div>
              </article>

              <article className="rounded-xl border border-white/15 bg-black/25 p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-zinc-300">New Grinders (7D)</h3>
                <div className="mt-2 space-y-2">
                  {dashboard.newGrinders7d.map((row) => (
                    <div key={`${row.username}-${row.firstSeenAt}`} className="text-sm">
                      <p className="truncate font-semibold text-zinc-100">{row.username}</p>
                      <p className="text-xs text-zinc-400">{row.runs7d} runs • first seen {row.firstSeenAt ? new Date(row.firstSeenAt).toLocaleDateString() : "-"}</p>
                    </div>
                  ))}
                  {dashboard.newGrinders7d.length === 0 && <p className="text-sm text-zinc-400">No data.</p>}
                </div>
              </article>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-white/15 bg-black/25 p-4">
                <h2 className="text-sm font-black tracking-[0.14em] text-zinc-200">Admin Controls (app_config)</h2>
                <form onSubmit={submitConfig} className="mt-3 space-y-3">
                  <label className="block text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Type
                    <select
                      value={configForm.type}
                      onChange={(event) => setConfigForm((prev) => ({ ...prev, type: event.target.value as ConfigFormState["type"] }))}
                      className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-black/40 px-3 text-sm text-white"
                    >
                      <option value="announcement">announcement</option>
                      <option value="maintenance">maintenance</option>
                      <option value="version">version</option>
                      <option value="dataset">dataset</option>
                    </select>
                  </label>

                  <label className="block text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Message
                    <textarea
                      value={configForm.message}
                      onChange={(event) => setConfigForm((prev) => ({ ...prev, message: event.target.value }))}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                      placeholder="Display message"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Version
                      <input
                        value={configForm.version}
                        onChange={(event) => setConfigForm((prev) => ({ ...prev, version: event.target.value }))}
                        className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-black/40 px-3 text-sm text-white"
                        placeholder="e.g. 1.2.3"
                      />
                    </label>
                    <label className="block text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Priority
                      <input
                        type="number"
                        value={configForm.priority}
                        onChange={(event) => setConfigForm((prev) => ({ ...prev, priority: Number(event.target.value || 0) }))}
                        className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-black/40 px-3 text-sm text-white"
                      />
                    </label>
                  </div>

                  <label className="block text-xs uppercase tracking-[0.14em] text-zinc-400">
                    URL
                    <input
                      value={configForm.url}
                      onChange={(event) => setConfigForm((prev) => ({ ...prev, url: event.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-black/40 px-3 text-sm text-white"
                      placeholder="https://..."
                    />
                  </label>

                  <label className="block text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Checksum
                    <input
                      value={configForm.checksum}
                      onChange={(event) => setConfigForm((prev) => ({ ...prev, checksum: event.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-black/40 px-3 text-sm text-white"
                      placeholder="dataset checksum"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      checked={configForm.isActive}
                      onChange={(event) => setConfigForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      className="h-4 w-4"
                    />
                    Set this record as active
                  </label>

                  <button
                    type="submit"
                    disabled={configBusy || !password.trim()}
                    className="h-11 rounded-lg bg-cyan-500 px-5 text-sm font-black tracking-wide text-white hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {configBusy ? "SAVING..." : "SAVE CONFIG"}
                  </button>
                </form>
              </section>

              <section className="rounded-xl border border-white/15 bg-black/25 p-4">
                <h2 className="text-sm font-black tracking-[0.14em] text-zinc-200">Current app_config Rows</h2>
                <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-white/10">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-black/35 text-left uppercase tracking-[0.12em] text-zinc-400">
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Active</th>
                        <th className="px-2 py-2">Priority</th>
                        <th className="px-2 py-2">Version</th>
                        <th className="px-2 py-2">Message</th>
                        <th className="px-2 py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configRows.map((row) => (
                        <tr key={row.id || `${row.type}-${row.createdAt}`} className="border-b border-white/5 align-top">
                          <td className="px-2 py-2 font-semibold text-zinc-100">{row.type}</td>
                          <td className="px-2 py-2">{row.isActive ? "yes" : "no"}</td>
                          <td className="px-2 py-2">{row.priority}</td>
                          <td className="px-2 py-2">{row.version || "-"}</td>
                          <td className="max-w-[220px] truncate px-2 py-2 text-zinc-300" title={row.message}>{row.message || "-"}</td>
                          <td className="px-2 py-2 text-zinc-400">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                        </tr>
                      ))}
                      {configRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-2 py-3 text-zinc-400">No config rows loaded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="rounded-xl border border-white/15 bg-black/25 p-4">
              <h2 className="text-sm font-black tracking-[0.14em] text-zinc-200">User Reports</h2>
              <p className="mt-1 text-xs text-zinc-400">Submitted from the floating report button across pages.</p>
              <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[980px] text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/35 text-left uppercase tracking-[0.12em] text-zinc-400">
                      <th className="px-2 py-2">Created</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Report</th>
                      <th className="px-2 py-2">Page</th>
                      <th className="px-2 py-2">User ID</th>
                      <th className="px-2 py-2">User Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row) => (
                      <tr key={`${row.id}-${row.createdAt}`} className="border-b border-white/5 align-top">
                        <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${
                            row.status === "resolved"
                              ? "bg-emerald-500/20 text-emerald-200"
                              : row.status === "reviewing"
                                ? "bg-amber-500/20 text-amber-200"
                                : row.status === "spam"
                                  ? "bg-red-500/20 text-red-200"
                                  : "bg-sky-500/20 text-sky-200"
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="max-w-[320px] whitespace-pre-wrap px-2 py-2 text-zinc-100">{row.reportText || "-"}</td>
                        <td className="max-w-[150px] truncate px-2 py-2 text-zinc-300" title={row.pagePath}>
                          {row.pagePath || "-"}
                        </td>
                        <td className="max-w-[200px] truncate px-2 py-2 text-zinc-400" title={row.authUserId}>
                          {row.authUserId || "-"}
                        </td>
                        <td className="max-w-[260px] truncate px-2 py-2 text-zinc-500" title={row.userAgent}>
                          {row.userAgent || "-"}
                        </td>
                      </tr>
                    ))}
                    {reportRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-3 text-zinc-400">No reports found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-white/15 bg-black/25 p-4">
              <h2 className="text-sm font-black tracking-[0.14em] text-zinc-200">Security</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Invalid Password (1h)</p>
                  <p className="mt-1 text-2xl font-black">{dashboard.security.failedInvalidPasswordLastHour}</p>
                </article>
                <article className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Clients With Fails (1h)</p>
                  <p className="mt-1 text-2xl font-black">{dashboard.security.clientsWithFailuresLastHour}</p>
                </article>
                <article className="rounded-lg border border-white/10 bg-black/30 p-3 sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Policies</p>
                  <p className="mt-1 text-sm text-zinc-300">{dashboard.security.lockoutPolicy}</p>
                  <p className="text-sm text-zinc-300">{dashboard.security.rateLimitPolicy}</p>
                </article>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[760px] text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/35 text-left uppercase tracking-[0.12em] text-zinc-400">
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Client</th>
                      <th className="px-2 py-2">IP</th>
                      <th className="px-2 py-2">Result</th>
                      <th className="px-2 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.security.recentLoginAttempts.map((row, idx) => (
                      <tr key={`${row.clientId}-${row.attemptedAt}-${idx}`} className="border-b border-white/5">
                        <td className="px-2 py-2 text-zinc-300">{row.attemptedAt ? new Date(row.attemptedAt).toLocaleString() : "-"}</td>
                        <td className="max-w-[240px] truncate px-2 py-2 text-zinc-300" title={row.clientId}>{row.clientId || "-"}</td>
                        <td className="px-2 py-2 text-zinc-300">{row.ip || "-"}</td>
                        <td className={`px-2 py-2 font-bold ${row.success ? "text-emerald-300" : "text-red-300"}`}>
                          {row.success ? "SUCCESS" : "FAILED"}
                        </td>
                        <td className="px-2 py-2 text-zinc-300">{row.reason || "-"}</td>
                      </tr>
                    ))}
                    {dashboard.security.recentLoginAttempts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-2 py-3 text-zinc-400">No login attempts recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}
