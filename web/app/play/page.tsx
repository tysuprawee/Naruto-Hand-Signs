"use client";

import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  Maximize,
  Settings,
  Sparkles,
  Video,
  WifiOff,
  X,
} from "lucide-react";

import { supabase } from "@/utils/supabase";
import { OFFICIAL_JUTSUS } from "@/utils/jutsu-registry";
import {
  DEFAULT_FILTERS,
  evaluateLighting,
  type CalibrationProfile,
} from "@/utils/detection-filters";
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
import { LANGUAGE_OPTIONS, useLanguage } from "@/app/components/language-provider";
import { useBackgroundMusic } from "@/app/components/background-music-provider";
import type { LanguageCode } from "@/utils/i18n";

type PlayView =
  | "menu"
  | "mode_select"
  | "calibration_gate"
  | "calibration_session"
  | "free_session"
  | "rank_session"
  | "jutsu_library"
  | "leaderboard"
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

interface QuestStreakState {
  dailyCurrent: number;
  dailyBest: number;
  dailyLastPeriod: string;
  weeklyCurrent: number;
  weeklyBest: number;
  weeklyLastPeriod: string;
}

interface QuestState {
  daily: DailyQuestBucket;
  weekly: WeeklyQuestBucket;
  streak: QuestStreakState;
}

interface RetentionState {
  dailyPeriod: string;
  dailyMissionSeconds: number;
  dailyMissionClaimed: boolean;
  dailyMissionRewardPending: boolean;
  lastActiveAt: string;
  comebackRunsRemaining: number;
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
  subtitle?: string;
  localizeTitle?: boolean;
}

type DailyQuestDefinition = QuestDefinition & { scope: "daily"; id: DailyQuestId };
type WeeklyQuestDefinition = QuestDefinition & { scope: "weekly"; id: WeeklyQuestId };

interface StreakBonusTier {
  target: number;
  bonusPct: number;
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
  ramTigerShared: boolean;
  easyMode: boolean;
  cameraIdx: number;
  resolutionIdx: number;
  noEffects: boolean;
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

interface RunCompletionPanels {
  masteryPanel: MasteryPanelState | null;
  levelUpPanel: LevelUpPanelState | null;
}

interface LeaderboardSpeedRow {
  id: string;
  created_at?: string | null;
  username: string;
  score_time: number;
  mode: string;
  discord_id?: string | null;
  avatar_url?: string | null;
}

interface LeaderboardLevelRow {
  id: string;
  username: string;
  xp: number;
  level: number;
  rank?: string | null;
  discord_id?: string | null;
  avatar_url?: string | null;
}

const SETTINGS_STORAGE_KEY = "jutsu-play-menu-settings-v1";
const MENU_MUTE_STORAGE_KEY = "jutsu-play-menu-mute-v1";
const PENDING_RANK_QUEUE_PREFIX = "jutsu-play-pending-rank-submit-v1";
const CALIBRATION_SKIP_PREFIX = "jutsu-play-calibration-skip-v1";
const RETENTION_STORAGE_PREFIX = "jutsu-play-retention-v1";
const PENDING_RANK_QUEUE_MAX = 20;
const PENDING_RANK_REPLAY_BATCH = 4;
const DAILY_MISSION_TARGET_SECONDS = 180;
const DAILY_MISSION_REWARD_XP = 180;
const COMEBACK_INACTIVE_DAYS = 7;
const COMEBACK_BONUS_PCT = 35;
const COMEBACK_BONUS_RUNS = 3;
const WEB_APP_VERSION = "1.0.0";
const DEFAULT_RUNTIME_DATASET = {
  version: "",
  url: "/mediapipe_signs_db.csv",
  checksum: "",
} as const;

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

interface RuntimeDatasetState {
  version: string;
  url: string;
  checksum: string;
}

interface ErrorModalState {
  title: string;
  message: string;
}

interface AlertModalState {
  title: string;
  message: string;
  buttonText: string;
}

interface JutsuInfoModalState {
  name: string;
}

interface ConnectionLostState {
  title: string;
  lines: string[];
}

interface PendingRankSubmitRecord {
  id: string;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastReason: string;
  result: PlayArenaResult;
}

interface DirectProfileMetaResult {
  ok: boolean;
  profile?: Record<string, unknown>;
  reason?: string;
  detail?: string;
}

type LightingReadiness = "good" | "low_light" | "overexposed" | "low_contrast";

const DEFAULT_SETTINGS: MenuSettingsState = {
  musicVol: 0.5,
  sfxVol: 0.7,
  debugHands: false,
  restrictedSigns: false,
  ramTigerShared: true,
  easyMode: false,
  cameraIdx: 0,
  resolutionIdx: 0,
  noEffects: false,
  fullscreen: false,
};

const RESOLUTION_OPTIONS: Array<{ width: number; height: number; label: string }> = [
  { width: 640, height: 480, label: "640x480" },
  { width: 1280, height: 720, label: "1280x720" },
  { width: 1920, height: 1080, label: "1920x1080" },
];

const QUEST_BASE_DEFS: QuestDefinition[] = [
  { scope: "daily", id: "d_signs", title: "Land 25 correct signs", target: 25, reward: 120 },
  { scope: "daily", id: "d_jutsus", title: "Complete 5 jutsu runs", target: 5, reward: 180 },
  { scope: "daily", id: "d_xp", title: "Earn 450 XP", target: 450, reward: 250 },
  { scope: "weekly", id: "w_jutsus", title: "Complete 30 jutsu runs", target: 30, reward: 700 },
  { scope: "weekly", id: "w_challenges", title: "Finish 12 rank mode runs", target: 12, reward: 900 },
  { scope: "weekly", id: "w_xp", title: "Earn 4000 XP", target: 4000, reward: 1200 },
];

const DAILY_QUEST_BASE_DEFS = QUEST_BASE_DEFS.filter((def): def is DailyQuestDefinition => def.scope === "daily");
const WEEKLY_QUEST_BASE_DEFS = QUEST_BASE_DEFS.filter((def): def is WeeklyQuestDefinition => def.scope === "weekly");
const QUEST_THEME_JUTSU_NAMES = Object.keys(OFFICIAL_JUTSUS)
  .sort((a, b) => a.localeCompare(b));

const QUEST_DYNAMIC_TEMPLATES: Record<QuestId, Array<{ title: string; subtitle: string }>> = {
  d_signs: [
    { title: "Seal Precision Drill: Land {target} correct signs", subtitle: "Theme focus: {jutsu}. Any sign sequence counts toward progress." },
    { title: "Academy Form Check: Hit {target} clean hand signs", subtitle: "Keep both hands visible and chain stable detections." },
    { title: "Chakra Control Warmup: Confirm {target} correct signs", subtitle: "Inspired by {jutsu}. Accuracy over speed." },
    { title: "Practice Circuit: Register {target} valid signs", subtitle: "Any mode contributes to this mission." },
    { title: "Ninja Fundamentals: Land {target} successful signs", subtitle: "Stack clean inputs and keep the combo flowing." },
  ],
  d_jutsus: [
    { title: "Mission Rotation: Complete {target} jutsu runs", subtitle: "Theme focus: {jutsu}. Free or rank runs both count." },
    { title: "Field Exercise: Finish {target} full jutsu clears", subtitle: "Push consistent pacing through complete sequences." },
    { title: "Dojo Session: Clear {target} jutsu attempts", subtitle: "Any unlocked jutsu can be used for progress." },
    { title: "Shinobi Reps: Complete {target} run completions", subtitle: "Steady clears build daily streak momentum." },
    { title: "Combat Routine: Finish {target} jutsu cycles", subtitle: "Use this to farm XP and unlocks efficiently." },
  ],
  d_xp: [
    { title: "Growth Target: Earn {target} XP today", subtitle: "Theme focus: {jutsu}. Quest and run rewards both apply." },
    { title: "Level Push: Farm {target} XP in one daily period", subtitle: "Keep chaining runs to maximize streak boost value." },
    { title: "Training Grind: Collect {target} XP", subtitle: "Clear quests and jutsu runs to hit the mark fast." },
    { title: "Academy Advancement: Gain {target} XP", subtitle: "Every completed run contributes toward this quota." },
    { title: "Power Build: Accumulate {target} XP today", subtitle: "Stack mission claims and regular run rewards." },
  ],
  w_jutsus: [
    { title: "Weekly Output: Complete {target} jutsu runs", subtitle: "Theme focus: {jutsu}. Build volume across the full week." },
    { title: "Long Arc Training: Finish {target} jutsu clears", subtitle: "Daily consistency keeps this objective on pace." },
    { title: "Shinobi Marathon: Clear {target} jutsu cycles", subtitle: "Any unlocked move set can contribute." },
    { title: "Dojo Grind Week: Complete {target} total runs", subtitle: "Keep free and rank sessions rotating." },
    { title: "Weekly Trial Path: Reach {target} jutsu completions", subtitle: "Reliable clears fuel weekly streak progress." },
  ],
  w_challenges: [
    { title: "Rank Track: Finish {target} rank mode runs", subtitle: "Theme focus: {jutsu}. Push secure submissions all week." },
    { title: "Competitive Week: Complete {target} ranked clears", subtitle: "Run proof submissions count when runs complete." },
    { title: "Leaderboard Prep: Finish {target} rank attempts", subtitle: "Use rank mode reps to sharpen timings." },
    { title: "Exam Week: Land {target} successful rank runs", subtitle: "Consistent completions keep weekly streak alive." },
    { title: "Challenge Quota: Complete {target} rank mode sessions", subtitle: "Secure run tokens and consistent execution matter." },
  ],
  w_xp: [
    { title: "Weekly Growth Plan: Earn {target} XP", subtitle: "Theme focus: {jutsu}. Quests and runs stack together." },
    { title: "Power Week: Farm {target} XP total", subtitle: "Spread sessions across the week to avoid a final-day crunch." },
    { title: "Progression Surge: Collect {target} XP", subtitle: "Keep quest claims on cooldown and chain run clears." },
    { title: "Rank Advancement Week: Gain {target} XP", subtitle: "Use streak boosts to scale your XP gain." },
    { title: "Shinobi XP Contract: Reach {target} XP", subtitle: "Sustain momentum through daily play windows." },
  ],
};

function hashQuestSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fillQuestTemplate(template: string, context: { target: number; reward: number; jutsu: string }): string {
  return template
    .replaceAll("{target}", String(context.target))
    .replaceAll("{reward}", String(context.reward))
    .replaceAll("{jutsu}", context.jutsu);
}

function buildDynamicQuestDef<T extends QuestDefinition>(base: T, period: string, identitySeed: string): T {
  const templates = QUEST_DYNAMIC_TEMPLATES[base.id];
  if (!Array.isArray(templates) || templates.length === 0) return base;

  const themeSeed = `${identitySeed}|${base.scope}|${base.id}|${period}`;
  const template = templates[hashQuestSeed(themeSeed) % templates.length];
  const jutsu = QUEST_THEME_JUTSU_NAMES[hashQuestSeed(`${themeSeed}|jutsu`) % Math.max(1, QUEST_THEME_JUTSU_NAMES.length)] || "Shadow Clone";
  const context = { target: base.target, reward: base.reward, jutsu };

  return {
    ...base,
    title: fillQuestTemplate(template.title, context),
    subtitle: fillQuestTemplate(template.subtitle, context),
    localizeTitle: false,
  };
}

function buildDynamicDailyQuestDefs(period: string, identitySeed: string): DailyQuestDefinition[] {
  return DAILY_QUEST_BASE_DEFS.map((def) => buildDynamicQuestDef(def, period, identitySeed));
}

function buildDynamicWeeklyQuestDefs(period: string, identitySeed: string): WeeklyQuestDefinition[] {
  return WEEKLY_QUEST_BASE_DEFS.map((def) => buildDynamicQuestDef(def, period, identitySeed));
}

const DAILY_STREAK_BONUS_TIERS: StreakBonusTier[] = [
  { target: 3, bonusPct: 5 },
  { target: 7, bonusPct: 10 },
  { target: 14, bonusPct: 15 },
];
const WEEKLY_STREAK_BONUS_TIERS: StreakBonusTier[] = [
  { target: 2, bonusPct: 5 },
  { target: 4, bonusPct: 10 },
  { target: 8, bonusPct: 15 },
];

function resolveStreakBonusPct(streak: number, tiers: StreakBonusTier[]): number {
  let bonus = 0;
  for (const tier of tiers) {
    if (streak >= tier.target) bonus = Math.max(bonus, tier.bonusPct);
  }
  return bonus;
}

function getNextStreakTier(streak: number, tiers: StreakBonusTier[]): StreakBonusTier | null {
  for (const tier of tiers) {
    if (streak < tier.target) return tier;
  }
  return null;
}

function createDefaultQuestStreakState(): QuestStreakState {
  return {
    dailyCurrent: 0,
    dailyBest: 0,
    dailyLastPeriod: "",
    weeklyCurrent: 0,
    weeklyBest: 0,
    weeklyLastPeriod: "",
  };
}

function parseUtcDailyId(period: string): Date | null {
  const text = String(period || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function parseUtcIsoWeekId(period: string): Date | null {
  const text = String(period || "").trim();
  const match = /^(\d{4})-W(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4, 0, 0, 0));
  const jan4Dow = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4.getTime());
  mondayWeek1.setUTCDate(mondayWeek1.getUTCDate() - jan4Dow + 1);
  const mondayTarget = new Date(mondayWeek1.getTime());
  mondayTarget.setUTCDate(mondayTarget.getUTCDate() + ((week - 1) * 7));
  return mondayTarget;
}

function diffWholeDaysUtc(fromPeriod: string, toPeriod: string): number | null {
  const from = parseUtcDailyId(fromPeriod);
  const to = parseUtcDailyId(toPeriod);
  if (!from || !to) return null;
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function diffWholeWeeksUtc(fromPeriod: string, toPeriod: string): number | null {
  const from = parseUtcIsoWeekId(fromPeriod);
  const to = parseUtcIsoWeekId(toPeriod);
  if (!from || !to) return null;
  return Math.floor((to.getTime() - from.getTime()) / (7 * 86400000));
}

function sanitizeQuestStreakState(raw: unknown): QuestStreakState {
  const source = isRecord(raw) ? raw : {};
  return {
    dailyCurrent: Math.max(0, Math.floor(Number(source.dailyCurrent) || 0)),
    dailyBest: Math.max(0, Math.floor(Number(source.dailyBest) || 0)),
    dailyLastPeriod: String(source.dailyLastPeriod || "").trim(),
    weeklyCurrent: Math.max(0, Math.floor(Number(source.weeklyCurrent) || 0)),
    weeklyBest: Math.max(0, Math.floor(Number(source.weeklyBest) || 0)),
    weeklyLastPeriod: String(source.weeklyLastPeriod || "").trim(),
  };
}

function isDailyQuestBucketComplete(bucket: DailyQuestBucket): boolean {
  return DAILY_QUEST_BASE_DEFS.every((def) => {
    const entry = bucket.quests[def.id];
    return Boolean(entry?.claimed || Number(entry?.progress || 0) >= def.target);
  });
}

function isWeeklyQuestBucketComplete(bucket: WeeklyQuestBucket): boolean {
  return WEEKLY_QUEST_BASE_DEFS.every((def) => {
    const entry = bucket.quests[def.id];
    return Boolean(entry?.claimed || Number(entry?.progress || 0) >= def.target);
  });
}

function reconcileQuestStreakState(
  base: QuestStreakState,
  daily: DailyQuestBucket,
  weekly: WeeklyQuestBucket,
): QuestStreakState {
  const next: QuestStreakState = {
    ...base,
    dailyCurrent: Math.max(0, Math.floor(base.dailyCurrent || 0)),
    dailyBest: Math.max(0, Math.floor(base.dailyBest || 0)),
    weeklyCurrent: Math.max(0, Math.floor(base.weeklyCurrent || 0)),
    weeklyBest: Math.max(0, Math.floor(base.weeklyBest || 0)),
  };

  if (next.dailyLastPeriod && next.dailyLastPeriod !== daily.period) {
    const dailyGap = diffWholeDaysUtc(next.dailyLastPeriod, daily.period);
    if (dailyGap !== null && dailyGap > 1) {
      next.dailyCurrent = 0;
    }
  }
  if (isDailyQuestBucketComplete(daily) && next.dailyLastPeriod !== daily.period) {
    const dailyGap = diffWholeDaysUtc(next.dailyLastPeriod, daily.period);
    if (!next.dailyLastPeriod) {
      next.dailyCurrent = 1;
    } else if (dailyGap === 1) {
      next.dailyCurrent = Math.max(1, next.dailyCurrent + 1);
    } else {
      next.dailyCurrent = 1;
    }
    next.dailyBest = Math.max(next.dailyBest, next.dailyCurrent);
    next.dailyLastPeriod = daily.period;
  }

  if (next.weeklyLastPeriod && next.weeklyLastPeriod !== weekly.period) {
    const weeklyGap = diffWholeWeeksUtc(next.weeklyLastPeriod, weekly.period);
    if (weeklyGap !== null && weeklyGap > 1) {
      next.weeklyCurrent = 0;
    }
  }
  if (isWeeklyQuestBucketComplete(weekly) && next.weeklyLastPeriod !== weekly.period) {
    const weeklyGap = diffWholeWeeksUtc(next.weeklyLastPeriod, weekly.period);
    if (!next.weeklyLastPeriod) {
      next.weeklyCurrent = 1;
    } else if (weeklyGap === 1) {
      next.weeklyCurrent = Math.max(1, next.weeklyCurrent + 1);
    } else {
      next.weeklyCurrent = 1;
    }
    next.weeklyBest = Math.max(next.weeklyBest, next.weeklyCurrent);
    next.weeklyLastPeriod = weekly.period;
  }

  return next;
}

const LEADERBOARD_PAGE_SIZE = 10;
const LEADERBOARD_MODE_LIST = Object.entries(OFFICIAL_JUTSUS)
  .sort((a, b) => a[1].minLevel - b[1].minLevel || a[0].localeCompare(b[0]))
  .map(([name]) => name.toUpperCase());

const JUTSU_TEXTURES: Record<string, string> = {
  "Shadow Clone": "/pics/textured_buttons/shadow_clone.jpg",
  Rasengan: "/pics/textured_buttons/rasengan.jpg",
  Rasenshuriken: "/pics/textured_buttons/rasenshuriken.jpg",
  Fireball: "/pics/textured_buttons/fireball.jpg",
  "Phoenix Flower": "/pics/textured_buttons/phoenix_flowers.jpg",
  "Shadow Clone + Chidori Combo": "/pics/textured_buttons/shadow_clone_chidori.jpg",
  "Shadow Clone + Rasengan Combo": "/pics/textured_buttons/shadow_clone_rasengan.jpg",
  Chidori: "/pics/textured_buttons/chidori.jpg",
  "Water Dragon": "/pics/textured_buttons/water_dragon.jpg",
  Sharingan: "/pics/textured_buttons/sharingan.jpg",
  "Mangekyou Sharingan": "/effects/m_sharingan.jpg",
  "Reaper Death Seal": "/pics/textured_buttons/reaper_death.jpg",
};

const JUTSU_INFO_SUMMARIES: Record<string, string> = {
  "Shadow Clone": "Create solid clones to overwhelm your target and set up combo pressure.",
  Rasengan: "Concentrate chakra into a compressed sphere and drive it through the opponent.",
  Rasenshuriken: "A wind-infused evolution of Rasengan that forms a spinning chakra shuriken with extreme cutting force.",
  Fireball: "A classic Uchiha fire release technique with wide area pressure and high impact.",
  "Phoenix Flower": "Rapid fire-style projectiles that spread to force movement and openings.",
  Chidori: "Lightning chakra focused into a piercing strike with explosive speed.",
  "Water Dragon": "A long-form water release sequence that summons a crushing dragon torrent.",
  Sharingan: "Heightened visual perception to read movement and react ahead of time.",
  "Mangekyou Sharingan": "An evolved ocular state with advanced visual control and pressure effects.",
  "Reaper Death Seal": "Forbidden sealing art with a heavy cost and extreme finishing power.",
  "Shadow Clone + Rasengan Combo": "Deploy clones first, then collapse the angle with synchronized Rasengan.",
  "Shadow Clone + Chidori Combo": "Split with clones, then chain into lightning finish from converging lanes.",
};

const JUTSU_EFFECT_LABELS: Record<string, string> = {
  fire: "Fire Style",
  lightning: "Lightning Style",
  clone: "Clone Technique",
  water: "Water Style",
  eye: "Dojutsu",
  rasengan: "Chakra Sphere",
  rasenshuriken: "Wind Chakra Sphere",
  reaper: "Sealing Art",
};

const MASTERY_ICON_BY_TIER: Record<"none" | "bronze" | "silver" | "gold", string> = {
  none: "/pics/ui/reward_xp.png",
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
      "OAuth login is used for account identity and progression sync.",
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

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value !== 0 : fallback;
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off"].includes(text)) return false;
  return fallback;
}

type MenuSettingsInput = Partial<Record<keyof MenuSettingsState, unknown>>;

function sanitizeSettings(raw: MenuSettingsInput | null | undefined): MenuSettingsState {
  return {
    musicVol: clampVolume(raw?.musicVol, DEFAULT_SETTINGS.musicVol),
    sfxVol: clampVolume(raw?.sfxVol, DEFAULT_SETTINGS.sfxVol),
    debugHands: parseBoolean(raw?.debugHands, DEFAULT_SETTINGS.debugHands),
    restrictedSigns: parseBoolean(raw?.restrictedSigns, DEFAULT_SETTINGS.restrictedSigns),
    ramTigerShared: parseBoolean(raw?.ramTigerShared, DEFAULT_SETTINGS.ramTigerShared),
    easyMode: false,
    cameraIdx: clampInt(raw?.cameraIdx, 0, 16, DEFAULT_SETTINGS.cameraIdx),
    resolutionIdx: clampInt(raw?.resolutionIdx, 0, 2, DEFAULT_SETTINGS.resolutionIdx),
    noEffects: parseBoolean(raw?.noEffects, DEFAULT_SETTINGS.noEffects),
    fullscreen: parseBoolean(raw?.fullscreen, DEFAULT_SETTINGS.fullscreen),
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

function readStoredMenuMute(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MENU_MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRecordJson(raw: unknown): Record<string, unknown> | null {
  if (isRecord(raw)) return raw;
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function firstRecord(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (isRecord(value)) return value;
  }
  return null;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const raw of values) {
    const value = String(raw || "").trim();
    if (value) return value;
  }
  return "";
}

function normalizeJutsuNameToken(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCanonicalJutsuName(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (OFFICIAL_JUTSUS[value]) return value;
  const lower = value.toLowerCase();
  const matched = Object.keys(OFFICIAL_JUTSUS).find((name) => name.toLowerCase() === lower);
  if (matched) return matched;
  const normalized = normalizeJutsuNameToken(value);
  if (!normalized) return value;
  const normalizedMatch = Object.keys(OFFICIAL_JUTSUS).find(
    (name) => normalizeJutsuNameToken(name) === normalized,
  );
  return normalizedMatch || value;
}

function getJutsuUiName(raw: unknown): string {
  const canonical = resolveCanonicalJutsuName(raw);
  if (canonical && OFFICIAL_JUTSUS[canonical]) {
    return String(OFFICIAL_JUTSUS[canonical].displayName || canonical);
  }
  return String(raw || "");
}

function normalizeDiscordUsername(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  const withoutAt = value.startsWith("@") ? value.slice(1).trim() : value;
  const tagged = withoutAt.match(/^(.+?)#\d{1,5}$/);
  const normalized = (tagged ? tagged[1] : withoutAt).trim();
  return normalized;
}

function normalizeProfileUsername(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  return value
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function buildBootstrapUsernameCandidates(baseUsername: string, discordId: string): string[] {
  const cleanBase = normalizeProfileUsername(baseUsername) || "shinobi";
  const numericDiscordId = String(discordId || "").replace(/\D/g, "");
  const suffix6 = (numericDiscordId || "000000").slice(-6);
  const suffix4 = suffix6.slice(-4);
  const candidates = [
    cleanBase,
    `${cleanBase}_${suffix4}`,
    `${cleanBase}_${suffix6}`,
    `shinobi_${suffix6}`,
  ];
  return Array.from(new Set(candidates.map((value) => normalizeProfileUsername(value)).filter(Boolean)));
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
  return snowflake || "";
}

function resolveSessionIdentity(session: Session | null): AuthIdentity | null {
  const user = session?.user;
  if (!user) return null;

  const metadata = isRecord(user.user_metadata) ? user.user_metadata : {};
  const appMetadata = isRecord(user.app_metadata) ? user.app_metadata : {};
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const discordIdentity = identities.find((entry) => String(entry?.provider || "").toLowerCase() === "discord");
  const identityData = isRecord(discordIdentity?.identity_data) ? discordIdentity.identity_data : {};

  const username = pickDiscordUsername(
    identityData.username,
    identityData.preferred_username,
    identityData.user_name,
    identityData.name,
    identityData.full_name,
    metadata.username,
    metadata.preferred_username,
    metadata.user_name,
    metadata.name,
    metadata.full_name,
    String(user.email || "").split("@")[0],
  );
  const providerIdentity = pickDiscordId(
    identityData.provider_id,
    identityData.user_id,
    identityData.id,
    metadata.provider_id,
    metadata.user_id,
    metadata.id,
    appMetadata.provider_id,
    appMetadata.discord_id,
    identityData.sub,
    metadata.sub,
    appMetadata.sub,
    discordIdentity?.id,
  );
  const accountIdentity = firstNonEmpty(
    user.id,
    providerIdentity,
  );

  if (!username || !accountIdentity) return null;
  return { username, discordId: accountIdentity };
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
      void root.requestFullscreen().catch(() => { });
      return;
    }
    if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
    return;
  }

  if (!document.fullscreenElement) return;
  if (doc.exitFullscreen) {
    void doc.exitFullscreen().catch(() => { });
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

function formatDurationMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
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
    streak: createDefaultQuestStreakState(),
  };
}

function createDefaultRetentionState(now: Date): RetentionState {
  return {
    dailyPeriod: utcDailyId(now),
    dailyMissionSeconds: 0,
    dailyMissionClaimed: false,
    dailyMissionRewardPending: false,
    lastActiveAt: "",
    comebackRunsRemaining: 0,
  };
}

function sanitizeRetentionState(raw: unknown, now: Date): RetentionState {
  const source = isRecord(raw) ? raw : {};
  const base = createDefaultRetentionState(now);
  const dailyMissionSeconds = Math.max(0, Math.floor(Number(source.dailyMissionSeconds) || 0));
  return {
    dailyPeriod: String(source.dailyPeriod || base.dailyPeriod),
    dailyMissionSeconds: Math.max(0, Math.min(DAILY_MISSION_TARGET_SECONDS, dailyMissionSeconds)),
    dailyMissionClaimed: parseBoolean(source.dailyMissionClaimed, false),
    dailyMissionRewardPending: parseBoolean(source.dailyMissionRewardPending, false),
    lastActiveAt: String(source.lastActiveAt || "").trim(),
    comebackRunsRemaining: Math.max(0, Math.floor(Number(source.comebackRunsRemaining) || 0)),
  };
}

function reconcileRetentionState(base: RetentionState, now: Date): RetentionState {
  const currentDailyId = utcDailyId(now);
  const next: RetentionState = {
    ...base,
    dailyMissionSeconds: Math.max(0, Math.min(DAILY_MISSION_TARGET_SECONDS, Math.floor(Number(base.dailyMissionSeconds) || 0))),
    comebackRunsRemaining: Math.max(0, Math.floor(Number(base.comebackRunsRemaining) || 0)),
  };

  if (next.dailyPeriod !== currentDailyId) {
    next.dailyPeriod = currentDailyId;
    next.dailyMissionSeconds = 0;
    next.dailyMissionClaimed = false;
    next.dailyMissionRewardPending = false;
  }

  if (next.dailyMissionSeconds >= DAILY_MISSION_TARGET_SECONDS) {
    next.dailyMissionClaimed = true;
  }

  const lastActiveMs = Date.parse(next.lastActiveAt);
  if (Number.isFinite(lastActiveMs)) {
    const lastActiveDaily = utcDailyId(new Date(lastActiveMs));
    const gapDays = diffWholeDaysUtc(lastActiveDaily, currentDailyId);
    if (gapDays !== null && gapDays >= COMEBACK_INACTIVE_DAYS && next.comebackRunsRemaining <= 0) {
      next.comebackRunsRemaining = COMEBACK_BONUS_RUNS;
    }
  }

  return next;
}

function retentionStateEquals(a: RetentionState, b: RetentionState): boolean {
  return (
    a.dailyPeriod === b.dailyPeriod
    && a.dailyMissionSeconds === b.dailyMissionSeconds
    && a.dailyMissionClaimed === b.dailyMissionClaimed
    && a.dailyMissionRewardPending === b.dailyMissionRewardPending
    && a.lastActiveAt === b.lastActiveAt
    && a.comebackRunsRemaining === b.comebackRunsRemaining
  );
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
    streak: createDefaultQuestStreakState(),
  };
  const inputStreak = sanitizeQuestStreakState(source.streak);
  result.streak = reconcileQuestStreakState(inputStreak, result.daily, result.weekly);
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
    const name = resolveCanonicalJutsuName(nameRaw);
    if (!name) continue;
    const best = isRecord(row) ? Number(row.best_time ?? row.bestTime) : Number(row);
    if (!Number.isFinite(best) || best <= 0) continue;
    const prevBest = Number(out[name]?.bestTime || 0);
    if (Number.isFinite(prevBest) && prevBest > 0 && prevBest <= best) continue;
    out[name] = { bestTime: best };
  }
  return out;
}

function mergeMasteryMapsKeepBest(...maps: MasteryMap[]): MasteryMap {
  const out: MasteryMap = {};
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    for (const [nameRaw, row] of Object.entries(map)) {
      const name = resolveCanonicalJutsuName(nameRaw);
      if (!name) continue;
      const best = Number(row?.bestTime);
      if (!Number.isFinite(best) || best <= 0) continue;
      const prev = Number(out[name]?.bestTime || 0);
      if (!Number.isFinite(prev) || prev <= 0 || best < prev) {
        out[name] = { bestTime: best };
      }
    }
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
  const canonicalJutsu = resolveCanonicalJutsuName(jutsuName);
  const seqLen = Math.max(1, OFFICIAL_JUTSUS[canonicalJutsu]?.sequence?.length || 1);
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
  const canonicalJutsu = resolveCanonicalJutsuName(jutsuName);
  const seqLen = Math.max(1, OFFICIAL_JUTSUS[canonicalJutsu]?.sequence?.length || 1);
  return 50 + (seqLen * 10);
}

function normalizeSignToken(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function formatSignLabel(raw: unknown): string {
  return String(raw || "")
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
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

interface RankSecureSubmitAttemptResult {
  ok: boolean;
  retryable: boolean;
  reason: string;
  statusText: string;
  detailText: string;
  rankText: string;
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

function toUtcIsoNoMs(now = new Date()): string {
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function buildPendingRankQueueStorageKey(discordId: string): string {
  return `${PENDING_RANK_QUEUE_PREFIX}:${String(discordId || "").trim()}`;
}

function buildCalibrationSkipStorageKey(discordId: string): string {
  return `${CALIBRATION_SKIP_PREFIX}:${String(discordId || "").trim()}`;
}

function buildRetentionStorageKey(discordId: string): string {
  return `${RETENTION_STORAGE_PREFIX}:${String(discordId || "").trim()}`;
}

function makePendingRankRecordId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `rank_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function buildPendingRankFingerprint(result: PlayArenaResult): string {
  const proof = result.proof as PlayArenaProof | undefined;
  const runToken = String(proof?.runToken || "").trim();
  if (runToken) return `token:${runToken}`;

  const startedAt = String(proof?.clientStartedAtIso || "").trim();
  const elapsed = Number(result.elapsedSeconds || 0);
  const elapsedSafe = Number.isFinite(elapsed) ? elapsed : 0;
  const expectedSigns = Math.max(0, Math.floor(Number(result.expectedSigns) || 0));
  return `run:${String(result.jutsuName || "").trim().toUpperCase()}|${startedAt}|${elapsedSafe.toFixed(4)}|${expectedSigns}`;
}

function isTransientSubmitFailure(reasonRaw: unknown, detailRaw: unknown): boolean {
  const text = `${String(reasonRaw || "")} ${String(detailRaw || "")}`.toLowerCase();
  return /(offline|network|timeout|timed out|fetch failed|failed to fetch|connection|rpc_error)/i.test(text);
}

function isDuplicateSubmitFailure(reasonRaw: unknown, detailRaw: unknown): boolean {
  const text = `${String(reasonRaw || "")} ${String(detailRaw || "")}`.toLowerCase();
  return /(duplicate|already|replay|exists|token_used|already_submitted|already_recorded)/i.test(text);
}

function shouldFallbackToLegacyBoundRpc(reasonRaw: unknown, detailRaw: unknown): boolean {
  const text = `${String(reasonRaw || "")} ${String(detailRaw || "")}`.toLowerCase();
  if (text.includes("session_discord_missing")) return true;
  if (text.includes("session_identity_mismatch")) return true;
  if (text.includes("auth_guard_discord_identity")) return true;
  if ((text.includes("rpc_error") || text.includes("rpc_exception")) && text.includes("does not exist")) return true;
  if ((text.includes("rpc_error") || text.includes("rpc_exception")) && text.includes("permission denied")) return true;
  return false;
}

function sanitizeQueuedRankResult(raw: unknown): PlayArenaResult | null {
  if (!isRecord(raw)) return null;
  if (String(raw.mode || "").trim() !== "rank") return null;

  const jutsuName = String(raw.jutsuName || "").trim();
  if (!jutsuName) return null;

  const expectedSigns = Math.max(1, Math.floor(Number(raw.expectedSigns) || 0));
  const signsLanded = Math.max(0, Math.floor(Number(raw.signsLanded) || 0));
  const elapsedSeconds = Number(raw.elapsedSeconds);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return null;

  const proofRaw = isRecord(raw.proof) ? raw.proof : null;
  if (!proofRaw) return null;
  const events = sanitizeProofEvents(proofRaw.events);
  if (events.length === 0) return null;

  const cooldownMs = Number(proofRaw.cooldownMs);
  const voteRequiredHits = Math.floor(Number(proofRaw.voteRequiredHits));
  const voteMinConfidence = Number(proofRaw.voteMinConfidence);
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) return null;
  if (!Number.isFinite(voteRequiredHits) || voteRequiredHits <= 0) return null;
  if (!Number.isFinite(voteMinConfidence) || voteMinConfidence <= 0) return null;

  const proof: PlayArenaProof = {
    runToken: String(proofRaw.runToken || ""),
    tokenSource: String(proofRaw.tokenSource || "none"),
    tokenIssueReason: String(proofRaw.tokenIssueReason || ""),
    clientStartedAtIso: String(proofRaw.clientStartedAtIso || ""),
    events,
    eventOverflow: Boolean(proofRaw.eventOverflow),
    cooldownMs,
    voteRequiredHits,
    voteMinConfidence,
    restrictedSigns: Boolean(proofRaw.restrictedSigns),
    cameraIdx: Math.max(0, Math.floor(Number(proofRaw.cameraIdx) || 0)),
    resolutionIdx: Math.max(0, Math.floor(Number(proofRaw.resolutionIdx) || 0)),
  };

  return {
    mode: "rank",
    jutsuName,
    signsLanded,
    expectedSigns,
    elapsedSeconds,
    proof,
  };
}

function sanitizePendingRankRecord(raw: unknown): PendingRankSubmitRecord | null {
  if (!isRecord(raw)) return null;
  const result = sanitizeQueuedRankResult(raw.result);
  if (!result) return null;

  const id = String(raw.id || "").trim() || makePendingRankRecordId();
  const createdAt = String(raw.createdAt || "").trim() || toUtcIsoNoMs();
  const updatedAt = String(raw.updatedAt || "").trim() || createdAt;
  const attempts = Math.max(0, Math.floor(Number(raw.attempts) || 0));
  const lastReason = String(raw.lastReason || "").trim().slice(0, 160);
  const fingerprint = String(raw.fingerprint || "").trim() || buildPendingRankFingerprint(result);

  return {
    id,
    fingerprint,
    createdAt,
    updatedAt,
    attempts,
    lastReason,
    result,
  };
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

  const rawExpectedSigns = Number(result.expectedSigns);
  if (!Number.isFinite(rawExpectedSigns)) {
    return fail("invalid_expected_signs", "Expected sign count is invalid.");
  }
  const expectedSigns = Math.max(0, Math.floor(rawExpectedSigns));
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
      if (Number.isFinite(eventExpectedSigns) && eventExpectedSigns >= 0 && eventExpectedSigns !== expectedSigns) {
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

function isTransientVideoPlayError(err: unknown): boolean {
  const name = String((err as { name?: unknown })?.name || "").toLowerCase();
  const message = String((err as { message?: unknown })?.message || err || "").toLowerCase();
  return (
    name === "aborterror"
    || message.includes("the play() request was interrupted")
    || message.includes("interrupted by a new load request")
    || message.includes("aborterror")
  );
}

function formatLeaderboardModeLabel(rawMode: string): string {
  return String(rawMode || "")
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function getSpeedLeaderboardIdentityKey(row: Pick<LeaderboardSpeedRow, "discord_id" | "username">): string {
  const discordId = String(row.discord_id || "").trim();
  if (discordId) return `d:${discordId}`;
  const username = normalizeDiscordUsername(row.username).toLowerCase();
  if (username) return `u:${username}`;
  return "";
}

function compareSpeedLeaderboardRows(a: LeaderboardSpeedRow, b: LeaderboardSpeedRow): number {
  const aScore = Number(a.score_time);
  const bScore = Number(b.score_time);
  if (aScore !== bScore) return aScore - bScore;

  const aCreatedAt = Number(new Date(String(a.created_at || "")).getTime());
  const bCreatedAt = Number(new Date(String(b.created_at || "")).getTime());
  if (Number.isFinite(aCreatedAt) && Number.isFinite(bCreatedAt) && aCreatedAt !== bCreatedAt) {
    return aCreatedAt - bCreatedAt;
  }

  return String(a.id || "").localeCompare(String(b.id || ""));
}

function dedupeSpeedLeaderboardRows(rows: LeaderboardSpeedRow[]): LeaderboardSpeedRow[] {
  const bestByIdentity = new Map<string, LeaderboardSpeedRow>();
  const fallbackRows: LeaderboardSpeedRow[] = [];
  for (const row of rows) {
    const score = Number(row.score_time);
    if (!Number.isFinite(score) || score <= 0) continue;

    const identityKey = getSpeedLeaderboardIdentityKey(row);
    if (!identityKey) {
      fallbackRows.push(row);
      continue;
    }

    const existing = bestByIdentity.get(identityKey);
    if (!existing || compareSpeedLeaderboardRows(row, existing) < 0) {
      bestByIdentity.set(identityKey, row);
    }
  }
  return [...bestByIdentity.values(), ...fallbackRows].sort(compareSpeedLeaderboardRows);
}

function getLeaderboardTitleForRank(rank: number): "HOKAGE" | "JONIN" | "CHUNIN" | "GENIN" {
  if (rank === 1) return "HOKAGE";
  if (rank <= 3) return "JONIN";
  if (rank <= 10) return "CHUNIN";
  return "GENIN";
}

function getLeaderboardTitleClass(rank: number): string {
  if (rank === 1) return "text-amber-300";
  if (rank <= 3) return "text-zinc-200";
  if (rank <= 10) return "text-orange-300";
  return "text-zinc-300";
}

function LockedPanel({
  title,
  description,
  onBack,
  joinLabel = "JOIN DISCORD FOR UPDATES",
  backLabel = "BACK TO SELECT PATH",
}: {
  title: string;
  description: string;
  onBack: () => void;
  joinLabel?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-7 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-black text-ninja-dim hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>

      <h2 className="text-3xl font-black tracking-tight text-white">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ninja-dim">{description}</p>

      <a
        href="https://discord.gg/7xBQ22SnN2"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-6 text-sm font-black text-indigo-200 hover:bg-indigo-500/25"
      >
        {joinLabel}
      </a>
    </div>
  );
}

function PlayPageInner() {
  const { language, setLanguage, t } = useLanguage();
  const { setMusicMuted: setGlobalMusicMuted, setMusicVolume: setGlobalMusicVolume } = useBackgroundMusic();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authBusy, setAuthBusy] = useState(false);
  const [authBusyProvider, setAuthBusyProvider] = useState<"discord" | "google" | null>(null);
  const [authError, setAuthError] = useState(
    !supabase
      ? "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      : "",
  );

  const [view, setView] = useState<PlayView>("menu");
  const [libraryIntent, setLibraryIntent] = useState<LibraryIntent>("browse");
  const [selectedJutsu, setSelectedJutsu] = useState<string>(Object.keys(OFFICIAL_JUTSUS)[0] || "");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [questNotice, setQuestNotice] = useState("");
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [serverClockSynced, setServerClockSynced] = useState(false);
  const [maintenanceGate, setMaintenanceGate] = useState<RuntimeGateState | null>(null);
  const [updateGate, setUpdateGate] = useState<RuntimeGateState | null>(null);
  const [runtimeDataset, setRuntimeDataset] = useState<RuntimeDatasetState>(DEFAULT_RUNTIME_DATASET);
  const [runtimeDatasetSyncedAt, setRuntimeDatasetSyncedAt] = useState(0);
  const [connectionLostState, setConnectionLostState] = useState<ConnectionLostState | null>(null);
  const [errorModal, setErrorModal] = useState<ErrorModalState | null>(null);
  const [alertModal, setAlertModal] = useState<AlertModalState | null>(null);
  const [jutsuInfoModal, setJutsuInfoModal] = useState<JutsuInfoModalState | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [cameraOptions, setCameraOptions] = useState<Array<{ idx: number; label: string; deviceId: string }>>([]);
  const [cameraScanBusy, setCameraScanBusy] = useState(false);
  const [settingsPreviewEnabled, setSettingsPreviewEnabled] = useState(false);
  const [settingsPreviewError, setSettingsPreviewError] = useState("");
  const settingsPreviewRef = useRef<HTMLVideoElement | null>(null);
  const settingsPreviewStreamRef = useRef<MediaStream | null>(null);
  const calibrationGatePreviewRef = useRef<HTMLVideoElement | null>(null);
  const calibrationGatePreviewStreamRef = useRef<MediaStream | null>(null);
  const calibrationGateSampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const calibrationGatePreviewStartSeqRef = useRef(0);
  const [calibrationGateCameraIdx, setCalibrationGateCameraIdx] = useState(0);
  const [calibrationGateResolutionIdx, setCalibrationGateResolutionIdx] = useState(0);
  const [calibrationGateReady, setCalibrationGateReady] = useState(false);
  const [calibrationGateError, setCalibrationGateError] = useState("");
  const [calibrationGateSkipped, setCalibrationGateSkipped] = useState(false);
  const [calibrationGateLighting, setCalibrationGateLighting] = useState<LightingReadiness>("good");
  const [calibrationGateDetected, setCalibrationGateDetected] = useState("IDLE");
  const [calibrationGateConfidence, setCalibrationGateConfidence] = useState(0);
  const [calibrationGateSamples, setCalibrationGateSamples] = useState(0);
  const announcementDigestRef = useRef("");

  const [savedSettings, setSavedSettings] = useState<MenuSettingsState>(() => readStoredSettings());
  const [draftSettings, setDraftSettings] = useState<MenuSettingsState>(() => readStoredSettings());

  const searchParams = useSearchParams();
  useEffect(() => {
    const noEffectsParam = searchParams.get("noEffects") === "true";
    if (noEffectsParam) {
      setSavedSettings((prev) => ({ ...prev, noEffects: true }));
      setDraftSettings((prev) => ({ ...prev, noEffects: true }));
    }
  }, [searchParams]);
  const [menuMusicMuted, setMenuMusicMuted] = useState(() => readStoredMenuMute());
  const [progression, setProgression] = useState<ProgressionState>(() => createInitialProgression());
  const [questState, setQuestState] = useState<QuestState>(() => createDefaultQuestState(new Date()));
  const [retentionState, setRetentionState] = useState<RetentionState>(() => createDefaultRetentionState(new Date()));
  const [mastery, setMastery] = useState<MasteryMap>({});
  const [tutorialMeta, setTutorialMeta] = useState<TutorialMetaState>({
    tutorialSeen: false,
    tutorialSeenAt: null,
    tutorialVersion: "1.0",
  });
  const [calibrationProfile, setCalibrationProfile] = useState<CalibrationProfile>(() => createDefaultCalibrationProfile());
  const [calibrationReturnView, setCalibrationReturnView] = useState<
    "mode_select" | "settings" | "jutsu_library" | "free_session" | "rank_session"
  >("mode_select");
  const [stateReady, setStateReady] = useState(false);
  const [stateBusy, setStateBusy] = useState(false);
  const [stateError, setStateError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [claimBusyKey, setClaimBusyKey] = useState("");
  const [identityLinked, setIdentityLinked] = useState(false);
  const [levelUpPanel, setLevelUpPanel] = useState<LevelUpPanelState | null>(null);
  const [masteryPanel, setMasteryPanel] = useState<MasteryPanelState | null>(null);
  const [masteryBarDisplayPct, setMasteryBarDisplayPct] = useState(0);
  const lastUiHoverAtRef = useRef(0);
  const rewardModalSfxStateRef = useRef<{ mastery: boolean; level: boolean }>({ mastery: false, level: false });
  const [leaderboardModeIdx, setLeaderboardModeIdx] = useState(() => {
    const idx = LEADERBOARD_MODE_LIST.indexOf("FIREBALL");
    return idx >= 0 ? idx : 0;
  });
  const [leaderboardBoard, setLeaderboardBoard] = useState<"speed" | "level">("speed");
  const [leaderboardPage, setLeaderboardPage] = useState(0);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardSpeedRow[]>([]);
  const [leaderboardLevelRows, setLeaderboardLevelRows] = useState<LeaderboardLevelRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [leaderboardTotalCount, setLeaderboardTotalCount] = useState(0);
  const [leaderboardHasNext, setLeaderboardHasNext] = useState(false);
  const runPanelTimerRef = useRef<number | null>(null);
  const pendingRankReplayBusyRef = useRef(false);
  const profileMetaHydratedRef = useRef(false);
  const [boundUsername, setBoundUsername] = useState("");

  const sessionIdentity = useMemo(() => resolveSessionIdentity(session), [session]);
  const identity = useMemo(() => {
    if (!sessionIdentity) return null;
    if (!boundUsername) return sessionIdentity;
    return {
      username: boundUsername,
      discordId: sessionIdentity.discordId,
    };
  }, [boundUsername, sessionIdentity]);
  const username = useMemo(() => getDiscordDisplayName(session, sessionIdentity), [session, sessionIdentity]);
  const avatarUrl = useMemo(() => getDiscordAvatar(session), [session]);
  const visibleStateError = stateError || (
    session && !sessionIdentity
      ? "Account identity is missing required username/id fields. Re-login and retry."
      : ""
  );

  const now = new Date(clockNowMs + serverOffsetMs);
  const currentUtcDailyId = utcDailyId(now);
  const dailyResetAt = startOfTomorrowUtc(now);
  const weeklyResetAt = nextWeeklyResetUtc(now);
  const dailyStreakBonusPct = resolveStreakBonusPct(questState.streak.dailyCurrent, DAILY_STREAK_BONUS_TIERS);
  const weeklyStreakBonusPct = resolveStreakBonusPct(questState.streak.weeklyCurrent, WEEKLY_STREAK_BONUS_TIERS);
  const activeStreakBonusPct = dailyStreakBonusPct + weeklyStreakBonusPct;
  const nextDailyStreakTier = getNextStreakTier(questState.streak.dailyCurrent, DAILY_STREAK_BONUS_TIERS);
  const nextWeeklyStreakTier = getNextStreakTier(questState.streak.weeklyCurrent, WEEKLY_STREAK_BONUS_TIERS);
  const questIdentitySeed = useMemo(() => {
    if (identity?.discordId) return identity.discordId;
    if (identity?.username) return identity.username.toLowerCase();
    return "guest";
  }, [identity?.discordId, identity?.username]);
  const dailyQuestDefs = useMemo(
    () => buildDynamicDailyQuestDefs(questState.daily.period, questIdentitySeed),
    [questIdentitySeed, questState.daily.period],
  );
  const weeklyQuestDefs = useMemo(
    () => buildDynamicWeeklyQuestDefs(questState.weekly.period, questIdentitySeed),
    [questIdentitySeed, questState.weekly.period],
  );
  const effectiveRetentionState = useMemo(
    () => reconcileRetentionState(retentionState, now),
    [retentionState, now],
  );
  const dailyMissionProgressPct = Math.max(
    0,
    Math.min(1, effectiveRetentionState.dailyMissionSeconds / Math.max(1, DAILY_MISSION_TARGET_SECONDS)),
  );
  const dailyMissionRemainingSeconds = Math.max(0, DAILY_MISSION_TARGET_SECONDS - effectiveRetentionState.dailyMissionSeconds);
  const dailyMissionActiveRewardPending = effectiveRetentionState.dailyMissionRewardPending;
  const comebackBoostRunsRemaining = effectiveRetentionState.comebackRunsRemaining;
  const comebackBoostActive = comebackBoostRunsRemaining > 0;
  const questVarietyHighlight = useMemo(() => {
    const allDefs: QuestDefinition[] = [...dailyQuestDefs, ...weeklyQuestDefs];
    if (allDefs.length === 0) return null;
    const seed = `${questState.daily.period}|${questState.weekly.period}|${questIdentitySeed}|variety`;
    return allDefs[hashQuestSeed(seed) % allDefs.length] || null;
  }, [dailyQuestDefs, weeklyQuestDefs, questIdentitySeed, questState.daily.period, questState.weekly.period]);
  const questVarietyCode = useMemo(() => {
    const seed = `${questState.daily.period}|${questState.weekly.period}|${questIdentitySeed}|rotation`;
    return hashQuestSeed(seed).toString(16).slice(0, 6).toUpperCase();
  }, [questIdentitySeed, questState.daily.period, questState.weekly.period]);
  const calibrationReady = hasCalibrationProfile(calibrationProfile);

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
  const activeJutsuInfoName = jutsuInfoModal?.name ? resolveCanonicalJutsuName(jutsuInfoModal.name) : "";
  const activeJutsuInfoConfig = activeJutsuInfoName ? OFFICIAL_JUTSUS[activeJutsuInfoName] || null : null;
  const activeJutsuInfoUnlocked = Boolean(
    activeJutsuInfoConfig && progression.level >= activeJutsuInfoConfig.minLevel,
  );
  const activeJutsuInfoUiName = activeJutsuInfoName ? getJutsuUiName(activeJutsuInfoName) : "";
  const activeJutsuInfoTexture = activeJutsuInfoName ? (JUTSU_TEXTURES[activeJutsuInfoName] || "") : "";
  const activeJutsuInfoSummary = activeJutsuInfoName
    ? JUTSU_INFO_SUMMARIES[activeJutsuInfoName]
    || "A hidden leaf technique. Study the sequence, maintain stable hands, then execute with timing."
    : "";
  const activeJutsuInfoEffectLabel = activeJutsuInfoConfig?.effect
    ? (JUTSU_EFFECT_LABELS[activeJutsuInfoConfig.effect] || formatSignLabel(activeJutsuInfoConfig.effect))
    : "None";
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
  const leaderboardMode = LEADERBOARD_MODE_LIST[
    Math.max(0, Math.min(LEADERBOARD_MODE_LIST.length - 1, leaderboardModeIdx))
  ] || "FIREBALL";
  const leaderboardShowingSpeed = leaderboardBoard === "speed";
  const leaderboardVisibleCount = leaderboardShowingSpeed ? leaderboardRows.length : leaderboardLevelRows.length;
  const leaderboardTitleLine = leaderboardShowingSpeed
    ? t("leaderboard.speedrunTitleLine", "SPEEDRUN LEADERBOARD")
    : t("leaderboard.levelTitleLine", "LEVEL LEADERBOARD");
  const leaderboardSubtitle = leaderboardShowingSpeed
    ? `${t("leaderboard.fastestVerifiedClearsFor", "Fastest verified clears for")} ${formatLeaderboardModeLabel(leaderboardMode)}.`
    : t("leaderboard.levelSubtitle", "Top shinobi ranked by LV and XP.");
  const leaderboardPageCount = Math.max(1, Math.ceil(Math.max(0, leaderboardTotalCount) / LEADERBOARD_PAGE_SIZE));
  const leaderboardCanPrev = leaderboardPage > 0;
  const leaderboardCanNext = leaderboardPage < (leaderboardPageCount - 1);
  const pendingRankQueueStorageKey = useMemo(() => {
    const discordId = String(identity?.discordId || "").trim();
    return discordId ? buildPendingRankQueueStorageKey(discordId) : "";
  }, [identity?.discordId]);
  const calibrationSkipStorageKey = useMemo(() => {
    const discordId = String(identity?.discordId || "").trim();
    return discordId ? buildCalibrationSkipStorageKey(discordId) : "";
  }, [identity?.discordId]);
  const retentionStorageKey = useMemo(() => {
    const discordId = String(identity?.discordId || "").trim();
    return discordId ? buildRetentionStorageKey(discordId) : "";
  }, [identity?.discordId]);
  const effectiveMenuMusicVol = useMemo(
    () => clampVolume(view === "settings" ? draftSettings.musicVol : savedSettings.musicVol, DEFAULT_SETTINGS.musicVol),
    [draftSettings.musicVol, savedSettings.musicVol, view],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!calibrationSkipStorageKey) {
      setCalibrationGateSkipped(false);
      return;
    }
    try {
      setCalibrationGateSkipped(window.localStorage.getItem(calibrationSkipStorageKey) === "1");
    } catch {
      setCalibrationGateSkipped(false);
    }
  }, [calibrationSkipStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !calibrationSkipStorageKey) return;
    try {
      if (calibrationGateSkipped) {
        window.localStorage.setItem(calibrationSkipStorageKey, "1");
      } else {
        window.localStorage.removeItem(calibrationSkipStorageKey);
      }
    } catch {
      // Ignore localStorage write failures.
    }
  }, [calibrationGateSkipped, calibrationSkipStorageKey]);

  useEffect(() => {
    if (calibrationReady && calibrationGateSkipped) {
      setCalibrationGateSkipped(false);
    }
  }, [calibrationGateSkipped, calibrationReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nowDate = new Date();
    if (!retentionStorageKey) {
      setRetentionState(createDefaultRetentionState(nowDate));
      return;
    }
    try {
      const raw = window.localStorage.getItem(retentionStorageKey);
      if (!raw) {
        setRetentionState(reconcileRetentionState(createDefaultRetentionState(nowDate), nowDate));
        return;
      }
      const parsed = JSON.parse(raw);
      const state = reconcileRetentionState(sanitizeRetentionState(parsed, nowDate), nowDate);
      setRetentionState(state);
    } catch {
      setRetentionState(reconcileRetentionState(createDefaultRetentionState(nowDate), nowDate));
    }
  }, [retentionStorageKey]);

  useEffect(() => {
    const dayAnchor = parseUtcDailyId(currentUtcDailyId) || new Date();
    setRetentionState((prev) => {
      const next = reconcileRetentionState(prev, dayAnchor);
      return retentionStateEquals(prev, next) ? prev : next;
    });
  }, [currentUtcDailyId]);

  useEffect(() => {
    if (typeof window === "undefined" || !retentionStorageKey) return;
    try {
      window.localStorage.setItem(retentionStorageKey, JSON.stringify(retentionState));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [retentionState, retentionStorageKey]);

  const applyCompetitivePayload = useCallback((payload: Record<string, unknown>) => {
    const payloadResult = firstRecord(payload.result);
    const nestedFunctionPayload = firstRecord(
      payloadResult?.get_competitive_state_authoritative,
      payload.get_competitive_state_authoritative,
    );
    const rootPayload = firstRecord(nestedFunctionPayload, payloadResult, payload) || payload;
    const profilePayload = firstRecord(rootPayload.profile, payload.profile, rootPayload) || rootPayload;

    if (hasProgressionShape(profilePayload)) {
      setProgression(sanitizeProgression(profilePayload));
    } else if (hasProgressionShape(rootPayload)) {
      setProgression(sanitizeProgression(rootPayload));
    }

    const masteryPayload = parseRecordJson(profilePayload.mastery)
      ?? parseRecordJson(rootPayload.mastery)
      ?? parseRecordJson(payload.mastery);
    if (masteryPayload) {
      const nextMastery = sanitizeMasteryMap(masteryPayload);
      setMastery((prev) => mergeMasteryMapsKeepBest(prev, nextMastery));
    }
    const nextTutorial = sanitizeTutorialMeta(profilePayload);
    setTutorialMeta(nextTutorial);
    const calibrationSource = parseRecordJson(profilePayload.calibration_profile ?? profilePayload.calibrationProfile)
      ?? parseRecordJson(rootPayload.calibration_profile ?? rootPayload.calibrationProfile);
    if (calibrationSource) {
      const source = calibrationSource as Record<string, unknown>;
      setCalibrationProfile(sanitizeCalibrationProfileState(source));
    }

    const questsPayload = parseRecordJson(rootPayload.quests)
      ?? parseRecordJson(profilePayload.quests)
      ?? parseRecordJson(payload.quests);
    if (questsPayload) {
      setQuestState(sanitizeQuestState(questsPayload, new Date()));
    } else if (hasQuestShape(rootPayload)) {
      setQuestState(sanitizeQuestState(rootPayload, new Date()));
    } else if (hasQuestShape(profilePayload)) {
      setQuestState(sanitizeQuestState(profilePayload, new Date()));
    }
  }, []);

  const playUiSfx = useCallback((src: string, scale = 1) => {
    if (typeof window === "undefined") return;
    try {
      const audio = new Audio(src);
      audio.volume = Math.max(0, Math.min(1, savedSettings.sfxVol * scale));
      void audio.play().catch(() => { });
    } catch {
      // Ignore autoplay errors.
    }
  }, [savedSettings.sfxVol]);

  const playUiHoverSfx = useCallback(() => {
    if (typeof window === "undefined") return;
    const now = performance.now();
    if ((now - lastUiHoverAtRef.current) < 90) return;
    lastUiHoverAtRef.current = now;
    playUiSfx("/sounds/hover.mp3", 0.45);
  }, [playUiSfx]);

  const playUiClickSfx = useCallback(() => {
    playUiSfx("/sounds/click.mp3", 0.65);
  }, [playUiSfx]);

  useEffect(() => {
    const prev = rewardModalSfxStateRef.current;
    if (masteryPanel && !prev.mastery) {
      playUiSfx("/sounds/reward.mp3", 0.9);
    }
    if (levelUpPanel && !masteryPanel && !prev.level) {
      playUiSfx("/sounds/level.mp3", 0.9);
    }
    rewardModalSfxStateRef.current = {
      mastery: Boolean(masteryPanel),
      level: Boolean(levelUpPanel),
    };
  }, [levelUpPanel, masteryPanel, playUiSfx]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(MENU_MUTE_STORAGE_KEY, menuMusicMuted ? "1" : "0");
    } catch {
      // Ignore localStorage write failures.
    }
  }, [menuMusicMuted]);

  useEffect(() => {
    setGlobalMusicVolume(effectiveMenuMusicVol);
  }, [effectiveMenuMusicVol, setGlobalMusicVolume]);

  useEffect(() => {
    setGlobalMusicMuted(menuMusicMuted);
  }, [menuMusicMuted, setGlobalMusicMuted]);

  const clearQueuedRunPanels = useCallback(() => {
    if (runPanelTimerRef.current !== null) {
      window.clearTimeout(runPanelTimerRef.current);
      runPanelTimerRef.current = null;
    }
  }, []);

  const showRunCompletionPanels = useCallback((panels: RunCompletionPanels) => {
    if (panels.masteryPanel) {
      setMasteryPanel(panels.masteryPanel);
    }
    if (panels.levelUpPanel) {
      setLevelUpPanel(panels.levelUpPanel);
    }
  }, []);

  const queueRunCompletionPanels = useCallback((panels: RunCompletionPanels, delayMs: number) => {
    clearQueuedRunPanels();
    if (!panels.masteryPanel && !panels.levelUpPanel) return;

    const safeDelayMs = Math.max(0, Math.floor(delayMs));
    if (safeDelayMs <= 0) {
      showRunCompletionPanels(panels);
      return;
    }

    runPanelTimerRef.current = window.setTimeout(() => {
      runPanelTimerRef.current = null;
      showRunCompletionPanels(panels);
    }, safeDelayMs);
  }, [clearQueuedRunPanels, showRunCompletionPanels]);

  useEffect(() => (() => {
    clearQueuedRunPanels();
  }), [clearQueuedRunPanels]);

  const openErrorModal = useCallback((title: string, message: string) => {
    setErrorModal({
      title: String(title || "Error"),
      message: String(message || "An unexpected error occurred."),
    });
  }, []);

  const openAlertModal = useCallback((title: string, message: string, buttonText = "OK") => {
    setAlertModal({
      title: String(title || "Alert"),
      message: String(message || ""),
      buttonText: String(buttonText || "OK"),
    });
  }, []);

  const triggerConnectionLost = useCallback((title?: string, lines?: string[]) => {
    setConnectionLostState({
      title: String(title || t("connection.title", "Connection Lost")),
      lines: Array.isArray(lines) && lines.length > 0
        ? lines.slice(0, 3).map((line) => String(line))
        : [
          t("connection.lineNetworkInterrupted", "Network connection interrupted."),
          t("connection.lineSessionTerminated", "Session has been terminated."),
        ],
    });
    setShowAnnouncements(false);
  }, [t]);

  const callRpc = useCallback(async (rpcName: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (!supabase) {
      if (session) {
        triggerConnectionLost(t("connection.configMissing", "Configuration Missing"), [
          t("connection.supabaseUnavailable", "Supabase environment is unavailable."),
          t("connection.lineSessionTerminated", "Session has been terminated."),
        ]);
      }
      return { ok: false, reason: "offline", rpc: rpcName };
    }
    const { data, error } = await supabase.rpc(rpcName, payload);
    if (error) {
      const detail = String(error.message || "");
      if (session && /(failed to fetch|network|offline|timed out|fetch failed)/i.test(detail)) {
        triggerConnectionLost();
      }
      return {
        ok: false,
        reason: "rpc_error",
        detail,
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
  }, [session, t, triggerConnectionLost]);

  const callRpcWithLegacyFallback = useCallback(async (
    authRpcName: string,
    legacyRpcName: string,
    payload: Record<string, unknown>,
  ): Promise<{ response: Record<string, unknown>; usedLegacy: boolean }> => {
    const authRes = await callRpc(authRpcName, payload);
    if (Boolean(authRes.ok)) {
      return { response: authRes, usedLegacy: false };
    }

    const reason = String(authRes.reason || "");
    const detail = String(authRes.detail || "");
    const shouldFallback = Boolean(legacyRpcName)
      && legacyRpcName !== authRpcName
      && shouldFallbackToLegacyBoundRpc(reason, detail);
    if (!shouldFallback) {
      return { response: authRes, usedLegacy: false };
    }

    const legacyRes = await callRpc(legacyRpcName, payload);
    if (Boolean(legacyRes.ok)) {
      return { response: legacyRes, usedLegacy: true };
    }

    const legacyDetail = String(legacyRes.detail || "").trim();
    if (!legacyDetail && (reason || detail)) {
      return {
        response: {
          ...legacyRes,
          detail: `auth=${reason || "unknown"}${detail ? ` (${detail})` : ""}`,
        },
        usedLegacy: true,
      };
    }
    return { response: legacyRes, usedLegacy: true };
  }, [callRpc]);

  const callBoundRpc = useCallback(async (
    authRpcName: string,
    legacyRpcName: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const { response } = await callRpcWithLegacyFallback(authRpcName, legacyRpcName, payload);
    return response;
  }, [callRpcWithLegacyFallback]);

  const fetchProfileMetaDirect = useCallback(async (): Promise<DirectProfileMetaResult> => {
    const res = await callRpc("get_profile_meta_self_auth", {});
    if (!Boolean(res.ok)) {
      return {
        ok: false,
        reason: String(res.reason || "profile_meta_fetch_failed"),
        detail: String(res.detail || ""),
      };
    }
    if (!isRecord(res.profile)) {
      return { ok: false, reason: "profile_missing" };
    }
    return { ok: true, profile: res.profile as Record<string, unknown> };
  }, [callRpc]);

  const findExistingUsernameByDiscordId = useCallback(async (discordId: string): Promise<string> => {
    const dId = String(discordId || "").trim();
    if (!supabase || !dId) return "";
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("username,updated_at")
        .eq("discord_id", dId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (!error && Array.isArray(data) && data.length > 0) {
        const username = normalizeDiscordUsername(data[0]?.username);
        if (username) return username;
      }
    } catch {
      // Ignore and fallback to leaderboard lookup.
    }
    try {
      const { data, error } = await supabase
        .from("leaderboard")
        .select("username,created_at")
        .eq("discord_id", dId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (!error && Array.isArray(data) && data.length > 0) {
        for (const row of data as Array<Record<string, unknown>>) {
          const username = normalizeDiscordUsername(row.username);
          if (username) return username;
        }
      }
    } catch {
      // Ignore fallback lookup failures.
    }
    return "";
  }, []);

  const readPendingRankQueue = useCallback((): PendingRankSubmitRecord[] => {
    if (typeof window === "undefined" || !pendingRankQueueStorageKey) return [];
    try {
      const raw = window.localStorage.getItem(pendingRankQueueStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const rows = parsed
        .map((entry) => sanitizePendingRankRecord(entry))
        .filter((entry): entry is PendingRankSubmitRecord => Boolean(entry));
      return rows.slice(-PENDING_RANK_QUEUE_MAX);
    } catch {
      return [];
    }
  }, [pendingRankQueueStorageKey]);

  const writePendingRankQueue = useCallback((rows: PendingRankSubmitRecord[]) => {
    if (typeof window === "undefined" || !pendingRankQueueStorageKey) return;
    try {
      if (!Array.isArray(rows) || rows.length === 0) {
        window.localStorage.removeItem(pendingRankQueueStorageKey);
        return;
      }
      const safeRows = rows
        .map((entry) => sanitizePendingRankRecord(entry))
        .filter((entry): entry is PendingRankSubmitRecord => Boolean(entry))
        .slice(-PENDING_RANK_QUEUE_MAX);
      if (safeRows.length === 0) {
        window.localStorage.removeItem(pendingRankQueueStorageKey);
        return;
      }
      window.localStorage.setItem(pendingRankQueueStorageKey, JSON.stringify(safeRows));
    } catch {
      // Ignore storage errors.
    }
  }, [pendingRankQueueStorageKey]);

  const enqueuePendingRankSubmit = useCallback((result: PlayArenaResult, reason: string): boolean => {
    if (!pendingRankQueueStorageKey) return false;
    const sanitizedResult = sanitizeQueuedRankResult(result);
    if (!sanitizedResult) return false;

    const queue = readPendingRankQueue();
    const nowIso = toUtcIsoNoMs();
    const fingerprint = buildPendingRankFingerprint(sanitizedResult);
    const reasonText = String(reason || "transient_submit_failure").trim().slice(0, 160);
    const idx = queue.findIndex((entry) => entry.fingerprint === fingerprint);
    if (idx >= 0) {
      queue[idx] = {
        ...queue[idx],
        updatedAt: nowIso,
        lastReason: reasonText || queue[idx].lastReason,
        result: sanitizedResult,
      };
      writePendingRankQueue(queue);
      return true;
    }

    queue.push({
      id: makePendingRankRecordId(),
      fingerprint,
      createdAt: nowIso,
      updatedAt: nowIso,
      attempts: 0,
      lastReason: reasonText,
      result: sanitizedResult,
    });
    writePendingRankQueue(queue);
    return true;
  }, [pendingRankQueueStorageKey, readPendingRankQueue, writePendingRankQueue]);

  const cycleLeaderboardMode = useCallback((direction: -1 | 1) => {
    if (LEADERBOARD_MODE_LIST.length <= 1) return;
    setLeaderboardModeIdx((prev) => {
      const safePrev = Math.max(0, Math.min(LEADERBOARD_MODE_LIST.length - 1, prev));
      return (safePrev + direction + LEADERBOARD_MODE_LIST.length) % LEADERBOARD_MODE_LIST.length;
    });
    setLeaderboardPage(0);
  }, []);

  useEffect(() => {
    if (view !== "leaderboard") return;
    const sb = supabase;
    if (!sb) {
      setLeaderboardRows([]);
      setLeaderboardLevelRows([]);
      setLeaderboardTotalCount(0);
      setLeaderboardHasNext(false);
      setLeaderboardError("Leaderboard unavailable: Supabase is not configured.");
      return;
    }

    let cancelled = false;
    const fetchLeaderboard = async () => {
      setLeaderboardLoading(true);
      setLeaderboardError("");
      const from = leaderboardPage * LEADERBOARD_PAGE_SIZE;
      const to = from + LEADERBOARD_PAGE_SIZE - 1;

      if (leaderboardBoard === "speed") {
        const allAttempts: LeaderboardSpeedRow[] = [];
        const batchSize = 500;
        let cursor = 0;

        while (!cancelled) {
          const { data, error } = await sb
            .from("leaderboard")
            .select("id,created_at,username,score_time,mode,avatar_url,discord_id")
            .eq("mode", leaderboardMode)
            .order("score_time", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(cursor, cursor + batchSize - 1);

          if (cancelled) return;
          if (error) {
            setLeaderboardRows([]);
            setLeaderboardLevelRows([]);
            setLeaderboardTotalCount(0);
            setLeaderboardHasNext(false);
            setLeaderboardError(String(error.message || "Leaderboard query failed."));
            setLeaderboardLoading(false);
            return;
          }

          const batchRows = Array.isArray(data) ? (data as LeaderboardSpeedRow[]) : [];
          if (batchRows.length === 0) break;
          allAttempts.push(...batchRows);
          if (batchRows.length < batchSize) break;
          cursor += batchSize;
        }

        if (cancelled) return;
        const dedupedRows = dedupeSpeedLeaderboardRows(allAttempts);
        const total = dedupedRows.length;
        const rows = dedupedRows.slice(from, to + 1);
        setLeaderboardRows(rows);
        setLeaderboardLevelRows([]);
        setLeaderboardTotalCount(total);
        setLeaderboardHasNext((to + 1) < total);
        setLeaderboardLoading(false);
        return;
      }

      const { data: profileData, error: profileError, count: profileCount } = await sb
        .from("profiles_leaderboard_public")
        .select("id,username,xp,level,rank", { count: "exact" })
        .order("level", { ascending: false })
        .order("xp", { ascending: false })
        .range(from, to);

      if (cancelled) return;
      if (profileError) {
        setLeaderboardRows([]);
        setLeaderboardLevelRows([]);
        setLeaderboardTotalCount(0);
        setLeaderboardHasNext(false);
        setLeaderboardError(String(profileError.message || "Level leaderboard query failed."));
        setLeaderboardLoading(false);
        return;
      }

      const baseProfiles = Array.isArray(profileData) ? (profileData as LeaderboardLevelRow[]) : [];
      const avatarByDiscordId = new Map<string, string>();
      const avatarByUsername = new Map<string, string>();
      const discordIdByUsername = new Map<string, string>();

      if (baseProfiles.length > 0) {
        const { data: avatarRows } = await sb
          .from("leaderboard")
          .select("username,discord_id,avatar_url,created_at")
          .not("avatar_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(320);
        if (!cancelled && Array.isArray(avatarRows)) {
          for (const rowRaw of avatarRows as Array<Record<string, unknown>>) {
            const avatar = String(rowRaw.avatar_url || "").trim();
            const dId = String(rowRaw.discord_id || "").trim();
            const uname = String(rowRaw.username || "").trim().toLowerCase();
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
        }
      }

      if (cancelled) return;
      const rows = baseProfiles.map((profileRow) => {
        const uname = String(profileRow.username || "").trim().toLowerCase();
        const dId = String(profileRow.discord_id || "").trim();
        const resolvedDiscordId = dId || (uname ? discordIdByUsername.get(uname) || "" : "");
        const fallbackAvatar = (resolvedDiscordId ? avatarByDiscordId.get(resolvedDiscordId) : undefined)
          || (uname ? avatarByUsername.get(uname) : undefined)
          || null;
        return {
          ...profileRow,
          discord_id: resolvedDiscordId || profileRow.discord_id || null,
          avatar_url: fallbackAvatar,
        };
      });

      const total = Number.isFinite(Number(profileCount))
        ? Math.max(0, Number(profileCount))
        : Math.max(0, (leaderboardPage * LEADERBOARD_PAGE_SIZE) + rows.length);
      setLeaderboardLevelRows(rows);
      setLeaderboardRows([]);
      setLeaderboardTotalCount(total);
      setLeaderboardHasNext(((leaderboardPage + 1) * LEADERBOARD_PAGE_SIZE) < total);
      setLeaderboardLoading(false);
    };

    void fetchLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [leaderboardBoard, leaderboardMode, leaderboardPage, view]);

  useEffect(() => {
    if (leaderboardLoading) return;
    if (leaderboardPage <= 0) return;
    if (leaderboardTotalCount <= 0) {
      setLeaderboardPage(0);
      return;
    }
    const lastPage = Math.max(0, Math.ceil(leaderboardTotalCount / LEADERBOARD_PAGE_SIZE) - 1);
    if (leaderboardPage > lastPage) {
      setLeaderboardPage(lastPage);
    }
  }, [leaderboardLoading, leaderboardPage, leaderboardTotalCount]);

  const handleCycleSelectedJutsu = useCallback((direction: -1 | 1) => {
    if (unlockedJutsuNames.length === 0) return;
    const currentIndex = Math.max(0, unlockedJutsuNames.indexOf(selectedJutsu));
    const nextIndex = (currentIndex + direction + unlockedJutsuNames.length) % unlockedJutsuNames.length;
    const nextJutsu = unlockedJutsuNames[nextIndex];
    if (!nextJutsu || nextJutsu === selectedJutsu) return;
    setSelectedJutsu(nextJutsu);
    playUiSfx("/sounds/each.mp3", 0.45);
  }, [playUiSfx, selectedJutsu, unlockedJutsuNames]);

  const handleOpenJutsuInfo = useCallback((name: string, unlocked: boolean) => {
    const canonical = resolveCanonicalJutsuName(name);
    if (!canonical || !OFFICIAL_JUTSUS[canonical]) return;
    playUiClickSfx();
    if (unlocked) {
      setSelectedJutsu(canonical);
    }
    setJutsuInfoModal({ name: canonical });
  }, [playUiClickSfx]);

  const handleLibraryStart = useCallback(() => {
    playUiClickSfx();
    if (!stateReady || !identityLinked || actionBusy) return;
    setJutsuInfoModal(null);
    if (libraryIntent === "rank") {
      setView("rank_session");
      return;
    }
    setView("free_session");
  }, [
    actionBusy,
    identityLinked,
    libraryIntent,
    playUiClickSfx,
    stateReady,
  ]);

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

  const stopCalibrationGatePreview = useCallback(() => {
    calibrationGatePreviewStartSeqRef.current += 1;
    const stream = calibrationGatePreviewStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      calibrationGatePreviewStreamRef.current = null;
    }
    if (calibrationGatePreviewRef.current) {
      calibrationGatePreviewRef.current.srcObject = null;
    }
    setCalibrationGateReady(false);
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
        setCalibrationGateCameraIdx((prev) => Math.max(0, Math.min(prev, cams.length - 1)));
      }
      setSettingsPreviewError("");
    } catch (err) {
      setSettingsPreviewError(String((err as Error)?.message || "Unable to scan camera devices."));
    } finally {
      setCameraScanBusy(false);
    }
  }, []);

  const buildCameraConstraints = useCallback((cameraIdx: number, resolutionIdx: number): MediaTrackConstraints => {
    const selected = cameraOptions[Math.max(0, Math.floor(cameraIdx))];
    const res = RESOLUTION_OPTIONS[Math.max(0, Math.min(RESOLUTION_OPTIONS.length - 1, Math.floor(resolutionIdx)))]
      || RESOLUTION_OPTIONS[0];
    const constraints: MediaTrackConstraints = {
      width: { ideal: res.width },
      height: { ideal: res.height },
      facingMode: "user",
    };
    if (selected?.deviceId) {
      constraints.deviceId = { exact: selected.deviceId };
    }
    return constraints;
  }, [cameraOptions]);

  const startSettingsPreview = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    stopSettingsPreview();
    setSettingsPreviewError("");
    try {
      const constraints = buildCameraConstraints(draftSettings.cameraIdx, draftSettings.resolutionIdx);
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
  }, [buildCameraConstraints, draftSettings.cameraIdx, draftSettings.resolutionIdx, stopSettingsPreview]);

  const startCalibrationGatePreview = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    const startSeq = calibrationGatePreviewStartSeqRef.current + 1;
    calibrationGatePreviewStartSeqRef.current = startSeq;
    stopCalibrationGatePreview();
    setCalibrationGateError("");
    setCalibrationGateSamples(0);
    try {
      const constraints = buildCameraConstraints(calibrationGateCameraIdx, calibrationGateResolutionIdx);
      const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
      if (startSeq !== calibrationGatePreviewStartSeqRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      calibrationGatePreviewStreamRef.current = stream;
      if (calibrationGatePreviewRef.current) {
        calibrationGatePreviewRef.current.srcObject = stream;
        try {
          await calibrationGatePreviewRef.current.play();
        } catch (playErr) {
          if (!isTransientVideoPlayError(playErr)) {
            throw playErr;
          }
          await new Promise((resolve) => setTimeout(resolve, 120));
          if (startSeq !== calibrationGatePreviewStartSeqRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          await calibrationGatePreviewRef.current.play();
        }
      }
      if (startSeq !== calibrationGatePreviewStartSeqRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setCalibrationGateReady(true);
    } catch (err) {
      if (startSeq !== calibrationGatePreviewStartSeqRef.current) return;
      stopCalibrationGatePreview();
      if (isTransientVideoPlayError(err)) {
        setCalibrationGateError("Camera feed is restarting. Press SCAN once.");
        return;
      }
      setCalibrationGateError(String((err as Error)?.message || "Camera unavailable. Check device and retry."));
    }
  }, [buildCameraConstraints, calibrationGateCameraIdx, calibrationGateResolutionIdx, stopCalibrationGatePreview]);

  const pollRuntimeConfig = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("app_config")
        .select("id,type,message,version,is_active,priority,created_at,url,checksum")
        .in("type", ["announcement", "version", "maintenance", "dataset"])
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
        const url = String(latest.url || "https://discord.gg/7xBQ22SnN2");
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
          const url = String(latest.url || "https://discord.gg/7xBQ22SnN2");
          setUpdateGate({ message, url, remoteVersion });
        } else {
          setUpdateGate(null);
        }
      } else {
        setUpdateGate(null);
      }

      const datasetRows = rows.filter((row) => String((row as { type?: string }).type || "") === "dataset");
      if (datasetRows.length > 0) {
        const latestDataset = datasetRows[0] as Record<string, unknown>;
        setRuntimeDataset({
          version: String(latestDataset.version || "").trim(),
          url: String(latestDataset.url || "/mediapipe_signs_db.csv").trim() || "/mediapipe_signs_db.csv",
          checksum: String(latestDataset.checksum || "").trim().toUpperCase(),
        });
        setRuntimeDatasetSyncedAt(Date.now());
      } else {
        setRuntimeDataset({
          version: DEFAULT_RUNTIME_DATASET.version,
          url: DEFAULT_RUNTIME_DATASET.url,
          checksum: DEFAULT_RUNTIME_DATASET.checksum,
        });
        setRuntimeDatasetSyncedAt(Date.now());
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
        session
        && authReady
        && digest
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
  }, [authReady, session]);

  const syncServerTimeOffset = useCallback(async () => {
    if (typeof window === "undefined") return;
    const baseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    if (!baseUrl) return;

    const endpoints = [`${baseUrl.replace(/\/$/, "")}/rest/v1/`];
    const apiKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
    for (const endpoint of endpoints) {
      try {
        const head = await fetch(endpoint, {
          method: "HEAD",
          cache: "no-store",
          headers: apiKey ? { apikey: apiKey } : undefined,
        });
        let dateHeader = head.headers.get("date");
        if (!dateHeader) {
          const getRes = await fetch(endpoint, {
            method: "GET",
            cache: "no-store",
            headers: apiKey ? { apikey: apiKey } : undefined,
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
    const guardedRes = await callBoundRpc("upsert_profile_guarded_bound_auth", "upsert_profile_guarded_bound", {
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
    if (Boolean(guardedRes.ok)) {
      return guardedRes;
    }
    if (String(guardedRes.reason || "") === "identity_mismatch") {
      return guardedRes;
    }

    const settingsRes = await callBoundRpc("upsert_profile_settings_bound_auth", "upsert_profile_settings_bound", {
      p_username: targetIdentity.username,
      p_discord_id: targetIdentity.discordId,
      p_user_settings: {
        music_vol: DEFAULT_SETTINGS.musicVol,
        sfx_vol: DEFAULT_SETTINGS.sfxVol,
        camera_idx: DEFAULT_SETTINGS.cameraIdx,
        debug_hands: DEFAULT_SETTINGS.debugHands,
        restricted_signs: DEFAULT_SETTINGS.restrictedSigns,
        ram_tiger_shared: DEFAULT_SETTINGS.ramTigerShared,
        easy_mode: DEFAULT_SETTINGS.easyMode,
        resolution_idx: DEFAULT_SETTINGS.resolutionIdx,
        no_effects: DEFAULT_SETTINGS.noEffects,
        fullscreen: DEFAULT_SETTINGS.fullscreen,
      },
    });
    if (Boolean(settingsRes.ok)) {
      return settingsRes;
    }
    if (String(settingsRes.reason || "") === "identity_mismatch") {
      return settingsRes;
    }

    const calibrationRes = await callBoundRpc("upsert_calibration_profile_bound_auth", "upsert_calibration_profile_bound", {
      p_username: targetIdentity.username,
      p_discord_id: targetIdentity.discordId,
      p_calibration_profile: createDefaultCalibrationProfile(),
    });
    if (Boolean(calibrationRes.ok)) {
      return calibrationRes;
    }
    if (String(calibrationRes.reason || "") === "identity_mismatch") {
      return calibrationRes;
    }

    return {
      ok: false,
      reason: "bootstrap_failed",
      detail: [
        `guarded=${String(guardedRes.reason || "unknown")}`,
        `settings=${String(settingsRes.reason || "unknown")}`,
        `calibration=${String(calibrationRes.reason || "unknown")}`,
      ].join("; "),
    };
  }, [callBoundRpc]);

  const syncAuthoritativeState = useCallback(async (targetIdentity: AuthIdentity, silent: boolean) => {
    if (!silent) {
      setStateBusy(true);
    }

    let effectiveIdentity = targetIdentity;
    const existingProfileRes = await fetchProfileMetaDirect();
    if (existingProfileRes.ok && isRecord(existingProfileRes.profile)) {
      const existingUsername = normalizeDiscordUsername(existingProfileRes.profile.username);
      if (existingUsername) {
        effectiveIdentity = {
          username: existingUsername,
          discordId: targetIdentity.discordId,
        };
        setBoundUsername(existingUsername);
      }
    } else {
      const existingUsername = await findExistingUsernameByDiscordId(targetIdentity.discordId);
      if (existingUsername) {
        effectiveIdentity = {
          username: existingUsername,
          discordId: targetIdentity.discordId,
        };
        setBoundUsername(existingUsername);
      }
    }

    const fallbackCandidates = buildBootstrapUsernameCandidates(effectiveIdentity.username, effectiveIdentity.discordId);

    const tryBootstrapWithFallbackUsername = async (): Promise<boolean> => {
      for (const candidate of fallbackCandidates) {
        if (candidate.toLowerCase() === effectiveIdentity.username.toLowerCase()) continue;
        const candidateIdentity: AuthIdentity = {
          username: candidate,
          discordId: effectiveIdentity.discordId,
        };
        const candidateBootstrap = await bootstrapAuthoritativeProfile(candidateIdentity);
        if (Boolean(candidateBootstrap.ok)) {
          effectiveIdentity = candidateIdentity;
          setBoundUsername(candidateIdentity.username);
          return true;
        }
      }
      return false;
    };

    const identityPayload = {
      p_username: effectiveIdentity.username,
      p_discord_id: effectiveIdentity.discordId,
    };

    let bindRes = await callBoundRpc("bind_profile_identity_bound_auth", "bind_profile_identity_bound", identityPayload);
    if (!Boolean(bindRes.ok) && String(bindRes.reason || "") === "profile_missing") {
      const bootstrapRes = await bootstrapAuthoritativeProfile(effectiveIdentity);
      if (!Boolean(bootstrapRes.ok)) {
        if (String(bootstrapRes.reason || "") === "identity_mismatch") {
          const fallbackOk = await tryBootstrapWithFallbackUsername();
          if (!fallbackOk && (!silent || String(bootstrapRes.reason || "") === "identity_mismatch")) {
            setStateError(toRpcError("Unable to bootstrap profile", bootstrapRes));
          }
        } else if (!silent || String(bootstrapRes.reason || "") === "identity_mismatch") {
          setStateError(toRpcError("Unable to bootstrap profile", bootstrapRes));
        }
      } else {
        setBoundUsername(effectiveIdentity.username);
      }
      bindRes = await callBoundRpc("bind_profile_identity_bound_auth", "bind_profile_identity_bound", {
        p_username: effectiveIdentity.username,
        p_discord_id: effectiveIdentity.discordId,
      });
    }

    setIdentityLinked(Boolean(bindRes.ok));
    if (!Boolean(bindRes.ok) && String(bindRes.reason || "") === "identity_mismatch") {
      setStateReady(true);
      if (!silent) setStateBusy(false);
      setStateError(toRpcError("Account link rejected", bindRes));
      return;
    }

    let stateRes = await callBoundRpc("get_competitive_state_authoritative_bound_auth", "get_competitive_state_authoritative_bound", {
      p_username: effectiveIdentity.username,
      p_discord_id: effectiveIdentity.discordId,
    });
    if (!Boolean(stateRes.ok) && String(stateRes.reason || "") === "profile_missing") {
      const bootstrapRes = await bootstrapAuthoritativeProfile(effectiveIdentity);
      if (Boolean(bootstrapRes.ok)) {
        stateRes = await callBoundRpc("get_competitive_state_authoritative_bound_auth", "get_competitive_state_authoritative_bound", {
          p_username: effectiveIdentity.username,
          p_discord_id: effectiveIdentity.discordId,
        });
      } else if (String(bootstrapRes.reason || "") === "identity_mismatch") {
        const fallbackOk = await tryBootstrapWithFallbackUsername();
        if (fallbackOk) {
          stateRes = await callBoundRpc("get_competitive_state_authoritative_bound_auth", "get_competitive_state_authoritative_bound", {
            p_username: effectiveIdentity.username,
            p_discord_id: effectiveIdentity.discordId,
          });
        } else if (!silent) {
          setStateError(toRpcError("Unable to bootstrap profile", bootstrapRes));
        }
      } else if (!silent) {
        setStateError(toRpcError("Unable to bootstrap profile", bootstrapRes));
      }
    }

    const shouldFetchDirectProfile = !profileMetaHydratedRef.current;
    const [settingsRes, calibrationRes, directProfileRes] = await Promise.all([
      callBoundRpc("get_profile_settings_bound_auth", "get_profile_settings_bound", {
        p_username: effectiveIdentity.username,
        p_discord_id: effectiveIdentity.discordId,
      }),
      callBoundRpc("get_calibration_profile_bound_auth", "get_calibration_profile_bound", {
        p_username: effectiveIdentity.username,
        p_discord_id: effectiveIdentity.discordId,
      }),
      shouldFetchDirectProfile
        ? fetchProfileMetaDirect()
        : Promise.resolve<DirectProfileMetaResult | null>(null),
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

    if (directProfileRes?.ok && isRecord(directProfileRes.profile)) {
      const canonicalUsername = normalizeDiscordUsername(directProfileRes.profile.username);
      if (canonicalUsername) {
        setBoundUsername(canonicalUsername);
      }
      applyCompetitivePayload({
        ok: true,
        profile: directProfileRes.profile,
        quests: directProfileRes.profile.quests,
      });
      profileMetaHydratedRef.current = true;
    }

    if (Boolean(settingsRes.ok) && isRecord(settingsRes.settings)) {
      const cloud = settingsRes.settings as Record<string, unknown>;
      const cloudSettings = sanitizeSettings({
        musicVol: Number(cloud.music_vol ?? cloud.musicVol),
        sfxVol: Number(cloud.sfx_vol ?? cloud.sfxVol),
        cameraIdx: Number(cloud.camera_idx ?? cloud.cameraIdx),
        debugHands: cloud.debug_hands ?? cloud.debugHands,
        restrictedSigns: cloud.restricted_signs ?? cloud.restrictedSigns,
        ramTigerShared: cloud.ram_tiger_shared ?? cloud.ramTigerShared,
        resolutionIdx: Number(cloud.resolution_idx ?? cloud.resolutionIdx),
        noEffects: cloud.no_effects ?? cloud.noEffects,
        fullscreen: cloud.fullscreen,
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
  }, [applyCompetitivePayload, bootstrapAuthoritativeProfile, callBoundRpc, fetchProfileMetaDirect, findExistingUsernameByDiscordId]);

  useEffect(() => {
    if (!supabase) return;

    let alive = true;

    const client = supabase;
    void client.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        setAuthError(error.message);
        if (error.message.includes("Refresh Token Not Found") || error.message.includes("Invalid Refresh Token")) {
          console.warn("Stale session detected, clearing...");
          void client.auth.signOut();
        }
      }
      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setAuthReady(true);
      setAuthBusy(false);
      setAuthBusyProvider(null);
      pendingRankReplayBusyRef.current = false;
      profileMetaHydratedRef.current = false;
      if (nextSession) {
        setAuthError("");
        setStateReady(false);
        setBoundUsername("");
        setIdentityLinked(false);
        setCalibrationGateSkipped(false);
        setStateError("");
        setQuestNotice("");
        clearQueuedRunPanels();
        setLevelUpPanel(null);
        setMasteryPanel(null);
      } else {
        setStateReady(false);
        setStateBusy(false);
        setStateError("");
        setBoundUsername("");
        setActionBusy(false);
        setClaimBusyKey("");
        setIdentityLinked(false);
        setCalibrationGateSkipped(false);
        setProgression(createInitialProgression());
        setQuestState(createDefaultQuestState(new Date()));
        setMastery({});
        setTutorialMeta({
          tutorialSeen: false,
          tutorialSeenAt: null,
          tutorialVersion: "1.0",
        });
        setCalibrationProfile(createDefaultCalibrationProfile());
        clearQueuedRunPanels();
        setLevelUpPanel(null);
        setMasteryPanel(null);
        setQuestNotice("");
      }
    });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, [clearQueuedRunPanels]);

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
    if (!selectedJutsu) return;
    const selectedConfig = OFFICIAL_JUTSUS[selectedJutsu];
    if (!selectedConfig) return;
    if (progression.level >= selectedConfig.minLevel) return;
    const fallback = unlockedJutsuNames[0] || orderedJutsuNames[0] || "";
    if (!fallback || fallback === selectedJutsu) return;
    setSelectedJutsu(fallback);
  }, [orderedJutsuNames, progression.level, selectedJutsu, unlockedJutsuNames]);

  useEffect(() => {
    if (view === "jutsu_library") return;
    if (!jutsuInfoModal) return;
    setJutsuInfoModal(null);
  }, [jutsuInfoModal, view]);

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
    if (!maintenanceGate && !updateGate) return;
    setShowAnnouncements(false);
  }, [maintenanceGate, updateGate]);

  useEffect(() => {
    if (session) return;
    setShowAnnouncements(false);
  }, [session]);

  useEffect(() => {
    if (!session) {
      setShowLogoutConfirm(false);
      return;
    }
    if (!visibleStateError || maintenanceGate || updateGate || connectionLostState) return;
    setErrorModal((prev) => prev || {
      title: "Error",
      message: visibleStateError,
    });
  }, [connectionLostState, maintenanceGate, session, updateGate, visibleStateError]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOffline = () => {
      if (!session) return;
      triggerConnectionLost();
    };
    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, [session, triggerConnectionLost]);

  useEffect(() => {
    if (!connectionLostState || !supabase) return;
    void supabase.auth.signOut().catch(() => { });
  }, [connectionLostState]);

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

  useEffect(() => {
    if (view !== "calibration_gate") {
      stopCalibrationGatePreview();
      setCalibrationGateError("");
      return;
    }

    setCalibrationGateCameraIdx(savedSettings.cameraIdx);
    setCalibrationGateResolutionIdx(savedSettings.resolutionIdx);
    setCalibrationGateDetected("IDLE");
    setCalibrationGateConfidence(0);
    setCalibrationGateLighting("good");
    setCalibrationGateSamples(0);
    stopSettingsPreview();
    void scanCameras();
  }, [
    savedSettings.cameraIdx,
    savedSettings.resolutionIdx,
    scanCameras,
    stopCalibrationGatePreview,
    stopSettingsPreview,
    view,
  ]);

  useEffect(() => {
    if (view !== "calibration_gate") return;
    void startCalibrationGatePreview();
  }, [calibrationGateCameraIdx, calibrationGateResolutionIdx, startCalibrationGatePreview, view]);

  useEffect(() => {
    if (view !== "calibration_gate" || !calibrationGateReady) return;
    const video = calibrationGatePreviewRef.current;
    if (!video) return;

    let raf = 0;
    let lastAt = 0;
    let samples = 0;

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (!video || video.readyState < 2) return;
      if (ts - lastAt < 240) return;
      lastAt = ts;

      if (!calibrationGateSampleCanvasRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = 96;
        canvas.height = 72;
        calibrationGateSampleCanvasRef.current = canvas;
      }
      const canvas = calibrationGateSampleCanvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, 96, 72);
      const imageData = ctx.getImageData(0, 0, 96, 72);
      const stats = evaluateLighting(
        imageData.data,
        96,
        72,
        calibrationProfile,
      );

      setCalibrationGateLighting(stats.status as LightingReadiness);
      setCalibrationGateDetected(stats.status === "good" ? "READY" : "IDLE");
      setCalibrationGateConfidence(stats.status === "good" ? 0.72 : 0.22);

      samples += 1;
      setCalibrationGateSamples(Math.min(999, samples));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [calibrationGateReady, calibrationProfile, view]);

  useEffect(() => (() => {
    stopSettingsPreview();
    stopCalibrationGatePreview();
  }), [stopCalibrationGatePreview, stopSettingsPreview]);

  const handleSkipCalibrationGate = useCallback(() => {
    playUiClickSfx();
    setCalibrationGateSkipped(true);
    stopCalibrationGatePreview();
    setCalibrationGateError("");
    setView(calibrationReturnView);
  }, [calibrationReturnView, playUiClickSfx, stopCalibrationGatePreview]);

  const handleOAuthLogin = async (provider: "discord" | "google") => {
    if (!supabase || typeof window === "undefined") return;
    setAuthBusy(true);
    setAuthBusyProvider(provider);
    setAuthError("");

    const redirectTo = `${window.location.origin}/play`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        scopes: provider === "discord" ? "identify email" : undefined,
      },
    });

    if (error) {
      setAuthError(error.message);
      setAuthBusy(false);
      setAuthBusyProvider(null);
    }
  };

  const handleDiscordLogin = async () => {
    await handleOAuthLogin("discord");
  };

  const handleGoogleLogin = async () => {
    await handleOAuthLogin("google");
  };

  const handleSaveSettings = async () => {
    const next = sanitizeSettings(draftSettings);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      toggleFullscreen(next.fullscreen);
    }

    if (identity) {
      const res = await callBoundRpc("upsert_profile_settings_bound_auth", "upsert_profile_settings_bound", {
        p_username: identity.username,
        p_discord_id: identity.discordId,
        p_user_settings: {
          music_vol: next.musicVol,
          sfx_vol: next.sfxVol,
          camera_idx: next.cameraIdx,
          debug_hands: next.debugHands,
          restricted_signs: next.restrictedSigns,
          ram_tiger_shared: next.ramTigerShared,
          easy_mode: false,
          resolution_idx: next.resolutionIdx,
          no_effects: next.noEffects,
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


  const handleLogout = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    setAuthBusyProvider(null);
    setAuthError("");
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      openErrorModal("Sign Out Failed", error.message);
    }
    setShowLogoutConfirm(false);
    setView("menu");
    setAuthBusy(false);
  };

  const handleConnectionLostExit = async () => {
    if (supabase) {
      setAuthBusy(true);
      setAuthBusyProvider(null);
      await supabase.auth.signOut().catch(() => { });
      setAuthBusy(false);
    }
    setConnectionLostState(null);
    setView("menu");
  };

  const persistProfileMeta = useCallback(async (
    nextMastery: MasteryMap,
    tutorialOverride?: TutorialMetaState,
  ) => {
    if (!identity) return { ok: false, reason: "missing_identity" };

    let safeMastery = mergeMasteryMapsKeepBest(nextMastery);
    const cloudMeta = await fetchProfileMetaDirect();
    if (cloudMeta.ok && isRecord(cloudMeta.profile)) {
      const cloudMastery = sanitizeMasteryMap(cloudMeta.profile.mastery);
      safeMastery = mergeMasteryMapsKeepBest(cloudMastery, safeMastery);
      profileMetaHydratedRef.current = true;
    }

    const rpcMastery = Object.fromEntries(
      Object.entries(safeMastery).map(([name, info]) => [name, { best_time: info.bestTime }]),
    );
    const tutorialState = tutorialOverride || tutorialMeta;
    const res = await callBoundRpc("upsert_profile_meta_guarded_bound_auth", "upsert_profile_meta_guarded_bound", {
      p_username: identity.username,
      p_discord_id: identity.discordId,
      p_tutorial_seen: tutorialState.tutorialSeen,
      p_tutorial_seen_at: tutorialState.tutorialSeenAt,
      p_tutorial_version: tutorialState.tutorialVersion,
      p_mastery: rpcMastery,
      p_quests: null,
    });

    if (Object.keys(safeMastery).length > Object.keys(nextMastery).length) {
      setMastery((prev) => mergeMasteryMapsKeepBest(prev, safeMastery));
    }

    return res;
  }, [callBoundRpc, fetchProfileMetaDirect, identity, tutorialMeta]);

  const recordMasteryCompletion = useCallback(async (jutsuName: string, clearTime: number) => {
    if (!Number.isFinite(clearTime) || clearTime <= 0) return null;

    const canonicalJutsu = resolveCanonicalJutsuName(jutsuName);
    const previousBest = mastery[canonicalJutsu]?.bestTime ?? null;
    const previousTier = getMasteryTier(canonicalJutsu, previousBest);
    if (previousBest !== null && clearTime >= previousBest) {
      return null;
    }

    const nextMastery: MasteryMap = {
      ...mastery,
      [canonicalJutsu]: { bestTime: clearTime },
    };
    const newTier = getMasteryTier(canonicalJutsu, clearTime);
    const panelPayload: MasteryPanelState = {
      jutsuName: canonicalJutsu,
      previousBest,
      newBest: clearTime,
      previousTier,
      newTier,
    };
    setMastery(nextMastery);

    if (identity) {
      const res = await persistProfileMeta(nextMastery);
      if (!Boolean(res.ok)) {
        setStateError(toRpcError("Mastery sync failed", res));
      }
    }

    return { previousBest, newBest: clearTime, previousTier, newTier, panel: panelPayload };
  }, [identity, mastery, persistProfileMeta]);

  const recordTrainingRun = useCallback(async (
    mode: "free" | "rank",
    options?: { signsLanded?: number; jutsuName?: string; xpOverride?: number },
  ): Promise<{
    ok: boolean;
    xpAwarded: number;
    streakBonusPct: number;
    streakBonusXp: number;
    previousLevel: number;
    newLevel: number;
    reason?: string;
    levelUpPanel: LevelUpPanelState | null;
  }> => {
    if (actionBusy) {
      return {
        ok: false,
        xpAwarded: 0,
        streakBonusPct: 0,
        streakBonusXp: 0,
        previousLevel: progression.level,
        newLevel: progression.level,
        reason: "action_busy",
        levelUpPanel: null,
      };
    }
    if (!identity) {
      const message = t("run.identityUnavailable", "Account identity is unavailable. Re-login and retry.");
      setStateError(message);
      openErrorModal(t("run.runErrorTitle", "Run Error"), message);
      return {
        ok: false,
        xpAwarded: 0,
        streakBonusPct: 0,
        streakBonusXp: 0,
        previousLevel: progression.level,
        newLevel: progression.level,
        reason: "missing_identity",
        levelUpPanel: null,
      };
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
      const { response: res } = await callRpcWithLegacyFallback(
        "award_jutsu_completion_authoritative_bound_auth",
        "award_jutsu_completion_authoritative_bound",
        {
          p_username: identity.username,
          p_discord_id: identity.discordId,
          p_xp_gain: xpGain,
          p_signs_landed: signsLanded,
          p_is_challenge: mode === "rank",
          p_mode: runJutsuName.toUpperCase(),
        },
      );

      if (!Boolean(res.ok)) {
        const message = toRpcError(t("run.runAwardRejected", "Run award rejected"), res);
        setStateError(message);
        openErrorModal(t("run.runErrorTitle", "Run Error"), message);
        return {
          ok: false,
          xpAwarded: 0,
          streakBonusPct: 0,
          streakBonusXp: 0,
          previousLevel,
          newLevel: previousLevel,
          reason: String(res.reason || "award_rejected"),
          levelUpPanel: null,
        };
      }

      applyCompetitivePayload(res);
      const gained = Math.max(0, Math.floor(Number(res.xp_awarded) || xpGain));
      const streakBonusPct = Math.max(0, Math.floor(Number(res.streak_bonus_pct) || 0));
      const streakBonusXp = Math.max(0, Math.floor(Number(res.streak_bonus_xp) || 0));
      const profilePayload = isRecord(res.profile) ? res.profile : res;
      const nextProgression = sanitizeProgression(profilePayload);
      const unlocks = getUnlockedJutsusBetweenLevels(previousLevel, nextProgression.level);

      const levelUpPanelPayload: LevelUpPanelState | null = nextProgression.level > previousLevel
        ? {
          previousLevel,
          newLevel: nextProgression.level,
          rank: nextProgression.rank,
          sourceLabel: t("levelUp.sourceJutsuClear", "Jutsu Clear"),
          unlocked: unlocks,
        }
        : null;

      if (unlocks.length > 0 && nextProgression.level <= previousLevel) {
        setQuestNotice(`${t("run.unlockedPrefix", "Unlocked")}: ${unlocks.join(", ")}`);
      }

      return {
        ok: true,
        xpAwarded: gained,
        streakBonusPct,
        streakBonusXp,
        previousLevel,
        newLevel: nextProgression.level,
        levelUpPanel: levelUpPanelPayload,
      };
    } catch (err) {
      const message = String((err as Error)?.message || err || "unknown_error");
      setStateError(`${t("run.runAwardRejected", "Run award rejected")}: ${message}`);
      openErrorModal(t("run.runErrorTitle", "Run Error"), `${t("run.runAwardRejected", "Run award rejected")}: ${message}`);
      return {
        ok: false,
        xpAwarded: 0,
        streakBonusPct: 0,
        streakBonusXp: 0,
        previousLevel,
        newLevel: previousLevel,
        reason: message,
        levelUpPanel: null,
      };
    } finally {
      setActionBusy(false);
    }
  }, [
    actionBusy,
    applyCompetitivePayload,
    callRpcWithLegacyFallback,
    identity,
    progression.level,
    selectedJutsu,
    selectedJutsuConfig?.sequence.length,
    openErrorModal,
    t,
  ]);

  const requestRankRunToken = useCallback(async (payload: {
    mode: "rank";
    jutsuName: string;
    clientStartedAtIso: string;
  }) => {
    if (!identity) return { reason: "missing_identity" };
    const { response: res, usedLegacy } = await callRpcWithLegacyFallback(
      "issue_run_token_bound_auth",
      "issue_run_token_bound",
      {
        p_username: identity.username,
        p_discord_id: identity.discordId,
        p_mode: payload.jutsuName.toUpperCase(),
        p_client_started_at: payload.clientStartedAtIso,
      },
    );
    if (Boolean(res.ok) && String(res.token || "").trim()) {
      return {
        token: String(res.token),
        source: usedLegacy ? `legacy:${String(res.source || "rpc")}` : String(res.source || "rpc"),
      };
    }
    return {
      token: "",
      source: "none",
      reason: String(res.reason || "token_issue_failed"),
      detail: String(res.detail || ""),
    };
  }, [callRpcWithLegacyFallback, identity]);

  const attemptRankRunSecureSubmit = useCallback(async (result: PlayArenaResult): Promise<RankSecureSubmitAttemptResult> => {
    if (result.mode !== "rank") {
      return {
        ok: true,
        retryable: false,
        reason: "not_rank_mode",
        statusText: "",
        detailText: "",
        rankText: "",
      };
    }
    if (!identity) {
      return {
        ok: false,
        retryable: false,
        reason: "missing_identity",
        statusText: "XP applied",
        detailText: "Secure submit skipped: missing identity",
        rankText: "",
      };
    }

    const modeLabel = String(result.jutsuName || selectedJutsu).toUpperCase();
    const proofCheck = validateRankProofClient(result);
    if (!proofCheck.ok) {
      return {
        ok: false,
        retryable: false,
        reason: proofCheck.reason,
        statusText: "Secure submit skipped",
        detailText: `Local proof rejected (${proofCheck.reason})${proofCheck.detail ? `: ${proofCheck.detail}` : ""}`,
        rankText: "",
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
        clientStartedAtIso: proof?.clientStartedAtIso || toUtcIsoNoMs(),
      });
      runToken = String(tokenRes?.token || "");
      tokenSource = String(tokenRes?.source || tokenSource);
      if (!runToken) {
        const tokenReason = String(tokenRes?.reason || proof?.tokenIssueReason || "token_issue_failed");
        return {
          ok: false,
          retryable: isTransientSubmitFailure(tokenReason, ""),
          reason: tokenReason,
          statusText: "Secure submit skipped",
          detailText: `Run token unavailable (${tokenReason})`,
          rankText: "",
        };
      }
    }

    const submitPayload = {
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
        client_version: WEB_APP_VERSION,
        token_source: tokenSource,
        event_chain_hash: chain,
        event_overflow: Boolean(proof?.eventOverflow),
        proof_validation: "client_sanity_v1",
      },
      p_avatar_url: avatarUrl,
    };
    const { response: submitRes } = await callRpcWithLegacyFallback(
      "submit_challenge_run_secure_bound_auth",
      "submit_challenge_run_secure_bound",
      submitPayload,
    );

    if (!Boolean(submitRes.ok)) {
      const reason = String(submitRes.reason || "submit_failed");
      const detail = String(submitRes.detail || "");
      if (isDuplicateSubmitFailure(reason, detail)) {
        return {
          ok: true,
          retryable: false,
          reason: "duplicate",
          statusText: "Secure rank run submitted",
          detailText: "",
          rankText: "",
        };
      }
      return {
        ok: false,
        retryable: isTransientSubmitFailure(reason, detail),
        reason,
        statusText: "Rank run complete",
        detailText: detail
          ? `Secure submit rejected: ${reason} (${detail})`
          : `Secure submit rejected: ${reason}`,
        rankText: "",
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
      retryable: false,
      reason: "ok",
      statusText: "Secure rank run submitted",
      detailText: "",
      rankText,
    };
  }, [avatarUrl, callRpcWithLegacyFallback, identity, requestRankRunToken, selectedJutsu]);

  const submitRankRunSecure = useCallback(async (result: PlayArenaResult): Promise<PlayArenaCompleteFeedback> => {
    const attempt = await attemptRankRunSecureSubmit(result);
    if (attempt.ok) {
      return {
        ok: true,
        statusText: attempt.statusText,
        detailText: attempt.detailText,
        rankText: attempt.rankText,
      };
    }
    if (!attempt.retryable) {
      return {
        ok: true,
        statusText: attempt.statusText || "Rank run complete",
        detailText: attempt.detailText,
      };
    }

    const queued = enqueuePendingRankSubmit(result, attempt.reason);
    return {
      ok: true,
      statusText: queued ? "Rank submit queued" : (attempt.statusText || "Rank run complete"),
      detailText: queued
        ? "Connection issue detected. Run proof is queued and will retry automatically on your next login."
        : attempt.detailText,
      rankText: attempt.rankText,
    };
  }, [attemptRankRunSecureSubmit, enqueuePendingRankSubmit]);

  const replayPendingRankSubmits = useCallback(async () => {
    if (!session || !identity || !identityLinked || !stateReady) return;
    if (pendingRankReplayBusyRef.current) return;

    const queued = readPendingRankQueue();
    if (queued.length === 0) return;

    pendingRankReplayBusyRef.current = true;
    try {
      const nowIso = toUtcIsoNoMs();
      let recovered = 0;
      const remaining: PendingRankSubmitRecord[] = [];
      const replayNow = queued.slice(0, PENDING_RANK_REPLAY_BATCH);
      const replayLater = queued.slice(PENDING_RANK_REPLAY_BATCH);

      for (const item of replayNow) {
        const attempt = await attemptRankRunSecureSubmit(item.result);
        if (attempt.ok) {
          recovered += 1;
          continue;
        }
        if (!attempt.retryable) {
          continue;
        }
        remaining.push({
          ...item,
          attempts: Math.max(0, item.attempts) + 1,
          updatedAt: nowIso,
          lastReason: String(attempt.reason || "retry_pending").slice(0, 160),
        });
      }

      writePendingRankQueue([...remaining, ...replayLater]);

      if (recovered > 0) {
        setQuestNotice(
          `${t("run.recoveredPendingPrefix", "Recovered")} ${recovered} ${t("run.pendingRankSubmit", "pending rank submit")}${recovered === 1 ? "" : t("run.pluralSuffix", "s")}.`,
        );
      }
    } finally {
      pendingRankReplayBusyRef.current = false;
    }
  }, [attemptRankRunSecureSubmit, identity, identityLinked, readPendingRankQueue, session, stateReady, t, writePendingRankQueue]);

  useEffect(() => {
    if (!session || !identity || !identityLinked || !stateReady) return;
    void replayPendingRankSubmits();
  }, [identity, identityLinked, replayPendingRankSubmits, session, stateReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      void replayPendingRankSubmits();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [replayPendingRankSubmits]);

  const handleArenaComplete = useCallback(async (result: PlayArenaResult): Promise<boolean | PlayArenaCompleteFeedback> => {
    const retentionForRun = reconcileRetentionState(effectiveRetentionState, now);
    const runSecondsRaw = Number(result.elapsedSeconds || 0);
    const runSeconds = Number.isFinite(runSecondsRaw)
      ? Math.max(0, Math.min(900, runSecondsRaw))
      : 0;
    const baseXpGain = getRunXpGain(result.jutsuName);
    const projectedMissionSeconds = Math.max(
      retentionForRun.dailyMissionSeconds,
      Math.min(DAILY_MISSION_TARGET_SECONDS, retentionForRun.dailyMissionSeconds + runSeconds),
    );
    const missionUnlockedThisRun = !retentionForRun.dailyMissionClaimed
      && projectedMissionSeconds >= DAILY_MISSION_TARGET_SECONDS;
    const missionBonusArmed = retentionForRun.dailyMissionRewardPending || missionUnlockedThisRun;
    const dailyMissionBonusXp = missionBonusArmed ? DAILY_MISSION_REWARD_XP : 0;
    const comebackBonusXp = retentionForRun.comebackRunsRemaining > 0
      ? Math.max(1, Math.floor(baseXpGain * (COMEBACK_BONUS_PCT / 100)))
      : 0;
    const xpOverride = baseXpGain + dailyMissionBonusXp + comebackBonusXp;

    const masteryResult = await recordMasteryCompletion(result.jutsuName, result.elapsedSeconds);
    const secureRes = result.mode === "rank"
      ? await submitRankRunSecure(result)
      : { ok: true, statusText: "" };
    const runRes = await recordTrainingRun(result.mode, {
      signsLanded: result.signsLanded,
      jutsuName: result.jutsuName,
      xpOverride,
    });

    setRetentionState((prev) => {
      const start = reconcileRetentionState(prev, now);
      const next: RetentionState = {
        ...start,
        dailyMissionSeconds: Math.max(
          start.dailyMissionSeconds,
          Math.min(DAILY_MISSION_TARGET_SECONDS, start.dailyMissionSeconds + runSeconds),
        ),
        dailyMissionClaimed: start.dailyMissionClaimed || missionUnlockedThisRun,
        dailyMissionRewardPending: missionBonusArmed && !runRes.ok,
        lastActiveAt: runRes.ok ? toUtcIsoNoMs(now) : start.lastActiveAt,
        comebackRunsRemaining: start.comebackRunsRemaining,
      };
      if (runRes.ok && next.comebackRunsRemaining > 0) {
        next.comebackRunsRemaining = Math.max(0, next.comebackRunsRemaining - 1);
      }
      return next;
    });

    const fallbackEffectDurationMs = Math.max(
      650,
      Math.round((Number(OFFICIAL_JUTSUS[result.jutsuName]?.duration) || 5.0) * 1000),
    );
    const effectDurationMs = Math.max(
      0,
      Math.floor(Number(result.effectDurationMs) || fallbackEffectDurationMs),
    );

    queueRunCompletionPanels(
      {
        masteryPanel: masteryResult?.panel ?? null,
        levelUpPanel: runRes.levelUpPanel,
      },
      effectDurationMs + 120,
    );

    const detailParts: string[] = [];
    if (secureRes.detailText) {
      detailParts.push(secureRes.detailText);
    }
    if (runRes.ok && runRes.streakBonusPct > 0) {
      detailParts.push(`Streak boost +${runRes.streakBonusPct}% (+${runRes.streakBonusXp} XP)`);
    }
    if (runRes.ok && dailyMissionBonusXp > 0) {
      detailParts.push(`Daily mission +${dailyMissionBonusXp} XP`);
    } else if (!runRes.ok && missionUnlockedThisRun) {
      detailParts.push("Daily mission completed (reward pending next successful run)");
    }
    if (runRes.ok && comebackBonusXp > 0) {
      detailParts.push(`Comeback boost +${COMEBACK_BONUS_PCT}% (+${comebackBonusXp} XP)`);
    }
    if (masteryResult) {
      detailParts.push(
        masteryResult.previousBest === null
          ? `Mastery first record: ${masteryResult.newBest.toFixed(2)}s`
          : `Mastery improved ${masteryResult.previousBest.toFixed(2)}s → ${masteryResult.newBest.toFixed(2)}s`,
      );
    }
    const isRankRun = result.mode === "rank";
    if (isRankRun && !runRes.ok && runRes.reason) {
      detailParts.push(`XP sync skipped: ${runRes.reason}`);
    }
    if (missionUnlockedThisRun) {
      if (runRes.ok) {
        setQuestNotice(`Daily 3-minute mission complete (+${DAILY_MISSION_REWARD_XP} XP).`);
      } else {
        setQuestNotice("Daily 3-minute mission complete. Reward will apply on your next successful run.");
      }
    }

    return {
      ok: isRankRun ? true : runRes.ok,
      statusText: isRankRun
        ? (secureRes.statusText || "Rank run complete")
        : runRes.ok
          ? (secureRes.statusText || `+${runRes.xpAwarded} XP applied`)
          : "Run processing failed",
      detailText: detailParts.join(" • "),
      rankText: secureRes.rankText,
      xpAwarded: runRes.ok ? runRes.xpAwarded : 0,
    };
  }, [effectiveRetentionState, now, queueRunCompletionPanels, recordMasteryCompletion, recordTrainingRun, submitRankRunSecure]);

  const handleCalibrationComplete = useCallback(async (profile: CalibrationProfile): Promise<boolean> => {
    setCalibrationProfile(profile);
    setCalibrationGateSkipped(false);
    if (!identity) return false;

    const res = await callBoundRpc("upsert_calibration_profile_bound_auth", "upsert_calibration_profile_bound", {
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
      const message = toRpcError(t("calibration.syncFailed", "Calibration sync failed"), res);
      setStateError(message);
      openErrorModal(t("calibration.errorTitle", "Calibration Error"), message);
      return false;
    }
    return true;
  }, [callBoundRpc, identity, openErrorModal, t]);

  const markTutorialSeen = useCallback(async () => {
    const seenAt = tutorialMeta.tutorialSeenAt || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const nextMeta: TutorialMetaState = {
      tutorialSeen: true,
      tutorialSeenAt: seenAt,
      tutorialVersion: "1.0",
    };
    setTutorialMeta(nextMeta);

    if (!identity) return;
    const res = await persistProfileMeta(mastery, nextMeta);
    if (!Boolean(res.ok)) {
      setStateError(toRpcError("Tutorial sync failed", res));
    }
  }, [identity, mastery, persistProfileMeta, tutorialMeta.tutorialSeenAt]);

  const claimQuest = async (def: QuestDefinition) => {
    if (actionBusy) return;
    if (!identity) {
      const message = t("quest.identityUnavailable", "Account identity is unavailable. Re-login and retry.");
      setStateError(message);
      openErrorModal(t("quest.rewardTitle", "Quest Reward"), message);
      return;
    }

    const key = `${def.scope}:${def.id}`;
    setActionBusy(true);
    setClaimBusyKey(key);
    setStateError("");
    try {
      const previousLevel = progression.level;
      const res = await callBoundRpc("claim_quest_authoritative_bound_auth", "claim_quest_authoritative_bound", {
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
            sourceLabel: t("levelUp.sourceQuestReward", "Quest Reward"),
            unlocked: unlocks,
          });
        }
        const rewardXp = Math.max(0, Math.floor(Number(res.reward_xp) || def.reward));
        const title = String(res.title || getQuestDisplayTitle(def));
        setQuestNotice(`${t("quest.questClaimedPrefix", "Quest claimed")}: ${title} (+${rewardXp} XP).`);
        openAlertModal(
          t("quest.rewardTitle", "Quest Reward"),
          `${title}\n${t("quest.rewardClaimed", "Reward claimed")}: +${rewardXp} XP`,
          t("quest.claimed", "CLAIMED"),
        );
      } else {
        const message = toRpcError(t("quest.claimFailed", "Quest claim failed"), res);
        setStateError(message);
        openErrorModal(t("quest.rewardTitle", "Quest Reward"), message);
      }
    } catch (err) {
      const message = `${t("quest.claimFailed", "Quest claim failed")}: ${String((err as Error)?.message || err || "unknown_error")}`;
      setStateError(message);
      openErrorModal(t("quest.rewardTitle", "Quest Reward"), message);
    }

    setClaimBusyKey("");
    setActionBusy(false);
  };

  const tutorial = TUTORIAL_STEPS[tutorialStep];
  const tutorialTitle = t(`tutorial.steps.${tutorialStep}.title`, tutorial.title);
  const tutorialLines = tutorial.lines.map((line, lineIdx) => (
    t(`tutorial.steps.${tutorialStep}.lines.${lineIdx}`, line)
  ));
  const getQuestDisplayTitle = useCallback((def: QuestDefinition): string => {
    if (def.localizeTitle === false) return def.title;
    return t(`quest.def.${def.id}.title`, def.title);
  }, [t]);
  const localizedAboutSections = useMemo(() => (
    ABOUT_SECTIONS.map((section, sectionIdx) => ({
      ...section,
      title: t(`about.sections.${sectionIdx}.title`, section.title),
      lines: section.lines.map((line, lineIdx) => t(`about.sections.${sectionIdx}.lines.${lineIdx}`, line)),
    }))
  ), [t]);
  const calibrationGateProgressPct = calibrationReady
    ? 100
    : Math.max(0, Math.min(99, Math.round((calibrationGateSamples / 140) * 100)));
  const calibrationGateLightingText = t(
    `calibration.lightState.${calibrationGateLighting}`,
    calibrationGateLighting.toUpperCase().replace("_", " "),
  );
  const calibrationGateLightingClass = calibrationGateLighting === "good"
    ? "text-emerald-300"
    : "text-amber-300";
  const calibrationGateStatusLine = calibrationGateError
    ? calibrationGateError
    : calibrationGateReady
      ? t("calibration.keepHandsVisible", "Keep both hands visible and move naturally.")
      : t("calibration.pressScanIfNoFeed", "Press SCAN if no camera feed appears.");
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
      ? { name: t("mastery.bronze", "BRONZE"), target: masteryThresholds.bronze }
      : masteryPanel.newTier === "bronze"
        ? { name: t("mastery.silver", "SILVER"), target: masteryThresholds.silver }
        : masteryPanel.newTier === "silver"
          ? { name: t("mastery.gold", "GOLD"), target: masteryThresholds.gold }
          : null
    : null;
  const levelUpDelta = levelUpPanel
    ? Math.max(0, levelUpPanel.newLevel - levelUpPanel.previousLevel)
    : 0;
  const alertModalLines = useMemo(() => {
    if (!alertModal) return [];
    return String(alertModal.message || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [alertModal]);
  const alertRewardXp = useMemo(() => {
    for (const line of alertModalLines) {
      const match = /\+(\d+)\s*XP/i.exec(line);
      if (match) return Math.max(0, Math.floor(Number(match[1]) || 0));
    }
    return 0;
  }, [alertModalLines]);
  useEffect(() => {
    if (!masteryPanel) {
      setMasteryBarDisplayPct(0);
      return;
    }
    const targetPct = masteryPanel.newBest > 0
      ? Math.max(1, masteryMarkerPct)
      : 0;
    setMasteryBarDisplayPct(0);
    const timer = window.setTimeout(() => {
      setMasteryBarDisplayPct(targetPct);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [masteryMarkerPct, masteryPanel]);
  const activeAnnouncement = announcements.length > 0
    ? announcements[Math.max(0, Math.min(announcementIndex, announcements.length - 1))]
    : null;
  const currentCameraOption = cameraOptions.find((camera) => camera.idx === draftSettings.cameraIdx) || null;
  const isInGameSessionView = view === "free_session" || view === "rank_session";
  const isMenuViewportView = view === "menu";
  const isViewportLockedView = isInGameSessionView || isMenuViewportView;

  return (
    <div className={isViewportLockedView ? "h-[100dvh] overflow-hidden bg-ninja-bg text-ninja-text" : "min-h-screen bg-ninja-bg text-ninja-text"}>
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

      <button
        type="button"
        onClick={() => {
          if (typeof document === "undefined") return;
          toggleFullscreen(!document.fullscreenElement);
        }}
        className="fixed bottom-4 right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-ninja-border bg-black/50 text-zinc-300 shadow-lg backdrop-blur hover:border-ninja-accent/40 hover:text-white"
        aria-label="Toggle Fullscreen"
      >
        <Maximize className="h-5 w-5" />
      </button>

      {!session && (
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
      )}
      <main className={isViewportLockedView
        ? "relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden px-2 py-2 md:px-4 md:py-3"
        : "relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10"}>
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
                Welcome to the Academy. Sign in to begin your training.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleDiscordLogin()}
                disabled={!supabase || authBusy}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-indigo-600 px-6 text-base font-black text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authBusy && authBusyProvider === "discord" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Image
                    src="/socials/discord-mark-white.svg"
                    alt="Discord"
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                )}
                LOGIN WITH DISCORD
              </button>

              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={!supabase || authBusy}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-zinc-500 bg-zinc-900/80 px-6 text-base font-black text-zinc-100 transition hover:bg-zinc-800/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authBusy && authBusyProvider === "google" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Image
                    src="/socials/google-g.svg"
                    alt="Google"
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                )}
                LOGIN WITH GOOGLE
              </button>
            </div>

            {authError && (
              <p className="mt-4 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {authError}
              </p>
            )}
          </div>
        )}

        {session && (
          <div className={isViewportLockedView ? "flex h-full min-h-0 flex-col" : ""}>
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
                Linking account identity and loading authoritative progression...
              </div>
            )}

            {view === "menu" && (
              <div className={`mx-auto max-w-2xl rounded-3xl border border-ninja-border bg-ninja-panel/88 p-6 md:p-8 shadow-[0_18px_55px_rgba(0,0,0,0.5)] ${isMenuViewportView ? "my-auto" : ""}`}>
                <div className="flex items-start justify-between gap-4 mb-2 md:mb-0">
                  {session ? (
                    <div className="flex w-44 flex-col gap-2 rounded-xl border border-ninja-border bg-black/35 p-2 sm:w-56">
                      <div className="flex items-center gap-2">
                        <div className="h-[38px] w-[38px] shrink-0 overflow-hidden rounded-lg border border-ninja-border bg-ninja-card">
                          {avatarUrl ? (
                            <Image
                              src={avatarUrl}
                              alt={username}
                              width={38}
                              height={38}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-ninja-card text-base font-black text-zinc-100">
                              {username.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 leading-tight">
                          <p className="truncate text-sm font-black text-white">{username}</p>
                          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-ninja-accent">
                            {progression.rank}
                          </p>
                        </div>
                      </div>
                      {(() => {
                        const prevLevelXp = getXpForLevel(progression.level);
                        const nextLevelXpTargetLocal = getXpForLevel(Math.max(1, progression.level + 1));
                        const progress = Math.max(0, progression.xp - prevLevelXp);
                        const required = Math.max(1, nextLevelXpTargetLocal - prevLevelXp);
                        const pct = Math.min(100, Math.max(0, (progress / required) * 100));
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                              <span>LV.{progression.level}</span>
                              <span>{progress} / {required} XP</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/60 border border-ninja-border/50">
                              <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select
                        value={language}
                        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
                        className="h-10 cursor-pointer appearance-none rounded-lg border border-ninja-border bg-black/35 pl-3 pr-7 text-[11px] font-black tracking-widest text-zinc-100 outline-none transition hover:border-ninja-accent/45 hover:bg-black/55 focus:border-ninja-accent/70"
                        title={t("menu.languageLabel", "Language")}
                        aria-label={t("menu.languageLabel", "Language")}
                      >
                        {LANGUAGE_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>{option.label}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                        <svg className="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                        </svg>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playUiClickSfx();
                        setMenuMusicMuted((prev) => !prev);
                      }}
                      onMouseEnter={playUiHoverSfx}
                      onFocus={playUiHoverSfx}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ninja-border bg-black/35 hover:border-ninja-accent/45 hover:bg-black/55"
                      aria-label={menuMusicMuted ? t("menu.unmuteMenuMusic", "Unmute Menu Music") : t("menu.muteMenuMusic", "Mute Menu Music")}
                      title={menuMusicMuted ? t("menu.unmuteMenuMusic", "Unmute Menu Music") : t("menu.muteMenuMusic", "Mute Menu Music")}
                    >
                      <Image
                        src={menuMusicMuted ? "/pics/mute.png" : "/pics/unmute.png"}
                        alt=""
                        width={22}
                        height={22}
                        className="h-[22px] w-[22px] object-contain"
                      />
                    </button>
                  </div>
                </div>

                <div className="text-center mt-2 sm:mt-0">
                  <div className="mx-auto flex h-40 w-40 items-center justify-center md:h-56 md:w-56">
                    <Image
                      src="/logo2.png"
                      alt="Jutsu Academy"
                      width={320}
                      height={320}
                      className="h-full w-full scale-[1.3] object-contain md:scale-[1.45]"
                    />
                  </div>
                  <p className="mt-4 text-sm font-bold tracking-[0.2em] text-ninja-accent">{t("menu.trainMasterRankUp", "TRAIN • MASTER • RANK UP")}</p>
                </div>

                <div className="mx-auto mt-8 w-full max-w-[360px] space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      playUiClickSfx();
                      setView("mode_select");
                    }}
                    onMouseEnter={playUiHoverSfx}
                    onFocus={playUiHoverSfx}
                    disabled={!stateReady || !identityLinked}
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-ninja-accent text-base font-black tracking-wide text-white transition hover:bg-ninja-accent-glow disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {!stateReady
                      ? t("menu.syncingAccount", "SYNCING ACCOUNT...")
                      : !identityLinked
                        ? t("menu.accountLinkRequired", "ACCOUNT LINK REQUIRED")
                        : t("menu.enterAcademy", "ENTER ACADEMY")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playUiClickSfx();
                      setDraftSettings(savedSettings);
                      setView("settings");
                    }}
                    onMouseEnter={playUiHoverSfx}
                    onFocus={playUiHoverSfx}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    <Settings className="h-5 w-5" />
                    {t("menu.settings", "SETTINGS")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playUiClickSfx();
                      setTutorialStep(0);
                      setView("tutorial");
                    }}
                    onMouseEnter={playUiHoverSfx}
                    onFocus={playUiHoverSfx}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    <Sparkles className="h-5 w-5" />
                    {t("menu.tutorial", "TUTORIAL")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playUiClickSfx();
                      setView("about");
                    }}
                    onMouseEnter={playUiHoverSfx}
                    onFocus={playUiHoverSfx}
                    className="flex h-14 w-full items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    {t("menu.about", "ABOUT")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playUiClickSfx();
                      setShowLogoutConfirm(true);
                    }}
                    onMouseEnter={playUiHoverSfx}
                    onFocus={playUiHoverSfx}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-ninja-border bg-ninja-card text-base font-black tracking-wide text-zinc-100 transition hover:border-ninja-accent/40 hover:bg-ninja-hover"
                  >
                    <LogOut className="h-5 w-5" />
                    {t("menu.signOut", "SIGN OUT")}
                  </button>
                </div>
              </div>
            )}

            {view === "mode_select" && (
              <div className="mx-auto w-full max-w-5xl rounded-[30px] border border-indigo-300/25 bg-gradient-to-b from-indigo-950/40 to-slate-950/85 p-5 shadow-[0_22px_80px_rgba(0,0,0,0.6)] md:p-10">
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  className="mb-8 flex items-center gap-2 text-sm font-black text-ninja-dim hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("common.back", "BACK")}
                </button>
                <div className="text-center">
                  <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">{t("modeSelect.title", "SELECT YOUR PATH")}</h1>
                  <p className="mt-3 text-sm font-black tracking-[0.28em] text-ninja-accent md:text-lg">{t("modeSelect.subtitle", "CHOOSE YOUR TRAINING")}</p>
                </div>

                <div className="mx-auto mt-8 w-full max-w-[420px] space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryIntent("free");
                      setView("jutsu_library");
                    }}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-zinc-400/40 bg-zinc-500/70 text-xl font-black tracking-wide text-zinc-100 transition hover:bg-zinc-400/80"
                  >
                    {t("modeSelect.freeObstaclePlay", "FREE OBSTACLE / PLAY")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLibraryIntent("rank");
                      setView("jutsu_library");
                    }}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-red-300/35 bg-gradient-to-r from-orange-600 to-red-600 text-xl font-black tracking-wide text-white transition hover:from-orange-500 hover:to-red-500"
                  >
                    {t("modeSelect.rankMode", "RANK MODE")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLibraryIntent("browse");
                      setView("jutsu_library");
                    }}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-950/45 text-xl font-black tracking-wide text-blue-300 transition hover:bg-blue-900/45"
                  >
                    {t("modeSelect.jutsuLibrary", "JUTSU LIBRARY")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setView("multiplayer")}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-zinc-500/35 bg-zinc-800/70 text-xl font-black tracking-wide text-zinc-400 transition hover:bg-zinc-700/70"
                  >
                    {t("modeSelect.multiplayerLocked", "MULTIPLAYER (LOCKED)")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setView("quest_board")}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-950/45 text-xl font-black tracking-wide text-emerald-300 transition hover:bg-emerald-900/45"
                  >
                    {t("modeSelect.questBoard", "QUEST BOARD")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLeaderboardPage(0);
                      setView("leaderboard");
                    }}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-yellow-300/40 bg-gradient-to-r from-amber-600 to-yellow-600 text-xl font-black tracking-wide text-white transition hover:from-amber-500 hover:to-yellow-500"
                  >
                    {t("modeSelect.leaderboard", "LEADERBOARD")}
                  </button>
                </div>
              </div>
            )}

            {view === "calibration_gate" && (
              <div className="mx-auto w-full max-w-5xl rounded-[22px] border border-ninja-border bg-ninja-panel/92 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.5)] md:p-7">
                <button
                  type="button"
                  onClick={() => setView(calibrationReturnView)}
                  className="mb-6 flex items-center gap-2 text-sm font-black text-ninja-dim hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("common.back", "BACK")}
                </button>
                <h2 className="text-3xl font-black tracking-tight text-white">{t("calibration.optionalTitle", "CALIBRATION (OPTIONAL)")}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ninja-dim">
                  {t("calibration.optionalSubtitle", "Calibration is optional. Run it any time to improve detection quality on your device.")}
                </p>

                <div className="mt-5 grid gap-4 lg:grid-cols-[540px,1fr]">
                  <div className="relative overflow-hidden rounded-2xl border border-ninja-border bg-black aspect-[3/2]">
                    <video
                      ref={calibrationGatePreviewRef}
                      muted
                      playsInline
                      autoPlay
                      className="h-full w-full object-cover"
                    />
                    {!calibrationGateReady && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 px-6 text-center">
                        <div className="space-y-1">
                          <p className="text-lg font-black tracking-wide text-red-200">{t("calibration.noCameraFeed", "NO CAMERA FEED")}</p>
                          <p className="text-xs text-zinc-300">
                            {calibrationGateError || t("calibration.cameraUnavailableFallback", "Camera unavailable for calibration.")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              await scanCameras();
                              await startCalibrationGatePreview();
                            })();
                          }}
                          disabled={cameraScanBusy}
                          className="group relative flex h-14 w-44 items-center justify-center gap-3 overflow-hidden rounded-xl bg-orange-600 px-6 text-sm font-black tracking-[0.15em] text-white shadow-[0_12px_45px_rgba(234,88,12,0.35)] transition-all hover:bg-orange-500 hover:shadow-[0_12px_45px_rgba(234,88,12,0.45)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                          {cameraScanBusy ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <div className="flex items-center gap-2">
                              <Video className="h-5 w-5" />
                              {t("calibration.scan", "SCAN").toUpperCase()}
                            </div>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleSkipCalibrationGate}
                          className="h-11 rounded-lg border border-ninja-border bg-black/40 px-5 text-xs font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40 hover:text-white"
                        >
                          {t("calibration.skipForNow", "SKIP FOR NOW")}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-ninja-border bg-black/30 px-4 py-3 text-sm">
                    <div className="space-y-2 text-[12px] font-mono text-zinc-200">
                      <div>
                        {t("calibration.lightLabel", "LIGHT")}: <span className={`font-black ${calibrationGateLightingClass}`}>{calibrationGateLightingText}</span>
                      </div>
                      <div>{t("calibration.modelLabel", "MODEL")}: MEDIAPIPE</div>
                      <div>{t("calibration.detectedLabel", "DETECTED")}: {calibrationGateDetected}</div>
                      <div>{t("calibration.confidenceLabel", "CONF")}: {Math.round(calibrationGateConfidence * 100)}%</div>
                      <div>{t("calibration.samplesLabel", "SAMPLES")}: {calibrationGateSamples}</div>
                      <div>{t("calibration.progressLabel", "PROGRESS")}: {calibrationReady ? t("calibration.ready", "READY") : `${calibrationGateProgressPct}%`}</div>
                    </div>
                    <div className="mt-3 rounded-lg border border-ninja-border bg-black/35 px-3 py-2 text-xs text-zinc-300">
                      {calibrationGateStatusLine}
                    </div>
                    <div className="mt-2 rounded-lg border border-ninja-border bg-black/35 px-3 py-2 text-xs text-zinc-300">
                      {serverClockSynced
                        ? t("calibration.serverClockSynced", "Server clock synced")
                        : t("calibration.localFallbackClock", "Using local fallback clock")} • {t("calibration.statusLabel", "Calibration status")}:{" "}
                      <span className={`font-black ${calibrationReady ? "text-emerald-300" : "text-amber-300"}`}>
                        {calibrationReady ? t("calibration.ready", "READY") : t("calibration.missing", "MISSING")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="grid items-center gap-2 sm:grid-cols-[92px,1fr,100px]">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{t("calibration.cameraLabel", "Camera")}</p>
                    <select
                      value={calibrationGateCameraIdx}
                      onChange={(event) => {
                        const next = clampInt(event.target.value, 0, 32, calibrationGateCameraIdx);
                        setCalibrationGateCameraIdx(next);
                        setSavedSettings((prev) => ({ ...prev, cameraIdx: next }));
                        setDraftSettings((prev) => ({ ...prev, cameraIdx: next }));
                      }}
                      className="h-10 rounded-lg border border-ninja-border bg-black/35 px-3 text-sm text-white"
                    >
                      {cameraOptions.length === 0 && (
                        <option value={calibrationGateCameraIdx}>{t("calibration.cameraLabel", "Camera")} {calibrationGateCameraIdx}</option>
                      )}
                      {cameraOptions.map((cam) => (
                        <option key={`cal-gate-${cam.idx}-${cam.deviceId}`} value={cam.idx}>
                          {cam.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          await scanCameras();
                          await startCalibrationGatePreview();
                        })();
                      }}
                      disabled={cameraScanBusy}
                      className="h-10 rounded-lg border border-ninja-border bg-ninja-card text-xs font-black tracking-wide text-zinc-100 hover:border-ninja-accent/45 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cameraScanBusy ? t("calibration.scanBusy", "SCAN...") : t("calibration.scan", "SCAN")}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!calibrationGateReady) {
                        void (async () => {
                          await scanCameras();
                          await startCalibrationGatePreview();
                        })();
                        return;
                      }
                      setView("calibration_session");
                    }}
                    className="flex h-[50px] w-full items-center justify-center rounded-xl bg-ninja-accent text-sm font-black tracking-wide text-white hover:bg-ninja-accent-glow"
                  >
                    {calibrationGateReady
                      ? t("calibration.startCalibration", "START CALIBRATION")
                      : t("calibration.retryCamera", "RETRY CAMERA")}
                  </button>

                  <div className="grid gap-3 sm:grid-cols-1">
                    <button
                      type="button"
                      onClick={handleSkipCalibrationGate}
                      className="flex h-[42px] items-center justify-center rounded-xl border border-ninja-border bg-black/35 text-sm font-black tracking-wide text-zinc-200 hover:border-ninja-accent/40 hover:text-white"
                    >
                      {t("calibration.skipForNow", "SKIP FOR NOW")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCalibrationReturnView("settings");
                        setDraftSettings(savedSettings);
                        setView("settings");
                      }}
                      className="flex h-[42px] items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-sm font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40"
                    >
                      {t("settings.title", "SETTINGS")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === "calibration_session" && (
              <PlayArena
                jutsuName={selectedJutsu}
                mode="calibration"
                restrictedSigns={savedSettings.restrictedSigns}
                ramTigerShared={savedSettings.ramTigerShared}
                easyMode={false}
                debugHands={savedSettings.debugHands}
                sfxVolume={savedSettings.sfxVol}
                cameraIdx={savedSettings.cameraIdx}
                resolutionIdx={savedSettings.resolutionIdx}
                calibrationProfile={calibrationProfile}
                datasetVersion={runtimeDataset.version}
                datasetChecksum={runtimeDataset.checksum}
                datasetUrl={runtimeDataset.url}
                datasetSyncedAt={runtimeDatasetSyncedAt}
                onCalibrationComplete={handleCalibrationComplete}
                noEffects={savedSettings.noEffects}
                onBack={() => setView(calibrationReturnView)}
              />
            )}

            {view === "free_session" && selectedJutsuConfig && (
              <div className="min-h-0 flex-1">
                <PlayArena
                  jutsuName={selectedJutsu}
                  mode="free"
                  restrictedSigns={savedSettings.restrictedSigns}
                  ramTigerShared={savedSettings.ramTigerShared}
                  easyMode={false}
                  debugHands={savedSettings.debugHands}
                  sfxVolume={savedSettings.sfxVol}
                  cameraIdx={savedSettings.cameraIdx}
                  resolutionIdx={savedSettings.resolutionIdx}
                  calibrationProfile={calibrationProfile}
                  datasetVersion={runtimeDataset.version}
                  datasetChecksum={runtimeDataset.checksum}
                  datasetUrl={runtimeDataset.url}
                  datasetSyncedAt={runtimeDatasetSyncedAt}
                  busy={actionBusy}
                  viewportFit
                  onComplete={handleArenaComplete}
                  progressionHud={{
                    xp: progression.xp,
                    level: progression.level,
                    rank: progression.rank,
                    xpToNextLevel: nextLevelXpTarget,
                  }}
                  onPrevJutsu={() => handleCycleSelectedJutsu(-1)}
                  onNextJutsu={() => handleCycleSelectedJutsu(1)}
                  noEffects={savedSettings.noEffects}
                  onQuickCalibrate={() => {
                    setCalibrationReturnView("free_session");
                    setView("calibration_session");
                  }}
                  onBack={() => setView("jutsu_library")}
                />
              </div>
            )}

            {view === "rank_session" && selectedJutsuConfig && (
              <div className="min-h-0 flex-1">
                <PlayArena
                  jutsuName={selectedJutsu}
                  mode="rank"
                  restrictedSigns={savedSettings.restrictedSigns}
                  ramTigerShared={savedSettings.ramTigerShared}
                  easyMode={false}
                  debugHands={savedSettings.debugHands}
                  sfxVolume={savedSettings.sfxVol}
                  cameraIdx={savedSettings.cameraIdx}
                  resolutionIdx={savedSettings.resolutionIdx}
                  calibrationProfile={calibrationProfile}
                  datasetVersion={runtimeDataset.version}
                  datasetChecksum={runtimeDataset.checksum}
                  datasetUrl={runtimeDataset.url}
                  datasetSyncedAt={runtimeDatasetSyncedAt}
                  busy={actionBusy}
                  viewportFit
                  noEffects={savedSettings.noEffects}
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
                    setCalibrationReturnView("rank_session");
                    setView("calibration_session");
                  }}
                  onBack={() => setView("jutsu_library")}
                />
              </div>
            )}

            {view === "jutsu_library" && (
              <div className="mx-auto w-full max-w-5xl rounded-3xl border border-ninja-border bg-ninja-panel/92 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.5)] md:p-8">
                <button
                  type="button"
                  onClick={() => setView("mode_select")}
                  className="mb-6 flex items-center gap-2 text-sm font-black text-ninja-dim hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("common.back", "BACK")}
                </button>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white">{t("library.title", "JUTSU LIBRARY")}</h2>
                    <p className="mt-1 text-sm text-ninja-dim">
                      {libraryIntent === "free"
                        ? t("library.contextFree", "Free Play context: choose a jutsu, then jump into practice.")
                        : libraryIntent === "rank"
                          ? t("library.contextRank", "Rank Mode context: choose a jutsu, then challenge your speed.")
                          : t("library.contextBrowse", "Browse unlocks and requirements by level.")}
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
                          const uiName = getJutsuUiName(name);
                          const masteryRow = mastery[name];
                          const masteryTier = getMasteryTier(name, masteryRow?.bestTime);
                          const masteryTierLabel = masteryTier === "none"
                            ? t("mastery.unranked", "UNRANKED")
                            : masteryTier.toUpperCase();
                          const masteryBronzeTarget = getMasteryThresholds(name).bronze;
                          const masteryColor = masteryTier === "gold"
                            ? "text-amber-300"
                            : masteryTier === "silver"
                              ? "text-slate-300"
                              : masteryTier === "bronze"
                                ? "text-orange-300"
                                : "text-zinc-400";
                          return (
                            <div
                              key={name}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  (e.currentTarget as HTMLDivElement).click();
                                }
                              }}
                              onClick={() => {
                                handleOpenJutsuInfo(name, unlocked);
                              }}
                              className={`relative w-full h-[196px] overflow-hidden rounded-xl border text-left flex flex-col cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ninja-accent transition-all duration-300 ${selected
                                ? "z-20 border-white scale-[1.02] shadow-[0_0_60px_rgba(255,120,50,0.95)] ring-4 ring-ninja-accent"
                                : unlocked
                                  ? "border-ninja-border hover:border-ninja-accent/50 hover:scale-[1.01]"
                                  : "border-zinc-700 opacity-60"
                                }`}
                            >
                              <div className="absolute inset-0 z-0">
                                {texture ? (
                                  <Image
                                    src={texture}
                                    alt={uiName}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    className={`h-full w-full object-cover transition-all duration-500 ${(selected && unlocked) ? "opacity-100 scale-110 brightness-[1.15] contrast-110" : unlocked ? "opacity-60" : "opacity-30 grayscale"}`}
                                  />
                                ) : (
                                  <div className="h-full w-full bg-gradient-to-br from-zinc-700 to-zinc-900" />
                                )}
                              </div>
                              <div className="relative z-10 bg-gradient-to-b from-black/45 via-black/60 to-black/80 p-3 flex-1 flex flex-col w-full h-full">
                                <p className="text-sm font-black text-white">{uiName}</p>
                                <p className="mt-1 text-[11px] text-zinc-300">{config.sequence.length} {t("library.signs", "signs")}</p>
                                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-ninja-accent/90">
                                  LV.{config.minLevel}
                                </p>
                                <div className="mt-auto pt-2">
                                  <p className={`text-[11px] font-bold uppercase ${masteryColor}`}>
                                    {t("library.mastery", "Mastery")}: {masteryTierLabel}
                                    {masteryRow ? ` • ${masteryRow.bestTime.toFixed(2)}s` : ""}
                                  </p>
                                  {masteryRow && masteryTier === "none" && (
                                    <p className="mt-0.5 text-[10px] font-semibold text-zinc-400">
                                      {t("library.bronzeTarget", "Bronze target")}: {masteryBronzeTarget.toFixed(2)}s
                                    </p>
                                  )}
                                  <p className={`mt-1 text-[11px] font-black ${unlocked ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "text-red-400"}`}>
                                    {unlocked
                                      ? t("library.unlocked", "UNLOCKED")
                                      : `${t("library.locked", "LOCKED")} • LV.${config.minLevel}`}
                                  </p>
                                </div>
                                <div className="h-12 flex items-end">
                                  {selected && unlocked && libraryIntent !== "browse" && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleLibraryStart();
                                      }}
                                      className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white px-3 text-[11px] font-black tracking-widest text-orange-600 shadow-[0_4px_12px_rgba(255,255,255,0.3)] transition-all hover:bg-orange-50 active:scale-95 animate-in fade-in zoom-in duration-300"
                                    >
                                      {libraryIntent === "rank" ? "START" : "PLAY"}
                                      <ArrowRight className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>


              </div>
            )}

            {view === "quest_board" && (
              <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-zinc-700/70 bg-[linear-gradient(180deg,rgba(18,22,40,0.96)_0%,rgba(10,12,24,0.96)_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.62)] md:p-8">
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -top-28 left-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-[90px]" />
                  <div className="absolute -right-24 top-16 h-80 w-80 rounded-full bg-orange-500/12 blur-[100px]" />
                  <div className="absolute -bottom-36 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-500/14 blur-[110px]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(255,255,255,0.05),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(255,138,76,0.08),transparent_42%)]" />
                </div>
                <button
                  type="button"
                  onClick={() => setView("mode_select")}
                  className="relative z-10 mb-6 flex items-center gap-2 text-sm font-black tracking-wide text-zinc-400 transition-colors hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("common.back", "BACK")}
                </button>

                <div className="relative z-10 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300/85">Mission Control</p>
                      <h2 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">
                        {t("quest.boardTitle", "QUEST BOARD")}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-300/85">
                        {t("quest.boardSubtitle", "Server-authoritative quest state and claim rewards (same guarded RPC path as pygame).")}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-200/85">
                        Rotating directives refresh each daily and weekly UTC reset.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-600/70 bg-black/35 px-4 py-3 text-xs text-zinc-200 shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
                      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Reset Tracker</p>
                      <div className="grid gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-400">{t("quest.dailyResetUtc", "Daily reset (UTC)")}</span>
                          <span className="font-mono text-[12px] font-black text-cyan-200">{formatCountdown(dailyResetAt.getTime() - now.getTime())}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-400">{t("quest.weeklyResetUtc", "Weekly reset (UTC)")}</span>
                          <span className="font-mono text-[12px] font-black text-cyan-200">{formatCountdown(weeklyResetAt.getTime() - now.getTime())}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-400">{t("quest.clockSource", "Clock source")}</span>
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                            {serverClockSynced ? t("quest.serverSynced", "Server-synced") : t("quest.localFallback", "Local fallback")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-amber-300/45 bg-gradient-to-r from-amber-500/20 via-orange-500/16 to-rose-500/20 px-4 py-4">
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.20),transparent_72%)]" />
                    <div className="relative flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
                          {t("quest.activeStreakBoost", "Active Streak Boost")}
                        </p>
                        <p className="mt-1 text-xs text-amber-100/90">
                          Boost applies to every completed jutsu run.
                        </p>
                      </div>
                      <p className="text-2xl font-black tracking-tight text-white md:text-3xl">
                        +{activeStreakBonusPct}% XP
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-cyan-300/35 bg-cyan-500/8 p-4 shadow-[0_12px_24px_rgba(6,182,212,0.12)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">
                          {t("quest.directiveOfDay", "Directive Of The Day")}
                        </p>
                        <span className="rounded-full border border-cyan-300/45 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black tracking-[0.12em] text-cyan-100">
                          #{questVarietyCode}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {questVarietyHighlight ? getQuestDisplayTitle(questVarietyHighlight) : t("quest.none", "No directive available")}
                      </p>
                      {questVarietyHighlight?.subtitle && (
                        <p className="mt-1 text-[11px] text-cyan-100/90">{questVarietyHighlight.subtitle}</p>
                      )}
                      <p className="mt-2 text-[11px] text-cyan-100/70">
                        {t("quest.rotationHint", "Directive rotates each UTC reset to keep quests fresh.")}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-300/35 bg-emerald-500/8 p-4 shadow-[0_12px_24px_rgba(16,185,129,0.12)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">
                          {t("quest.dailyMission", "Daily 3-Minute Mission")}
                        </p>
                        <span className="text-xs font-black text-emerald-100">
                          {Math.min(DAILY_MISSION_TARGET_SECONDS, Math.floor(effectiveRetentionState.dailyMissionSeconds))}/{DAILY_MISSION_TARGET_SECONDS}s
                        </span>
                      </div>
                      <div className="mt-3 h-2.5 rounded-full bg-zinc-800/95 p-[1px]">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300" style={{ width: `${dailyMissionProgressPct * 100}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-emerald-100/90">
                        {effectiveRetentionState.dailyMissionClaimed
                          ? (dailyMissionActiveRewardPending
                            ? `Reward pending: +${DAILY_MISSION_REWARD_XP} XP on next successful run`
                            : `Completed today (+${DAILY_MISSION_REWARD_XP} XP)`)
                          : `${formatDurationMmSs(dailyMissionRemainingSeconds)} remaining to unlock +${DAILY_MISSION_REWARD_XP} XP`}
                      </p>
                      {comebackBoostActive && (
                        <p className="mt-2 text-[11px] font-semibold text-amber-200">
                          {`Comeback boost active: +${COMEBACK_BONUS_PCT}% XP for ${comebackBoostRunsRemaining} run${comebackBoostRunsRemaining === 1 ? "" : "s"}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-300/45 bg-[linear-gradient(145deg,rgba(16,185,129,0.18)_0%,rgba(10,23,22,0.7)_100%)] p-4 shadow-[0_14px_28px_rgba(16,185,129,0.15)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-200">
                          {t("quest.dailyStreak", "Daily Streak")}
                        </p>
                        {isDailyQuestBucketComplete(questState.daily) && (
                          <span className="rounded-full border border-emerald-300/55 bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
                            {t("quest.periodComplete", "Period Complete")}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="text-4xl font-black tabular-nums text-white">{questState.streak.dailyCurrent}</span>
                        <span className="pb-1 text-xs uppercase tracking-[0.14em] text-emerald-200">{t("quest.days", "days")}</span>
                      </div>
                      <p className="mt-1 text-xs text-emerald-100/90">{t("quest.best", "Best")}: {questState.streak.dailyBest}</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-100/95">{t("quest.xpBoost", "XP Boost")}: +{dailyStreakBonusPct}%</p>
                      <p className="mt-1 text-[11px] text-emerald-100/80">
                        {nextDailyStreakTier
                          ? `${t("quest.nextMilestone", "Next milestone")}: ${nextDailyStreakTier.target} ${t("quest.days", "days")} (+${nextDailyStreakTier.bonusPct}%)`
                          : t("quest.maxTierReached", "Max tier reached")}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-blue-300/45 bg-[linear-gradient(145deg,rgba(59,130,246,0.18)_0%,rgba(11,18,36,0.75)_100%)] p-4 shadow-[0_14px_28px_rgba(59,130,246,0.15)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-200">
                          {t("quest.weeklyStreak", "Weekly Streak")}
                        </p>
                        {isWeeklyQuestBucketComplete(questState.weekly) && (
                          <span className="rounded-full border border-blue-300/55 bg-blue-400/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">
                            {t("quest.periodComplete", "Period Complete")}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="text-4xl font-black tabular-nums text-white">{questState.streak.weeklyCurrent}</span>
                        <span className="pb-1 text-xs uppercase tracking-[0.14em] text-blue-200">{t("quest.weeks", "weeks")}</span>
                      </div>
                      <p className="mt-1 text-xs text-blue-100/90">{t("quest.best", "Best")}: {questState.streak.weeklyBest}</p>
                      <p className="mt-1 text-xs font-semibold text-blue-100/95">{t("quest.xpBoost", "XP Boost")}: +{weeklyStreakBonusPct}%</p>
                      <p className="mt-1 text-[11px] text-blue-100/80">
                        {nextWeeklyStreakTier
                          ? `${t("quest.nextMilestone", "Next milestone")}: ${nextWeeklyStreakTier.target} ${t("quest.weeks", "weeks")} (+${nextWeeklyStreakTier.bonusPct}%)`
                          : t("quest.maxTierReached", "Max tier reached")}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <section className="rounded-2xl border border-zinc-700/80 bg-zinc-950/45 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Image src="/pics/quests/daily_icon.png" alt={t("quest.daily", "Daily")} width={32} height={32} className="h-8 w-8 object-contain" />
                          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-emerald-300">{t("quest.daily", "Daily")}</h3>
                        </div>
                        <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
                          24H
                        </span>
                      </div>
                      <div className="space-y-3">
                        {dailyQuestDefs.map((def) => {
                          const entry = questState.daily.quests[def.id];
                          const pct = Math.max(0, Math.min(1, entry.progress / Math.max(1, def.target)));
                          const ready = entry.progress >= def.target && !entry.claimed;
                          const questTitle = getQuestDisplayTitle(def);
                          const cardTone = entry.claimed
                            ? "border-emerald-400/45 bg-emerald-500/8"
                            : ready
                              ? "border-amber-300/55 bg-amber-500/8"
                              : "border-zinc-700/85 bg-black/35";
                          const progressTone = entry.claimed
                            ? "from-emerald-300 via-emerald-400 to-teal-300"
                            : ready
                              ? "from-amber-300 via-orange-400 to-orange-500"
                              : "from-orange-500 via-orange-500 to-amber-300";
                          return (
                            <div key={def.id} className={`rounded-xl border p-3 transition-colors ${cardTone}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold leading-snug text-white">{questTitle}</p>
                                    {ready && !entry.claimed && (
                                      <span className="rounded-full border border-amber-300/65 bg-amber-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-amber-200">
                                        Ready
                                      </span>
                                    )}
                                  </div>
                                  {!!def.subtitle && (
                                    <p className="mt-1 text-[11px] text-zinc-300/80">{def.subtitle}</p>
                                  )}
                                </div>
                                <span className="text-xs font-bold tabular-nums text-zinc-300">{Math.min(entry.progress, def.target)}/{def.target}</span>
                              </div>
                              <div className="mt-3 h-2.5 rounded-full bg-zinc-800/95 p-[1px]">
                                <div className={`h-full rounded-full bg-gradient-to-r ${progressTone}`} style={{ width: `${pct * 100}%` }} />
                              </div>
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs font-black tracking-[0.08em] text-amber-300">+{def.reward} XP</span>
                                {entry.claimed ? (
                                  <span className="rounded-md border border-emerald-300/45 bg-emerald-500/15 px-2 py-1 text-xs font-black tracking-[0.1em] text-emerald-200">
                                    {t("quest.claimed", "CLAIMED")}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!ready || actionBusy || !stateReady || !identityLinked}
                                    onClick={() => void claimQuest(def)}
                                    className="rounded-lg border border-amber-200/45 bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 text-[11px] font-black tracking-[0.08em] text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                                  >
                                    {claimBusyKey === `${def.scope}:${def.id}`
                                      ? t("quest.claiming", "CLAIMING...")
                                      : t("quest.claim", "CLAIM")}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-zinc-700/80 bg-zinc-950/45 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Image src="/pics/quests/weekly_icon.png" alt={t("quest.weekly", "Weekly")} width={32} height={32} className="h-8 w-8 object-contain" />
                          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-blue-300">{t("quest.weekly", "Weekly")}</h3>
                        </div>
                        <span className="rounded-full border border-blue-300/35 bg-blue-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-blue-200">
                          7D
                        </span>
                      </div>
                      <div className="space-y-3">
                        {weeklyQuestDefs.map((def) => {
                          const entry = questState.weekly.quests[def.id];
                          const pct = Math.max(0, Math.min(1, entry.progress / Math.max(1, def.target)));
                          const ready = entry.progress >= def.target && !entry.claimed;
                          const questTitle = getQuestDisplayTitle(def);
                          const cardTone = entry.claimed
                            ? "border-emerald-400/45 bg-emerald-500/8"
                            : ready
                              ? "border-amber-300/55 bg-amber-500/8"
                              : "border-zinc-700/85 bg-black/35";
                          const progressTone = entry.claimed
                            ? "from-emerald-300 via-emerald-400 to-teal-300"
                            : ready
                              ? "from-amber-300 via-orange-400 to-orange-500"
                              : "from-orange-500 via-orange-500 to-amber-300";
                          return (
                            <div key={def.id} className={`rounded-xl border p-3 transition-colors ${cardTone}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold leading-snug text-white">{questTitle}</p>
                                    {ready && !entry.claimed && (
                                      <span className="rounded-full border border-amber-300/65 bg-amber-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-amber-200">
                                        Ready
                                      </span>
                                    )}
                                  </div>
                                  {!!def.subtitle && (
                                    <p className="mt-1 text-[11px] text-zinc-300/80">{def.subtitle}</p>
                                  )}
                                </div>
                                <span className="text-xs font-bold tabular-nums text-zinc-300">{Math.min(entry.progress, def.target)}/{def.target}</span>
                              </div>
                              <div className="mt-3 h-2.5 rounded-full bg-zinc-800/95 p-[1px]">
                                <div className={`h-full rounded-full bg-gradient-to-r ${progressTone}`} style={{ width: `${pct * 100}%` }} />
                              </div>
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs font-black tracking-[0.08em] text-amber-300">+{def.reward} XP</span>
                                {entry.claimed ? (
                                  <span className="rounded-md border border-emerald-300/45 bg-emerald-500/15 px-2 py-1 text-xs font-black tracking-[0.1em] text-emerald-200">
                                    {t("quest.claimed", "CLAIMED")}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!ready || actionBusy || !stateReady || !identityLinked}
                                    onClick={() => void claimQuest(def)}
                                    className="rounded-lg border border-amber-200/45 bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 text-[11px] font-black tracking-[0.08em] text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                                  >
                                    {claimBusyKey === `${def.scope}:${def.id}`
                                      ? t("quest.claiming", "CLAIMING...")
                                      : t("quest.claim", "CLAIM")}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}

            {view === "leaderboard" && (
              <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-indigo-200/20 bg-ninja-panel/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)] md:p-8">
                <button
                  type="button"
                  onClick={() => setView("mode_select")}
                  className="relative z-10 mb-6 flex items-center gap-2 text-sm font-black text-ninja-dim hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("common.back", "BACK")}
                </button>
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -top-28 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
                  <div className="absolute -right-24 top-20 h-56 w-56 rounded-full bg-orange-500/12 blur-3xl" />
                  <div className="absolute -left-20 bottom-10 h-48 w-48 rounded-full bg-indigo-400/12 blur-3xl" />
                </div>

                <div className="relative">
                  <div className="text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300/90">{leaderboardTitleLine}</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight md:text-5xl">
                      <span className="bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                        {t("leaderboard.hallOfFame", "HALL OF FAME")}
                      </span>
                    </h2>
                    <p className="mt-2 text-sm text-zinc-300/90">{leaderboardSubtitle}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLeaderboardBoard("speed");
                        setLeaderboardPage(0);
                      }}
                      className={`rounded-xl border px-4 py-2 text-xs font-black tracking-[0.14em] transition ${leaderboardShowingSpeed
                        ? "border-orange-300/70 bg-orange-500/20 text-orange-100 shadow-[0_0_24px_rgba(251,146,60,0.35)]"
                        : "border-ninja-border bg-ninja-card text-zinc-200 hover:border-orange-300/40"
                        }`}
                    >
                      {t("leaderboard.speedrunTab", "SPEEDRUN")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLeaderboardBoard("level");
                        setLeaderboardPage(0);
                      }}
                      className={`rounded-xl border px-4 py-2 text-xs font-black tracking-[0.14em] transition ${!leaderboardShowingSpeed
                        ? "border-cyan-300/70 bg-cyan-500/18 text-cyan-100 shadow-[0_0_24px_rgba(56,189,248,0.35)]"
                        : "border-ninja-border bg-ninja-card text-zinc-200 hover:border-cyan-300/40"
                        }`}
                    >
                      {t("leaderboard.levelTab", "LEVEL")}
                    </button>
                  </div>

                  {leaderboardShowingSpeed && (
                    <div className="mx-auto mt-4 flex w-full max-w-[560px] items-center gap-2 md:gap-3">
                      <button
                        type="button"
                        onClick={() => cycleLeaderboardMode(-1)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-zinc-100 hover:border-ninja-accent/45"
                        aria-label={t("leaderboard.previousMode", "Previous leaderboard mode")}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div className="min-w-0 flex-1 rounded-xl border border-amber-300/45 bg-amber-500/12 px-3 py-2 text-center text-sm font-black tracking-[0.1em] text-amber-200 md:text-base">
                        <span className="block truncate">{formatLeaderboardModeLabel(leaderboardMode)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => cycleLeaderboardMode(1)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ninja-border bg-ninja-card text-zinc-100 hover:border-ninja-accent/45"
                        aria-label={t("leaderboard.nextMode", "Next leaderboard mode")}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  )}

                  <div className="mt-6 rounded-2xl border border-indigo-300/25 bg-[linear-gradient(180deg,rgba(15,23,42,0.55),rgba(10,14,28,0.8))] p-3 md:p-4">
                    <div
                      className={`hidden items-center gap-x-3 border-b border-indigo-200/20 px-3 pb-2 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400 md:grid ${leaderboardShowingSpeed
                        ? "md:grid-cols-[90px_minmax(0,1fr)_160px_140px]"
                        : "md:grid-cols-[90px_minmax(0,1fr)_120px_180px_160px]"
                        }`}
                    >
                      <span>{t("leaderboard.colRank", "Rank")}</span>
                      <span>{t("leaderboard.colShinobi", "Shinobi")}</span>
                      {leaderboardShowingSpeed ? (
                        <>
                          <span className="text-right">{t("leaderboard.colTime", "Time")}</span>
                          <span>{t("leaderboard.colTitle", "Title")}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-right">{t("leaderboard.colLv", "LV")}</span>
                          <span className="text-right">{t("leaderboard.colXp", "XP")}</span>
                          <span>{t("leaderboard.colTitle", "Title")}</span>
                        </>
                      )}
                    </div>

                    {leaderboardLoading ? (
                      <div className="flex h-52 items-center justify-center gap-2 text-sm text-zinc-200">
                        <Loader2 className="h-4 w-4 animate-spin text-ninja-accent" />
                        {t("leaderboard.loading", "Summoning scrolls...")}
                      </div>
                    ) : leaderboardError ? (
                      <div className="flex h-52 items-center justify-center px-3 text-center text-sm text-red-200">
                        {leaderboardError}
                      </div>
                    ) : leaderboardVisibleCount === 0 ? (
                      <div className="flex h-52 items-center justify-center px-3 text-center text-sm text-zinc-300">
                        {leaderboardShowingSpeed
                          ? `${t("leaderboard.noRecordsFor", "No")} ${formatLeaderboardModeLabel(leaderboardMode)} ${t("leaderboard.recordsFound", "records found.")}`
                          : t("leaderboard.noLevelRecordsFound", "No level leaderboard records found yet.")}
                      </div>
                    ) : (
                      <>
                        <div className="hidden space-y-2 pt-2 md:block">
                          {leaderboardShowingSpeed
                            ? leaderboardRows.map((row, idx) => {
                              const rank = (leaderboardPage * LEADERBOARD_PAGE_SIZE) + idx + 1;
                              const title = getLeaderboardTitleForRank(rank);
                              const titleClass = getLeaderboardTitleClass(rank);
                              const usernameText = String(row.username || "Shinobi");
                              const rowFx = rank === 1
                                ? "border-amber-300/45 bg-gradient-to-r from-amber-500/18 via-amber-300/8 to-transparent"
                                : rank <= 3
                                  ? "border-zinc-300/25 bg-gradient-to-r from-zinc-300/10 via-zinc-200/5 to-transparent"
                                  : "border-indigo-200/10 bg-black/12";
                              return (
                                <div key={`${row.id}-${rank}`} className={`grid items-center gap-x-3 rounded-xl border px-3 py-2.5 md:grid-cols-[90px_minmax(0,1fr)_160px_140px] ${rowFx}`}>
                                  <span className={`font-black ${titleClass}`}>#{rank}</span>
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    {row.avatar_url ? (
                                      <Image
                                        src={row.avatar_url}
                                        alt={usernameText}
                                        width={30}
                                        height={30}
                                        unoptimized
                                        className={`h-8 w-8 rounded-full object-cover ${rank <= 3 ? "ring-1 ring-white/35" : ""}`}
                                      />
                                    ) : (
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-black text-zinc-100">
                                        {usernameText.slice(0, 1).toUpperCase()}
                                      </div>
                                    )}
                                    <span className="truncate text-zinc-100">{usernameText}</span>
                                  </div>
                                  <span className="text-right font-mono text-lg font-black text-emerald-300">{Number(row.score_time || 0).toFixed(2)}s</span>
                                  <span className={`inline-flex w-fit rounded-md border px-2 py-1 text-xs font-black tracking-[0.08em] ${titleClass} border-current/40 bg-black/25`}>
                                    {title}
                                  </span>
                                </div>
                              );
                            })
                            : leaderboardLevelRows.map((row, idx) => {
                              const rank = (leaderboardPage * LEADERBOARD_PAGE_SIZE) + idx + 1;
                              const titleClass = getLeaderboardTitleClass(rank);
                              const usernameText = String(row.username || "Shinobi");
                              const rowTitle = String(row.rank || getLeaderboardTitleForRank(rank)).toUpperCase();
                              const rowFx = rank === 1
                                ? "border-cyan-300/45 bg-gradient-to-r from-cyan-500/16 via-cyan-300/8 to-transparent"
                                : rank <= 3
                                  ? "border-zinc-300/25 bg-gradient-to-r from-zinc-300/10 via-zinc-200/5 to-transparent"
                                  : "border-indigo-200/10 bg-black/12";
                              return (
                                <div key={`${row.id}-${rank}`} className={`grid items-center gap-x-3 rounded-xl border px-3 py-2.5 md:grid-cols-[90px_minmax(0,1fr)_120px_180px_160px] ${rowFx}`}>
                                  <span className={`font-black ${titleClass}`}>#{rank}</span>
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    {row.avatar_url ? (
                                      <Image
                                        src={row.avatar_url}
                                        alt={usernameText}
                                        width={30}
                                        height={30}
                                        unoptimized
                                        className={`h-8 w-8 rounded-full object-cover ${rank <= 3 ? "ring-1 ring-white/35" : ""}`}
                                      />
                                    ) : (
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-black text-zinc-100">
                                        {usernameText.slice(0, 1).toUpperCase()}
                                      </div>
                                    )}
                                    <span className="truncate text-zinc-100">{usernameText}</span>
                                  </div>
                                  <span className="text-right font-mono font-black text-sky-200">LV.{Math.max(0, Math.floor(Number(row.level) || 0))}</span>
                                  <span className="text-right font-mono text-xl font-black text-emerald-300">{Math.max(0, Math.floor(Number(row.xp) || 0)).toLocaleString()}</span>
                                  <span className={`inline-flex w-fit rounded-md border px-2 py-1 text-xs font-black tracking-[0.08em] ${titleClass} border-current/40 bg-black/25`}>
                                    {rowTitle}
                                  </span>
                                </div>
                              );
                            })}
                        </div>

                        <div className="space-y-2 pt-2 md:hidden">
                          {leaderboardShowingSpeed
                            ? leaderboardRows.map((row, idx) => {
                              const rank = (leaderboardPage * LEADERBOARD_PAGE_SIZE) + idx + 1;
                              const title = getLeaderboardTitleForRank(rank);
                              const titleClass = getLeaderboardTitleClass(rank);
                              const usernameText = String(row.username || "Shinobi");
                              return (
                                <div key={`${row.id}-${rank}`} className="rounded-xl border border-indigo-200/20 bg-black/25 p-3">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-sm font-black ${titleClass}`}>#{rank}</span>
                                    <span className={`text-[11px] font-black ${titleClass}`}>{title}</span>
                                  </div>
                                  <div className="mt-2 flex items-center gap-2.5">
                                    {row.avatar_url ? (
                                      <Image
                                        src={row.avatar_url}
                                        alt={usernameText}
                                        width={30}
                                        height={30}
                                        unoptimized
                                        className="h-8 w-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-black text-zinc-100">
                                        {usernameText.slice(0, 1).toUpperCase()}
                                      </div>
                                    )}
                                    <span className="truncate text-zinc-100">{usernameText}</span>
                                  </div>
                                  <div className="mt-3 flex items-end justify-between">
                                    <span className="text-[10px] font-black tracking-[0.14em] text-zinc-400">{t("leaderboard.colTime", "Time").toUpperCase()}</span>
                                    <span className="font-mono text-xl font-black text-emerald-300">{Number(row.score_time || 0).toFixed(2)}s</span>
                                  </div>
                                </div>
                              );
                            })
                            : leaderboardLevelRows.map((row, idx) => {
                              const rank = (leaderboardPage * LEADERBOARD_PAGE_SIZE) + idx + 1;
                              const titleClass = getLeaderboardTitleClass(rank);
                              const usernameText = String(row.username || "Shinobi");
                              const rowTitle = String(row.rank || getLeaderboardTitleForRank(rank)).toUpperCase();
                              return (
                                <div key={`${row.id}-${rank}`} className="rounded-xl border border-indigo-200/20 bg-black/25 p-3">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-sm font-black ${titleClass}`}>#{rank}</span>
                                    <span className={`text-[11px] font-black ${titleClass}`}>{rowTitle}</span>
                                  </div>
                                  <div className="mt-2 flex items-center gap-2.5">
                                    {row.avatar_url ? (
                                      <Image
                                        src={row.avatar_url}
                                        alt={usernameText}
                                        width={30}
                                        height={30}
                                        unoptimized
                                        className="h-8 w-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-black text-zinc-100">
                                        {usernameText.slice(0, 1).toUpperCase()}
                                      </div>
                                    )}
                                    <span className="truncate text-zinc-100">{usernameText}</span>
                                  </div>
                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-lg border border-sky-300/25 bg-sky-500/10 px-2 py-1.5">
                                      <p className="text-[10px] font-black tracking-[0.12em] text-sky-200/85">{t("leaderboard.colLv", "LV")}</p>
                                      <p className="text-right font-mono font-black text-sky-100">LV.{Math.max(0, Math.floor(Number(row.level) || 0))}</p>
                                    </div>
                                    <div className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-2 py-1.5">
                                      <p className="text-[10px] font-black tracking-[0.12em] text-emerald-200/85">{t("leaderboard.colXp", "XP")}</p>
                                      <p className="text-right font-mono font-black text-emerald-200">{Math.max(0, Math.floor(Number(row.xp) || 0)).toLocaleString()}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <span className="text-xs font-mono text-zinc-300">
                      {t("leaderboard.page", "PAGE")} {leaderboardPage + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={leaderboardLoading || !leaderboardCanPrev}
                        onClick={() => setLeaderboardPage((prev) => Math.max(0, prev - 1))}
                        className="rounded-lg border border-ninja-border bg-ninja-card px-4 py-2 text-xs font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {t("common.prev", "PREV")}
                      </button>
                      <button
                        type="button"
                        disabled={leaderboardLoading || !leaderboardCanNext || !leaderboardHasNext}
                        onClick={() => setLeaderboardPage((prev) => prev + 1)}
                        className="rounded-lg border border-ninja-border bg-ninja-card px-4 py-2 text-xs font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {t("common.next", "NEXT")}
                      </button>
                    </div>
                  </div>


                </div>
              </div>
            )}

            {view === "multiplayer" && (
              <LockedPanel
                title={t("modeSelect.multiplayerLocked", "MULTIPLAYER (LOCKED)")}
                description={t("multiplayer.lockedDescription", "Online multiplayer matchmaking and anti-cheat flow are not enabled in this web build yet.")}
                joinLabel={t("multiplayer.joinDiscordForUpdates", "JOIN DISCORD FOR UPDATES")}
                backLabel={t("common.backToSelectPath", "BACK TO SELECT PATH")}
                onBack={() => setView("mode_select")}
              />
            )}

            {view === "settings" && (
              <div className="mx-auto max-w-2xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-8 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <div className="mb-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSettings(savedSettings);
                      setView("menu");
                    }}
                    className="flex items-center gap-2 text-sm font-black text-ninja-dim hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t("common.cancel", "CANCEL")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveSettings()}
                    className="h-10 rounded-xl bg-ninja-accent px-5 text-xs font-black tracking-wide text-white hover:bg-ninja-accent-glow"
                  >
                    {t("settings.saveAndBack", "SAVE & BACK")}
                  </button>
                </div>
                <h2 className="text-3xl font-black tracking-tight text-white">{t("settings.title", "SETTINGS")}</h2>
                <p className="mt-1 text-sm text-ninja-dim">{t("settings.subtitle", "Menu settings mirror the pygame controls.")}</p>

                <div className="mt-6 space-y-6">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-zinc-100">
                      <span>{t("settings.musicVolume", "Music Volume")}</span>
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
                      <span>{t("settings.sfxVolume", "SFX Volume")}</span>
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
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">{t("settings.cameraSetup", "Camera Setup")}</p>
                      <button
                        type="button"
                        onClick={() => void scanCameras()}
                        disabled={cameraScanBusy}
                        className="rounded-md border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-[11px] font-black tracking-wide text-sky-200 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cameraScanBusy ? t("settings.scanning", "SCANNING...") : t("settings.scanCameras", "SCAN CAMERAS")}
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1.8fr,1fr]">
                      <label className="text-sm text-zinc-100">
                        <span className="block text-xs uppercase tracking-[0.14em] text-zinc-400">{t("settings.cameraDevice", "Camera Device")}</span>
                        <select
                          value={draftSettings.cameraIdx}
                          onChange={(event) => {
                            const next = clampInt(event.target.value, 0, 32, draftSettings.cameraIdx);
                            setDraftSettings((prev) => ({ ...prev, cameraIdx: next }));
                          }}
                          className="mt-2 w-full rounded-md border border-ninja-border bg-black/30 px-2 py-1 text-sm text-white"
                        >
                          {cameraOptions.length === 0 && (
                            <option value={draftSettings.cameraIdx}>{t("settings.cameraLabel", "Camera")} {draftSettings.cameraIdx}</option>
                          )}
                          {cameraOptions.map((cam) => (
                            <option key={`${cam.idx}-${cam.deviceId}`} value={cam.idx}>
                              {cam.label}
                            </option>
                          ))}
                          {!currentCameraOption && cameraOptions.length > 0 && (
                            <option value={draftSettings.cameraIdx}>{t("settings.cameraLabel", "Camera")} {draftSettings.cameraIdx}</option>
                          )}
                        </select>
                      </label>
                    </div>

                    <label className="mt-3 flex items-center justify-between rounded-lg border border-ninja-border bg-black/20 px-3 py-2 text-sm text-zinc-100">
                      <span>{t("settings.cameraPreview", "Camera Preview")}</span>
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
                    <span>{t("settings.showHandSkeleton", "Show Hand Skeleton")}</span>
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

                  <label className="flex items-center justify-between gap-3 rounded-lg border border-ninja-border bg-ninja-bg/30 px-4 py-3 text-sm text-zinc-100">
                    <span className="flex flex-col">
                      <span>{t("settings.strictTwoHandMode", "Strict Two-Hand Mode")}</span>
                      <span className="text-xs text-zinc-400">
                        {t("settings.strictTwoHandModeHint", "Require both hands visible before confirming signs.")}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={draftSettings.restrictedSigns}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDraftSettings((prev) => ({ ...prev, restrictedSigns: checked }));
                      }}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-lg border border-ninja-border bg-ninja-bg/30 px-4 py-3 text-sm text-zinc-100">
                    <span className="flex flex-col">
                      <span>{t("settings.ramTigerShared", "Ram/Tiger Assist")}</span>
                      <span className="text-xs text-zinc-400">
                        {t("settings.ramTigerSharedHint", "Allow Ram or Tiger to count for either sign in a sequence.")}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={draftSettings.ramTigerShared}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDraftSettings((prev) => ({ ...prev, ramTigerShared: checked }));
                      }}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-lg border border-ninja-border bg-ninja-bg/30 px-4 py-3 text-sm text-zinc-100">
                    <span className="flex flex-col">
                      <span>{t("settings.animations", "Animations")}</span>
                      <span className="text-xs text-zinc-400">
                        {t("settings.animationsHint", "Turn jutsu visual effects on or off.")}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={!draftSettings.noEffects}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDraftSettings((prev) => ({ ...prev, noEffects: !checked }));
                      }}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-ninja-border bg-ninja-bg/30 px-4 py-3 text-sm text-zinc-100">
                    <span>{t("settings.fullscreen", "Fullscreen")}</span>
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
                    className="h-12 w-full rounded-xl border border-amber-500/40 bg-amber-500/15 px-6 text-sm font-black tracking-wide text-amber-200 hover:bg-amber-500/25"
                  >
                    {t("settings.runCalibration", "RUN CALIBRATION")}
                  </button>
                </div>
              </div>
            )}

            {view === "tutorial" && (
              <div className="mx-auto max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-6 md:p-8 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <button
                  type="button"
                  onClick={() => {
                    void markTutorialSeen();
                    setTutorialStep(0);
                    setView("menu");
                  }}
                  className="mb-6 flex items-center gap-2 text-sm font-black text-ninja-dim hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("common.back", "BACK")}
                </button>
                <p className="text-xs font-black tracking-[0.2em] text-ninja-dim">
                  {t("tutorial.step", "STEP")} {tutorialStep + 1} / {TUTORIAL_STEPS.length}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-white">{tutorialTitle}</h2>

                <div className="mt-5 grid grid-cols-1 items-start gap-5 md:grid-cols-[320px,1fr]">
                  <div className="flex w-full items-center justify-center overflow-hidden rounded-2xl border border-ninja-border bg-black/40 p-2 md:h-[220px] aspect-[16/11]">
                    <Image
                      src={tutorial.iconPath}
                      alt={tutorialTitle}
                      width={320}
                      height={220}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="rounded-2xl border border-ninja-border bg-ninja-bg/40 p-5">
                    <ul className="space-y-3 text-sm text-zinc-200">
                      {tutorialLines.map((line) => (
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
                    {t("common.back", "BACK")}
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
                    {t("tutorial.skip", "SKIP")}
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
                    {tutorialStep >= TUTORIAL_STEPS.length - 1
                      ? t("tutorial.finish", "FINISH")
                      : t("common.next", "NEXT")}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {view === "about" && (
              <div className="mx-auto max-w-3xl rounded-3xl border border-ninja-border bg-ninja-panel/90 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  className="mb-8 flex items-center gap-2 text-sm font-black text-ninja-dim hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("common.back", "BACK")}
                </button>
                <h2 className="text-3xl font-black tracking-tight text-white">{t("about.title", "ABOUT JUTSU ACADEMY")}</h2>
                <p className="mt-1 text-sm text-ninja-dim">{t("about.subtitle", "Project details, controls, privacy, and roadmap.")}</p>

                <div className="mt-6 max-h-[62vh] space-y-4 overflow-y-auto pr-1">
                  {localizedAboutSections.map((section) => (
                    <section key={section.title} className="rounded-xl border border-ninja-border bg-ninja-bg/35 p-4">
                      <h3
                        className={`text-base font-black uppercase tracking-wide ${section.tone === "success"
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
          </div>
        )
        }
      </main>

      {showAnnouncements && !!session && activeAnnouncement && !maintenanceGate && !updateGate && (
        <div className="fixed inset-0 z-[59] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close announcements"
            onClick={() => setShowAnnouncements(false)}
            className="absolute inset-0 bg-black/72"
          />
          <div className="relative w-full max-w-[620px] rounded-2xl border border-ninja-border bg-[#11141f]/96 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-300">
              {t("announcement.title", "Announcement")} {announcementIndex + 1} / {announcements.length}
            </p>
            <p className="mt-4 rounded-xl border border-ninja-border bg-black/30 px-4 py-4 text-sm leading-relaxed text-zinc-100 min-h-[160px]">
              {activeAnnouncement.message}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAnnouncementIndex((prev) => Math.max(0, prev - 1))}
                disabled={announcementIndex <= 0}
                className="h-10 rounded-lg border border-ninja-border bg-ninja-card px-4 text-xs font-black tracking-wide text-zinc-100 hover:border-ninja-accent/40 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("common.prev", "PREV")}
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
                {announcementIndex >= announcements.length - 1
                  ? t("common.done", "DONE")
                  : t("common.next", "NEXT")}
              </button>
            </div>
          </div>
        </div>
      )}

      {
        maintenanceGate && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/88 px-4">
            <div className="w-full max-w-[620px] rounded-2xl border border-red-400/35 bg-[#140f14]/96 p-7 shadow-[0_30px_95px_rgba(0,0,0,0.72)]">
              <p className="text-[11px] font-black uppercase tracking-[0.23em] text-red-300">{t("maintenance.label", "Maintenance")}</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-white">{t("maintenance.title", "Jutsu Academy Temporarily Offline")}</h3>
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
                  {t("maintenance.statusDiscord", "STATUS / DISCORD")}
                </a>
                <button
                  type="button"
                  onClick={() => void pollRuntimeConfig()}
                  className="h-10 rounded-lg bg-red-600 px-4 text-xs font-black tracking-wide text-white hover:bg-red-500"
                >
                  {t("common.retry", "RETRY")}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        !maintenanceGate && updateGate && (
          <div className="fixed inset-0 z-[69] flex items-center justify-center bg-black/86 px-4">
            <div className="w-full max-w-[620px] rounded-2xl border border-amber-300/40 bg-[#15120b]/96 p-7 shadow-[0_30px_95px_rgba(0,0,0,0.72)]">
              <p className="text-[11px] font-black uppercase tracking-[0.23em] text-amber-300">{t("update.label", "Mandatory Update")}</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-white">{t("update.title", "Client Update Required")}</h3>
              <p className="mt-4 rounded-xl border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
                {updateGate.message}
              </p>
              <div className="mt-4 rounded-lg border border-ninja-border bg-black/25 px-3 py-2 text-xs text-zinc-200">
                {t("update.current", "Current")}: {WEB_APP_VERSION} • {t("update.required", "Required")}: {updateGate.remoteVersion || t("update.latest", "latest")}
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <a
                  href={updateGate.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center rounded-lg border border-amber-300/45 bg-amber-500/18 px-4 text-xs font-black tracking-wide text-amber-100 hover:bg-amber-500/30"
                >
                  {t("update.getUpdate", "GET UPDATE")}
                </a>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="h-10 rounded-lg bg-amber-600 px-4 text-xs font-black tracking-wide text-white hover:bg-amber-500"
                >
                  {t("update.reload", "RELOAD")}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        session && masteryPanel && (
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
                  ? t("mastery.masteryUnlocked", "MASTERY UNLOCKED")
                  : t("mastery.newBest", "NEW BEST")}
              </p>
              <p className="mt-1 text-center text-xl font-black" style={{ color: "rgb(200, 180, 130)" }}>{getJutsuUiName(masteryPanel.jutsuName)}</p>

              <p className="mt-3 text-center text-5xl font-black" style={{ color: "rgb(255, 245, 200)" }}>{masteryPanel.newBest.toFixed(2)}s</p>
              <p className="mt-1 text-center text-xs uppercase tracking-[0.16em]" style={{ color: "rgb(160, 220, 160)" }}>
                {masteryPanel.previousBest === null
                  ? t("mastery.firstRecord", "FIRST RECORD")
                  : t("mastery.newBestTime", "NEW BEST TIME")}
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
                  {masteryPanel.newTier === "none" ? t("mastery.unranked", "UNRANKED") : masteryPanel.newTier}
                </p>
                {(masteryPanel.newTier !== masteryPanel.previousTier || masteryPanel.previousBest === null) && (
                  <span className="ml-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "rgb(200, 255, 180)" }}>
                    {t("mastery.unlocked", "Unlocked!")}
                  </span>
                )}
              </div>

              {masteryDelta !== null && (
                <p
                  className="mt-2 text-center text-xs font-black"
                  style={{ color: masteryDelta < 0 ? "rgb(100, 230, 120)" : "rgb(230, 110, 80)" }}
                >
                  {masteryDelta < 0 ? t("mastery.up", "UP") : t("mastery.down", "DOWN")} {Math.abs(masteryDelta).toFixed(2)}s
                </p>
              )}

              {masteryThresholds && (
                <div className="mt-4">
                  <div className="relative h-[8px] rounded-full" style={{ backgroundColor: "rgb(50, 40, 30)" }}>
                    <div
                      className="h-[8px] rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${masteryBarDisplayPct}%`,
                        backgroundColor: `rgb(${masteryTierRgb.r}, ${masteryTierRgb.g}, ${masteryTierRgb.b})`,
                      }}
                    />
                    <span
                      className="absolute -top-[7px] h-[22px] w-[2px] rounded-full transition-[left] duration-700 ease-out"
                      style={{
                        left: `${masteryBarDisplayPct}%`,
                        transform: "translateX(-50%)",
                        backgroundColor: "rgba(245, 245, 245, 0.85)",
                        boxShadow: "0 0 8px rgba(255,255,255,0.35)",
                      }}
                    />
                    <span className="absolute -top-[6px] h-[20px] w-[1px]" style={{ left: `${masteryBronzePct}%`, backgroundColor: "rgb(196, 128, 60)" }} />
                    <span className="absolute -top-[6px] h-[20px] w-[1px]" style={{ left: `${masterySilverPct}%`, backgroundColor: "rgb(180, 190, 200)" }} />
                    <span className="absolute -top-[6px] h-[20px] w-[1px]" style={{ left: `${masteryGoldPct}%`, backgroundColor: "rgb(255, 200, 40)" }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wide" style={{ color: "rgb(180, 160, 120)" }}>
                    <span>{t("mastery.bronze", "BRONZE")} {masteryThresholds.bronze.toFixed(1)}s</span>
                    <span>{t("mastery.silver", "SILVER")} {masteryThresholds.silver.toFixed(1)}s</span>
                    <span>{t("mastery.gold", "GOLD")} {masteryThresholds.gold.toFixed(1)}s</span>
                  </div>
                  {masteryNextTierHint && (
                    <p className="mt-2 text-center text-[11px]" style={{ color: "rgb(180, 160, 110)" }}>
                      {t("common.next", "NEXT")}: {masteryNextTierHint.name} ({masteryNextTierHint.target.toFixed(2)}s) - {(masteryPanel.newBest - masteryNextTierHint.target).toFixed(2)}s {t("mastery.toGo", "to go")}
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
                {t("common.continue", "Continue")}
              </button>
            </div>
          </div>
        )
      }

      {
        session && levelUpPanel && !masteryPanel && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close level-up panel"
              onClick={() => setLevelUpPanel(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"
            />

            <div className="relative w-full max-w-[520px] overflow-hidden rounded-[26px] border border-amber-200/55 bg-[radial-gradient(circle_at_22%_15%,rgba(255,210,120,0.2),transparent_45%),radial-gradient(circle_at_78%_85%,rgba(110,180,255,0.18),transparent_42%),linear-gradient(180deg,rgba(20,16,28,0.98)_0%,rgba(9,10,18,0.98)_100%)] shadow-[0_36px_110px_rgba(0,0,0,0.72)]">
              <div className="pointer-events-none absolute -left-20 -top-16 h-48 w-48 rounded-full bg-amber-300/22 blur-3xl" />
              <div className="pointer-events-none absolute -right-20 -bottom-16 h-52 w-52 rounded-full bg-cyan-300/18 blur-3xl" />
              <div className="pointer-events-none absolute inset-[2px] rounded-[24px] border border-amber-100/18" />

              <button
                type="button"
                aria-label={t("common.close", "Close")}
                onClick={() => setLevelUpPanel(null)}
                className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/35 text-zinc-200 hover:border-white/45 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative px-6 pb-6 pt-7">
                <div className="mb-3 flex items-center justify-center gap-2">
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

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-amber-300/45 bg-amber-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                    {t("levelUp.title", "LEVEL UP")}
                  </span>
                  {!!levelUpPanel.sourceLabel && (
                    <span className="rounded-full border border-zinc-500/45 bg-zinc-800/55 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-200">
                      {levelUpPanel.sourceLabel}
                    </span>
                  )}
                </div>

                <div className="mt-5 flex justify-center">
                  <div className="relative flex h-[132px] w-[132px] items-center justify-center rounded-full border border-amber-200/50 bg-gradient-to-b from-amber-200/20 to-amber-400/5">
                    <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,230,140,0.22)_0%,rgba(255,230,140,0)_65%)]" />
                    <p className="relative text-center text-[46px] font-black leading-none text-amber-100">
                      {levelUpPanel.newLevel}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-zinc-600/65 bg-zinc-900/55 px-3 py-2 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Previous</p>
                    <p className="mt-1 text-lg font-black text-zinc-100">LV.{levelUpPanel.previousLevel}</p>
                  </div>
                  <div className="rounded-xl border border-amber-300/55 bg-amber-500/12 px-3 py-2 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-200">Current</p>
                    <p className="mt-1 text-lg font-black text-amber-100">LV.{levelUpPanel.newLevel}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="rounded-full border border-amber-300/55 bg-amber-500/14 px-4 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
                    {levelUpPanel.rank}
                  </span>
                  {levelUpDelta > 0 && (
                    <span className="rounded-full border border-emerald-300/45 bg-emerald-500/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-200">
                      +{levelUpDelta} Level{levelUpDelta === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {levelUpPanel.unlocked.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-emerald-300/35 bg-emerald-500/7 p-4">
                    <p className="text-center text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">
                      {t("levelUp.newJutsuUnlocked", "New Jutsu Unlocked")}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {levelUpPanel.unlocked.slice(0, 4).map((name) => (
                        <div
                          key={name}
                          className="rounded-lg border border-emerald-300/45 bg-emerald-500/12 px-3 py-2 text-center text-xs font-bold text-emerald-100"
                        >
                          {getJutsuUiName(name)}
                        </div>
                      ))}
                    </div>
                    {levelUpPanel.unlocked.length > 4 && (
                      <p className="mt-2 text-center text-[11px] text-emerald-100/70">
                        +{levelUpPanel.unlocked.length - 4} {t("levelUp.more", "more")}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setLevelUpPanel(null)}
                  className="mt-6 flex h-[48px] w-full items-center justify-center rounded-[14px] border border-amber-300/70 bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-black tracking-[0.08em] text-zinc-950 hover:brightness-110"
                >
                  {t("levelUp.awesome", "Awesome")}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        session && showLogoutConfirm && (
          <div className="fixed inset-0 z-[51] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close logout dialog"
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-black/75"
            />
            <div className="relative w-full max-w-[500px] rounded-2xl border border-ninja-border bg-ninja-panel p-6 shadow-[0_24px_70px_rgba(0,0,0,0.62)]">
              <p className="text-center text-2xl font-black tracking-tight text-white">{t("logout.title", "Sign Out?")}</p>
              <p className="mt-4 text-center text-sm text-zinc-300">{t("logout.subtitle", "Sign out and clear this session?")}</p>
              <p className="mt-1 text-center text-sm text-zinc-400">{t("logout.helper", "You can log back in anytime.")}</p>

              {authError && (
                <p className="mt-4 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {authError}
                </p>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={authBusy}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-700 text-sm font-black text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  {t("menu.signOut", "SIGN OUT")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="h-12 rounded-xl border border-ninja-border bg-ninja-card text-sm font-black text-zinc-100 hover:border-ninja-accent/40"
                >
                  {t("common.cancel", "CANCEL")}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        errorModal && !connectionLostState && (
          <div className="fixed inset-0 z-[52] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close error modal"
              onClick={() => setErrorModal(null)}
              className="absolute inset-0 bg-black/80"
            />
            <div className="relative w-full max-w-[550px] rounded-2xl border border-red-400/60 bg-ninja-panel p-6 shadow-[0_24px_70px_rgba(0,0,0,0.62)]">
              <p className="text-center text-2xl font-black text-red-300">{errorModal.title}</p>
              <p className="mt-5 whitespace-pre-line text-center text-sm leading-relaxed text-zinc-100">
                {errorModal.message}
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setErrorModal(null)}
                  className="flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-xl border border-ninja-border bg-ninja-card px-5 text-sm font-black text-zinc-100 hover:border-ninja-accent/40"
                >
                  <AlertTriangle className="h-4 w-4 text-red-300" />
                  {t("common.backToMenu", "Back to Menu")}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        alertModal && !connectionLostState && (
          <div className="fixed inset-0 z-[53] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close alert modal"
              onClick={() => setAlertModal(null)}
              className="absolute inset-0 bg-black/82 backdrop-blur-[2px]"
            />

            <div className="relative w-full max-w-[660px] overflow-hidden rounded-[24px] border border-orange-200/65 bg-[radial-gradient(circle_at_15%_8%,rgba(255,180,80,0.22),transparent_42%),radial-gradient(circle_at_82%_88%,rgba(98,198,255,0.16),transparent_38%),linear-gradient(180deg,rgba(16,20,36,0.97)_0%,rgba(10,12,24,0.97)_100%)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.72)]">
              <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-orange-300/25 blur-3xl" />
              <div className="pointer-events-none absolute -right-20 -bottom-20 h-52 w-52 rounded-full bg-cyan-300/14 blur-3xl" />
              <div className="pointer-events-none absolute inset-[2px] rounded-[22px] border border-orange-100/18" />

              <div className="relative">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/55 bg-amber-400/14 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Quest Complete
                  </span>
                  {alertRewardXp > 0 && (
                    <span className="rounded-full border border-emerald-300/50 bg-emerald-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                      +{alertRewardXp} XP
                    </span>
                  )}
                </div>

                <p className="mt-3 text-center text-2xl font-black text-orange-100">{alertModal.title}</p>

                <div className="mt-5 space-y-2">
                  {alertModalLines.length > 0 ? alertModalLines.map((line, idx) => (
                    <p
                      key={`alert-line-${idx}`}
                      className={`rounded-lg border px-4 py-2 text-center text-sm leading-relaxed ${idx === 0
                        ? "border-orange-300/45 bg-orange-500/10 text-zinc-100"
                        : "border-zinc-600/70 bg-zinc-900/45 text-zinc-200"
                        }`}
                    >
                      {line}
                    </p>
                  )) : (
                    <p className="rounded-lg border border-zinc-600/70 bg-zinc-900/45 px-4 py-2 text-center text-sm leading-relaxed text-zinc-200">
                      {alertModal.message}
                    </p>
                  )}
                </div>

                <div className="mt-7 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setAlertModal(null)}
                    className="flex h-12 min-w-[240px] items-center justify-center rounded-xl border border-orange-200/60 bg-gradient-to-r from-orange-500 to-amber-500 px-6 text-sm font-black tracking-[0.1em] text-zinc-950 hover:brightness-110"
                  >
                    {alertModal.buttonText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        jutsuInfoModal && activeJutsuInfoConfig && !connectionLostState && (
          <div className="fixed inset-0 z-[54] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close jutsu info modal"
              onClick={() => setJutsuInfoModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"
            />
            <div className="relative w-full max-w-[760px] overflow-hidden rounded-[24px] border border-orange-300/55 bg-[#0f1424]/96 shadow-[0_30px_90px_rgba(0,0,0,0.72)]">
              <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -right-28 -bottom-24 h-64 w-64 rounded-full bg-cyan-400/14 blur-3xl" />

              <button
                type="button"
                aria-label={t("common.close", "Close")}
                onClick={() => setJutsuInfoModal(null)}
                className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/45 text-zinc-200 hover:border-white/45 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative h-[220px] w-full overflow-hidden border-b border-ninja-border/70">
                {activeJutsuInfoTexture ? (
                  <Image
                    src={activeJutsuInfoTexture}
                    alt={activeJutsuInfoUiName}
                    fill
                    sizes="(max-width: 768px) 100vw, 760px"
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#24314d] via-[#1c253f] to-[#111726]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1424] via-[#0f1424]/55 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/40 bg-black/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-orange-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    {activeJutsuInfoEffectLabel}
                  </div>
                  <h3 className="mt-3 text-3xl font-black leading-tight text-white">{activeJutsuInfoUiName}</h3>
                  <p className="mt-1 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200/95">
                    {activeJutsuInfoConfig.displayText}
                  </p>
                </div>
              </div>

              <div className="relative p-5 md:p-6">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${activeJutsuInfoUnlocked
                    ? "border-emerald-300/45 bg-emerald-500/14 text-emerald-200"
                    : "border-red-300/45 bg-red-500/14 text-red-200"
                    }`}
                  >
                    {activeJutsuInfoUnlocked
                      ? t("library.unlocked", "UNLOCKED")
                      : `${t("library.locked", "LOCKED")} • LV.${activeJutsuInfoConfig.minLevel}`}
                  </span>
                  <span className="rounded-full border border-ninja-border bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                    LV.{activeJutsuInfoConfig.minLevel}
                  </span>
                  <span className="rounded-full border border-ninja-border bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                    {activeJutsuInfoConfig.sequence.length} {t("library.signs", "signs")}
                  </span>
                  {activeJutsuInfoConfig.duration ? (
                    <span className="rounded-full border border-ninja-border bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                      {activeJutsuInfoConfig.duration.toFixed(1)}s
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-relaxed text-zinc-200/95">
                  {activeJutsuInfoSummary}
                </p>

                <div className="mt-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-300">
                    {t("library.sequence", "Sequence")}
                  </p>
                  {activeJutsuInfoConfig.sequence.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeJutsuInfoConfig.sequence.map((sign, idx) => (
                        <span
                          key={`${activeJutsuInfoName}-${idx}-${sign}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-ninja-border bg-black/30 px-3 py-1.5 text-xs font-bold text-zinc-100"
                        >
                          <span className="rounded-md bg-orange-500/18 px-1.5 py-0.5 text-[10px] font-black text-orange-200">
                            {idx + 1}
                          </span>
                          {formatSignLabel(sign)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-semibold text-emerald-300">
                      {t("library.noSignsRequired", "No hand signs required for this move.")}
                    </p>
                  )}
                </div>

                {Array.isArray(activeJutsuInfoConfig.comboParts) && activeJutsuInfoConfig.comboParts.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-300">
                      {t("library.comboFlow", "Combo Flow")}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {activeJutsuInfoConfig.comboParts.map((part, idx) => (
                        <div
                          key={`${activeJutsuInfoName}-combo-${idx}-${part.name}`}
                          className="rounded-lg border border-ninja-border bg-black/30 px-3 py-2"
                        >
                          <p className="text-xs font-black text-white">{part.name}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-300">Step {part.atStep} • {formatSignLabel(part.effect)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setJutsuInfoModal(null)}
                    className="h-11 rounded-xl border border-ninja-border bg-black/35 text-sm font-black text-zinc-100 hover:border-ninja-accent/45"
                  >
                    {t("common.close", "Close")}
                  </button>

                  {activeJutsuInfoUnlocked ? (
                    libraryIntent === "browse" ? (
                      <button
                        type="button"
                        onClick={() => {
                          playUiClickSfx();
                          setSelectedJutsu(activeJutsuInfoName);
                          setJutsuInfoModal(null);
                        }}
                        className="h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 text-sm font-black text-white shadow-[0_10px_24px_rgba(251,146,60,0.35)] hover:brightness-110"
                      >
                        {t("library.selectJutsu", "Select Jutsu")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleLibraryStart}
                        className="h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 text-sm font-black text-white shadow-[0_10px_24px_rgba(251,146,60,0.35)] hover:brightness-110"
                      >
                        {libraryIntent === "rank"
                          ? t("library.startRankRun", "Start Rank Run")
                          : t("library.playThisJutsu", "Play This Jutsu")}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="h-11 rounded-xl border border-red-300/45 bg-red-500/12 text-sm font-black text-red-200"
                    >
                      {t("library.unlocksAt", "Unlocks at")} LV.{activeJutsuInfoConfig.minLevel}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        connectionLostState && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/85" />
            <div className="relative w-full max-w-[500px] rounded-2xl border border-red-400/60 bg-ninja-panel p-6 shadow-[0_30px_90px_rgba(0,0,0,0.75)]">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-red-400/45 bg-red-500/10">
                <WifiOff className="h-5 w-5 text-red-300" />
              </div>
              <p className="mt-3 text-center text-2xl font-black text-red-300">{connectionLostState.title}</p>
              <div className="mt-4 space-y-2 text-center text-sm text-zinc-100">
                {connectionLostState.lines.map((line) => (
                  <p key={`conn-line-${line}`}>{line}</p>
                ))}
              </div>
              <div className="mt-7 flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleConnectionLostExit()}
                  disabled={authBusy}
                  className="flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-xl bg-red-700 px-6 text-sm font-black text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("connection.exitToLogin", "EXIT TO LOGIN")}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense>
      <PlayPageInner />
    </Suspense>
  );
}
