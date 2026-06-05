import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { installHook } from "../../src/git/install-hook.js";
import { uninstallHook } from "../../src/git/uninstall-hook.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "docguard-hook-"));
  execSync("git init -q", { cwd: dir });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("installHook", () => {
  it("creates a git pre-commit hook with LF line endings", async () => {
    const r = await installHook({ cwd: dir });
    expect(r.action).toBe("created");
    expect(r.kind).toBe("git");
    const raw = readFileSync(r.path);
    expect(raw.includes(Buffer.from("\r\n"))).toBe(false);
    expect(raw.toString("utf8")).toContain("docguard check");
  });

  it("is idempotent", async () => {
    await installHook({ cwd: dir });
    const r = await installHook({ cwd: dir });
    expect(r.action).toBe("unchanged");
  });

  it("appends to an existing hook without overwriting", async () => {
    const path = join(dir, ".git", "hooks", "pre-commit");
    writeFileSync(path, "#!/usr/bin/env sh\necho hi\n", "utf8");
    const r = await installHook({ cwd: dir });
    expect(r.action).toBe("appended");
    const text = readFileSync(path, "utf8");
    expect(text).toContain("echo hi");
    expect(text).toContain("docguard check");
  });

  it("uses Husky when .husky exists", async () => {
    mkdirSync(join(dir, ".husky"));
    const r = await installHook({ cwd: dir });
    expect(r.kind).toBe("husky");
    expect(r.path).toContain(".husky");
  });
});

describe("uninstallHook", () => {
  it("removes the managed hook block and the .docguard directory", async () => {
    await installHook({ cwd: dir });
    mkdirSync(join(dir, ".docguard"), { recursive: true });
    writeFileSync(join(dir, ".docguard", "bypass.log"), "x\n", "utf8");
    const r = await uninstallHook({ cwd: dir });
    expect(r.hooksRemoved.length).toBeGreaterThan(0);
    expect(r.cacheRemoved).toBe(true);
    expect(existsSync(join(dir, ".docguard"))).toBe(false);
  });

  it("preserves unrelated hook content", async () => {
    const path = join(dir, ".git", "hooks", "pre-commit");
    writeFileSync(path, "#!/usr/bin/env sh\necho keep\n", "utf8");
    await installHook({ cwd: dir });
    await uninstallHook({ cwd: dir });
    const text = readFileSync(path, "utf8");
    expect(text).toContain("echo keep");
    expect(text).not.toContain("docguard check");
  });

  it("purge removes config", async () => {
    writeFileSync(join(dir, ".docguard.json"), "{}", "utf8");
    const r = await uninstallHook({ cwd: dir, purge: true });
    expect(r.configRemoved).toBe(true);
    expect(existsSync(join(dir, ".docguard.json"))).toBe(false);
  });
});
