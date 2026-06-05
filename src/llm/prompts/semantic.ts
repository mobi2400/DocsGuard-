import type { DocChunk } from "../../types/docs.js";
import type { FileDiff } from "../../types/diff.js";
import type { LlmMessage } from "../provider.js";
import { CATEGORIES } from "../../config/schema.js";

export const PROMPT_VERSION = "v1.0.0";

const SYSTEM = `You are DocGuard, a code-vs-documentation reviewer.

Your job is to decide whether the staged code changes violate any rule stated
in the provided documentation chunks. You only flag violations that have a
clear, quotable basis in the docs.

Rules:
1. Output strictly valid JSON in the schema below. No prose, no markdown.
2. Every violation MUST cite a chunk by its exact "chunk_id" from the input.
3. The "quote" field MUST be an exact substring of the cited chunk's text.
4. Use one of these categories: ${CATEGORIES.join(", ")}.
5. "confidence" must be "low", "medium", or "high".
6. Report nothing if you are unsure. False positives are worse than false negatives.

Output schema:
{
  "violations": [
    {
      "file": "<changed file path>",
      "line": <number, line in changed file>,
      "category": "<one of the categories>",
      "confidence": "low" | "medium" | "high",
      "message": "<short explanation>",
      "doc_citation": {
        "chunk_id": "<chunk id from input>",
        "quote": "<exact substring from that chunk>"
      }
    }
  ]
}

If nothing is wrong, return { "violations": [] }.`;

function formatChunks(chunks: readonly DocChunk[]): string {
  const lines: string[] = [];
  for (const c of chunks) {
    lines.push(`--- chunk_id: ${c.id}`);
    lines.push(`heading: ${c.heading}`);
    lines.push(`file: ${c.file} (lines ${String(c.lineStart)}-${String(c.lineEnd)})`);
    lines.push("text:");
    lines.push(c.text);
    lines.push("");
  }
  return lines.join("\n");
}

function formatDiffs(diffs: readonly FileDiff[]): string {
  const lines: string[] = [];
  for (const d of diffs) {
    lines.push(`### file: ${d.file.path} (${d.file.kind})`);
    for (const h of d.hunks) {
      lines.push(h.header);
      lines.push(h.body);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function buildSemanticPrompt(
  chunks: readonly DocChunk[],
  diffs: readonly FileDiff[],
): readonly LlmMessage[] {
  const user = [
    `# DOCUMENTATION CHUNKS (${String(chunks.length)})`,
    formatChunks(chunks),
    `# STAGED DIFF (${String(diffs.length)} file(s))`,
    formatDiffs(diffs),
    "Return only the JSON object.",
  ].join("\n\n");

  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ];
}
