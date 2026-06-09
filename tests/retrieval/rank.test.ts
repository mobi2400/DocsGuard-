import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocChunk } from "../../src/types/docs.js";
import type { FileDiff } from "../../src/types/diff.js";
import type { EmbeddedChunk } from "../../src/embeddings/cache.js";

vi.mock("../../src/embeddings/embed.js", () => ({
  getEmbedder: async () => async (_text: string) => new Float32Array([1, 0, 0]),
}));

let rankChunksForDiffs: typeof import("../../src/retrieval/rank.js").rankChunksForDiffs;

beforeEach(async () => {
  ({ rankChunksForDiffs } = await import("../../src/retrieval/rank.js"));
});

function chunk(id: string): DocChunk {
  return {
    id,
    file: `docs/${id}.md`,
    heading: id,
    lineStart: 1,
    lineEnd: 5,
    charCount: 10,
    text: "x",
    truncated: false,
  };
}

function embedded(id: string, vec: number[]): EmbeddedChunk {
  return { chunk: chunk(id), vector: new Float32Array(vec) };
}

const diff: FileDiff = {
  file: { path: "src/x.ts", oldPath: null, kind: "added", isBinary: false },
  hunks: [{ file: "src/x.ts", oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, header: "@@", body: "+x" }],
  truncated: false,
};

describe("rankChunksForDiffs", () => {
  it("keeps chunks within RELATIVE_GAP of the top score", async () => {
    const chunks = [
      embedded("a", [1, 0, 0]),
      embedded("b", [0.92, 0.39, 0]),
      embedded("c", [0.5, 0.86, 0]),
      embedded("d", [0, 1, 0]),
    ];
    const out = await rankChunksForDiffs([diff], chunks, {
      topK: 10,
      minScore: 0.15,
      priority: {},
    });
    const ids = out[0]?.hits.map((h) => h.chunk.id) ?? [];
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("d");
  });

  it("returns nothing when top score is below the absolute floor", async () => {
    const chunks = [
      embedded("a", [0.05, 1, 0]),
      embedded("b", [0.04, 1, 0]),
    ];
    const out = await rankChunksForDiffs([diff], chunks, {
      topK: 10,
      minScore: 0,
      priority: {},
    });
    expect(out[0]?.hits).toEqual([]);
  });

  it("honors topK as an upper bound", async () => {
    const chunks = [
      embedded("a", [1, 0, 0]),
      embedded("b", [0.99, 0.1, 0]),
      embedded("c", [0.98, 0.15, 0]),
      embedded("d", [0.97, 0.2, 0]),
    ];
    const out = await rankChunksForDiffs([diff], chunks, {
      topK: 2,
      minScore: 0,
      priority: {},
    });
    expect(out[0]?.hits).toHaveLength(2);
  });

  it("respects a user-raised minScore above the floor", async () => {
    const chunks = [embedded("a", [1, 0, 0]), embedded("b", [0.6, 0.8, 0])];
    const out = await rankChunksForDiffs([diff], chunks, {
      topK: 10,
      minScore: 0.7,
      priority: {},
    });
    const ids = out[0]?.hits.map((h) => h.chunk.id) ?? [];
    expect(ids).toEqual(["a"]);
  });
});
