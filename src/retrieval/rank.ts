import type { DocChunk } from "../types/docs.js";
import type { FileDiff } from "../types/diff.js";
import type { Priority } from "../config/schema.js";
import type { EmbeddedChunk } from "../embeddings/cache.js";
import { getEmbedder } from "../embeddings/embed.js";
import { cosine } from "./cosine.js";
import { pathBoost } from "./path-boost.js";

const PRIORITY_BONUS: Record<Priority, number> = {
  critical: 0.15,
  normal: 0,
  low: -0.1,
};

const PATH_BOOST_WEIGHT = 0.1;

export interface RankOptions {
  readonly topK: number;
  readonly minScore: number;
  readonly priority: Readonly<Record<string, Priority>>;
}

export interface RetrievalHit {
  readonly chunk: DocChunk;
  readonly score: number;
}

export interface FileRetrieval {
  readonly file: string;
  readonly hits: readonly RetrievalHit[];
}

function diffQueryText(diff: FileDiff): string {
  const parts: string[] = [diff.file.path];
  for (const h of diff.hunks) {
    parts.push(h.body);
  }
  return parts.join("\n");
}

function priorityFor(filePath: string, priority: Readonly<Record<string, Priority>>): number {
  const direct = priority[filePath];
  if (direct !== undefined) return PRIORITY_BONUS[direct];
  for (const key of Object.keys(priority)) {
    if (filePath.endsWith(key.replace(/^\.\//, ""))) {
      const p = priority[key];
      if (p !== undefined) return PRIORITY_BONUS[p];
    }
  }
  return 0;
}

export async function rankChunksForDiffs(
  diffs: readonly FileDiff[],
  embedded: readonly EmbeddedChunk[],
  opts: RankOptions,
): Promise<readonly FileRetrieval[]> {
  if (diffs.length === 0 || embedded.length === 0) return [];
  const embedder = await getEmbedder();
  const out: FileRetrieval[] = [];

  for (const diff of diffs) {
    const queryVec = await embedder(diffQueryText(diff));
    const scored: RetrievalHit[] = embedded.map((e) => {
      const base = cosine(queryVec, e.vector);
      const boost = pathBoost(diff.file.path, e.chunk.file, PATH_BOOST_WEIGHT);
      const pri = priorityFor(e.chunk.file, opts.priority);
      return { chunk: e.chunk, score: base + boost + pri };
    });

    scored.sort((a, b) => b.score - a.score);
    const hits = scored.filter((s) => s.score >= opts.minScore).slice(0, opts.topK);
    out.push({ file: diff.file.path, hits });
  }

  return out;
}
