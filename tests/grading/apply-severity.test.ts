import { describe, it, expect } from "vitest";
import { gradeFindings } from "../../src/grading/apply-severity.js";
import type { DocChunk } from "../../src/types/docs.js";
import type { RawSemanticViolation } from "../../src/types/result.js";
import { DEFAULT_CONFIG } from "../../src/config/defaults.js";

const chunk = (id: string, text: string): DocChunk => ({
  id,
  file: "docs/a.md",
  heading: "h",
  lineStart: 10,
  lineEnd: 20,
  charCount: text.length,
  text,
  truncated: false,
});

const raw = (over: Partial<RawSemanticViolation>): RawSemanticViolation => ({
  file: "src/x.ts",
  line: 1,
  category: "security",
  confidence: "high",
  message: "m",
  chunkId: "docs/a.md#h",
  quote: "must use repo",
  ...over,
});

describe("gradeFindings", () => {
  const chunks = [chunk("docs/a.md#h", "All code must use repo layer")];

  it("uses configured severity for valid high-confidence findings", () => {
    const out = gradeFindings([raw({})], { severity: DEFAULT_CONFIG.severity, chunks });
    expect(out.findings[0]?.severity).toBe("block");
    expect(out.status).toBe("block");
  });

  it("downgrades to warn on low confidence", () => {
    const out = gradeFindings([raw({ confidence: "low" })], { severity: DEFAULT_CONFIG.severity, chunks });
    expect(out.findings[0]?.severity).toBe("warn");
    expect(out.findings[0]?.downgradeReason).toBe("low confidence");
  });

  it("downgrades to warn on unknown chunk_id", () => {
    const out = gradeFindings([raw({ chunkId: "ghost" })], { severity: DEFAULT_CONFIG.severity, chunks });
    expect(out.findings[0]?.severity).toBe("warn");
    expect(out.findings[0]?.citation).toBeNull();
  });

  it("downgrades to warn when quote not in chunk", () => {
    const out = gradeFindings([raw({ quote: "totally made up" })], { severity: DEFAULT_CONFIG.severity, chunks });
    expect(out.findings[0]?.severity).toBe("warn");
    expect(out.findings[0]?.downgradeReason).toMatch(/quote not found/);
  });

  it("status escalates to highest among findings", () => {
    const out = gradeFindings(
      [raw({ category: "naming" }), raw({ category: "security" })],
      { severity: DEFAULT_CONFIG.severity, chunks },
    );
    expect(out.status).toBe("block");
  });

  it("status is pass when no findings", () => {
    const out = gradeFindings([], { severity: DEFAULT_CONFIG.severity, chunks });
    expect(out.status).toBe("pass");
  });
});
