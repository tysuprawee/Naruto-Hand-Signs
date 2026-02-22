"use client";

import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogIn,
  LogOut,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

import { supabase } from "@/utils/supabase";
import { OFFICIAL_JUTSUS } from "@/utils/jutsu-registry";
import { DEFAULT_FILTERS, type CalibrationProfile } from "@/utils/detection-filters";
import {
  createInitialProgression,
  getLevelFromXp,
  getXpForLevel,
  getRankForLevel,
  type ProgressionState,
} from "@/utils/progression";
import PlayArena, {
  type PlayArenaCompleteFeedback,
  type PlayArenaProof,
  type PlayArenaProofEvent,
  type PlayArenaResult,
} from "@/app/play/play-arena";

type PlayView =
  | "menu"
  | "mode_select"
  | "free_play"
  | "rank_mode"
  | "calibration_gate"
  | "calibration_session"
  | "free_session"
  | "rank_session"
  | "jutsu_library"
  | "multiplayer"
  | "quest_board"
  | "settings"
  | "tutorial"
  | "about";

type LibraryIntent = "browse" | "free" | "rank";

type QuestScope = "daily" | "weekly";
type DailyQuestId = "d_signs" | "d_jutsus" | "d_xp";
type WeeklyQuestId = "w_jutsus" | "w_challenges" | "w_xp";
type QuestId = DailyQuestId | WeeklyQuestId;

interface QuestProgress {
  progress: number;
  claimed: boolean;
}

interface DailyQuestBucket {
  period: string;
  quests: Record<DailyQuestId, QuestProgress>;
}

interface WeeklyQuestBucket {
  period: string;
  quests: Record<WeeklyQuestId, QuestProgress>;
}

interface QuestState {
  daily: DailyQuestBucket;
  weekly: WeeklyQuestBucket;
}

interface AuthIdentity {
  username: string;
  discordId: string;
}

interface QuestDefinition {
  scope: QuestScope;
  id: QuestId;
  title: string;
  target: number;
  reward: number;
}

interface TutorialStep {
  iconPath: string;
  title: string;
  lines: string[];
}

interface MenuSettingsState {
  musicVol: number;
  sfxVol: number;
  debugHands: boolean;
  restrictedSigns: boolean;
  cameraIdx: number;
  resolutionIdx: number;
  fullscreen: boolean;
}

interface TutorialMetaState {
  tutorialSeen: boolean;
  tutorialSeenAt: string | null;
  tutorialVersion: string;
}

interface MasteryInfo {
  bestTime: number;
}

type MasteryMap = Record<string, MasteryInfo>;

interface LevelUpPanelState {
  previousLevel: number;
  newLevel: number;
  rank: string;
  sourceLabel: string;
  unlocked: string[];
}

interface MasteryPanelState {
  jutsuName: string;
  previousBest: number | null;
  newBest: number;
  previousTier: "none" | "bronze" | "silver" | "gold";
  newTier: "none" | "bronze" | "silver" | "gold";
}

const SETTINGS_STORAGE_KEY = "jutsu-play-menu-settings-v1";
const WEB_APP_VERSION = "1.0.0";

interface RuntimeGateState {
  message: string;
  url: string;
  remoteVersion?: string;
}

interface AnnouncementRow {
  id: string;
  message: string;
  createdAt: string;
}

const DEFAULT_SETTINGS: MenuSettingsState = {
  musicVol: 0.5,
  sfxVol: 0.7,
  debugHands: true,
  restrictedSigns: true,
  cameraIdx: 0,
  resolutionIdx: 0,
  fullscreen: false,
};

const QUEST_DEFS: QuestDefinition[] = [
  { scope: "daily", id: "d_signs", title: "Land 25 correct signs", target: 25, reward: 120 },
  { scope: "daily", id: "d_jutsus", title: "Complete 5 jutsu runs", target: 5, reward: 180 },
  { scope: "daily", id: "d_xp", title: "Earn 450 XP", target: 450, reward: 250 },
  { scope: "weekly", id: "w_jutsus", title: "Complete 30 jutsu runs", target: 30, reward: 700 },
  { scope: "weekly", id: "w_challenges", title: "Finish 12 rank mode runs", target: 12, reward: 900 },
  { scope: "weekly", id: "w_xp", title: "Earn 4000 XP", target: 4000, reward: 1200 },
];

const JUTSU_TEXTURES: Record<string, string> = {
  "Shadow Clone": "/pics/textured_buttons/shadow_clone.jpg",
  Rasengan: "/pics/textured_buttons/rasengan.jpg",
  Fireball: "/pics/textured_buttons/fireball.jpg",
  "Phoenix Flower": "/pics/textured_buttons/phoenix_flowers.jpg",
  "Shadow Clone + Chidori Combo": "/pics/textured_buttons/shadow_clone_chidori.jpg",
  "Shadow Clone + Rasengan Combo": "/pics/textured_buttons/shadow_clone_rasengan.jpg",
  Chidori: "/pics/textured_buttons/chidori.jpg",
  "Water Dragon": "/pics/textured_buttons/water_dragon.jpg",
  Sharingan: "/pics/textured_buttons/sharingan.jpg",
};

const MASTERY_ICON_BY_TIER: Record<"none" | "bronze" | "silver" | "gold", string> = {
  none: "/pics/mastery/locked_badge.png",
  bronze: "/pics/mastery/bronze_badge.png",
  silver: "/pics/mastery/silver_badge.png",
  gold: "/pics/mastery/gold_badge.png",
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    iconPath: "/pics/tutorial/step_camera.png",
    title: "Setup Your Camera",
    lines: [
      "Open Settings and choose your camera device.",
      "Enable preview to verify framing and lighting.",
      "Keep both hands visible in the camera panel.",
    ],
  },
  {
    iconPath: "/pics/tutorial/step_signs.png",
    title: "Perform Signs In Order",
    lines: [
      "Follow the sign sequence shown at the bottom.",
      "Each correct sign advances your combo step.",
      "Stable lighting improves landmark recognition.",
    ],
  },
  {
    iconPath: "/pics/tutorial/step_execute.png",
    title: "Execute The Jutsu",
    lines: [
      "Complete all signs to trigger the jutsu effect.",
      "You earn XP for successful completions.",
      "Level up to unlock higher-tier jutsu.",
    ],
  },
  {
    iconPath: "/pics/tutorial/step_challenge.png",
    title: "Rank Mode And Progress",
    lines: [
      "Use Rank Mode for timed runs and leaderboard ranking.",
      "Visit Quest Board for daily and weekly XP rewards.",
      "Master each jutsu to reach Bronze, Silver, and Gold tiers.",
    ],
  },
];

const ABOUT_SECTIONS: Array<{ title: string; lines: string[]; tone?: "accent" | "success" | "error" }> = [
  {
    title: "Overview",
    tone: "success",
    lines: [
      "Jutsu Academy is a Naruto-inspired hand-sign training game where players perform sign sequences in front of a camera to execute jutsu.",
      "The game focuses on timing, recognition accuracy, progression unlocks, and fast iteration between free practice and rank mode runs.",
    ],
  },
  {
    title: "Modes",
    lines: [
      "Free Play: pick any unlocked jutsu and practice at your pace.",
      "Rank Mode: clear the full sequence as fast as possible.",
      "Jutsu Library: browse tiers, lock requirements, and progression status.",
      "Leaderboard: compare rank mode times against other players.",
    ],
  },
  {
    title: "Controls",
    tone: "accent",
    lines: [
      "Menu navigation: mouse or touch input.",
      "Playing: LEFT and RIGHT arrows switch jutsu when allowed.",
      "Rank Mode: SPACE starts countdown and restarts after results.",
      "Exit current run: ESC or the in-game BACK button.",
    ],
  },
  {
    title: "Privacy And Data",
    lines: [
      "Camera frames are processed locally for sign detection and effects.",
      "Raw camera frames are not uploaded.",
      "Discord login is used for account identity and progression sync.",
    ],
  },
  {
    title: "Legal Notice",
    tone: "error",
    lines: [
      "This is a non-profit fan-made project for educational and portfolio use.",
      "Naruto and related names or characters are property of their respective rights holders.",
      "This project is not affiliated with or endorsed by official rights holders.",
    ],
  },
];

function clampVolume(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function sanitizeSettings(raw: Partial<MenuSettingsState> | null | undefined): MenuSettingsState {
  return {
    musicVol: clampVolume(raw?.musicVol, DEFAULT_SETTINGS.musicVol),
    sfxVol: clampVolume(raw?.sfxVol, DEFAULT_SETTINGS.sfxVol),
    debugHands: typeof raw?.debugHands === "boolean" ? raw.debugHands : DEFAULT_SETTINGS.debugHands,
    restrictedSigns: true,
    cameraIdx: clampInt(raw?.cameraIdx, 0, 16, DEFAULT_SETTINGS.cameraIdx),
    resolutionIdx: clampInt(raw?.resolutionIdx, 0, 2, DEFAULT_SETTINGS.resolutionIdx),
    fullscreen: typeof raw?.fullscreen === "boolean" ? raw.fullscreen : DEFAULT_SETTINGS.fullscreen,
  };
}

function readStoredSettings(): MenuSettingsState {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<MenuSettingsState>;
    return sanitizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstNonEmpty(...values: unknown[]): string {
  for (const raw of values) {
    const value = String(raw || "").trim();
    if (value) return value;
  }
  return "";
}

function normalizeDiscordUsername(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  const withoutAt = value.startsWith("@") ? value.slice(1).trim() : value;
  const tagged = withoutAt.match(/^(.+?)#\d{1,5}$/);
  const normalized = (tagged ? tagged[1] : withoutAt).trim();
  return normalized;
}

function pickDiscordUsername(...values: unknown[]): string {
  for (const raw of values) {
    const value = normalizeDiscordUsername(raw);
    if (value) return value;
  }
  return "";
}

function looksLikeDiscordSnowflake(raw: unknown): boolean {
  return /^[0-9]{15,22}$/.test(String(raw || "").trim());
}

function pickDiscordId(...values: unknown[]): string {
  const cleaned = values
    .map((raw) => String(raw || "").trim())
    .filter(Boolean);
  const snowflake = cleaned.find((value) => looksLikeDiscordSnowflake(value));
  return snowflake || cleaned[0] || "";
}

function resolveSessionIdentity(session: Session | null): AuthIdentity | null {
  const user = session?.user;
  if (!user) return null;

  const metadata = isRecord(user.user_metadata) ? user.user_metadata : {};
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const discordIdentity = identities.find((entry) => String(entry?.provider || "").toLowerCase() === "discord");
  const identityData = isRecord(discordIdentity?.identity_data) ? discordIdentity.identity_data : {};

  const username = pickDiscordUsername(
    identityData.username,
    metadata.username,
    metadata.preferred_username,
    metadata.user_name,
    metadata.name,
    metadata.full_name,
    String(user.email || "").split("@")[0],
  );
  const discordId = pickDiscordId(
    identityData.user_id,
    identityData.id,
    metadata.provider_id,
    identityData.sub,
    metadata.sub,
    discordIdentity?.id,
  );

  if (!username || !discordId) return null;
  return { username, discordId };
}

function getDiscordDisplayName(session: Session | null, identity: AuthIdentity | null): string {
  if (identity?.username) return identity.username;
  const user = session?.user;
  const metadata = isRecord(user?.user_metadata) ? user.user_metadata : {};
  const fallback = pickDiscordUsername(
    metadata.username,
    metadata.preferred_username,
    metadata.user_name,
    metadata.full_name,
    metadata.name,
    String(user?.email || "").split("@")[0],
  );
  return fallback || "Shinobi";
}

function getDiscordAvatar(session: Session | null): string | null {
  const metadata = isRecord(session?.user?.user_metadata) ? session.user.user_metadata : {};
  const value = firstNonEmpty(metadata.avatar_url, metadata.picture);
  return value || null;
}

function toggleFullscreen(enabled: boolean): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const doc = document as Document & {
    webkitExitFullscreen?: () => void;
  };

  if (enabled) {
    if (document.fullscreenElement) return;
    if (root.requestFullscreen) {
      void root.requestFullscreen().catch(() => {});
      return;
    }
    if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
    return;
  }

  if (!document.fullscreenElement) return;
  if (doc.exitFullscreen) {
    void doc.exitFullscreen().catch(() => {});
    return;
  }
  if (doc.webkitExitFullscreen) {
    doc.webkitExitFullscreen();
  }
}

function startOfTomorrowUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
}

function nextWeeklyResetUtc(now: Date): Date {
  const day = now.getUTCDay();
  const mondayBased = (day + 6) % 7; // Mon=0 ... Sun=6
  const daysUntilNextMonday = 7 - mondayBased;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilNextMonday, 0, 0, 0));
}

function utcIsoWeekId(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function utcDailyId(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function parseMaybeMessageList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  }
  const text = String(raw || "").trim();
  if (!text) return [];
  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((value) => String(value || "").trim()).filter(Boolean);
      }
    } catch {
      // Ignore malformed list payload and fallback to plain text.
    }
  }
  return [text];
}

function createDefaultQuestState(now: Date): QuestState {
  return {
    daily: {
      period: utcDailyId(now),
      quests: {
        d_signs: { progress: 0, claimed: false },
        d_jutsus: { progress: 0, claimed: false },
        d_xp: { progress: 0, claimed: false },
      },
    },
    weekly: {
      period: utcIsoWeekId(now),
      quests: {
        w_jutsus: { progress: 0, claimed: false },
        w_challenges: { progress: 0, claimed: false },
        w_xp: { progress: 0, claimed: false },
      },
    },
  };
}

function sanitizeProgression(raw: unknown): ProgressionState {
  const base = createInitialProgression();
  if (!isRecord(raw)) return base;
  const source = raw;

  const xp = Math.max(0, Math.floor(Number(source.xp) || 0));
  const levelFromPayload = Math.max(0, Math.floor(Number(source.level) || 0));
  const level = levelFromPayload > 0 ? levelFromPayload : getLevelFromXp(xp);
  const rankRaw = String(source.rank || "").trim();

  return {
    xp,
    level,
    rank: rankRaw || getRankForLevel(level),
    totalSigns: Math.max(0, Math.floor(Number(source.total_signs ?? source.totalSigns) || 0)),
    totalJutsus: Math.max(0, Math.floor(Number(source.total_jutsus ?? source.totalJutsus) || 0)),
    fastestCombo: Math.max(0, Number(source.fastest_combo ?? source.fastestCombo) || 99),
  };
}

function sanitizeQuestState(raw: unknown, now: Date): QuestState {
  const base = createDefaultQuestState(now);
  if (!isRecord(raw)) return base;
  const source = raw as Partial<QuestState>;

  const result: QuestState = {
    daily: {
      period: String(source.daily?.period || base.daily.period),
      quests: {
        d_signs: {
          progress: Math.max(0, Math.floor(Number(source.daily?.quests?.d_signs?.progress) || 0)),
          claimed: Boolean(source.daily?.quests?.d_signs?.claimed),
        },
        d_jutsus: {
          progress: Math.max(0, Math.floor(Number(source.daily?.quests?.d_jutsus?.progress) || 0)),
          claimed: Boolean(source.daily?.quests?.d_jutsus?.claimed),
        },
        d_xp: {
          progress: Math.max(0, Math.floor(Number(source.daily?.quests?.d_xp?.progress) || 0)),
          claimed: Boolean(source.daily?.quests?.d_xp?.claimed),
        },
      },
    },
    weekly: {
      period: String(source.weekly?.period || base.weekly.period),
      quests: {
        w_jutsus: {
          progress: Math.max(0, Math.floor(Number(source.weekly?.quests?.w_jutsus?.progress) || 0)),
          claimed: Boolean(source.weekly?.quests?.w_jutsus?.claimed),
        },
        w_challenges: {
          progress: Math.max(0, Math.floor(Number(source.weekly?.quests?.w_challenges?.progress) || 0)),
          claimed: Boolean(source.weekly?.quests?.w_challenges?.claimed),
        },
        w_xp: {
          progress: Math.max(0, Math.floor(Number(source.weekly?.quests?.w_xp?.progress) || 0)),
          claimed: Boolean(source.weekly?.quests?.w_xp?.claimed),
        },
      },
    },
  };
  return result;
}

function sanitizeTutorialMeta(raw: unknown): TutorialMetaState {
  if (!isRecord(raw)) {
    return {
      tutorialSeen: false,
      tutorialSeenAt: null,
      tutorialVersion: "1.0",
    };
  }
  return {
    tutorialSeen: Boolean(raw.tutorial_seen ?? raw.tutorialSeen),
    tutorialSeenAt: String(raw.tutorial_seen_at ?? raw.tutorialSeenAt ?? "").trim() || null,
    tutorialVersion: String(raw.tutorial_version ?? raw.tutorialVersion ?? "1.0").trim() || "1.0",
  };
}

function sanitizeMasteryMap(raw: unknown): MasteryMap {
  if (!isRecord(raw)) return {};
  const out: MasteryMap = {};
  for (const [nameRaw, row] of Object.entries(raw)) {
    const name = String(nameRaw || "").trim();
    if (!name) continue;
    const best = isRecord(row) ? Number(row.best_time ?? row.bestTime) : Number(row);
    if (!Number.isFinite(best) || best <= 0) continue;
    out[name] = { bestTime: best };
  }
  return out;
}

function sanitizeCalibrationProfileState(raw: unknown): CalibrationProfile {
  const source = isRecord(raw) ? raw : {};
  return {
    version: clampInt(source.version, 1, 99, DEFAULT_FILTERS.version),
    samples: clampInt(source.samples, 0, 20000, DEFAULT_FILTERS.samples),
    updatedAt: String(source.updated_at ?? source.updatedAt ?? ""),
    lightingMin: Math.max(25, Math.min(120, Number(source.lighting_min ?? source.lightingMin) || DEFAULT_FILTERS.lightingMin)),
    lightingMax: Math.max(120, Math.min(245, Number(source.lighting_max ?? source.lightingMax) || DEFAULT_FILTERS.lightingMax)),
    lightingMinContrast: Math.max(10, Math.min(80, Number(source.lighting_min_contrast ?? source.lightingMinContrast) || DEFAULT_FILTERS.lightingMinContrast)),
    voteMinConfidence: Math.max(0.2, Math.min(0.9, Number(source.vote_min_confidence ?? source.voteMinConfidence) || DEFAULT_FILTERS.voteMinConfidence)),
    voteRequiredHits: clampInt(
      source.vote_required_hits ?? source.voteRequiredHits,
      2,
      3,
      DEFAULT_FILTERS.voteRequiredHits,
    ),
  };
}

function createDefaultCalibrationProfile(): CalibrationProfile {
  return {
    ...DEFAULT_FILTERS,
    updatedAt: "",
  };
}

function hasCalibrationProfile(profile: CalibrationProfile | null): boolean {
  return Boolean(profile && (profile.samples > 0 || profile.updatedAt));
}

function getMasteryThresholds(jutsuName: string): { bronze: number; silver: number; gold: number } {
  const seqLen = Math.max(1, OFFICIAL_JUTSUS[jutsuName]?.sequence?.length || 1);
  return {
    bronze: seqLen * 4.0,
    silver: seqLen * 2.8,
    gold: seqLen * 2.0,
  };
}

function getMasteryTier(
  jutsuName: string,
  bestTime: number | null | undefined,
): "none" | "bronze" | "silver" | "gold" {
  if (!Number.isFinite(Number(bestTime)) || Number(bestTime) <= 0) return "none";
  const t = getMasteryThresholds(jutsuName);
  const best = Number(bestTime);
  if (best <= t.gold) return "gold";
  if (best <= t.silver) return "silver";
  if (best <= t.bronze) return "bronze";
  return "none";
}

function getRunXpGain(jutsuName: string): number {
  const seqLen = Math.max(1, OFFICIAL_JUTSUS[jutsuName]?.sequence?.length || 1);
  return 50 + (seqLen * 10);
}

function normalizeSignToken(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function getUnlockedJutsusBetweenLevels(previousLevel: number, newLevel: number): string[] {
  if (newLevel <= previousLevel) return [];
  return Object.entries(OFFICIAL_JUTSUS)
    .filter(([, cfg]) => cfg.minLevel > previousLevel && cfg.minLevel <= newLevel)
    .sort((a, b) => a[1].minLevel - b[1].minLevel || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const data = new TextEncoder().encode(input);
    const hash = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, "0");
}

interface RankProofValidationResult {
  ok: boolean;
  reason: string;
  detail: string;
  events: PlayArenaProofEvent[];
  signOkCount: number;
  runStartSec: number;
  runFinishSec: number;
  lastSignSec: number;
}

function sanitizeProofEvents(rawEvents: unknown): PlayArenaProofEvent[] {
  if (!Array.isArray(rawEvents)) return [];
  const out: PlayArenaProofEvent[] = [];
  for (const raw of rawEvents) {
    if (!isRecord(raw)) continue;
    const t = Number(raw.t);
    const type = String(raw.type || "").trim();
    if (!Number.isFinite(t) || !type) continue;

    const event: PlayArenaProofEvent = {
      t: Number(t.toFixed(3)),
      type: type.slice(0, 48),
    };

    let extraCount = 0;
    for (const [keyRaw, value] of Object.entries(raw)) {
      if (keyRaw === "t" || keyRaw === "type") continue;
      if (extraCount >= 16) break;
      const key = String(keyRaw || "").trim();
      if (!key || key.length > 36) continue;

      if (typeof value === "number") {
        if (!Number.isFinite(value)) continue;
        event[key] = Number(value.toFixed(4));
        extraCount += 1;
        continue;
      }
      if (typeof value === "boolean") {
        event[key] = value;
        extraCount += 1;
        continue;
      }
      if (typeof value === "string") {
        event[key] = value.slice(0, 140);
        extraCount += 1;
        continue;
      }
      if (value === null) {
        event[key] = null;
        extraCount += 1;
      }
    }

    out.push(event);
    if (out.length >= 260) break;
  }
  return out;
}

function validateRankProofClient(result: PlayArenaResult): RankProofValidationResult {
  const proof = result.proof as PlayArenaProof | undefined;
  const events = sanitizeProofEvents(proof?.events);

  const fail = (reason: string, detail: string): RankProofValidationResult => ({
    ok: false,
    reason,
    detail,
    events,
    signOkCount: 0,
    runStartSec: 0,
    runFinishSec: 0,
    lastSignSec: 0,
  });

  if (!proof) {
    return fail("missing_proof", "No proof payload was provided by the arena.");
  }
  if (events.length === 0) {
    return fail("missing_events", "Run proof did not contain any valid events.");
  }
  if (events.length > 256 && !proof.eventOverflow) {
    return fail("event_limit_exceeded", "Event list exceeded limit without overflow marker.");
  }

  const expectedSigns = Math.max(0, Math.floor(Number(result.expectedSigns) || 0));
  if (expectedSigns <= 0) {
    return fail("invalid_expected_signs", "Expected sign count is missing.");
  }

  const jutsuSequence = (OFFICIAL_JUTSUS[result.jutsuName]?.sequence ?? []).map((sign) => normalizeSignToken(sign));
  if (jutsuSequence.length > 0 && jutsuSequence.length !== expectedSigns) {
    return fail("jutsu_sequence_mismatch", "Result sign count does not match configured jutsu sequence.");
  }

  const startedAtMs = Date.parse(String(proof.clientStartedAtIso || ""));
  if (!Number.isFinite(startedAtMs)) {
    return fail("invalid_started_at", "Missing or invalid run start timestamp.");
  }
  const nowMs = Date.now();
  if (startedAtMs > (nowMs + 60_000)) {
    return fail("started_in_future", "Run start timestamp is in the future.");
  }
  if ((nowMs - startedAtMs) > (2 * 60 * 60 * 1000)) {
    return fail("stale_run", "Run start timestamp is too old.");
  }

  const cooldownMs = Number(proof.cooldownMs);
  if (!Number.isFinite(cooldownMs) || cooldownMs < 120 || cooldownMs > 1200) {
    return fail("cooldown_out_of_range", "Proof cooldown is outside expected range.");
  }
  const voteRequiredHits = Math.floor(Number(proof.voteRequiredHits));
  if (voteRequiredHits < 2 || voteRequiredHits > 3) {
    return fail("vote_hits_out_of_range", "Vote hits requirement is outside expected range.");
  }
  const voteMinConfidence = Number(proof.voteMinConfidence);
  if (!Number.isFinite(voteMinConfidence) || voteMinConfidence < 0.2 || voteMinConfidence > 0.95) {
    return fail("vote_confidence_out_of_range", "Vote confidence threshold is outside expected range.");
  }

  const modeLabel = String(result.jutsuName || "").trim().toUpperCase();
  let prevT = -0.001;
  let runStartIdx = -1;
  let runStartSec = 0;
  let runFinishIdx = -1;
  let runFinishSec = 0;
  let runFinishCount = 0;
  let signOkCount = 0;
  let lastSignSec = 0;
  let sawOverflowMarker = false;

  for (let idx = 0; idx < events.length; idx += 1) {
    const event = events[idx];
    const t = Number(event.t);
    if (!Number.isFinite(t) || t < -0.001) {
      return fail("invalid_event_time", `Event ${idx + 1} has invalid timestamp.`);
    }
    if (t + 0.015 < prevT) {
      return fail("non_monotonic_time", "Proof timestamps are not monotonic.");
    }
    prevT = Math.max(prevT, t);

    const type = String(event.type || "").trim();
    if (!type) {
      return fail("invalid_event_type", `Event ${idx + 1} is missing type.`);
    }

    if (type === "run_start") {
      if (runStartIdx !== -1) {
        return fail("duplicate_run_start", "Proof contains multiple run_start events.");
      }
      runStartIdx = idx;
      runStartSec = Math.max(0, t);

      const eventMode = String(event.mode || "").trim().toUpperCase();
      if (eventMode && eventMode !== modeLabel) {
        return fail("mode_mismatch", "run_start mode does not match selected jutsu.");
      }
      const eventExpectedSigns = Math.floor(Number(event.expected_signs));
      if (Number.isFinite(eventExpectedSigns) && eventExpectedSigns > 0 && eventExpectedSigns !== expectedSigns) {
        return fail("expected_signs_mismatch", "run_start expected_signs mismatched result payload.");
      }
      continue;
    }

    if (type === "event_overflow") {
      sawOverflowMarker = true;
      continue;
    }

    if (type === "sign_ok") {
      if (runStartIdx === -1 || idx < runStartIdx) {
        return fail("sign_before_start", "sign_ok was recorded before run_start.");
      }
      const step = Math.floor(Number(event.step));
      if (step !== signOkCount + 1) {
        return fail("sign_step_mismatch", "sign_ok step sequence is invalid.");
      }

      const sign = normalizeSignToken(event.sign);
      if (!sign) {
        return fail("sign_missing", "sign_ok event did not include a sign token.");
      }
      if (jutsuSequence.length >= step && sign !== jutsuSequence[step - 1]) {
        return fail("sign_sequence_mismatch", "sign_ok did not match jutsu sequence.");
      }

      if (signOkCount > 0) {
        const minGap = Math.max(0.05, (cooldownMs / 1000) * 0.5);
        if ((t - lastSignSec) + 0.001 < minGap) {
          return fail("sign_gap_too_short", "sign_ok cadence is faster than cooldown allows.");
        }
      }

      signOkCount += 1;
      lastSignSec = t;
      continue;
    }

    if (type === "run_finish") {
      if (runStartIdx === -1 || idx < runStartIdx) {
        return fail("finish_before_start", "run_finish was recorded before run_start.");
      }
      runFinishCount += 1;
      runFinishIdx = idx;
      runFinishSec = Math.max(0, t);
    }
  }

  if (runStartIdx === -1) {
    return fail("missing_run_start", "Proof did not include run_start.");
  }
  if (runFinishCount !== 1 || runFinishIdx === -1) {
    return fail("invalid_run_finish", "Proof must contain exactly one run_finish.");
  }
  if (signOkCount !== expectedSigns) {
    return fail("insufficient_sign_events", `Expected ${expectedSigns} sign_ok events but received ${signOkCount}.`);
  }
  if (runFinishSec + 0.001 < lastSignSec) {
    return fail("finish_before_last_sign", "run_finish occurred before final sign event.");
  }
  if (proof.eventOverflow && !sawOverflowMarker && events.length >= 256) {
    return fail("overflow_marker_missing", "Proof overflow flag set without overflow marker event.");
  }

  const elapsedSeconds = Number(result.elapsedSeconds || 0);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return fail("invalid_elapsed_time", "Result elapsed time is invalid.");
  }
  if (Math.abs(runFinishSec - elapsedSeconds) > 1.15) {
    return fail("finish_time_mismatch", "run_finish timing mismatched result elapsed time.");
  }

  return {
    ok: true,
    reason: "",
    detail: "",
    events,
    signOkCount,
    runStartSec,
    runFinishSec,
    lastSignSec,
  };
}

function hasProgressionShape(payload: Record<string, unknown>): boolean {
  return [
    "xp",
    "level",
    "rank",
    "total_signs",
    "totalSigns",
    "total_jutsus",
    "totalJutsus",
    "fastest_combo",
    "fastestCombo",
  ].some((key) => Object.prototype.hasOwnProperty.call(payload, key));
}

function hasQuestShape(payload: Record<string, unknown>): boolean {
  return isRecord(payload.daily) && isRecord(payload.weekly);
}

function toRpcError(prefix: string, payload: Record<string, unknown>): string {
  const reason = String(payload.reason || "rpc_failed").trim();
  const detail = String(payload.detail || "").trim();
  if (detail) return `${prefix}: ${reason} (${detail})`;
  return `${prefix}: ${reason}`;
}

function LockedPanel({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-7 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
      <h2 className="text-3xl font-black tracking-tight text-white">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ninja-dim">{description}</p>

      <a
        href="https://discord.gg/7xBQ22SnN2"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-6 text-sm font-black text-indigo-200 hover:bg-indigo-500/25"
      >
        JOIN DISCORD FOR UPDATES
      </a>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 flex h-12 w-full items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-sm font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40"
      >
        BACK TO SELECT PATH
      </button>
    </div>
  );
}

export default function PlayPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(
    !supabase
      ? "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      : "",
  );

  const [view, setView] = useState<PlayView>("menu");
  const [libraryIntent, setLibraryIntent] = useState<LibraryIntent>("browse");
  const [selectedJutsu, setSelectedJutsu] = useState<string>(Object.keys(OFFICIAL_JUTSUS)[0] || "");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [questNotice, setQuestNotice] = useState("");
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [serverClockSynced, setServerClockSynced] = useState(false);
  const [maintenanceGate, setMaintenanceGate] = useState<RuntimeGateState | null>(null);
  const [updateGate, setUpdateGate] = useState<RuntimeGateState | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [cameraOptions, setCameraOptions] = useState<Array<{ idx: number; label: string; deviceId: string }>>([]);
  const [cameraScanBusy, setCameraScanBusy] = useState(false);
  const [settingsPreviewEnabled, setSettingsPreviewEnabled] = useState(false);
  const [settingsPreviewError, setSettingsPreviewError] = useState("");
  const settingsPreviewRef = useRef<HTMLVideoElement | null>(null);
  const settingsPreviewStreamRef = useRef<MediaStream | null>(null);
  const announcementDigestRef = useRef("");
  const welcomeShownRef = useRef(false);

  const [savedSettings, setSavedSettings] = useState<MenuSettingsState>(() => readStoredSettings());
  const [draftSettings, setDraftSettings] = useState<MenuSettingsState>(() => readStoredSettings());
  const [progression, setProgression] = useState<ProgressionState>(() => createInitialProgression());
  const [questState, setQuestState] = useState<QuestState>(() => createDefaultQuestState(new Date()));
  const [mastery, setMastery] = useState<MasteryMap>({});
  const [tutorialMeta, setTutorialMeta] = useState<TutorialMetaState>({
    tutorialSeen: false,
    tutorialSeenAt: null,
    tutorialVersion: "1.0",
  });
  const [calibrationProfile, setCalibrationProfile] = useState<CalibrationProfile>(() => createDefaultCalibrationProfile());
  const [calibrationReturnView, setCalibrationReturnView] = useState<"free_play" | "rank_mode" | "settings">("free_play");
  const [stateReady, setStateReady] = useState(false);
  const [stateBusy, setStateBusy] = useState(false);
  const [stateError, setStateError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [claimBusyKey, setClaimBusyKey] = useState("");
  const [identityLinked, setIdentityLinked] = useState(false);
  const [levelUpPanel, setLevelUpPanel] = useState<LevelUpPanelState | null>(null);
  const [masteryPanel, setMasteryPanel] = useState<MasteryPanelState | null>(null);

  const identity = useMemo(() => resolveSessionIdentity(session), [session]);
  const username = useMemo(() => getDiscordDisplayName(session, identity), [session, identity]);
  const avatarUrl = useMemo(() => getDiscordAvatar(session), [session]);
  const visibleStateError = stateError || (
    session && !identity
      ? "Discord identity is missing required username/id fields. Re-login and retry."
      : ""
  );

  const now = new Date(clockNowMs + serverOffsetMs);
  const dailyResetAt = startOfTomorrowUtc(now);
  const weeklyResetAt = nextWeeklyResetUtc(now);
  const calibrationReady = hasCalibrationProfile(calibrationProfile);
  const needsCalibrationGate = Boolean(session && identityLinked && !calibrationReady);

  const jutsuTiers = useMemo(() => {
    const entries = Object.entries(OFFICIAL_JUTSUS).sort((a, b) => a[1].minLevel - b[1].minLevel || a[0].localeCompare(b[0]));
    return [
      {
        title: "Academy Tier",
        items: entries.filter(([, config]) => config.minLevel >= 0 && config.minLevel <= 2),
      },
      {
        title: "Genin Tier",
        items: entries.filter(([, config]) => config.minLevel >= 3 && config.minLevel <= 5),
      },
      {
        title: "Chunin Tier",
        items: entries.filter(([, config]) => config.minLevel >= 6 && config.minLevel <= 10),
      },
      {
        title: "Jonin+ Tier",
        items: entries.filter(([, config]) => config.minLevel >= 11),
      },
    ].filter((tier) => tier.items.length > 0);
  }, []);

  const selectedJutsuConfig = OFFICIAL_JUTSUS[selectedJutsu] || null;
  const selectedJutsuUnlocked = Boolean(selectedJutsuConfig && progression.level >= selectedJutsuConfig.minLevel);
  const orderedJutsuNames = useMemo(() => (
    Object.entries(OFFICIAL_JUTSUS)
      .sort((a, b) => a[1].minLevel - b[1].minLevel || a[0].localeCompare(b[0]))
      .map(([name]) => name)
  ), []);
  const unlockedJutsuNames = useMemo(
    () => orderedJutsuNames.filter((name) => progression.level >= OFFICIAL_JUTSUS[name].minLevel),
    [orderedJutsuNames, progression.level],
  );
  const nextLevelXpTarget = getXpForLevel(Math.max(1, progression.level + 1));

  const applyCompetitivePayload = useCallback((payload: Record<string, unknown>) => {
    const profilePayload = isRecord(payload.profile) ? payload.profile : payload;
    if (hasProgressionShape(profilePayload)) {
      setProgression(sanitizeProgression(profilePayload));
    }

    if (isRecord(profilePayload.mastery)) {
      setMastery(sanitizeMasteryMap(profilePayload.mastery));
    }
    const nextTutorial = sanitizeTutorialMeta(profilePayload);
    setTutorialMeta(nextTutorial);
    if (isRecord(profilePayload.calibration_profile ?? profilePayload.calibrationProfile)) {
      const source = (profilePayload.calibration_profile ?? profilePayload.calibrationProfile) as Record<string, unknown>;
      setCalibrationProfile(sanitizeCalibrationProfileState(source));
    }

    if (isRecord(payload.quests)) {
      setQuestState(sanitizeQuestState(payload.quests, new Date()));
    } else if (hasQuestShape(payload)) {
      setQuestState(sanitizeQuestState(payload, new Date()));
    }
  }, []);

  const callRpc = useCallback(async (rpcName: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (!supabase) return { ok: false, reason: "offline", rpc: rpcName };
    const { data, error } = await supabase.rpc(rpcName, payload);
    if (error) {
      return {
        ok: false,
        reason: "rpc_error",
        detail: error.message,
        rpc: rpcName,
      };
    }
    if (isRecord(data)) return data;
    if (Array.isArray(data) && data.length > 0 && isRecord(data[0])) return data[0];
    return {
      ok: false,
      reason: "rpc_invalid_response",
      rpc: rpcName,
    };
  }, []);

  const playUiSfx = useCallback((src: string, scale = 1) => {
    if (typeof window === "undefined") return;
    try {
      const audio = new Audio(src);
      audio.volume = Math.max(0, Math.min(1, savedSettings.sfxVol * scale));
      void audio.play().catch(() => {});
    } catch {
      // Ignore autoplay errors.
    }
  }, [savedSettings.sfxVol]);

  const handleCycleSelectedJutsu = useCallback((direction: -1 | 1) => {
    if (unlockedJutsuNames.length === 0) return;
    const currentIndex = Math.max(0, unlockedJutsuNames.indexOf(selectedJutsu));
    const nextIndex = (currentIndex + direction + unlockedJutsuNames.length) % unlockedJutsuNames.length;
    const nextJutsu = unlockedJutsuNames[nextIndex];
    if (!nextJutsu || nextJutsu === selectedJutsu) return;
    setSelectedJutsu(nextJutsu);
    playUiSfx("/sounds/each.mp3", 0.45);
  }, [playUiSfx, selectedJutsu, unlockedJutsuNames]);

  const stopSettingsPreview = useCallback(() => {
    const stream = settingsPreviewStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      settingsPreviewStreamRef.current = null;
    }
    if (settingsPreviewRef.current) {
      settingsPreviewRef.current.srcObject = null;
    }
  }, []);

  const scanCameras = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    setCameraScanBusy(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, idx) => ({
          idx,
          label: String(device.label || `Camera ${idx}`),
          deviceId: String(device.deviceId || ""),
        }));
      setCameraOptions(cams);
      if (cams.length > 0) {
        setDraftSettings((prev) => ({
          ...prev,
          cameraIdx: Math.max(0, Math.min(prev.cameraIdx, cams.length - 1)),
        }));
      }
      setSettingsPreviewError("");
    } catch (err) {
      setSettingsPreviewError(String((err as Error)?.message || "Unable to scan camera devices."));
    } finally {
      setCameraScanBusy(false);
    }
  }, []);

  const startSettingsPreview = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    stopSettingsPreview();
    setSettingsPreviewError("");
    try {
      const selected = cameraOptions[Math.max(0, Math.floor(draftSettings.cameraIdx))];
      const resolutionMap: Array<{ width: number; height: number }> = [
        { width: 640, height: 480 },
        { width: 1280, height: 720 },
        { width: 1920, height: 1080 },
      ];
      const res = resolutionMap[Math.max(0, Math.min(2, Math.floor(draftSettings.resolutionIdx)))] || resolutionMap[0];
      const constraints: MediaTrackConstraints = {
        width: { ideal: res.width },
        height: { ideal: res.height },
        facingMode: "user",
      };
      if (selected?.deviceId) {
        constraints.deviceId = { exact: selected.deviceId };
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
      settingsPreviewStreamRef.current = stream;
      if (settingsPreviewRef.current) {
        settingsPreviewRef.current.srcObject = stream;
        await settingsPreviewRef.current.play();
      }
    } catch (err) {
      stopSettingsPreview();
      setSettingsPreviewError(String((err as Error)?.message || "Unable to start camera preview."));
    }
  }, [cameraOptions, draftSettings.cameraIdx, draftSettings.resolutionIdx, stopSettingsPreview]);

  const pollRuntimeConfig = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("app_config")
        .select("id,type,message,version,is_active,priority,created_at,url,link")
        .in("type", ["announcement", "version", "maintenance"])
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) {
        throw new Error(error.message);
      }

      const rows = Array.isArray(data) ? data : [];
      const maintenanceRows = rows.filter((row) => String((row as { type?: string }).type || "") === "maintenance");
      if (maintenanceRows.length > 0) {
        const latest = maintenanceRows[0] as Record<string, unknown>;
        const message = parseMaybeMessageList(latest.message)[0]
          || "Jutsu Academy is under maintenance. Please try again later.";
        const url = String(latest.url || latest.link || "https://discord.gg/7xBQ22SnN2");
        setMaintenanceGate({ message, url });
      } else {
        setMaintenanceGate(null);
      }

      const versionRows = rows.filter((row) => String((row as { type?: string }).type || "") === "version");
      if (versionRows.length > 0) {
        const latest = versionRows[0] as Record<string, unknown>;
        const remoteVersion = String(latest.version || "").trim();
        if (remoteVersion && remoteVersion !== WEB_APP_VERSION) {
          const message = parseMaybeMessageList(latest.message)[0] || "A mandatory update is required.";
          const url = String(latest.url || latest.link || "https://discord.gg/7xBQ22SnN2");
          setUpdateGate({ message, url, remoteVersion });
        } else {
          setUpdateGate(null);
        }
      } else {
        setUpdateGate(null);
      }

      const flattened: AnnouncementRow[] = [];
      for (const row of rows) {
        const record = row as Record<string, unknown>;
        if (String(record.type || "") !== "announcement") continue;
        const messages = parseMaybeMessageList(record.message);
        for (const message of messages) {
          flattened.push({
            id: `${String(record.id || "ann")}-${flattened.length}`,
            message,
            createdAt: String(record.created_at || ""),
          });
        }
      }
      setAnnouncements(flattened);
      const digest = flattened.map((item) => item.id).join("|");
      if (flattened.length === 0) {
        announcementDigestRef.current = "";
        setShowAnnouncements(false);
      } else if (
        digest
        && digest !== announcementDigestRef.current
        && !maintenanceRows.length
      ) {
        announcementDigestRef.current = digest;
        setShowAnnouncements(true);
        setAnnouncementIndex(0);
      }
    } catch {
      // Fallback mode: keep gameplay available even if app_config polling fails.
    }
  }, []);

  const syncServerTimeOffset = useCallback(async () => {
    if (typeof window === "undefined") return;
    const baseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    if (!baseUrl) return;

    const endpoints = [baseUrl, `${baseUrl.replace(/\/$/, "")}/rest/v1/`];
    for (const endpoint of endpoints) {
      try {
        const head = await fetch(endpoint, {
          method: "HEAD",
          cache: "no-store",
          headers: { apikey: String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "") },
        });
        let dateHeader = head.headers.get("date");
        if (!dateHeader) {
          const getRes = await fetch(endpoint, {
            method: "GET",
            cache: "no-store",
            headers: { apikey: String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "") },
          });
          dateHeader = getRes.headers.get("date");
        }
        if (!dateHeader) continue;
        const serverTime = new Date(dateHeader).getTime();
        if (!Number.isFinite(serverTime)) continue;
        setServerOffsetMs(serverTime - Date.now());
        setServerClockSynced(true);
        return;
      } catch {
        // Try fallback endpoint.
      }
    }
  }, []);

  const bootstrapAuthoritativeProfile = useCallback(async (targetIdentity: AuthIdentity) => {
    return callRpc("upsert_profile_guarded_bound", {
      p_username: targetIdentity.username,
      p_discord_id: targetIdentity.discordId,
      p_xp: 0,
      p_level: 0,
      p_rank: getRankForLevel(0),
      p_total_signs: 0,
      p_total_jutsus: 0,
      p_fastest_combo: 99,
      p_tutorial_seen: false,
      p_tutorial_seen_at: null,
      p_tutorial_version: "1.0",
    });
  }, [callRpc]);

  const syncAuthoritativeState = useCallback(async (targetIdentity: AuthIdentity, silent: boolean) => {
    if (!silent) {
      setStateBusy(true);
    }

    const identityPayload = {
      p_username: targetIdentity.username,
      p_discord_id: targetIdentity.discordId,
    };

    let bindRes = await callRpc("bind_profile_identity_bound", identityPayload);
    if (!Boolean(bindRes.ok) && String(bindRes.reason || "") === "profile_missing") {
      const bootstrapRes = await bootstrapAuthoritativeProfile(targetIdentity);
      if (!Boolean(bootstrapRes.ok)) {
        if (!silent || String(bootstrapRes.reason || "") === "identity_mismatch") {
          setStateError(toRpcError("Unable to bootstrap profile", bootstrapRes));
        }
      }
      bindRes = await callRpc("bind_profile_identity_bound", identityPayload);
    }

    setIdentityLinked(Boolean(bindRes.ok));
    if (!Boolean(bindRes.ok) && String(bindRes.reason || "") === "identity_mismatch") {
      setStateReady(true);
      if (!silent) setStateBusy(false);
      setStateError(toRpcError("Discord account link rejected", bindRes));
      return;
    }

    let stateRes = await callRpc("get_competitive_state_authoritative_bound", identityPayload);
    if (!Boolean(stateRes.ok) && String(stateRes.reason || "") === "profile_missing") {
      const bootstrapRes = await bootstrapAuthoritativeProfile(targetIdentity);
      if (Boolean(bootstrapRes.ok)) {
        stateRes = await callRpc("get_competitive_state_authoritative_bound", identityPayload);
      } else if (!silent) {
        setStateError(toRpcError("Unable to bootstrap profile", bootstrapRes));
      }
    }

    const [settingsRes, calibrationRes] = await Promise.all([
      callRpc("get_profile_settings_bound", identityPayload),
      callRpc("get_calibration_profile_bound", identityPayload),
    ]);

    if (Boolean(stateRes.ok)) {
      applyCompetitivePayload(stateRes);
      setIdentityLinked(true);
      if (!silent) {
        setStateError("");
      }
    } else if (!silent || String(stateRes.reason || "") === "identity_mismatch") {
      setStateError(toRpcError("Failed to fetch authoritative state", stateRes));
    }

    if (Boolean(settingsRes.ok) && isRecord(settingsRes.settings)) {
      const cloud = settingsRes.settings as Record<string, unknown>;
      const cloudSettings = sanitizeSettings({
        musicVol: Number(cloud.music_vol ?? cloud.musicVol),
        sfxVol: Number(cloud.sfx_vol ?? cloud.sfxVol),
        cameraIdx: Number(cloud.camera_idx ?? cloud.cameraIdx),
        debugHands: Boolean(cloud.debug_hands ?? cloud.debugHands),
        resolutionIdx: Number(cloud.resolution_idx ?? cloud.resolutionIdx),
        fullscreen: Boolean(cloud.fullscreen),
      });
      setSavedSettings(cloudSettings);
      setDraftSettings(cloudSettings);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cloudSettings));
      }
    }

    if (Boolean(calibrationRes.ok) && isRecord(calibrationRes.calibration_profile)) {
      setCalibrationProfile(sanitizeCalibrationProfileState(calibrationRes.calibration_profile));
    }

    setStateReady(true);
    if (!silent) {
      setStateBusy(false);
    }
  }, [applyCompetitivePayload, bootstrapAuthoritativeProfile, callRpc]);

  useEffect(() => {
    if (!supabase) return;

    let alive = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        setAuthError(error.message);
      }
      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setAuthReady(true);
      setAuthBusy(false);
      if (nextSession) {
        setAuthError("");
        setStateReady(false);
        setIdentityLinked(false);
        setStateError("");
        setQuestNotice("");
        setLevelUpPanel(null);
        setMasteryPanel(null);
      } else {
        setStateReady(false);
        setStateBusy(false);
        setStateError("");
        setActionBusy(false);
        setClaimBusyKey("");
        setIdentityLinked(false);
        setProgression(createInitialProgression());
        setQuestState(createDefaultQuestState(new Date()));
        setMastery({});
        setTutorialMeta({
          tutorialSeen: false,
          tutorialSeenAt: null,
          tutorialVersion: "1.0",
        });
        setCalibrationProfile(createDefaultCalibrationProfile());
        setLevelUpPanel(null);
        setMasteryPanel(null);
        setQuestNotice("");
      }
    });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void syncServerTimeOffset();
    const timer = window.setInterval(() => {
      void syncServerTimeOffset();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [syncServerTimeOffset]);

  useEffect(() => {
    if (!session || !identity) return;
    const firstSync = window.setTimeout(() => {
      void syncAuthoritativeState(identity, false);
    }, 0);
    const timer = window.setInterval(() => {
      void syncAuthoritativeState(identity, true);
    }, 20000);
    return () => {
      window.clearTimeout(firstSync);
      window.clearInterval(timer);
    };
  }, [identity, session, syncAuthoritativeState]);

  useEffect(() => {
    if (!selectedJutsu || !OFFICIAL_JUTSUS[selectedJutsu]) {
      setSelectedJutsu(orderedJutsuNames[0] || "");
    }
  }, [orderedJutsuNames, selectedJutsu]);

  useEffect(() => {
    void pollRuntimeConfig();
    const timer = window.setInterval(() => {
      void pollRuntimeConfig();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [pollRuntimeConfig]);

  useEffect(() => {
    if (announcements.length === 0) {
      setAnnouncementIndex(0);
      return;
    }
    setAnnouncementIndex((prev) => Math.max(0, Math.min(prev, announcements.length - 1)));
  }, [announcements.length]);

  useEffect(() => {
    if (!session) {
      welcomeShownRef.current = false;
      setShowWelcomeModal(false);
      return;
    }
    if (!stateReady || !identityLinked) return;
    if (maintenanceGate || updateGate || showAnnouncements) return;
    if (welcomeShownRef.current) return;
    welcomeShownRef.current = true;
    setShowWelcomeModal(true);
  }, [identityLinked, maintenanceGate, session, showAnnouncements, stateReady, updateGate]);

  useEffect(() => {
    if (!maintenanceGate && !updateGate) return;
    setShowAnnouncements(false);
    setShowWelcomeModal(false);
  }, [maintenanceGate, updateGate]);

  useEffect(() => {
    if (view !== "settings") {
      setSettingsPreviewEnabled(false);
      stopSettingsPreview();
      return;
    }
    void scanCameras();
  }, [scanCameras, stopSettingsPreview, view]);

  useEffect(() => {
    if (view !== "settings") return;
    if (!settingsPreviewEnabled) {
      stopSettingsPreview();
      return;
    }
    void startSettingsPreview();
  }, [settingsPreviewEnabled, startSettingsPreview, stopSettingsPreview, view]);

  useEffect(() => (() => stopSettingsPreview()), [stopSettingsPreview]);

  const handleDiscordLogin = async () => {
    if (!supabase || typeof window === "undefined") return;
    setAuthBusy(true);
    setAuthError("");

    const redirectTo = `${window.location.origin}/play`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo,
        scopes: "identify email",
      },
    });

    if (error) {
      setAuthError(error.message);
      setAuthBusy(false);
    }
  };

  const handleSaveSettings = async () => {
    const next = sanitizeSettings(draftSettings);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      toggleFullscreen(next.fullscreen);
    }

    if (identity) {
      const res = await callRpc("upsert_profile_settings_bound", {
        p_username: identity.username,
        p_discord_id: identity.discordId,
        p_user_settings: {
          music_vol: next.musicVol,
          sfx_vol: next.sfxVol,
          camera_idx: next.cameraIdx,
          debug_hands: next.debugHands,
          resolution_idx: next.resolutionIdx,
          fullscreen: next.fullscreen,
        },
      });
      if (!Boolean(res.ok)) {
        setStateError(toRpcError("Settings sync failed", res));
      }
    }

    setSavedSettings(next);
    setDraftSettings(next);
    setView("menu");
  };

  const handleQuit = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    }
    setShowQuitConfirm(false);
    setView("menu");
    setAuthBusy(false);
  };

  const persistProfileMeta = useCallback(async (nextMastery: MasteryMap) => {
    if (!identity) return { ok: false, reason: "missing_identity" };
    const rpcMastery = Object.fromEntries(
      Object.entries(nextMastery).map(([name, info]) => [name, { best_time: info.bestTime }]),
    );
    return callRpc("upsert_profile_meta_guarded_bound", {
      p_username: identity.username,
      p_discord_id: identity.discordId,
      p_tutorial_seen: tutorialMeta.tutorialSeen,
      p_tutorial_seen_at: tutorialMeta.tutorialSeenAt,
      p_tutorial_version: tutorialMeta.tutorialVersion,
      p_mastery: rpcMastery,
      p_quests: questState,
    });
  }, [callRpc, identity, questState, tutorialMeta]);

  const recordMasteryCompletion = useCallback(async (jutsuName: string, clearTime: number) => {
    if (!Number.isFinite(clearTime) || clearTime <= 0) return null;

    const previousBest = mastery[jutsuName]?.bestTime ?? null;
    const previousTier = getMasteryTier(jutsuName, previousBest);
    if (previousBest !== null && clearTime >= previousBest) {
      return null;
    }

    const nextMastery: MasteryMap = {
      ...mastery,
      [jutsuName]: { bestTime: clearTime },
    };
    const newTier = getMasteryTier(jutsuName, clearTime);
    setMastery(nextMastery);
    setMasteryPanel({
      jutsuName,
      previousBest,
      newBest: clearTime,
      previousTier,
      newTier,
    });

    if (identity) {
      const res = await persistProfileMeta(nextMastery);
      if (!Boolean(res.ok)) {
        setStateError(toRpcError("Mastery sync failed", res));
      }
    }

    return { previousBest, newBest: clearTime, previousTier, newTier };
  }, [identity, mastery, persistProfileMeta]);

  const recordTrainingRun = useCallback(async (
    mode: "free" | "rank",
    options?: { signsLanded?: number; jutsuName?: string; xpOverride?: number },
  ): Promise<{ ok: boolean; xpAwarded: number; previousLevel: number; newLevel: number; reason?: string }> => {
    if (actionBusy) {
      return { ok: false, xpAwarded: 0, previousLevel: progression.level, newLevel: progression.level, reason: "action_busy" };
    }
    if (!identity) {
      setStateError("Discord identity is unavailable. Re-login and retry.");
      return { ok: false, xpAwarded: 0, previousLevel: progression.level, newLevel: progression.level, reason: "missing_identity" };
    }

    const runJutsuName = String(options?.jutsuName || selectedJutsu || mode);
    const signsLanded = Math.max(
      1,
      Math.floor(Number(options?.signsLanded || selectedJutsuConfig?.sequence.length || 5)),
    );
    const previousLevel = progression.level;
    const xpGain = Math.max(1, Math.floor(Number(options?.xpOverride) || getRunXpGain(runJutsuName)));

    setActionBusy(true);
    setStateError("");
    try {
      const res = await callRpc("award_jutsu_completion_authoritative_bound", {
        p_username: identity.username,
        p_discord_id: identity.discordId,
        p_xp_gain: xpGain,
        p_signs_landed: signsLanded,
        p_is_challenge: mode === "rank",
        p_mode: runJutsuName.toUpperCase(),
      });

      if (!Boolean(res.ok)) {
        setStateError(toRpcError("Run award rejected", res));
        return { ok: false, xpAwarded: 0, previousLevel, newLevel: previousLevel, reason: String(res.reason || "award_rejected") };
      }

      applyCompetitivePayload(res);
      const gained = Math.max(0, Math.floor(Number(res.xp_awarded) || xpGain));
      const profilePayload = isRecord(res.profile) ? res.profile : res;
      const nextProgression = sanitizeProgression(profilePayload);
      const unlocks = getUnlockedJutsusBetweenLevels(previousLevel, nextProgression.level);

      if (nextProgression.level > previousLevel) {
        setLevelUpPanel({
          previousLevel,
          newLevel: nextProgression.level,
          rank: nextProgression.rank,
          sourceLabel: "Jutsu Clear",
          unlocked: unlocks,
        });
      }

      if (unlocks.length > 0 && nextProgression.level <= previousLevel) {
        setQuestNotice(`Unlocked: ${unlocks.join(", ")}`);
      } else {
        setQuestNotice(`${mode === "rank" ? "Rank" : "Free Play"} completion applied (+${gained} XP).`);
      }

      return {
        ok: true,
        xpAwarded: gained,
        previousLevel,
        newLevel: nextProgression.level,
      };
    } catch (err) {
      const message = String((err as Error)?.message || err || "unknown_error");
      setStateError(`Run award rejected: ${message}`);
      return { ok: false, xpAwarded: 0, previousLevel, newLevel: previousLevel, reason: message };
    } finally {
      setActionBusy(false);
    }
  }, [
    actionBusy,
    applyCompetitivePayload,
    callRpc,
    identity,
    progression.level,
    selectedJutsu,
    selectedJutsuConfig?.sequence.length,
  ]);

  const requestRankRunToken = useCallback(async (payload: {
    mode: "rank";
    jutsuName: string;
    clientStartedAtIso: string;
  }) => {
    if (!identity) return { reason: "missing_identity" };
    const res = await callRpc("issue_run_token_bound", {
      p_username: identity.username,
      p_discord_id: identity.discordId,
      p_mode: payload.jutsuName.toUpperCase(),
      p_client_started_at: payload.clientStartedAtIso,
    });
    if (Boolean(res.ok) && String(res.token || "").trim()) {
      return {
        token: String(res.token),
        source: String(res.source || "rpc"),
      };
    }
    return {
      token: "",
      source: "none",
      reason: String(res.reason || "token_issue_failed"),
    };
  }, [callRpc, identity]);

  const submitRankRunSecure = useCallback(async (result: PlayArenaResult): Promise<PlayArenaCompleteFeedback> => {
    if (result.mode !== "rank") {
      return { ok: true };
    }
    if (!identity) {
      return {
        ok: true,
        statusText: "XP applied",
        detailText: "Secure submit skipped: missing identity",
      };
    }

    const modeLabel = String(result.jutsuName || selectedJutsu).toUpperCase();
    const proofCheck = validateRankProofClient(result);
    if (!proofCheck.ok) {
      return {
        ok: true,
        statusText: "Secure submit skipped",
        detailText: `Local proof rejected (${proofCheck.reason})${proofCheck.detail ? `: ${proofCheck.detail}` : ""}`,
      };
    }

    const proof = result.proof as PlayArenaProof;
    const events = proofCheck.events;
    const canonicalEvents = canonicalize(events);
    const runHash = await sha256Hex(canonicalEvents);

    let chain = await sha256Hex(`${identity.username}|${modeLabel}|${proof?.clientStartedAtIso || ""}|web`);
    for (const event of events) {
      chain = await sha256Hex(`${chain}|${canonicalize(event)}`);
    }

    let runToken = String(proof?.runToken || "");
    let tokenSource = String(proof?.tokenSource || "none");
    if (!runToken) {
      const tokenRes = await requestRankRunToken({
        mode: "rank",
        jutsuName: result.jutsuName,
        clientStartedAtIso: proof?.clientStartedAtIso || new Date().toISOString().replace(/\\.\\d{3}Z$/, "Z"),
      });
      runToken = String(tokenRes?.token || "");
      tokenSource = String(tokenRes?.source || tokenSource);
    }

    if (!runToken) {
      return {
        ok: true,
        statusText: "Secure submit skipped",
        detailText: `Run token unavailable (${String(proof?.tokenIssueReason || "token_issue_failed")})`,
      };
    }

    const submitRes = await callRpc("submit_challenge_run_secure_bound", {
      p_username: identity.username,
      p_discord_id: identity.discordId,
      p_mode: modeLabel,
      p_score_time: result.elapsedSeconds,
      p_run_token: runToken,
      p_events: events,
      p_run_hash: runHash,
      p_metadata: {
        expected_signs: result.expectedSigns,
        detected_signs: proofCheck.signOkCount,
        cooldown_s: Number((Number(proof.cooldownMs) / 1000).toFixed(3)),
        cooldown_ms: Number(proof.cooldownMs),
        vote_required_hits: Number(proof.voteRequiredHits),
        vote_min_confidence: Number(proof.voteMinConfidence),
        restricted_signs: Boolean(proof.restrictedSigns),
        camera_idx: Number(proof.cameraIdx),
        resolution_idx: Number(proof.resolutionIdx),
        client_started_at: String(proof.clientStartedAtIso || ""),
        run_start_t: Number(proofCheck.runStartSec.toFixed(3)),
        run_finish_t: Number(proofCheck.runFinishSec.toFixed(3)),
        last_sign_t: Number(proofCheck.lastSignSec.toFixed(3)),
        client_elapsed_s: Number(result.elapsedSeconds.toFixed(4)),
        client_fps_target: 60,
        client_version: "web-play-v2",
        token_source: tokenSource,
        event_chain_hash: chain,
        event_overflow: Boolean(proof?.eventOverflow),
        proof_validation: "client_sanity_v1",
      },
      p_avatar_url: avatarUrl,
    });

    if (!Boolean(submitRes.ok)) {
      return {
        ok: true,
        statusText: "Rank run complete",
        detailText: `Secure submit rejected: ${String(submitRes.reason || "submit_failed")}`,
      };
    }

    let rankText = "";
    if (supabase) {
      const { data } = await supabase
        .from("leaderboard")
        .select("score_time")
        .eq("mode", modeLabel)
        .order("score_time", { ascending: true })
        .limit(100);

      if (Array.isArray(data) && data.length > 0) {
        const idx = data.findIndex((row) => Math.abs(Number(row.score_time || 0) - result.elapsedSeconds) < 0.001);
        if (idx >= 0) {
          const rank = idx + 1;
          const percentile = ((data.length - rank + 1) / data.length) * 100;
          rankText = `Rank: #${rank} (Top ${percentile.toFixed(0)}%)`;
        } else {
          rankText = "Rank: Top 100+";
        }
      }
    }

    return {
      ok: true,
      statusText: "Secure rank run submitted",
      rankText,
    };
  }, [avatarUrl, callRpc, identity, requestRankRunToken, selectedJutsu]);

  const handleArenaComplete = useCallback(async (result: PlayArenaResult): Promise<boolean | PlayArenaCompleteFeedback> => {
    const masteryResult = await recordMasteryCompletion(result.jutsuName, result.elapsedSeconds);
    const secureRes = result.mode === "rank"
      ? await submitRankRunSecure(result)
      : { ok: true, statusText: "" };
    const runRes = await recordTrainingRun(result.mode, {
      signsLanded: result.signsLanded,
      jutsuName: result.jutsuName,
      xpOverride: getRunXpGain(result.jutsuName),
    });

    const detailParts: string[] = [];
    if (secureRes.detailText) {
      detailParts.push(secureRes.detailText);
    }
    if (masteryResult) {
      detailParts.push(
        masteryResult.previousBest === null
          ? `Mastery first record: ${masteryResult.newBest.toFixed(2)}s`
          : `Mastery improved ${masteryResult.previousBest.toFixed(2)}s → ${masteryResult.newBest.toFixed(2)}s`,
      );
    }

    return {
      ok: runRes.ok,
      statusText: runRes.ok
        ? (secureRes.statusText || `+${runRes.xpAwarded} XP applied`)
        : "Run processing failed",
      detailText: detailParts.join(" • "),
      rankText: secureRes.rankText,
      xpAwarded: runRes.ok ? runRes.xpAwarded : 0,
    };
  }, [recordMasteryCompletion, recordTrainingRun, submitRankRunSecure]);

  const handleCalibrationComplete = useCallback(async (profile: CalibrationProfile): Promise<boolean> => {
    setCalibrationProfile(profile);
    if (!identity) return false;

    const res = await callRpc("upsert_calibration_profile_bound", {
      p_username: identity.username,
      p_discord_id: identity.discordId,
      p_calibration_profile: {
        version: profile.version,
        samples: profile.samples,
        updated_at: profile.updatedAt || new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        lighting_min: profile.lightingMin,
        lighting_max: profile.lightingMax,
        lighting_min_contrast: profile.lightingMinContrast,
        vote_min_confidence: profile.voteMinConfidence,
        vote_required_hits: profile.voteRequiredHits,
      },
    });

    if (!Boolean(res.ok)) {
      setStateError(toRpcError("Calibration sync failed", res));
      return false;
    }
    setQuestNotice("Calibration profile synced.");
    return true;
  }, [callRpc, identity]);

  const markTutorialSeen = useCallback(async () => {
    const seenAt = tutorialMeta.tutorialSeenAt || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const nextMeta: TutorialMetaState = {
      tutorialSeen: true,
      tutorialSeenAt: seenAt,
      tutorialVersion: "1.0",
    };
    setTutorialMeta(nextMeta);

    if (!identity) return;
    const rpcMastery = Object.fromEntries(
      Object.entries(mastery).map(([name, info]) => [name, { best_time: info.bestTime }]),
    );
    const res = await callRpc("upsert_profile_meta_guarded_bound", {
      p_username: identity.username,
      p_discord_id: identity.discordId,
      p_tutorial_seen: true,
      p_tutorial_seen_at: seenAt,
      p_tutorial_version: nextMeta.tutorialVersion,
      p_mastery: rpcMastery,
      p_quests: questState,
    });
    if (!Boolean(res.ok)) {
      setStateError(toRpcError("Tutorial sync failed", res));
    }
  }, [callRpc, identity, mastery, questState, tutorialMeta.tutorialSeenAt]);

  const claimQuest = async (def: QuestDefinition) => {
    if (actionBusy) return;
    if (!identity) {
      setStateError("Discord identity is unavailable. Re-login and retry.");
      return;
    }

    const key = `${def.scope}:${def.id}`;
    setActionBusy(true);
    setClaimBusyKey(key);
    setStateError("");
    try {
      const previousLevel = progression.level;
      const res = await callRpc("claim_quest_authoritative_bound", {
        p_username: identity.username,
        p_discord_id: identity.discordId,
        p_scope: def.scope,
        p_quest_id: def.id,
      });

      if (Boolean(res.ok)) {
        applyCompetitivePayload(res);
        const profilePayload = isRecord(res.profile) ? res.profile : res;
        const nextProgression = sanitizeProgression(profilePayload);
        const unlocks = getUnlockedJutsusBetweenLevels(previousLevel, nextProgression.level);
        if (nextProgression.level > previousLevel) {
          setLevelUpPanel({
            previousLevel,
            newLevel: nextProgression.level,
            rank: nextProgression.rank,
            sourceLabel: "Quest Reward",
            unlocked: unlocks,
          });
        }
        const rewardXp = Math.max(0, Math.floor(Number(res.reward_xp) || def.reward));
        const title = String(res.title || def.title);
        setQuestNotice(`Quest claimed: ${title} (+${rewardXp} XP).`);
      } else {
        setStateError(toRpcError("Quest claim failed", res));
      }
    } catch (err) {
      setStateError(`Quest claim failed: ${String((err as Error)?.message || err || "unknown_error")}`);
    }

    setClaimBusyKey("");
    setActionBusy(false);
  };

  const tutorial = TUTORIAL_STEPS[tutorialStep];
  const inMenu = view === "menu";
  const masteryThresholds = masteryPanel ? getMasteryThresholds(masteryPanel.jutsuName) : null;
  const masteryTrackSpan = masteryThresholds
    ? Math.max(0.001, masteryThresholds.bronze - masteryThresholds.gold)
    : 1;
  const masteryMarkerPct = masteryPanel && masteryThresholds
    ? Math.max(0, Math.min(100, ((masteryThresholds.bronze - masteryPanel.newBest) / masteryTrackSpan) * 100))
    : 0;
  const masteryBronzePct = masteryThresholds
    ? Math.max(0, Math.min(100, ((masteryThresholds.bronze - masteryThresholds.bronze) / masteryTrackSpan) * 100))
    : 0;
  const masterySilverPct = masteryThresholds
    ? Math.max(0, Math.min(100, ((masteryThresholds.bronze - masteryThresholds.silver) / masteryTrackSpan) * 100))
    : 0;
  const masteryGoldPct = masteryThresholds
    ? Math.max(0, Math.min(100, ((masteryThresholds.bronze - masteryThresholds.gold) / masteryTrackSpan) * 100))
    : 100;
  const masteryTierRgb = masteryPanel?.newTier === "gold"
    ? { r: 255, g: 200, b: 40 }
    : masteryPanel?.newTier === "silver"
      ? { r: 180, g: 190, b: 200 }
      : masteryPanel?.newTier === "bronze"
        ? { r: 196, g: 128, b: 60 }
        : { r: 100, g: 100, b: 100 };
  const masteryDelta = masteryPanel && masteryPanel.previousBest !== null
    ? masteryPanel.newBest - masteryPanel.previousBest
    : null;
  const masteryNextTierHint = masteryPanel && masteryThresholds
    ? masteryPanel.newTier === "none"
      ? { name: "BRONZE", target: masteryThresholds.bronze }
      : masteryPanel.newTier === "bronze"
        ? { name: "SILVER", target: masteryThresholds.silver }
        : masteryPanel.newTier === "silver"
          ? { name: "GOLD", target: masteryThresholds.gold }
          : null
    : null;
  const activeAnnouncement = announcements.length > 0
    ? announcements[Math.max(0, Math.min(announcementIndex, announcements.length - 1))]
    : null;
  const currentCameraOption = cameraOptions.find((camera) => camera.idx === draftSettings.cameraIdx) || null;

  return (
    <div className="min-h-screen bg-ninja-bg text-ninja-text">
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url('/vl2.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "grayscale(100%) contrast(118%) brightness(0.36)",
        }}
      />
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black/55 via-black/72 to-black/90" />

      <header className="relative z-20 border-b border-ninja-border bg-ninja-bg/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 hover:opacity-85 transition-opacity">
            <Image src="/logo2.png" alt="Jutsu Academy" width={40} height={40} className="h-10 w-10 object-contain" />
            <span className="font-bold tracking-tight text-zinc-100">Jutsu Academy</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-ninja-border bg-ninja-card/70 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-200 hover:border-ninja-accent/40 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Base
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        {!authReady && (
          <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-ninja-border bg-ninja-panel/85 p-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-ninja-accent" />
            <p className="mt-4 text-sm text-zinc-300">Initializing academy gate...</p>
          </div>
        )}

        {authReady && !session && (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-ninja-border bg-ninja-panel/90 p-8 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-black tracking-tight text-white">Login Required</h1>
              <p className="mt-2 text-sm text-ninja-dim">
                Sign in with Discord to enter <span className="text-ninja-accent font-semibold">/play</span>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleDiscordLogin()}
              disabled={!supabase || authBusy}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-indigo-600 px-6 text-base font-black text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              LOGIN WITH DISCORD
            </button>

            {authError && (
              <p className="mt-4 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {authError}
              </p>
            )}
          </div>
        )}

        {session && (
          <>
            <div className="mx-auto mb-6 flex w-full max-w-5xl items-center justify-between rounded-3xl border border-indigo-300/30 bg-gradient-to-r from-indigo-950/65 via-slate-900/70 to-indigo-950/65 px-4 py-3 backdrop-blur-sm md:px-6 md:py-4">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={username}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 rounded-xl border border-ninja-border object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-ninja-border bg-ninja-panel text-base font-black text-ninja-accent">
                    {username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-white md:text-[1.05rem]">{username}</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-300/80">
                    {identityLinked ? "Discord Connected • Account Linked" : "Discord Connected • Link Pending"}
                  </p>
                </div>
              </div>

              <div className="hidden md:block text-right">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-300/70">Rank</p>
                <p className="text-sm font-black text-white">{progression.rank}</p>
              </div>

              {!inMenu && (
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  className="rounded-xl border border-indigo-300/35 bg-indigo-950/35 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-100 hover:border-indigo-300/60 hover:bg-indigo-900/40"
                >
                  Back To Menu
                </button>
              )}
            </div>

            {!!questNotice && (
              <div className="mx-auto mb-4 w-full max-w-5xl rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                {questNotice}
              </div>
            )}

            {!!visibleStateError && (
              <div className="mx-auto mb-4 w-full max-w-5xl rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                {visibleStateError}
              </div>
            )}

            {(stateBusy || (!stateReady && Boolean(identity))) && session && (
              <div className="mx-auto mb-4 flex w-full max-w-5xl items-center gap-3 rounded-xl border border-ninja-border bg-ninja-panel/80 px-4 py-3 text-sm text-zinc-200">
                <Loader2 className="h-4 w-4 animate-spin text-ninja-accent" />
                Linking Discord identity and loading authoritative progression...
              </div>
            )}

            {view === "menu" && (
              <div className="mx-auto max-w-2xl rounded-3xl border border-ninja-border bg-ninja-panel/88 p-8 md:p-10 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <div className="text-center">
                  <Image
                    src="/logo2.png"
                    alt="Jutsu Academy"
                    width={144}
                    height={144}
                    className="mx-auto h-28 w-28 object-contain md:h-36 md:w-36"
                  />
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">JUTSU ACADEMY</h1>
                  <p className="mt-2 text-sm font-bold tracking-[0.2em] text-ninja-accent">TRAIN • MASTER • RANK UP</p>
                </div>

                <div className="mt-8 space-y-3">
                  <button
                    type="button"
                    onClick={() => setView("mode_select")}
                    disabled={!stateReady || !identityLinked}
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-ninja-accent text-base font-black tracking-wide text-white transition hover:bg-ninja-accent-glow disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {!stateReady ? "SYNCING ACCOUNT..." : !identityLinked ? "ACCOUNT LINK REQUIRED" : "ENTER ACADEMY"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSettings(savedSettings);
                      setView("settings");
                    }}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    <Settings className="h-5 w-5" />
                    SETTINGS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTutorialStep(0);
                      setView("tutorial");
                    }}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    <Sparkles className="h-5 w-5" />
                    TUTORIAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("about")}
                    className="flex h-14 w-full items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    ABOUT
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuitConfirm(true)}
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-red-700/80 text-base font-black tracking-wide text-white transition hover:bg-red-600"
                  >
                    QUIT
                  </button>
                </div>
              </div>
            )}

            {view === "mode_select" && (
              <div className="mx-auto w-full max-w-5xl rounded-[30px] border border-indigo-300/25 bg-gradient-to-b from-indigo-950/40 to-slate-950/85 p-5 shadow-[0_22px_80px_rgba(0,0,0,0.6)] md:p-10">
                <div className="text-center">
                  <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">SELECT YOUR PATH</h1>
                  <p className="mt-3 text-sm font-black tracking-[0.28em] text-ninja-accent md:text-lg">CHOOSE YOUR TRAINING</p>
                </div>

                <div className="mt-8 space-y-4">
                  <button
                    type="button"
                    onClick={() => setView("free_play")}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-zinc-400/40 bg-zinc-500/70 text-xl font-black tracking-wide text-zinc-100 transition hover:bg-zinc-400/80"
                  >
                    FREE OBSTACLE / PLAY
                  </button>

                  <button
                    type="button"
                    onClick={() => setView("rank_mode")}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-red-300/35 bg-gradient-to-r from-orange-600 to-red-600 text-xl font-black tracking-wide text-white transition hover:from-orange-500 hover:to-red-500"
                  >
                    RANK MODE
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLibraryIntent("browse");
                      setView("jutsu_library");
                    }}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-950/45 text-xl font-black tracking-wide text-blue-300 transition hover:bg-blue-900/45"
                  >
                    JUTSU LIBRARY
                  </button>

                  <button
                    type="button"
                    onClick={() => setView("multiplayer")}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-zinc-500/35 bg-zinc-800/70 text-xl font-black tracking-wide text-zinc-400 transition hover:bg-zinc-700/70"
                  >
                    MULTIPLAYER (LOCKED)
                  </button>

                  <button
                    type="button"
                    onClick={() => setView("quest_board")}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-950/45 text-xl font-black tracking-wide text-emerald-300 transition hover:bg-emerald-900/45"
                  >
                    QUEST BOARD
                  </button>

                  <Link
                    href="/leaderboard"
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-yellow-300/40 bg-gradient-to-r from-amber-600 to-yellow-600 text-xl font-black tracking-wide text-white transition hover:from-amber-500 hover:to-yellow-500"
                  >
                    LEADERBOARD
                  </Link>

                  <button
                    type="button"
                    onClick={() => setView("menu")}
                    className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl border border-ninja-border bg-ninja-card text-xl font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    BACK
                  </button>
                </div>
              </div>
            )}

            {view === "free_play" && (
              <div className="mx-auto w-full max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-7 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <h2 className="text-3xl font-black tracking-tight text-white">FREE OBSTACLE / PLAY</h2>
                <p className="mt-3 text-sm leading-relaxed text-ninja-dim">
                  Play a full camera-based sign sequence run, then apply authoritative XP from completion.
                </p>
                <div className="mt-4 rounded-xl border border-ninja-border bg-black/25 px-4 py-3 text-sm text-zinc-200">
                  Current Jutsu: <span className="font-black text-white">{selectedJutsu}</span>
                  {selectedJutsuConfig && (
                    <span className={`ml-2 text-xs font-black ${selectedJutsuUnlocked ? "text-emerald-300" : "text-red-300"}`}>
                      {selectedJutsuUnlocked ? "UNLOCKED" : `LOCKED • LV.${selectedJutsuConfig.minLevel}`}
                    </span>
                  )}
                </div>

                <div className="mt-6 grid gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (needsCalibrationGate) {
                        setCalibrationReturnView("free_play");
                        setView("calibration_gate");
                        return;
                      }
                      setView("free_session");
                    }}
                    disabled={!selectedJutsuUnlocked || !stateReady || !identityLinked}
                    className="flex h-12 items-center justify-center rounded-xl bg-zinc-600 text-sm font-black tracking-wide text-white hover:bg-zinc-500 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    START IN-GAME FREE RUN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryIntent("free");
                      setView("jutsu_library");
                    }}
                    className="flex h-12 items-center justify-center rounded-xl border border-blue-500/35 bg-blue-500/15 text-sm font-black tracking-wide text-blue-200 hover:bg-blue-500/25"
                  >
                    OPEN JUTSU LIBRARY
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("mode_select")}
                    className="flex h-12 items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-sm font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40"
                  >
                    BACK TO SELECT PATH
                  </button>
                </div>
              </div>
            )}

            {view === "rank_mode" && (
              <div className="mx-auto w-full max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-7 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <h2 className="text-3xl font-black tracking-tight text-white">RANK MODE</h2>
                <p className="mt-3 text-sm leading-relaxed text-ninja-dim">
                  Timed in-game run with the same sign detection stack used in challenge/practice and authoritative XP award.
                </p>
                <div className="mt-4 rounded-xl border border-ninja-border bg-black/25 px-4 py-3 text-sm text-zinc-200">
                  Current Jutsu: <span className="font-black text-white">{selectedJutsu}</span>
                  {selectedJutsuConfig && (
                    <span className={`ml-2 text-xs font-black ${selectedJutsuUnlocked ? "text-emerald-300" : "text-red-300"}`}>
                      {selectedJutsuUnlocked ? "UNLOCKED" : `LOCKED • LV.${selectedJutsuConfig.minLevel}`}
                    </span>
                  )}
                </div>

                <div className="mt-6 grid gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (needsCalibrationGate) {
                        setCalibrationReturnView("rank_mode");
                        setView("calibration_gate");
                        return;
                      }
                      setView("rank_session");
                    }}
                    disabled={!selectedJutsuUnlocked || !stateReady || !identityLinked}
                    className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-sm font-black tracking-wide text-white hover:from-orange-500 hover:to-red-500 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    START IN-GAME RANK RUN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryIntent("rank");
                      setView("jutsu_library");
                    }}
                    className="flex h-12 items-center justify-center rounded-xl border border-blue-500/35 bg-blue-500/15 text-sm font-black tracking-wide text-blue-200 hover:bg-blue-500/25"
                  >
                    OPEN JUTSU LIBRARY
                  </button>
                  <Link
                    href="/leaderboard"
                    className="flex h-12 items-center justify-center rounded-xl border border-yellow-300/40 bg-amber-700/70 text-sm font-black tracking-wide text-white hover:bg-amber-600/80"
                  >
                    OPEN LEADERBOARD
                  </Link>
                  <button
                    type="button"
                    onClick={() => setView("mode_select")}
                    className="flex h-12 items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-sm font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40"
                  >
                    BACK TO SELECT PATH
                  </button>
                </div>
              </div>
            )}

            {view === "calibration_gate" && (
              <div className="mx-auto w-full max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/92 p-7 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <h2 className="text-3xl font-black tracking-tight text-white">CALIBRATION REQUIRED</h2>
                <p className="mt-3 text-sm leading-relaxed text-ninja-dim">
                  Your account does not have a saved calibration profile yet. Match pygame flow by calibrating once before free/rank runs.
                </p>

                <div className="mt-4 rounded-xl border border-ninja-border bg-black/25 px-4 py-3 text-sm text-zinc-200">
                  {serverClockSynced ? "Server clock synced" : "Using local fallback clock"} • Calibration status:{" "}
                  <span className={`font-black ${calibrationReady ? "text-emerald-300" : "text-amber-300"}`}>
                    {calibrationReady ? "READY" : "MISSING"}
                  </span>
                </div>

                <div className="mt-6 grid gap-3">
                  <button
                    type="button"
                    onClick={() => setView("calibration_session")}
                    className="flex h-12 items-center justify-center rounded-xl bg-ninja-accent text-sm font-black tracking-wide text-white hover:bg-ninja-accent-glow"
                  >
                    START CALIBRATION
                  </button>
                  <button
                    type="button"
                    onClick={() => setView(calibrationReturnView)}
                    className="flex h-12 items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-sm font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40"
                  >
                    BACK
                  </button>
                </div>
              </div>
            )}

            {view === "calibration_session" && (
              <PlayArena
                jutsuName={selectedJutsu}
                mode="calibration"
                restrictedSigns={savedSettings.restrictedSigns}
                debugHands={savedSettings.debugHands}
                sfxVolume={savedSettings.sfxVol}
                cameraIdx={savedSettings.cameraIdx}
                resolutionIdx={savedSettings.resolutionIdx}
                calibrationProfile={calibrationProfile}
                onCalibrationComplete={handleCalibrationComplete}
                onBack={() => setView(calibrationReturnView)}
              />
            )}

            {view === "free_session" && selectedJutsuConfig && (
              <PlayArena
                jutsuName={selectedJutsu}
                mode="free"
                restrictedSigns={savedSettings.restrictedSigns}
                debugHands={savedSettings.debugHands}
                sfxVolume={savedSettings.sfxVol}
                cameraIdx={savedSettings.cameraIdx}
                resolutionIdx={savedSettings.resolutionIdx}
                calibrationProfile={calibrationProfile}
                busy={actionBusy}
                onComplete={handleArenaComplete}
                progressionHud={{
                  xp: progression.xp,
                  level: progression.level,
                  rank: progression.rank,
                  xpToNextLevel: nextLevelXpTarget,
                }}
                onPrevJutsu={() => handleCycleSelectedJutsu(-1)}
                onNextJutsu={() => handleCycleSelectedJutsu(1)}
                onQuickCalibrate={() => {
                  setCalibrationReturnView("free_play");
                  setView("calibration_session");
                }}
                onBack={() => setView("free_play")}
              />
            )}

            {view === "rank_session" && selectedJutsuConfig && (
              <PlayArena
                jutsuName={selectedJutsu}
                mode="rank"
                restrictedSigns={savedSettings.restrictedSigns}
                debugHands={savedSettings.debugHands}
                sfxVolume={savedSettings.sfxVol}
                cameraIdx={savedSettings.cameraIdx}
                resolutionIdx={savedSettings.resolutionIdx}
                calibrationProfile={calibrationProfile}
                busy={actionBusy}
                onComplete={handleArenaComplete}
                onRequestRunToken={requestRankRunToken}
                progressionHud={{
                  xp: progression.xp,
                  level: progression.level,
                  rank: progression.rank,
                  xpToNextLevel: nextLevelXpTarget,
                }}
                onPrevJutsu={() => handleCycleSelectedJutsu(-1)}
                onNextJutsu={() => handleCycleSelectedJutsu(1)}
                onQuickCalibrate={() => {
                  setCalibrationReturnView("rank_mode");
                  setView("calibration_session");
                }}
                onBack={() => setView("rank_mode")}
              />
            )}

            {view === "jutsu_library" && (
              <div className="mx-auto w-full max-w-5xl rounded-3xl border border-ninja-border bg-ninja-panel/92 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.5)] md:p-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white">JUTSU LIBRARY</h2>
                    <p className="mt-1 text-sm text-ninja-dim">
                      {libraryIntent === "free"
                        ? "Free Play context: choose a jutsu, then jump into practice."
                        : libraryIntent === "rank"
                          ? "Rank Mode context: choose a jutsu, then challenge your speed."
                          : "Browse unlocks and requirements by level."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-ninja-border bg-ninja-bg/40 px-4 py-2 text-sm text-zinc-100">
                    LV.{progression.level} • {progression.rank}
                  </div>
                </div>

                <div className="mt-6 space-y-5">
                  {jutsuTiers.map((tier) => (
                    <section key={tier.title} className="rounded-2xl border border-ninja-border bg-ninja-bg/35 p-4">
                      <h3 className="text-sm font-black uppercase tracking-[0.15em] text-ninja-accent">{tier.title}</h3>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {tier.items.map(([name, config]) => {
                          const unlocked = progression.level >= config.minLevel;
                          const selected = selectedJutsu === name;
                          const texture = JUTSU_TEXTURES[name] || "";
                          const masteryRow = mastery[name];
                          const masteryTier = getMasteryTier(name, masteryRow?.bestTime);
                          const masteryColor = masteryTier === "gold"
                            ? "text-amber-300"
                            : masteryTier === "silver"
                              ? "text-slate-300"
                              : masteryTier === "bronze"
                                ? "text-orange-300"
                                : "text-zinc-400";
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => setSelectedJutsu(name)}
                              className={`relative overflow-hidden rounded-xl border text-left transition ${
                                selected
                                  ? "border-ninja-accent shadow-[0_0_18px_rgba(255,120,50,0.32)]"
                                  : unlocked
                                    ? "border-ninja-border hover:border-ninja-accent/50"
                                    : "border-zinc-700"
                              }`}
                            >
                              <div className="absolute inset-0">
                                {texture ? (
                                  <Image
                                    src={texture}
                                    alt={name}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    className={`h-full w-full object-cover ${unlocked ? "opacity-60" : "opacity-30 grayscale"}`}
                                  />
                                ) : (
                                  <div className="h-full w-full bg-gradient-to-br from-zinc-700 to-zinc-900" />
                                )}
                              </div>
                              <div className="relative z-10 bg-gradient-to-b from-black/45 via-black/60 to-black/80 p-3">
                                <p className="text-sm font-black text-white">{name}</p>
                                <p className="mt-1 text-[11px] text-zinc-300">{config.sequence.length} signs</p>
                                <p className={`mt-1 text-[11px] font-bold uppercase ${masteryColor}`}>
                                  Mastery: {masteryTier}
                                  {masteryRow ? ` • ${masteryRow.bestTime.toFixed(2)}s` : ""}
                                </p>
                                <p className={`mt-1 text-[11px] font-bold ${unlocked ? "text-emerald-300" : "text-red-300"}`}>
                                  {unlocked ? "UNLOCKED" : `LOCKED • LV.${config.minLevel}`}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>

                {selectedJutsuConfig && (
                  <div className="mt-6 rounded-2xl border border-ninja-border bg-ninja-bg/45 p-4">
                    <p className="text-lg font-black text-white">{selectedJutsu}</p>
                    <p className="mt-1 text-xs text-ninja-dim">Required Level: {selectedJutsuConfig.minLevel}</p>
                    <p className="mt-2 text-sm text-zinc-200">{selectedJutsuConfig.displayText}</p>
                    <p className="mt-2 text-xs text-zinc-300">Sequence: {selectedJutsuConfig.sequence.map((s) => s.toUpperCase()).join(" → ")}</p>
                  </div>
                )}

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (libraryIntent === "rank") {
                        if (needsCalibrationGate) {
                          setCalibrationReturnView("rank_mode");
                          setView("calibration_gate");
                          return;
                        }
                        setView("rank_session");
                        return;
                      }
                      if (libraryIntent === "free") {
                        if (needsCalibrationGate) {
                          setCalibrationReturnView("free_play");
                          setView("calibration_gate");
                          return;
                        }
                        setView("free_session");
                      }
                    }}
                    disabled={libraryIntent === "browse" || !selectedJutsuUnlocked || actionBusy || !stateReady || !identityLinked}
                    className="flex h-12 items-center justify-center rounded-xl bg-ninja-accent text-sm font-black tracking-wide text-white hover:bg-ninja-accent-glow disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {libraryIntent === "rank"
                      ? "START RANK SESSION"
                      : libraryIntent === "free"
                        ? "START FREE SESSION"
                        : "OPEN FROM FREE/RANK MODE"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("mode_select")}
                    className="flex h-12 items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-sm font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40"
                  >
                    BACK TO SELECT PATH
                  </button>
                </div>
              </div>
            )}

            {view === "quest_board" && (
              <div className="mx-auto w-full max-w-5xl rounded-3xl border border-ninja-border bg-ninja-panel/92 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.5)] md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white">QUEST BOARD</h2>
                    <p className="mt-1 text-sm text-ninja-dim">
                      Server-authoritative quest state and claim rewards (same guarded RPC path as pygame).
                    </p>
                  </div>
                  <div className="rounded-xl border border-ninja-border bg-ninja-bg/40 px-4 py-2 text-xs text-zinc-300">
                    <div>Daily reset (UTC): {formatCountdown(dailyResetAt.getTime() - now.getTime())}</div>
                    <div>Weekly reset (UTC): {formatCountdown(weeklyResetAt.getTime() - now.getTime())}</div>
                    <div>Clock source: {serverClockSynced ? "Server-synced" : "Local fallback"}</div>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  <section className="rounded-2xl border border-ninja-border bg-ninja-bg/35 p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <Image src="/pics/quests/daily_icon.png" alt="Daily" width={32} height={32} className="h-8 w-8 object-contain" />
                      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-emerald-300">Daily</h3>
                    </div>
                    <div className="space-y-3">
                      {QUEST_DEFS.filter((q) => q.scope === "daily").map((def) => {
                        const entry = questState.daily.quests[def.id as DailyQuestId];
                        const pct = Math.max(0, Math.min(1, entry.progress / Math.max(1, def.target)));
                        const ready = entry.progress >= def.target && !entry.claimed;
                        return (
                          <div key={def.id} className="rounded-xl border border-ninja-border bg-black/25 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-white">{def.title}</p>
                              <span className="text-xs text-zinc-300">{Math.min(entry.progress, def.target)}/{def.target}</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-zinc-700">
                              <div className="h-2 rounded-full bg-orange-500" style={{ width: `${pct * 100}%` }} />
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-300">+{def.reward} XP</span>
                              {entry.claimed ? (
                                <span className="text-xs font-black text-emerald-300">CLAIMED</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!ready || actionBusy || !stateReady || !identityLinked}
                                  onClick={() => void claimQuest(def)}
                                  className="rounded-md px-3 py-1 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50 bg-orange-600 hover:bg-orange-500"
                                >
                                  {claimBusyKey === `${def.scope}:${def.id}` ? "CLAIMING..." : "CLAIM"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-ninja-border bg-ninja-bg/35 p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <Image src="/pics/quests/weekly_icon.png" alt="Weekly" width={32} height={32} className="h-8 w-8 object-contain" />
                      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-blue-300">Weekly</h3>
                    </div>
                    <div className="space-y-3">
                      {QUEST_DEFS.filter((q) => q.scope === "weekly").map((def) => {
                        const entry = questState.weekly.quests[def.id as WeeklyQuestId];
                        const pct = Math.max(0, Math.min(1, entry.progress / Math.max(1, def.target)));
                        const ready = entry.progress >= def.target && !entry.claimed;
                        return (
                          <div key={def.id} className="rounded-xl border border-ninja-border bg-black/25 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-white">{def.title}</p>
                              <span className="text-xs text-zinc-300">{Math.min(entry.progress, def.target)}/{def.target}</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-zinc-700">
                              <div className="h-2 rounded-full bg-orange-500" style={{ width: `${pct * 100}%` }} />
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-300">+{def.reward} XP</span>
                              {entry.claimed ? (
                                <span className="text-xs font-black text-emerald-300">CLAIMED</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!ready || actionBusy || !stateReady || !identityLinked}
                                  onClick={() => void claimQuest(def)}
                                  className="rounded-md px-3 py-1 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50 bg-orange-600 hover:bg-orange-500"
                                >
                                  {claimBusyKey === `${def.scope}:${def.id}` ? "CLAIMING..." : "CLAIM"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryIntent("free");
                      setView("jutsu_library");
                    }}
                    className="flex h-12 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/15 text-sm font-black text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    OPEN FREE SESSION
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryIntent("rank");
                      setView("jutsu_library");
                    }}
                    className="flex h-12 items-center justify-center rounded-xl border border-blue-500/35 bg-blue-500/15 text-sm font-black text-blue-200 hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    OPEN RANK SESSION
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!identity) return;
                      void syncAuthoritativeState(identity, false);
                    }}
                    disabled={stateBusy || !identity}
                    className="flex h-12 items-center justify-center rounded-xl border border-orange-500/35 bg-orange-500/15 text-sm font-black text-orange-200 hover:bg-orange-500/25 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {stateBusy ? "SYNCING..." : "SYNC STATE"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setView("mode_select")}
                  className="mt-6 flex h-12 w-full items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-sm font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40"
                >
                  BACK TO SELECT PATH
                </button>
              </div>
            )}

            {view === "multiplayer" && (
              <LockedPanel
                title="MULTIPLAYER (LOCKED)"
                description="Online multiplayer matchmaking and anti-cheat flow are not enabled in this web build yet."
                onBack={() => setView("mode_select")}
              />
            )}

            {view === "settings" && (
              <div className="mx-auto max-w-2xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-8 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <h2 className="text-3xl font-black tracking-tight text-white">SETTINGS</h2>
                <p className="mt-1 text-sm text-ninja-dim">Menu settings mirror the pygame controls.</p>

                <div className="mt-6 space-y-6">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-zinc-100">
                      <span>Music Volume</span>
                      <span className="font-mono text-ninja-accent">{Math.round(draftSettings.musicVol * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={draftSettings.musicVol}
                      onChange={(event) => {
                        setDraftSettings((prev) => ({
                          ...prev,
                          musicVol: clampVolume(event.target.value, prev.musicVol),
                        }));
                      }}
                      className="w-full accent-orange-500"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-zinc-100">
                      <span>SFX Volume</span>
                      <span className="font-mono text-ninja-accent">{Math.round(draftSettings.sfxVol * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={draftSettings.sfxVol}
                      onChange={(event) => {
                        setDraftSettings((prev) => ({
                          ...prev,
                          sfxVol: clampVolume(event.target.value, prev.sfxVol),
                        }));
                      }}
                      className="w-full accent-orange-500"
                    />
                  </div>

                  <div className="rounded-lg border border-ninja-border bg-ninja-bg/30 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Camera Setup</p>
                      <button
                        type="button"
                        onClick={() => void scanCameras()}
                        disabled={cameraScanBusy}
                        className="rounded-md border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-[11px] font-black tracking-wide text-sky-200 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cameraScanBusy ? "SCANNING..." : "SCAN CAMERAS"}
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1.8fr,1fr]">
                      <label className="text-sm text-zinc-100">
                        <span className="block text-xs uppercase tracking-[0.14em] text-zinc-400">Camera Device</span>
                        <select
                          value={draftSettings.cameraIdx}
                          onChange={(event) => {
                            const next = clampInt(event.target.value, 0, 32, draftSettings.cameraIdx);
                            setDraftSettings((prev) => ({ ...prev, cameraIdx: next }));
                          }}
                          className="mt-2 w-full rounded-md border border-ninja-border bg-black/30 px-2 py-1 text-sm text-white"
                        >
                          {cameraOptions.length === 0 && (
                            <option value={draftSettings.cameraIdx}>Camera {draftSettings.cameraIdx}</option>
                          )}
                          {cameraOptions.map((cam) => (
                            <option key={`${cam.idx}-${cam.deviceId}`} value={cam.idx}>
                              {cam.label}
                            </option>
                          ))}
                          {!currentCameraOption && cameraOptions.length > 0 && (
                            <option value={draftSettings.cameraIdx}>Camera {draftSettings.cameraIdx}</option>
                          )}
                        </select>
                      </label>

                      <label className="text-sm text-zinc-100">
                        <span className="block text-xs uppercase tracking-[0.14em] text-zinc-400">Resolution</span>
                        <select
                          value={draftSettings.resolutionIdx}
                          onChange={(event) => {
                            const next = clampInt(event.target.value, 0, 2, draftSettings.resolutionIdx);
                            setDraftSettings((prev) => ({ ...prev, resolutionIdx: next }));
                          }}
                          className="mt-2 w-full rounded-md border border-ninja-border bg-black/30 px-2 py-1 text-sm text-white"
                        >
                          <option value={0}>640x480</option>
                          <option value={1}>1280x720</option>
                          <option value={2}>1920x1080</option>
                        </select>
                      </label>
                    </div>

                    <label className="mt-3 flex items-center justify-between rounded-lg border border-ninja-border bg-black/20 px-3 py-2 text-sm text-zinc-100">
                      <span>Camera Preview</span>
                      <input
                        type="checkbox"
                        checked={settingsPreviewEnabled}
                        onChange={(event) => setSettingsPreviewEnabled(event.target.checked)}
                        className="h-4 w-4 accent-orange-500"
                      />
                    </label>

                    {!!settingsPreviewError && (
                      <p className="mt-2 rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {settingsPreviewError}
                      </p>
                    )}

                    {settingsPreviewEnabled && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-ninja-border bg-black/45">
                        <video
                          ref={settingsPreviewRef}
                          muted
                          playsInline
                          autoPlay
                          className="h-[190px] w-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <label className="flex items-center justify-between rounded-lg border border-ninja-border bg-ninja-bg/30 px-4 py-3 text-sm text-zinc-100">
                    <span>Show Hand Skeleton</span>
                    <input
                      type="checkbox"
                      checked={draftSettings.debugHands}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDraftSettings((prev) => ({ ...prev, debugHands: checked }));
                      }}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-ninja-border bg-ninja-bg/30 px-4 py-3 text-sm text-zinc-400">
                    <span>Restricted Signs (Require 2 Hands) - Always On</span>
                    <input type="checkbox" checked readOnly disabled className="h-4 w-4 accent-orange-500" />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-ninja-border bg-ninja-bg/30 px-4 py-3 text-sm text-zinc-100">
                    <span>Fullscreen</span>
                    <input
                      type="checkbox"
                      checked={draftSettings.fullscreen}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDraftSettings((prev) => ({ ...prev, fullscreen: checked }));
                      }}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCalibrationReturnView("settings");
                      setView("calibration_gate");
                    }}
                    className="h-12 rounded-xl border border-amber-500/40 bg-amber-500/15 px-6 text-sm font-black tracking-wide text-amber-200 hover:bg-amber-500/25"
                  >
                    RUN CALIBRATION
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveSettings()}
                    className="h-12 rounded-xl bg-ninja-accent px-6 text-sm font-black tracking-wide text-white hover:bg-ninja-accent-glow"
                  >
                    SAVE & BACK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSettings(savedSettings);
                      setView("menu");
                    }}
                    className="h-12 rounded-xl border border-ninja-border bg-ninja-card px-6 text-sm font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            {view === "tutorial" && (
              <div className="mx-auto max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-6 md:p-8 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <p className="text-xs font-black tracking-[0.2em] text-ninja-dim">
                  STEP {tutorialStep + 1} / {TUTORIAL_STEPS.length}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-white">{tutorial.title}</h2>

                <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[320px,1fr]">
                  <div className="overflow-hidden rounded-2xl border border-ninja-border bg-ninja-bg/60">
                    <Image
                      src={tutorial.iconPath}
                      alt={tutorial.title}
                      width={320}
                      height={220}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="rounded-2xl border border-ninja-border bg-ninja-bg/40 p-5">
                    <ul className="space-y-3 text-sm text-zinc-200">
                      {tutorial.lines.map((line) => (
                        <li key={line} className="leading-relaxed">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setTutorialStep((prev) => Math.max(0, prev - 1))}
                    disabled={tutorialStep === 0}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-ninja-border bg-ninja-card px-5 text-sm font-black text-zinc-100 hover:border-ninja-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    BACK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void markTutorialSeen();
                      setTutorialStep(0);
                      setView("menu");
                    }}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-ninja-border bg-ninja-card px-5 text-sm font-black text-zinc-100 hover:border-ninja-accent/40"
                  >
                    SKIP
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
                        void markTutorialSeen();
                        setTutorialStep(0);
                        setView("menu");
                        return;
                      }
                      setTutorialStep((prev) => Math.min(TUTORIAL_STEPS.length - 1, prev + 1));
                    }}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-ninja-accent px-5 text-sm font-black text-white hover:bg-ninja-accent-glow"
                  >
                    {tutorialStep >= TUTORIAL_STEPS.length - 1 ? "FINISH" : "NEXT"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {view === "about" && (
              <div className="mx-auto max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <h2 className="text-3xl font-black tracking-tight text-white">ABOUT JUTSU ACADEMY</h2>
                <p className="mt-1 text-sm text-ninja-dim">Project details, controls, privacy, and roadmap.</p>

                <div className="mt-6 max-h-[62vh] space-y-4 overflow-y-auto pr-1">
                  {ABOUT_SECTIONS.map((section) => (
                    <section key={section.title} className="rounded-xl border border-ninja-border bg-ninja-bg/35 p-4">
                      <h3
                        className={`text-base font-black uppercase tracking-wide ${
                          section.tone === "success"
                            ? "text-green-300"
                            : section.tone === "error"
                              ? "text-red-300"
                              : "text-ninja-accent"
                        }`}
                      >
                        {section.title}
                      </h3>
                      <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                        {section.lines.map((line) => (
                          <li key={line} className="leading-relaxed">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {showAnnouncements && activeAnnouncement && !showWelcomeModal && !maintenanceGate && !updateGate && (
        <div className="fixed inset-0 z-[59] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close announcements"
            onClick={() => setShowAnnouncements(false)}
            className="absolute inset-0 bg-black/72"
          />
          <div className="relative w-full max-w-[620px] rounded-2xl border border-ninja-border bg-[#11141f]/96 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-300">
              Announcement {announcementIndex + 1} / {announcements.length}
            </p>
            <p className="mt-4 rounded-xl border border-ninja-border bg-black/30 px-4 py-4 text-sm leading-relaxed text-zinc-100">
              {activeAnnouncement.message}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAnnouncementIndex((prev) => Math.max(0, prev - 1))}
                disabled={announcementIndex <= 0}
                className="h-10 rounded-lg border border-ninja-border bg-ninja-card px-4 text-xs font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40 disabled:cursor-not-allowed disabled:opacity-45"
              >
                PREV
              </button>
              <button
                type="button"
                onClick={() => {
                  if (announcementIndex >= announcements.length - 1) {
                    setShowAnnouncements(false);
                    return;
                  }
                  setAnnouncementIndex((prev) => Math.min(announcements.length - 1, prev + 1));
                }}
                className="h-10 rounded-lg bg-ninja-accent px-4 text-xs font-black tracking-wide text-white hover:bg-ninja-accent-glow"
              >
                {announcementIndex >= announcements.length - 1 ? "DONE" : "NEXT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWelcomeModal && session && !maintenanceGate && !updateGate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close welcome modal"
            onClick={() => setShowWelcomeModal(false)}
            className="absolute inset-0 bg-black/75"
          />
          <div className="relative w-full max-w-[560px] rounded-2xl border border-indigo-300/40 bg-gradient-to-b from-indigo-950/92 to-slate-950/96 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.68)]">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-200/90">Welcome Back</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-white">{username}</p>
            <p className="mt-2 text-sm text-zinc-200">
              Discord-linked account is active. Progression and XP are synced through guarded RPC routes.
            </p>
            <div className="mt-4 grid gap-2 rounded-xl border border-indigo-300/25 bg-indigo-900/20 p-3 text-xs text-zinc-200 md:grid-cols-3">
              <div>Level: <span className="font-black text-white">{progression.level}</span></div>
              <div>Rank: <span className="font-black text-white">{progression.rank}</span></div>
              <div>XP: <span className="font-black text-white">{progression.xp}</span></div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowWelcomeModal(false)}
                className="h-10 rounded-lg border border-ninja-border bg-ninja-card px-4 text-xs font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40"
              >
                LATER
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWelcomeModal(false);
                  if (!tutorialMeta.tutorialSeen) {
                    setTutorialStep(0);
                    setView("tutorial");
                    return;
                  }
                  setView("mode_select");
                }}
                className="h-10 rounded-lg bg-ninja-accent px-4 text-xs font-black tracking-wide text-white hover:bg-ninja-accent-glow"
              >
                ENTER ACADEMY
              </button>
            </div>
          </div>
        </div>
      )}

      {maintenanceGate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/88 px-4">
          <div className="w-full max-w-[620px] rounded-2xl border border-red-400/35 bg-[#140f14]/96 p-7 shadow-[0_30px_95px_rgba(0,0,0,0.72)]">
            <p className="text-[11px] font-black uppercase tracking-[0.23em] text-red-300">Maintenance</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight text-white">Jutsu Academy Temporarily Offline</h3>
            <p className="mt-4 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100">
              {maintenanceGate.message}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <a
                href={maintenanceGate.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center rounded-lg border border-red-300/45 bg-red-500/18 px-4 text-xs font-black tracking-wide text-red-100 hover:bg-red-500/30"
              >
                STATUS / DISCORD
              </a>
              <button
                type="button"
                onClick={() => void pollRuntimeConfig()}
                className="h-10 rounded-lg bg-red-600 px-4 text-xs font-black tracking-wide text-white hover:bg-red-500"
              >
                RETRY
              </button>
            </div>
          </div>
        </div>
      )}

      {!maintenanceGate && updateGate && (
        <div className="fixed inset-0 z-[69] flex items-center justify-center bg-black/86 px-4">
          <div className="w-full max-w-[620px] rounded-2xl border border-amber-300/40 bg-[#15120b]/96 p-7 shadow-[0_30px_95px_rgba(0,0,0,0.72)]">
            <p className="text-[11px] font-black uppercase tracking-[0.23em] text-amber-300">Mandatory Update</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight text-white">Client Update Required</h3>
            <p className="mt-4 rounded-xl border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
              {updateGate.message}
            </p>
            <div className="mt-4 rounded-lg border border-ninja-border bg-black/25 px-3 py-2 text-xs text-zinc-200">
              Current: {WEB_APP_VERSION} • Required: {updateGate.remoteVersion || "latest"}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <a
                href={updateGate.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center rounded-lg border border-amber-300/45 bg-amber-500/18 px-4 text-xs font-black tracking-wide text-amber-100 hover:bg-amber-500/30"
              >
                GET UPDATE
              </a>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-10 rounded-lg bg-amber-600 px-4 text-xs font-black tracking-wide text-white hover:bg-amber-500"
              >
                RELOAD
              </button>
            </div>
          </div>
        </div>
      )}

      {session && masteryPanel && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close mastery panel"
            onClick={() => setMasteryPanel(null)}
            className="absolute inset-0 bg-black/70"
          />

          <div
            className="relative w-full max-w-[440px] rounded-[20px] border p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
            style={{
              backgroundColor: "rgba(18, 14, 10, 0.92)",
              borderColor: "rgb(180, 110, 30)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-[2px] rounded-[18px] border"
              style={{ borderColor: "rgba(255, 200, 80, 0.32)" }}
            />

            <p className="text-center text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: "rgb(255, 220, 80)" }}>
              {masteryPanel.newTier !== masteryPanel.previousTier || masteryPanel.previousBest === null
                ? "MASTERY UNLOCKED"
                : "NEW BEST"}
            </p>
            <p className="mt-1 text-center text-xl font-black" style={{ color: "rgb(200, 180, 130)" }}>{masteryPanel.jutsuName}</p>

            <p className="mt-3 text-center text-5xl font-black" style={{ color: "rgb(255, 245, 200)" }}>{masteryPanel.newBest.toFixed(2)}s</p>
            <p className="mt-1 text-center text-xs uppercase tracking-[0.16em]" style={{ color: "rgb(160, 220, 160)" }}>
              {masteryPanel.previousBest === null ? "FIRST RECORD" : "NEW BEST TIME"}
            </p>

            <div
              className="mx-auto mt-4 flex h-[38px] w-[240px] items-center justify-center gap-2 rounded-full border px-4"
              style={{
                color: `rgb(${masteryTierRgb.r}, ${masteryTierRgb.g}, ${masteryTierRgb.b})`,
                borderColor: `rgba(${masteryTierRgb.r}, ${masteryTierRgb.g}, ${masteryTierRgb.b}, 0.78)`,
                backgroundColor: `rgba(${masteryTierRgb.r}, ${masteryTierRgb.g}, ${masteryTierRgb.b}, 0.16)`,
              }}
            >
              <Image
                src={MASTERY_ICON_BY_TIER[masteryPanel.newTier]}
                alt={masteryPanel.newTier}
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <p className="text-sm font-black uppercase tracking-wide">
                {masteryPanel.newTier === "none" ? "UNRANKED" : masteryPanel.newTier}
              </p>
              {(masteryPanel.newTier !== masteryPanel.previousTier || masteryPanel.previousBest === null) && (
                <span className="ml-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "rgb(200, 255, 180)" }}>
                  Unlocked!
                </span>
              )}
            </div>

            {masteryDelta !== null && (
              <p
                className="mt-2 text-center text-xs font-black"
                style={{ color: masteryDelta < 0 ? "rgb(100, 230, 120)" : "rgb(230, 110, 80)" }}
              >
                {masteryDelta < 0 ? "UP" : "DOWN"} {Math.abs(masteryDelta).toFixed(2)}s
              </p>
            )}

            {masteryThresholds && (
              <div className="mt-4">
                <div className="relative h-[8px] rounded-full" style={{ backgroundColor: "rgb(50, 40, 30)" }}>
                  <div
                    className="h-[8px] rounded-full transition-all"
                    style={{
                      width: `${masteryMarkerPct}%`,
                      backgroundColor: `rgb(${masteryTierRgb.r}, ${masteryTierRgb.g}, ${masteryTierRgb.b})`,
                    }}
                  />
                  <span className="absolute -top-[6px] h-[20px] w-[1px]" style={{ left: `${masteryBronzePct}%`, backgroundColor: "rgb(196, 128, 60)" }} />
                  <span className="absolute -top-[6px] h-[20px] w-[1px]" style={{ left: `${masterySilverPct}%`, backgroundColor: "rgb(180, 190, 200)" }} />
                  <span className="absolute -top-[6px] h-[20px] w-[1px]" style={{ left: `${masteryGoldPct}%`, backgroundColor: "rgb(255, 200, 40)" }} />
                </div>
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wide" style={{ color: "rgb(180, 160, 120)" }}>
                  <span>Bronze {masteryThresholds.bronze.toFixed(1)}s</span>
                  <span>Silver {masteryThresholds.silver.toFixed(1)}s</span>
                  <span>Gold {masteryThresholds.gold.toFixed(1)}s</span>
                </div>
                {masteryNextTierHint && (
                  <p className="mt-2 text-center text-[11px]" style={{ color: "rgb(180, 160, 110)" }}>
                    Next: {masteryNextTierHint.name} ({masteryNextTierHint.target.toFixed(2)}s) - {(masteryPanel.newBest - masteryNextTierHint.target).toFixed(2)}s to go
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMasteryPanel(null)}
              className="mt-5 flex h-11 w-full items-center justify-center rounded-[12px] border text-sm font-black text-white hover:bg-[#c87314]"
              style={{
                backgroundColor: "rgb(170, 90, 15)",
                borderColor: "rgb(255, 190, 60)",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {session && levelUpPanel && !masteryPanel && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close level-up panel"
            onClick={() => setLevelUpPanel(null)}
            className="absolute inset-0 bg-black/75"
          />

          <div
            className="relative w-full max-w-[460px] rounded-[22px] border p-6 shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
            style={{
              backgroundColor: "rgba(12, 10, 18, 0.96)",
              borderColor: "rgb(200, 160, 40)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-[2px] rounded-[20px] border"
              style={{ borderColor: "rgba(255, 220, 80, 0.24)" }}
            />

            <div className="mb-2 flex items-center justify-center gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <Image
                  key={`level-star-${n}`}
                  src="/pics/mastery/star_small.png"
                  alt="star"
                  width={14}
                  height={14}
                  className="h-[14px] w-[14px] object-contain"
                />
              ))}
            </div>

            <p className="text-center text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: "rgb(255, 210, 60)" }}>LEVEL UP</p>
            {!!levelUpPanel.sourceLabel && (
              <p className="mt-1 text-center text-[11px] uppercase tracking-[0.18em]" style={{ color: "rgb(160, 150, 120)" }}>{levelUpPanel.sourceLabel}</p>
            )}

            <p className="mt-3 text-center text-[56px] font-black leading-none" style={{ color: "rgb(255, 245, 180)" }}>LV.{levelUpPanel.newLevel}</p>
            <p className="mt-1 text-center text-xs font-bold" style={{ color: "rgb(180, 165, 120)" }}>
              LV.{levelUpPanel.previousLevel} → LV.{levelUpPanel.newLevel}
            </p>

            <div className="mt-4 flex justify-center">
              <div
                className="inline-flex rounded-full border px-6 py-2 text-center"
                style={{
                  borderColor: "rgba(200, 160, 40, 0.7)",
                  backgroundColor: "rgba(200, 160, 40, 0.16)",
                }}
              >
                <p className="text-sm font-black uppercase tracking-wide" style={{ color: "rgb(255, 220, 80)" }}>{levelUpPanel.rank}</p>
              </div>
            </div>

            {levelUpPanel.unlocked.length > 0 && (
              <div className="mt-5">
                <p className="text-center text-[11px] font-black uppercase tracking-[0.17em]" style={{ color: "rgb(140, 215, 155)" }}>
                  New Jutsu Unlocked
                </p>
                <div className="mt-3 space-y-2">
                  {levelUpPanel.unlocked.slice(0, 4).map((name) => (
                    <div
                      key={name}
                      className="rounded-lg border px-3 py-2 text-center text-xs font-bold"
                      style={{
                        borderColor: "rgba(70, 200, 100, 0.7)",
                        backgroundColor: "rgba(50, 170, 80, 0.16)",
                        color: "rgb(180, 255, 200)",
                      }}
                    >
                      {name}
                    </div>
                  ))}
                  {levelUpPanel.unlocked.length > 4 && (
                    <p className="text-center text-[11px]" style={{ color: "rgb(140, 160, 140)" }}>
                      +{levelUpPanel.unlocked.length - 4} more
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setLevelUpPanel(null)}
              className="mt-6 flex h-[46px] w-full items-center justify-center rounded-[13px] border text-sm font-black text-white hover:bg-[#d77d14]"
              style={{
                backgroundColor: "rgb(165, 85, 10)",
                borderColor: "rgb(255, 200, 60)",
              }}
            >
              Awesome
            </button>
          </div>
        </div>
      )}

      {showQuitConfirm && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close quit dialog"
            onClick={() => setShowQuitConfirm(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-md rounded-2xl border border-ninja-border bg-ninja-panel p-6">
            <h3 className="text-2xl font-black tracking-tight text-white">Leaving so soon?</h3>
            <p className="mt-2 text-sm text-ninja-dim">
              QUIT in web signs out your Discord session and returns you to login.
            </p>
            {authError && (
              <p className="mt-3 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {authError}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleQuit()}
                disabled={authBusy}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-black text-white hover:bg-red-500 disabled:opacity-60"
              >
                {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                YES, QUIT
              </button>
              <button
                type="button"
                onClick={() => setShowQuitConfirm(false)}
                className="h-11 flex-1 rounded-xl border border-ninja-border bg-ninja-card text-sm font-black text-zinc-100 hover:border-ninja-accent/40"
              >
                STAY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
