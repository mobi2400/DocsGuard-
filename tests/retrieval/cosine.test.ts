import { describe, it, expect } from "vitest";
import { cosine } from "../../src/retrieval/cosine.js";
import { pathOverlap } from "../../src/retrieval/path-boost.js";

describe("cosine", () => {
  it("returns 1 for identical vectors", () => {
    const v = new Float32Array([1, 2, 3]);
    expect(cosine(v, v)).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosine(a, b)).toBe(0);
  });

  it("returns 0 for mismatched or zero vectors", () => {
    expect(cosine(new Float32Array([1, 2]), new Float32Array([1, 2, 3]))).toBe(0);
    expect(cosine(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0);
  });
});

describe("pathOverlap", () => {
  it("scores high when paths share tokens", () => {
    const s = pathOverlap("src/auth/login.ts", "docs/auth.md");
    expect(s).toBeGreaterThan(0);
  });

  it("scores zero on unrelated paths", () => {
    const s = pathOverlap("src/billing/invoice.ts", "docs/deployment.md");
    expect(s).toBe(0);
  });

  it("ignores stop segments like src/lib", () => {
    expect(pathOverlap("src/index.ts", "docs/src.md")).toBe(0);
  });
});
