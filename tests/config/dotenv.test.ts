import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDotenv, loadDotenv } from "../../src/utils/dotenv.js";

describe("parseDotenv", () => {
  it("parses simple KEY=value lines", () => {
    expect(parseDotenv("FOO=bar\nBAZ=qux")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("ignores comments and blank lines", () => {
    expect(parseDotenv("# comment\n\nFOO=1\n# more")).toEqual({ FOO: "1" });
  });

  it("strips surrounding double and single quotes", () => {
    expect(parseDotenv('A="hello"\nB=\'world\'')).toEqual({ A: "hello", B: "world" });
  });

  it("handles escape sequences in double-quoted values", () => {
    expect(parseDotenv('M="a\\nb"')).toEqual({ M: "a\nb" });
  });

  it("supports `export KEY=value`", () => {
    expect(parseDotenv("export FOO=bar")).toEqual({ FOO: "bar" });
  });

  it("trims trailing inline comments on unquoted values", () => {
    expect(parseDotenv("FOO=bar # note")).toEqual({ FOO: "bar" });
  });

  it("ignores malformed lines", () => {
    expect(parseDotenv("not a kv\nFOO=ok")).toEqual({ FOO: "ok" });
  });
});

describe("loadDotenv", () => {
  let dir: string;
  let originalKey: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "docguard-env-"));
    originalKey = process.env["DG_TEST_KEY"];
    delete process.env["DG_TEST_KEY"];
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (originalKey === undefined) {
      delete process.env["DG_TEST_KEY"];
    } else {
      process.env["DG_TEST_KEY"] = originalKey;
    }
  });

  it("returns loaded=false when no .env exists", () => {
    const r = loadDotenv({ cwd: dir });
    expect(r.loaded).toBe(false);
    expect(r.keys).toEqual([]);
  });

  it("loads keys into process.env", () => {
    writeFileSync(join(dir, ".env"), "DG_TEST_KEY=from-file\n", "utf8");
    const r = loadDotenv({ cwd: dir });
    expect(r.loaded).toBe(true);
    expect(r.keys).toContain("DG_TEST_KEY");
    expect(process.env["DG_TEST_KEY"]).toBe("from-file");
  });

  it("does not override existing process.env by default", () => {
    process.env["DG_TEST_KEY"] = "from-shell";
    writeFileSync(join(dir, ".env"), "DG_TEST_KEY=from-file\n", "utf8");
    loadDotenv({ cwd: dir });
    expect(process.env["DG_TEST_KEY"]).toBe("from-shell");
  });

  it("overrides when override=true", () => {
    process.env["DG_TEST_KEY"] = "from-shell";
    writeFileSync(join(dir, ".env"), "DG_TEST_KEY=from-file\n", "utf8");
    loadDotenv({ cwd: dir, override: true });
    expect(process.env["DG_TEST_KEY"]).toBe("from-file");
  });
});
