type NumericRow = Record<string, number | string | null | undefined>;

const FEATURE_KEYS: string[] = (() => {
    const keys: string[] = [];
    for (let hand = 1; hand <= 2; hand += 1) {
        for (let i = 0; i < 21; i += 1) {
            keys.push(`h${hand}_${i}_x`, `h${hand}_${i}_y`, `h${hand}_${i}_z`);
        }
    }
    return keys;
})();

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

export class KNNClassifier {
    private data: { features: number[]; label: string }[];
    private k: number;
    private threshold: number;

    constructor(rawData: NumericRow[], k: number = 3, threshold: number = 1.8) {
        this.k = Math.max(1, Math.floor(k));
        this.threshold = Math.max(0.1, threshold);
        this.data = [];

        for (const row of rawData || []) {
            const label = String(row?.label ?? "").trim();
            if (!label) continue;

            const features = FEATURE_KEYS.map((key) => {
                const n = Number(row[key]);
                return Number.isFinite(n) ? n : 0;
            });

            this.data.push({ label, features });
        }
    }

    predict(features: number[]): string {
        return this.predictWithConfidence(features).label;
    }

    predictWithConfidence(features: number[]): { label: string; confidence: number; distance: number } {
        if (!features || features.length === 0 || this.data.length === 0) {
            return { label: "Unknown", confidence: 0, distance: Number.POSITIVE_INFINITY };
        }

        const distances = new Array(this.data.length);
        for (let i = 0; i < this.data.length; i += 1) {
            distances[i] = {
                label: this.data[i].label,
                dist: this.euclideanDistance(features, this.data[i].features),
            };
        }
        distances.sort((a, b) => a.dist - b.dist);

        const kNearest = distances.slice(0, this.k);
        if (kNearest.length === 0) {
            return { label: "Unknown", confidence: 0, distance: Number.POSITIVE_INFINITY };
        }

        const minDist = kNearest[0].dist;
        if (minDist > this.threshold) {
            return { label: "Idle", confidence: 0, distance: minDist };
        }

        const counts = new Map<string, { hits: number; distSum: number }>();
        for (const item of kNearest) {
            const current = counts.get(item.label) || { hits: 0, distSum: 0 };
            current.hits += 1;
            current.distSum += item.dist;
            counts.set(item.label, current);
        }

        let bestLabel = kNearest[0].label;
        let bestHits = -1;
        let bestAvgDist = Number.POSITIVE_INFINITY;
        for (const [label, score] of counts.entries()) {
            const avgDist = score.distSum / Math.max(1, score.hits);
            if (score.hits > bestHits || (score.hits === bestHits && avgDist < bestAvgDist)) {
                bestHits = score.hits;
                bestAvgDist = avgDist;
                bestLabel = label;
            }
        }

        return {
            label: bestLabel,
            confidence: clamp01(1 - minDist / this.threshold),
            distance: minDist,
        };
    }

    private euclideanDistance(a: number[], b: number[]): number {
        let sum = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i += 1) {
            const diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }
}

type Landmark = { x: number; y: number; z: number };

export function normalizeHand(landmarks: Landmark[]): number[] {
    if (!landmarks || landmarks.length === 0) return [];

    const wrist = landmarks[0];
    const middleBase = landmarks[9];

    let dist = Math.sqrt(
        (wrist.x - middleBase.x) ** 2 +
        (wrist.y - middleBase.y) ** 2 +
        (wrist.z - middleBase.z) ** 2
    );

    if (dist < 0.0001) dist = 1;

    const coords: number[] = [];
    for (const lm of landmarks) {
        coords.push(
            (lm.x - wrist.x) / dist,
            (lm.y - wrist.y) / dist,
            (lm.z - wrist.z) / dist
        );
    }

    return coords;
}
