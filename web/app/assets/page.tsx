"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type VfxClip = {
  id: string;
  category: string;
  effect: string;
  variant: string;
  frameCount: number;
  frames: string[];
};

type ManifestResponse = {
  clipCount: number;
  totalFrames: number;
  clips: VfxClip[];
  error?: string;
};

const BIG_ONLY_CATEGORY_ALLOWLIST = new Set([
  "Explosions",
  "Impacts",
  "Smoke Bursts",
  "Lightning",
  "Fantasy Spells",
  "Magic Bursts",
]);

const BIG_ONLY_EFFECT_INCLUDE = [
  "explosion",
  "impact",
  "burst",
  "smoke",
  "lightning",
  "spell",
  "strike",
  "charge",
  "warp",
];

const BIG_ONLY_EFFECT_EXCLUDE = [
  "symbol",
  "thumb",
  "rank_",
  "place_",
  "heartbeat",
  "alert",
  "warning",
  "success",
  "failure",
];

function isBigImpactClip(clip: VfxClip): boolean {
  const haystack = `${clip.category} ${clip.effect} ${clip.variant}`.toLowerCase();

  if (BIG_ONLY_EFFECT_EXCLUDE.some((token) => haystack.includes(token))) {
    return false;
  }

  if (BIG_ONLY_CATEGORY_ALLOWLIST.has(clip.category)) {
    return clip.frameCount >= 10;
  }

  if (BIG_ONLY_EFFECT_INCLUDE.some((token) => haystack.includes(token))) {
    return clip.frameCount >= 10;
  }

  return clip.frameCount >= 24;
}

function prettyLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function FrameSequenceCard({ clip, autoPlay }: { clip: VfxClip; autoPlay: boolean }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const isPlaying = autoPlay || hovered;

  useEffect(() => {
    if (!isPlaying || clip.frames.length <= 1) return;

    const frameMs = 1000 / 20;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % clip.frames.length);
    }, frameMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, clip.frames.length]);

  const currentFrame = clip.frames[Math.min(frameIndex, clip.frames.length - 1)] || "";

  return (
    <article className="vfx-card">
      <div
        className="vfx-preview"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          if (!autoPlay) setFrameIndex(0);
        }}
      >
        {currentFrame ? <img src={currentFrame} alt={`${clip.variant} frame ${frameIndex + 1}`} /> : <div />}
      </div>
      <div className="vfx-meta">
        <p className="vfx-id">{clip.id}</p>
        <p className="vfx-name">{prettyLabel(clip.effect)}</p>
        <p className="vfx-variant">{prettyLabel(clip.variant)}</p>
        <p className="vfx-count">{clip.frameCount} frames</p>
      </div>
    </article>
  );
}

export default function AssetsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [clips, setClips] = useState<VfxClip[]>([]);
  const [clipCount, setClipCount] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [query, setQuery] = useState("");
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadManifest() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/vfx-manifest", { cache: "no-store" });
        const payload = (await response.json()) as ManifestResponse;
        if (!response.ok) {
          throw new Error(payload?.error || `Manifest request failed (${response.status})`);
        }

        if (!alive) return;
        setClips(Array.isArray(payload.clips) ? payload.clips : []);
        setClipCount(Number(payload.clipCount || 0));
        setTotalFrames(Number(payload.totalFrames || 0));
      } catch (fetchError) {
        if (!alive) return;
        setError(fetchError instanceof Error ? fetchError.message : "Could not load VFX manifest");
        setClips([]);
        setClipCount(0);
        setTotalFrames(0);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void loadManifest();
    return () => {
      alive = false;
    };
  }, []);

  const bigOnlyClips = useMemo(() => clips.filter(isBigImpactClip), [clips]);
  const bigOnlyFrameCount = useMemo(
    () => bigOnlyClips.reduce((sum, clip) => sum + clip.frameCount, 0),
    [bigOnlyClips],
  );

  const filteredClips = useMemo(() => {
    const token = query.trim().toLowerCase();
    if (!token) return bigOnlyClips;

    return bigOnlyClips.filter((clip) => {
      const haystack = `${clip.category} ${clip.effect} ${clip.variant} ${clip.id}`.toLowerCase();
      return haystack.includes(token);
    });
  }, [bigOnlyClips, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, VfxClip[]>();
    for (const clip of filteredClips) {
      if (!map.has(clip.category)) {
        map.set(clip.category, []);
      }
      map.get(clip.category)?.push(clip);
    }
    return [...map.entries()];
  }, [filteredClips]);

  return (
    <main className="assets-page">
      <div className="assets-shell">
        <header className="assets-head">
          <div>
            <p className="kicker">VFX Library</p>
            <h1>Big Impact Effects</h1>
            <p className="sub">Curated from <code>/public/VFX</code> to show only large, high-impact clips.</p>
          </div>
          <Link href="/play" className="back-link">
            Back to Play
          </Link>
        </header>

        <section className="toolbar">
          <label className="search-wrap" htmlFor="vfx-search">
            Search
            <input
              id="vfx-search"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="category, effect, variant"
            />
          </label>

          <label className="toggle-wrap" htmlFor="autoplay-toggle">
            <input
              id="autoplay-toggle"
              type="checkbox"
              checked={autoPlay}
              onChange={(event) => setAutoPlay(event.target.checked)}
            />
            Autoplay All
          </label>

          <div className="stats">
            <span>Big Clips: <strong>{bigOnlyClips.length}</strong></span>
            <span>Big Frames: <strong>{bigOnlyFrameCount}</strong></span>
            <span>Shown: <strong>{filteredClips.length}</strong></span>
            <span>All Clips: <strong>{clipCount}</strong></span>
            <span>All Frames: <strong>{totalFrames}</strong></span>
          </div>
        </section>

        {loading && <p className="state">Loading VFX manifest...</p>}
        {!loading && error && <p className="state error">{error}</p>}

        {!loading && !error && grouped.length === 0 && <p className="state">No clips found in /public/VFX.</p>}

        {!loading && !error && grouped.map(([category, categoryClips]) => (
          <section key={category} className="category-block">
            <div className="category-head">
              <h2>{prettyLabel(category)}</h2>
              <p>{categoryClips.length} clips</p>
            </div>
            <div className="assets-grid">
              {categoryClips.map((clip) => (
                <FrameSequenceCard key={clip.id} clip={clip} autoPlay={autoPlay} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <style jsx global>{`
        .assets-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 10% 8%, rgba(22, 163, 74, 0.09), transparent 38%),
            radial-gradient(circle at 92% 16%, rgba(14, 116, 144, 0.14), transparent 42%),
            linear-gradient(180deg, #070a12 0%, #060710 100%);
          color: #ecf5ff;
          padding: 24px 14px 38px;
        }

        .assets-page .assets-shell {
          max-width: 1320px;
          margin: 0 auto;
        }

        .assets-page .assets-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }

        .assets-page .kicker {
          margin: 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          font-weight: 800;
          color: #86efac;
        }

        .assets-page h1 {
          margin: 6px 0 0;
          font-size: clamp(26px, 4vw, 40px);
          line-height: 1.05;
          letter-spacing: -0.02em;
        }

        .assets-page .sub {
          margin: 8px 0 0;
          color: #a5b5cc;
          font-size: 14px;
        }

        .assets-page .sub code {
          color: #c7d6ea;
          font-size: 12px;
        }

        .assets-page .back-link {
          display: inline-flex;
          border: 1px solid rgba(110, 231, 183, 0.35);
          color: #d7ffe8;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          border-radius: 10px;
          padding: 9px 12px;
          background: rgba(5, 20, 16, 0.48);
          white-space: nowrap;
        }

        .assets-page .toolbar {
          display: grid;
          grid-template-columns: minmax(240px, 1fr) auto auto;
          gap: 10px;
          align-items: end;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(6, 12, 24, 0.7);
          margin-bottom: 16px;
        }

        .assets-page .search-wrap {
          display: grid;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #c8d6ea;
        }

        .assets-page .search-wrap input {
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(7, 13, 26, 0.8);
          color: #f8fbff;
          padding: 9px 10px;
          font-size: 13px;
        }

        .assets-page .toggle-wrap {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 10px;
          padding: 9px 12px;
          background: rgba(7, 12, 23, 0.8);
          color: #dbe8f9;
          font-size: 13px;
          font-weight: 700;
        }

        .assets-page .toggle-wrap input {
          margin: 0;
          accent-color: #22c55e;
        }

        .assets-page .stats {
          display: inline-flex;
          gap: 10px;
          align-items: center;
          color: #8aa2c0;
          font-size: 12px;
          white-space: nowrap;
        }

        .assets-page .stats strong {
          color: #ecf5ff;
        }

        .assets-page .state {
          margin: 14px 0;
          color: #c8d6ea;
          font-size: 14px;
        }

        .assets-page .state.error {
          color: #fca5a5;
        }

        .assets-page .category-block {
          margin-bottom: 20px;
        }

        .assets-page .category-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 10px;
          gap: 10px;
        }

        .assets-page .category-head h2 {
          margin: 0;
          font-size: clamp(18px, 2vw, 24px);
          color: #f4fbff;
        }

        .assets-page .category-head p {
          margin: 0;
          color: #97acc8;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .assets-page .assets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }

        .assets-page .vfx-card {
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 14px;
          background: rgba(9, 14, 26, 0.84);
          overflow: hidden;
        }

        .assets-page .vfx-preview {
          height: 250px;
          background:
            radial-gradient(circle at center, rgba(30, 41, 59, 0.44), rgba(2, 6, 23, 0.8)),
            linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(1, 8, 18, 0.96));
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
          display: grid;
          place-items: center;
          padding: 8px;
        }

        .assets-page .vfx-preview img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          image-rendering: auto;
        }

        .assets-page .vfx-meta {
          padding: 10px 10px 12px;
          display: grid;
          gap: 4px;
        }

        .assets-page .vfx-id {
          margin: 0;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #7f96b4;
          word-break: break-all;
        }

        .assets-page .vfx-name {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          color: #f8fbff;
        }

        .assets-page .vfx-variant {
          margin: 0;
          font-size: 12px;
          color: #c2d3e8;
          line-height: 1.3;
          min-height: 32px;
        }

        .assets-page .vfx-count {
          margin: 0;
          color: #9fb3cc;
          font-size: 11px;
          font-weight: 700;
        }

        @media (max-width: 900px) {
          .assets-page .toolbar {
            grid-template-columns: 1fr;
          }

          .assets-page .stats {
            justify-content: flex-start;
            flex-wrap: wrap;
            white-space: normal;
          }
        }

        @media (max-width: 760px) {
          .assets-page .assets-head {
            flex-direction: column;
            align-items: flex-start;
          }

          .assets-page .assets-grid {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          }

          .assets-page .vfx-preview {
            height: 170px;
          }
        }
      `}</style>
    </main>
  );
}
