import { z } from "zod";
import { CATEGORIES } from "../../config/schema.js";
import type { RawSemanticViolation } from "../../types/result.js";

const violationSchema = z
  .object({
    file: z.string().min(1),
    line: z.number().int().nonnegative(),
    category: z.enum(CATEGORIES),
    confidence: z.enum(["low", "medium", "high"]),
    message: z.string().min(1),
    doc_citation: z
      .object({
        chunk_id: z.string().min(1),
        quote: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const responseSchema = z
  .object({
    violations: z.array(violationSchema),
  })
  .strict();

export interface ParseResult {
  readonly ok: boolean;
  readonly violations: readonly RawSemanticViolation[];
  readonly error: string | null;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

export function parseSemanticResponse(raw: string): ParseResult {
  const cleaned = stripCodeFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, violations: [], error: `invalid JSON: ${message}` };
  }

  const result = responseSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, violations: [], error: result.error.issues.map((i) => i.message).join("; ") };
  }

  const violations: RawSemanticViolation[] = result.data.violations.map((v) => ({
    file: v.file,
    line: v.line,
    category: v.category,
    confidence: v.confidence,
    message: v.message,
    chunkId: v.doc_citation.chunk_id,
    quote: v.doc_citation.quote,
  }));

  return { ok: true, violations, error: null };
}
