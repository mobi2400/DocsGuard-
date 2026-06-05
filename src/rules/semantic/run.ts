import type { DocChunk } from "../../types/docs.js";
import type { FileDiff } from "../../types/diff.js";
import type { LlmProvider } from "../../llm/provider.js";
import type { RawSemanticViolation } from "../../types/result.js";
import { LlmTimeoutError } from "../../llm/provider.js";
import { buildSemanticPrompt } from "../../llm/prompts/semantic.js";
import { parseSemanticResponse } from "./validate-response.js";

export interface SemanticRunOptions {
  readonly provider: LlmProvider;
  readonly model: string;
  readonly timeoutMs: number;
}

export interface SemanticRunResult {
  readonly violations: readonly RawSemanticViolation[];
  readonly skipped: boolean;
  readonly note: string | null;
}

export async function runSemanticCheck(
  chunks: readonly DocChunk[],
  diffs: readonly FileDiff[],
  opts: SemanticRunOptions,
): Promise<SemanticRunResult> {
  if (chunks.length === 0 || diffs.length === 0) {
    return { violations: [], skipped: true, note: "no chunks or diffs to evaluate" };
  }

  const messages = buildSemanticPrompt(chunks, diffs);

  let raw: string;
  try {
    raw = await opts.provider.complete(messages, {
      model: opts.model,
      temperature: 0,
      timeoutMs: opts.timeoutMs,
      responseFormat: "json_object",
    });
  } catch (err) {
    if (err instanceof LlmTimeoutError) {
      return { violations: [], skipped: true, note: "semantic check skipped (timeout)" };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { violations: [], skipped: true, note: `semantic check skipped (${message})` };
  }

  const parsed = parseSemanticResponse(raw);
  if (!parsed.ok) {
    return { violations: [], skipped: true, note: `semantic check skipped (${parsed.error ?? "parse error"})` };
  }

  return { violations: parsed.violations, skipped: false, note: null };
}
