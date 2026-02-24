import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

interface DatasetIndex {
  header: string;
  rowsByLabel: Map<string, string[]>;
}

interface DatasetIndexCacheEntry {
  mtimeMs: number;
  index: DatasetIndex;
}

let datasetIndexCachePromise: Promise<DatasetIndexCacheEntry> | null = null;

function normalizeDatasetLabel(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

function parseLabelQuery(raw: string): string[] {
  const unique = new Set<string>();
  for (const token of String(raw || "").split(",")) {
    const normalized = normalizeDatasetLabel(token);
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique];
}

function extractLabelFromCsvLine(line: string): string {
  const commaIndex = line.indexOf(",");
  const label = commaIndex < 0 ? line : line.slice(0, commaIndex);
  return normalizeDatasetLabel(label);
}

async function buildDatasetIndex(csvPath: string): Promise<DatasetIndex> {
  const raw = await fs.readFile(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = String(lines[0] || "").trim();
  const rowsByLabel = new Map<string, string[]>();

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const label = extractLabelFromCsvLine(line);
    if (!label) continue;
    const bucket = rowsByLabel.get(label);
    if (bucket) {
      bucket.push(line);
    } else {
      rowsByLabel.set(label, [line]);
    }
  }

  return { header, rowsByLabel };
}

async function getDatasetIndex(): Promise<DatasetIndex> {
  const csvPath = path.join(process.cwd(), "public", "mediapipe_signs_db.csv");
  const stat = await fs.stat(csvPath);
  if (!datasetIndexCachePromise) {
    datasetIndexCachePromise = (async () => ({
      mtimeMs: stat.mtimeMs,
      index: await buildDatasetIndex(csvPath),
    }))();
  } else {
    const cached = await datasetIndexCachePromise;
    if (Math.abs(cached.mtimeMs - stat.mtimeMs) > 0.5) {
      datasetIndexCachePromise = (async () => ({
        mtimeMs: stat.mtimeMs,
        index: await buildDatasetIndex(csvPath),
      }))();
    }
  }
  const next = await datasetIndexCachePromise;
  return next.index;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const labels = parseLabelQuery(url.searchParams.get("labels") || "");
  if (labels.length === 0) {
    return new Response("Missing labels query parameter.", { status: 400 });
  }

  try {
    const index = await getDatasetIndex();
    if (!index.header) {
      return new Response("Dataset header missing.", { status: 500 });
    }

    const rows: string[] = [];
    for (const label of labels) {
      const bucket = index.rowsByLabel.get(label);
      if (Array.isArray(bucket) && bucket.length > 0) {
        rows.push(...bucket);
      }
    }

    const csvText = `${index.header}\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`;
    return new Response(csvText, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const message = String((err as Error)?.message || err || "dataset_load_failed");
    return new Response(`Dataset slice failed: ${message}`, { status: 500 });
  }
}
