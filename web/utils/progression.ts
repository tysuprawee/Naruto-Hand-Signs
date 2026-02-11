export interface ProgressionState {
    xp: number;
    level: number;
    rank: string;
    totalSigns: number;
    totalJutsus: number;
    fastestCombo: number;
}

const RANKS: Array<[number, string]> = [
    [0, "Academy Student"],
    [5, "Genin Candidate"],
    [10, "Genin"],
    [25, "Chunin Candidate"],
    [50, "Chunin"],
    [100, "Special Jonin"],
    [250, "Jonin"],
    [500, "ANBU Black Ops"],
    [1000, "S-Rank Shinobi"],
    [2500, "Sanin"],
    [5000, "Hokage Candidate"],
    [10000, "HOKAGE"],
];

export function getXpForLevel(level: number): number {
    if (level <= 0) return 0;
    return Math.floor(Math.pow(level, 1.8) * 150);
}

export function getLevelFromXp(xp: number): number {
    let level = 0;
    while (getXpForLevel(level + 1) <= xp && level < 10000) {
        level += 1;
    }
    return level;
}

export function getRankForLevel(level: number): string {
    let current = RANKS[0][1];
    for (const [minLevel, title] of RANKS) {
        if (level >= minLevel) current = title;
    }
    return current;
}

export function createInitialProgression(): ProgressionState {
    return {
        xp: 0,
        level: 0,
        rank: "Academy Student",
        totalSigns: 0,
        totalJutsus: 0,
        fastestCombo: 99,
    };
}

export function addXp(state: ProgressionState, gain: number): { next: ProgressionState; leveledUp: boolean } {
    const nextXp = Math.max(0, Math.floor(state.xp + gain));
    const nextLevel = getLevelFromXp(nextXp);
    const leveledUp = nextLevel > state.level;
    return {
        leveledUp,
        next: {
            ...state,
            xp: nextXp,
            level: nextLevel,
            rank: getRankForLevel(nextLevel),
            totalJutsus: state.totalJutsus + 1,
        },
    };
}
