import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { DocChunk } from "../types/docs.js";
import { embeddingsCachePath } from "../utils/paths.js";
import { getEmbedder, EMBEDDING_MODEL, EMBEDDING_DIM } from "./embed.js";

const cacheEntrySchema = z
  .object({
    chunkId: z.string(),
    docSha: z.string(),
    model: z.string(),
    vector: z.array(z.number()),
  })
  .strict();

const cacheFileSchema = z
  .object({
    version: z.literal(1),
    model: z.string(),
    entries: z.array(cacheEntrySchema),
  })
  .strict();

type CacheEntry = z.infer<typeof cacheEntrySchema>;
type CacheFile = z.infer<typeof cacheFileSchema>;

export interface EmbeddedChunk {
  readonly chunk: DocChunk;
  readonly vector: Float32Array;
}

export interface EmbedChunksOptions {
  readonly cwd: string;
  readonly docShaByFile: ReadonlyMap<string, string>;
}

function keyOf(chunkId: string, docSha: string): string {
  return `${docSha}::${chunkId}`;
}

async function readCache(path: string): Promise<CacheFile | null> {
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const result = cacheFileSchema.safeParse(parsed);
    if (!result.success) return null;
    if (result.data.model !== EMBEDDING_MODEL) return null;
    return result.data;
  } catch {
    return null;
  }
}

async function writeCache(path: string, file: CacheFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(file), "utf8");
}

export async function embedChunksWithCache(
  chunks: readonly DocChunk[],
  opts: EmbedChunksOptions,
): Promise<readonly EmbeddedChunk[]> {
  const path = embeddingsCachePath(opts.cwd);
  const existing = await readCache(path);
  const cached = new Map<string, CacheEntry>();
  if (existing !== null) {
    for (const e of existing.entries) {
      cached.set(keyOf(e.chunkId, e.docSha), e);
    }
  }

  const out: EmbeddedChunk[] = [];
  const fresh: CacheEntry[] = [];
  let needsEmbedder = false;
  for (const c of chunks) {
    const sha = opts.docShaByFile.get(c.file);
    if (sha === undefined) continue;
    if (!cached.has(keyOf(c.id, sha))) {
      needsEmbedder = true;
      break;
    }
  }

  const embedder = needsEmbedder ? await getEmbedder() : null;

  for (const chunk of chunks) {
    const sha = opts.docShaByFile.get(chunk.file);
    if (sha === undefined) continue;
    const key = keyOf(chunk.id, sha);
    const hit = cached.get(key);
    if (hit !== undefined && hit.vector.length === EMBEDDING_DIM) {
      out.push({ chunk, vector: new Float32Array(hit.vector) });
      fresh.push(hit);
      continue;
    }
    if (embedder === null) continue;
    const vector = await embedder(chunk.text);
    out.push({ chunk, vector });
    fresh.push({
      chunkId: chunk.id,
      docSha: sha,
      model: EMBEDDING_MODEL,
      vector: Array.from(vector),
    });
  }

  await writeCache(path, {
    version: 1,
    model: EMBEDDING_MODEL,
    entries: fresh,
  });

  return out;
}
