export interface LightingThresholds {
    lightingMin: number;
    lightingMax: number;
    lightingMinContrast: number;
}

export interface CalibrationProfile extends LightingThresholds {
    voteMinConfidence: number;
    voteRequiredHits: number;
    samples: number;
    updatedAt: string;
    version: number;
}

export interface LightingStats {
    mean: number;
    contrast: number;
    status: "good" | "low_light" | "overexposed" | "low_contrast";
}

export interface VoteEntry {
    label: string;
    confidence: number;
    timeMs: number;
}

export interface VoteStableState {
    label: string;
    confidence: number;
    timeMs: number;
}

export const DEFAULT_FILTERS: CalibrationProfile = {
    version: 1,
    samples: 0,
    updatedAt: "",
    lightingMin: 45,
    lightingMax: 210,
    lightingMinContrast: 22,
    voteMinConfidence: 0.45,
    voteRequiredHits: 2,
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function evaluateLighting(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
    thresholds: LightingThresholds
): LightingStats {
    if (!rgba.length || width <= 0 || height <= 0) {
        return { mean: 0, contrast: 0, status: "low_light" };
    }

    // Downsample aggressively for cheap per-frame stats.
    const step = Math.max(4, Math.floor(Math.max(width, height) / 90));
    const luma: number[] = [];
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const i = (y * width + x) * 4;
            const r = rgba[i];
            const g = rgba[i + 1];
            const b = rgba[i + 2];
            luma.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
        }
    }

    const count = Math.max(1, luma.length);
    let sum = 0;
    for (const v of luma) sum += v;
    const mean = sum / count;

    let variance = 0;
    for (const v of luma) {
        const d = v - mean;
        variance += d * d;
    }
    const contrast = Math.sqrt(variance / count);

    let status: LightingStats["status"] = "good";
    if (mean < thresholds.lightingMin) status = "low_light";
    else if (mean > thresholds.lightingMax) status = "overexposed";
    else if (contrast < thresholds.lightingMinContrast) status = "low_contrast";

    return { mean, contrast, status };
}

export function applyTemporalVote(
    window: VoteEntry[],
    rawLabel: string,
    rawConfidence: number,
    nowMs: number,
    allowDetection: boolean,
    voteWindowSize: number,
    voteTtlMs: number,
    requiredHits: number,
    minConfidence: number,
    stableState?: VoteStableState,
    occlusionGraceMs: number = 240,
    reuseConfidenceDecay: number = 0.90
): { label: string; confidence: number; hits: number; nextWindow: VoteEntry[]; nextStableState: VoteStableState } {
    const next = window.filter((item) => nowMs - item.timeMs <= voteTtlMs);
    const normalized = String(rawLabel || "idle").trim().toLowerCase();
    const prevStable: VoteStableState = stableState || { label: "idle", confidence: 0, timeMs: 0 };
    let nextStableState: VoteStableState = {
        label: String(prevStable.label || "idle").trim().toLowerCase(),
        confidence: Math.max(0, Number(prevStable.confidence || 0)),
        timeMs: Math.max(0, Number(prevStable.timeMs || 0)),
    };

    const invalidFrame = !allowDetection || normalized === "idle" || normalized === "unknown";
    if (!invalidFrame) {
        next.push({
            label: normalized,
            confidence: Math.max(0, rawConfidence),
            timeMs: nowMs,
        });
        if (next.length > voteWindowSize) {
            next.splice(0, next.length - voteWindowSize);
        }
    }

    const reuseRecentStable = (): { label: string; confidence: number; hits: number; nextWindow: VoteEntry[]; nextStableState: VoteStableState } => {
        const label = String(nextStableState.label || "idle").trim().toLowerCase();
        if (!invalidFrame || !label || label === "idle" || label === "unknown" || nextStableState.timeMs <= 0) {
            return { label: "idle", confidence: 0, hits: 0, nextWindow: next, nextStableState };
        }
        const elapsed = Math.max(0, nowMs - nextStableState.timeMs);
        if (elapsed > Math.max(50, occlusionGraceMs)) {
            return { label: "idle", confidence: 0, hits: 0, nextWindow: next, nextStableState };
        }
        const frameCount = Math.max(1, elapsed / (1000 / 30));
        const decay = Math.max(0.5, Math.min(0.99, reuseConfidenceDecay)) ** frameCount;
        return {
            label,
            confidence: Math.max(0, nextStableState.confidence * decay),
            hits: 0,
            nextWindow: next,
            nextStableState,
        };
    };

    const counts = new Map<string, { hits: number; confSum: number }>();
    for (const item of next) {
        const score = counts.get(item.label) || { hits: 0, confSum: 0 };
        score.hits += 1;
        score.confSum += item.confidence;
        counts.set(item.label, score);
    }

    if (counts.size === 0) {
        return reuseRecentStable();
    }

    let bestLabel = "idle";
    let bestHits = 0;
    let bestAvgConf = 0;
    for (const [label, score] of counts.entries()) {
        const avg = score.confSum / Math.max(1, score.hits);
        if (score.hits > bestHits || (score.hits === bestHits && avg > bestAvgConf)) {
            bestLabel = label;
            bestHits = score.hits;
            bestAvgConf = avg;
        }
    }

    // Keep challenge-style behavior: if the full vote window agrees,
    // accept to avoid stalls on weaker/mobile devices.
    const hasHardConsensus = bestHits >= voteWindowSize;
    if ((bestHits >= requiredHits && bestAvgConf >= minConfidence) || hasHardConsensus) {
        nextStableState = {
            label: bestLabel,
            confidence: bestAvgConf,
            timeMs: nowMs,
        };
        return { label: bestLabel, confidence: bestAvgConf, hits: bestHits, nextWindow: next, nextStableState };
    }

    if (invalidFrame) {
        return reuseRecentStable();
    }

    return { label: "idle", confidence: bestAvgConf, hits: bestHits, nextWindow: next, nextStableState };
}

export interface CalibrationSample {
    brightness: number;
    contrast: number;
    confidence?: number;
}

export function finalizeCalibration(
    samples: CalibrationSample[],
    voteWindowSize: number
): CalibrationProfile {
    if (!samples.length) return { ...DEFAULT_FILTERS, updatedAt: new Date().toISOString() };

    const brightness = samples.map((s) => s.brightness).sort((a, b) => a - b);
    const contrast = samples.map((s) => s.contrast).sort((a, b) => a - b);
    const confidence = samples
        .map((s) => s.confidence || 0)
        .filter((v) => v > 0)
        .sort((a, b) => a - b);

    const median = (arr: number[]) => (arr.length ? arr[Math.floor(arr.length / 2)] : 0);
    const percentile = (arr: number[], pct: number) => {
        if (!arr.length) return 0;
        const idx = Math.min(arr.length - 1, Math.max(0, Math.floor((pct / 100) * (arr.length - 1))));
        return arr[idx];
    };

    const bMed = median(brightness) || 100;
    const cMed = median(contrast) || 30;
    const conf30 = percentile(confidence, 30) || DEFAULT_FILTERS.voteMinConfidence;

    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        samples: samples.length,
        lightingMin: clamp(bMed * 0.55, 25, 120),
        lightingMax: clamp(bMed * 1.45, 120, 245),
        lightingMinContrast: clamp(cMed * 0.65, 10, 80),
        voteMinConfidence: clamp(conf30 * 0.9, 0.25, 0.9),
        voteRequiredHits: Math.floor(clamp(DEFAULT_FILTERS.voteRequiredHits, 2, voteWindowSize)),
    };
}
