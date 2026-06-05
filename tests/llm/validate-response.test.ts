import { describe, it, expect } from "vitest";
import { parseSemanticResponse } from "../../src/rules/semantic/validate-response.js";

describe("parseSemanticResponse", () => {
  it("accepts a valid response", () => {
    const raw = JSON.stringify({
      violations: [
        {
          file: "src/a.ts",
          line: 5,
          category: "architecture",
          confidence: "high",
          message: "uses db directly",
          doc_citation: { chunk_id: "docs/a.md#x", quote: "must use repo layer" },
        },
      ],
    });
    const r = parseSemanticResponse(raw);
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.chunkId).toBe("docs/a.md#x");
  });

  it("accepts an empty violations array", () => {
    const r = parseSemanticResponse('{"violations":[]}');
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("strips ```json fences", () => {
    const r = parseSemanticResponse('```json\n{"violations":[]}\n```');
    expect(r.ok).toBe(true);
  });

  it("rejects invalid JSON", () => {
    const r = parseSemanticResponse("not json");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid JSON/);
  });

  it("rejects unknown category", () => {
    const raw = JSON.stringify({
      violations: [
        {
          file: "a.ts",
          line: 1,
          category: "vibes",
          confidence: "high",
          message: "x",
          doc_citation: { chunk_id: "y", quote: "z" },
        },
      ],
    });
    expect(parseSemanticResponse(raw).ok).toBe(false);
  });

  it("rejects missing doc_citation fields", () => {
    const raw = JSON.stringify({
      violations: [
        {
          file: "a.ts",
          line: 1,
          category: "naming",
          confidence: "low",
          message: "x",
          doc_citation: { chunk_id: "y" },
        },
      ],
    });
    expect(parseSemanticResponse(raw).ok).toBe(false);
  });

  it("rejects extra fields (strict)", () => {
    const raw = JSON.stringify({
      violations: [],
      bonus: 1,
    });
    expect(parseSemanticResponse(raw).ok).toBe(false);
  });
});
