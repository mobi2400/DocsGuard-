import type { Category, Severity } from "../config/schema.js";

export type Confidence = "low" | "medium" | "high";

export interface DocCitation {
  readonly chunkId: string;
  readonly file: string;
  readonly line: number;
  readonly quote: string;
}

export interface RawSemanticViolation {
  readonly file: string;
  readonly line: number;
  readonly category: Category;
  readonly confidence: Confidence;
  readonly message: string;
  readonly chunkId: string;
  readonly quote: string;
}

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly category: Category;
  readonly confidence: Confidence;
  readonly severity: Severity;
  readonly message: string;
  readonly citation: DocCitation | null;
  readonly downgradeReason: string | null;
}

export interface CheckOutcome {
  readonly findings: readonly Finding[];
  readonly status: Severity;
  readonly notes: readonly string[];
}
