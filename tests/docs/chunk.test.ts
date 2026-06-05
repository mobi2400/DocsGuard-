import { describe, it, expect } from "vitest";
import { chunkDocs } from "../../src/docs/chunk.js";
import { splitMarkdownByHeading } from "../../src/docs/parse-markdown.js";
import type { LoadedDoc } from "../../src/types/docs.js";

function doc(path: string, text: string): LoadedDoc {
  return { path, sha: "x", text };
}

describe("splitMarkdownByHeading", () => {
  it("returns one section for a heading-less doc", () => {
    const sections = splitMarkdownByHeading("hello\nworld\n", 2);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.heading).toBe("(intro)");
    expect(sections[0]?.lineStart).toBe(1);
  });

  it("splits on level-1 and level-2 headings only when maxDepth=2", () => {
    const md = "# A\nbody a\n## B\nbody b\n### C\nbody c\n";
    const sections = splitMarkdownByHeading(md, 2);
    expect(sections.map((s) => s.heading)).toEqual(["A", "B"]);
    expect(sections[1]?.text).toContain("### C");
  });

  it("tracks accurate line numbers", () => {
    const md = "intro line\n# Heading\nbody\n";
    const sections = splitMarkdownByHeading(md, 2);
    expect(sections[0]?.heading).toBe("(intro)");
    expect(sections[0]?.lineStart).toBe(1);
    expect(sections[1]?.heading).toBe("Heading");
    expect(sections[1]?.lineStart).toBe(2);
  });
});

describe("chunkDocs", () => {
  it("produces stable chunk ids of the form file#slug", () => {
    const chunks = chunkDocs([doc("/r/docs/a.md", "# Repository Layer\nbody\n")], { cwd: "/r" });
    expect(chunks[0]?.id).toBe("docs/a.md#repository-layer");
    expect(chunks[0]?.file).toBe("docs/a.md");
  });

  it("attaches accurate line metadata", () => {
    const md = "# A\nbody a\n## B\nbody b\n";
    const chunks = chunkDocs([doc("/r/x.md", md)], { cwd: "/r" });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.lineStart).toBe(1);
    expect(chunks[1]?.heading).toBe("B");
    expect(chunks[1]?.lineStart).toBe(3);
  });

  it("sub-splits oversized sections", () => {
    const big = "# Big\n" + "lorem ipsum ".repeat(200) + "\n";
    const chunks = chunkDocs([doc("/r/big.md", big)], { cwd: "/r", softMax: 200, hardMax: 5000 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.charCount).toBeLessThanOrEqual(5000);
    }
  });

  it("enforces hard cap on every chunk", () => {
    const big = "# Big\n" + "x".repeat(10_000) + "\n";
    const chunks = chunkDocs([doc("/r/big.md", big)], { cwd: "/r", softMax: 500, hardMax: 600 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.charCount).toBeLessThanOrEqual(600);
    }
  });

  it("disambiguates duplicate slugs", () => {
    const md = "# Same\nfirst\n# Same\nsecond\n";
    const chunks = chunkDocs([doc("/r/d.md", md)], { cwd: "/r" });
    expect(chunks[0]?.id).toBe("d.md#same");
    expect(chunks[1]?.id).toBe("d.md#same-2");
  });
});
