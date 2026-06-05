import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { listStagedFiles } from "../../src/git/staged-files.js";
import { readStagedDiff } from "../../src/git/staged-diff.js";

let dir: string;

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: dir, encoding: "utf8" });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "docguard-git-"));
  git("init -q");
  git('config user.email "t@t.t"');
  git('config user.name "t"');
  writeFileSync(join(dir, ".gitignore"), "node_modules\n", "utf8");
  git("add .gitignore");
  git('commit -q -m "init"');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("listStagedFiles", () => {
  it("returns empty when nothing is staged", async () => {
    const files = await listStagedFiles({ cwd: dir, ignore: [] });
    expect(files).toEqual([]);
  });

  it("lists added, modified, deleted, renamed files", async () => {
    writeFileSync(join(dir, "a.ts"), "export const A = 1;\n", "utf8");
    writeFileSync(join(dir, "b.ts"), "export const B = 1;\n", "utf8");
    git("add a.ts b.ts");
    git('commit -q -m "base"');

    writeFileSync(join(dir, "a.ts"), "export const A = 2;\n", "utf8");
    writeFileSync(join(dir, "c.ts"), "export const C = 3;\n", "utf8");
    git("rm -q b.ts");
    git("add a.ts c.ts");

    const files = await listStagedFiles({ cwd: dir, ignore: [] });
    const byKind = Object.fromEntries(files.map((f) => [f.kind, f.path]));
    expect(byKind["modified"]).toBe("a.ts");
    expect(byKind["added"]).toBe("c.ts");
    expect(byKind["deleted"]).toBe("b.ts");
  });

  it("respects ignore globs", async () => {
    writeFileSync(join(dir, "a.test.ts"), "x\n", "utf8");
    writeFileSync(join(dir, "b.ts"), "y\n", "utf8");
    git("add a.test.ts b.ts");
    const files = await listStagedFiles({ cwd: dir, ignore: ["**/*.test.ts"] });
    expect(files.map((f) => f.path)).toEqual(["b.ts"]);
  });

  it("skips lockfiles by default", async () => {
    writeFileSync(join(dir, "package-lock.json"), "{}\n", "utf8");
    writeFileSync(join(dir, "src.ts"), "x\n", "utf8");
    git("add package-lock.json src.ts");
    const files = await listStagedFiles({ cwd: dir, ignore: [] });
    expect(files.map((f) => f.path)).toEqual(["src.ts"]);
  });

  it("flags binary files", async () => {
    const binary = Buffer.from([0, 1, 2, 3, 0, 255, 254, 0]);
    writeFileSync(join(dir, "image.bin"), binary);
    git("add image.bin");
    const files = await listStagedFiles({ cwd: dir, ignore: [] });
    expect(files[0]?.isBinary).toBe(true);
  });
});

describe("readStagedDiff", () => {
  it("returns hunks for added files", async () => {
    writeFileSync(join(dir, "a.ts"), "line1\nline2\nline3\n", "utf8");
    git("add a.ts");
    const files = await listStagedFiles({ cwd: dir, ignore: [] });
    const diffs = await readStagedDiff(files, { cwd: dir });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.hunks.length).toBeGreaterThan(0);
    expect(diffs[0]?.hunks[0]?.body).toContain("+line1");
  });

  it("skips binary files", async () => {
    writeFileSync(join(dir, "img.bin"), Buffer.from([0, 1, 2, 0, 255]));
    git("add img.bin");
    const files = await listStagedFiles({ cwd: dir, ignore: [] });
    const diffs = await readStagedDiff(files, { cwd: dir });
    expect(diffs).toEqual([]);
  });

  it("skips removed-only changes", async () => {
    writeFileSync(join(dir, "a.ts"), "x\ny\nz\n", "utf8");
    git("add a.ts");
    git('commit -q -m "add"');
    git("rm -q a.ts");
    const files = await listStagedFiles({ cwd: dir, ignore: [] });
    const diffs = await readStagedDiff(files, { cwd: dir });
    expect(diffs).toEqual([]);
  });
});
