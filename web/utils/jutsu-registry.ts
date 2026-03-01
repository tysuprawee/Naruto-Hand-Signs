export type JutsuEffect = "fire" | "lightning" | "clone" | "water" | "eye" | "rasengan" | "rasenshuriken" | "reaper";

export interface ComboPart {
    name: string;
    atStep: number;
    effect: JutsuEffect;
}

export interface JutsuConfig {
    displayName?: string;
    sequence: string[];
    displayText: string;
    soundPath?: string | null;
    videoPath?: string | null;
    effect?: JutsuEffect;
    duration?: number;
    minLevel: number;
    comboParts?: ComboPart[];
}

export const OFFICIAL_JUTSUS: Record<string, JutsuConfig> = {
    "Shadow Clone + Chidori Combo": {
        sequence: ["ram", "snake", "tiger", "ox", "hare", "monkey"],
        displayText: "COMBO: SHADOW CLONE + CHIDORI!",
        soundPath: null,
        videoPath: null,
        effect: "lightning",
        duration: 6.0,
        minLevel: 7,
        comboParts: [
            { name: "Shadow Clone", atStep: 3, effect: "clone" },
            { name: "Chidori", atStep: 6, effect: "lightning" },
        ],
    },
    "Shadow Clone + Rasengan Combo": {
        sequence: ["ram", "snake", "tiger", "ram"],
        displayText: "COMBO: SHADOW CLONE + RASENGAN!",
        soundPath: null,
        videoPath: null,
        effect: "rasengan",
        duration: 8.0,
        minLevel: 6,
        comboParts: [
            { name: "Shadow Clone", atStep: 3, effect: "clone" },
            { name: "Rasengan", atStep: 4, effect: "rasengan" },
        ],
    },
    "Shadow Clone": {
        sequence: ["ram", "snake", "tiger"],
        displayText: "KAGE BUNSHIN NO JUTSU!",
        soundPath: "/sounds/clone.mp3",
        videoPath: null,
        effect: "clone",
        duration: 6.0,
        minLevel: 0,
    },
    "Reaper Death Seal": {
        sequence: ["snake", "boar", "ram", "hare", "dog", "rat", "bird", "horse", "snake", "clap"],
        displayText: "SHIKI FUJIN!",
        soundPath: null,
        videoPath: null,
        effect: "reaper",
        duration: 7.0,
        minLevel: 12,
    },
    "Rasengan": {
        sequence: ["ram"],
        displayText: "RASENGAN!",
        soundPath: "/sounds/rasengan.mp3",
        videoPath: "/effects/rasengan.mp4",
        effect: "rasengan",
        duration: 8.0,
        minLevel: 1,
    },
    Rasenshuriken: {
        sequence: ["ram", "snake", "tiger", "ram", "bird"],
        displayText: "WIND STYLE: RASENSHURIKEN!",
        soundPath: "/sounds/rasenshuriken.mp3",
        videoPath: null,
        effect: "rasenshuriken",
        duration: 10.0,
        minLevel: 11,
    },
    Fireball: {
        sequence: ["horse", "snake", "ram", "monkey", "boar", "horse", "tiger"],
        displayText: "KATON: GOUKAKYUU NO JUTSU!!",
        soundPath: "/sounds/fireball.mp3",
        videoPath: null,
        effect: "fire",
        duration: 5.0,
        minLevel: 2,
    },
    Chidori: {
        sequence: ["ox", "hare", "monkey"],
        displayText: "CHIDORI: KAZUSA NO JUTSU!",
        soundPath: "/sounds/chidori.mp3",
        videoPath: "/effects/chidori.mp4",
        effect: "lightning",
        duration: 8.0,
        minLevel: 4,
    },
    "Water Dragon": {
        sequence: ["ox", "monkey", "hare", "rat", "boar", "bird", "ox", "horse", "bird"],
        displayText: "WATER DRAGON BULLET!",
        soundPath: null,
        videoPath: null,
        effect: "water",
        duration: 8.0,
        minLevel: 10,
    },
    "Phoenix Flower": {
        sequence: ["rat", "tiger", "dog", "ox", "hare", "tiger"],
        displayText: "PHOENIX SAGE FIRE!",
        soundPath: "/sounds/phoenix_flowers.mp3",
        videoPath: null,
        effect: "fire",
        duration: 5.0,
        minLevel: 3,
    },
    Sharingan: {
        sequence: [],
        displayText: "SHARINGAN!",
        soundPath: null,
        videoPath: null,
        effect: "eye",
        duration: 10.0,
        minLevel: 8,
    },
    "Mangekyou Sharingan": {
        sequence: [],
        displayText: "MANGEKYOU SHARINGAN!",
        soundPath: null,
        videoPath: null,
        effect: "eye",
        duration: 10.0,
        minLevel: 15,
    },
};

export const JUTSU_NAMES = Object.keys(OFFICIAL_JUTSUS);
