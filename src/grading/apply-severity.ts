import type { DocChunk } from "../types/docs.js";
import type { DocCitation, Finding, RawSemanticViolation, CheckOutcome } from "../types/result.js";
import type { Severity, SeverityMap } from "../config/schema.js";

export interface GradeOptions {
  readonly severity: SeverityMap;
  readonly chunks: readonly DocChunk[];
  readonly extraNotes?: readonly string[];
}

const SEVERITY_ORDER: Record<Severity, number> = {
  pass: 0,
  warn: 1,
  block: 2,
};

function downgrade(target: Severity): Severity {
  return target === "block" ? "warn" : target;
}

function buildChunkIndex(chunks: readonly DocChunk[]): Map<string, DocChunk> {
  const map = new Map<string, DocChunk>();
  for (const c of chunks) map.set(c.id, c);
  return map;
}

function gradeOne(raw: RawSemanticViolation, opts: GradeOptions, idx: Map<string, DocChunk>): Finding {
  const configured = opts.severity[raw.category];
  const chunk = idx.get(raw.chunkId);

  if (chunk === undefined) {
    return {
      file: raw.file,
      line: raw.line,
      category: raw.category,
      confidence: raw.confidence,
      severity: downgrade(configured),
      message: raw.message,
      citation: null,
      downgradeReason: `unknown chunk_id "${raw.chunkId}"`,
    };
  }

  if (!chunk.text.includes(raw.quote)) {
    return {
      file: raw.file,
      line: raw.line,
      category: raw.category,
      confidence: raw.confidence,
      severity: downgrade(configured),
      message: raw.message,
      citation: {
        chunkId: chunk.id,
        file: chunk.file,
        line: chunk.lineStart,
        quote: raw.quote,
      },
      downgradeReason: "quote not found inside cited chunk",
    };
  }

  const citation: DocCitation = {
    chunkId: chunk.id,
    file: chunk.file,
    line: chunk.lineStart,
    quote: raw.quote,
  };

  if (raw.confidence === "low") {
    return {
      file: raw.file,
      line: raw.line,
      category: raw.category,
      confidence: raw.confidence,
      severity: downgrade(configured),
      message: raw.message,
      citation,
      downgradeReason: "low confidence",
    };
  }

  return {
    file: raw.file,
    line: raw.line,
    category: raw.category,
    confidence: raw.confidence,
    severity: configured,
    message: raw.message,
    citation,
    downgradeReason: null,
  };
}

export function gradeFindings(
  violations: readonly RawSemanticViolation[],
  opts: GradeOptions,
): CheckOutcome {
  const idx = buildChunkIndex(opts.chunks);
  const findings = violations.map((v) => gradeOne(v, opts, idx));

  let status: Severity = "pass";
  for (const f of findings) {
    if (SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[status]) {
      status = f.severity;
    }
  }

  return {
    findings,
    status,
    notes: opts.extraNotes ?? [],
  };
}
