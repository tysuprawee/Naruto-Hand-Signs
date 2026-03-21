import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type VfxClip = {
  id: string;
  category: string;
  effect: string;
  variant: string;
  frameCount: number;
  frames: string[];
};

const IMAGE_EXT_PATTERN = /\.(png|webp|jpg|jpeg)$/i;
const NATURAL_SORT = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

async function collectFrameDirectories(dirPath: string, out: string[]): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const hasFrames = entries.some((entry) => entry.isFile() && IMAGE_EXT_PATTERN.test(entry.name));

  if (hasFrames) {
    out.push(dirPath);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    await collectFrameDirectories(path.join(dirPath, entry.name), out);
  }
}

function encodePublicUrl(publicRoot: string, absolutePath: string): string {
  const relative = path.relative(publicRoot, absolutePath);
  const encoded = relative
    .split(path.sep)
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/${encoded}`;
}

export async function GET() {
  const publicRoot = path.join(process.cwd(), "public");
  const vfxRoot = path.join(publicRoot, "VFX");

  try {
    const rootStat = await fs.stat(vfxRoot).catch(() => null);
    if (!rootStat || !rootStat.isDirectory()) {
      return NextResponse.json({ error: "VFX root not found", clips: [] }, { status: 404 });
    }

    const frameDirs: string[] = [];
    await collectFrameDirectories(vfxRoot, frameDirs);

    const clips: VfxClip[] = [];

    for (const frameDir of frameDirs) {
      const entries = await fs.readdir(frameDir, { withFileTypes: true });
      const frameFiles = entries
        .filter((entry) => entry.isFile() && IMAGE_EXT_PATTERN.test(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => NATURAL_SORT.compare(a, b));

      if (frameFiles.length === 0) continue;

      const relativeDir = path.relative(vfxRoot, frameDir);
      const parts = relativeDir.split(path.sep).filter(Boolean);
      const category = parts[0] || "Uncategorized";
      const effect = parts[1] || parts[0] || "effect";
      const variant = parts.slice(2).join(" / ") || parts[parts.length - 1] || effect;

      const frames = frameFiles.map((frameFile) => encodePublicUrl(publicRoot, path.join(frameDir, frameFile)));

      const rawId = parts.join("_") || frameDir;
      const id = rawId.toLowerCase().replace(/[^a-z0-9_]+/g, "_");

      clips.push({
        id,
        category,
        effect,
        variant,
        frameCount: frames.length,
        frames,
      });
    }

    clips.sort((a, b) => {
      const categoryCmp = NATURAL_SORT.compare(a.category, b.category);
      if (categoryCmp !== 0) return categoryCmp;
      const effectCmp = NATURAL_SORT.compare(a.effect, b.effect);
      if (effectCmp !== 0) return effectCmp;
      return NATURAL_SORT.compare(a.variant, b.variant);
    });

    const totalFrames = clips.reduce((sum, clip) => sum + clip.frameCount, 0);

    return NextResponse.json({
      clipCount: clips.length,
      totalFrames,
      clips,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown manifest error",
        clips: [],
      },
      { status: 500 }
    );
  }
}
