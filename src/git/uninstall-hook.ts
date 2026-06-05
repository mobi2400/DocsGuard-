import { readFile, writeFile, unlink, access, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { docguardDir } from "../utils/paths.js";

const HOOK_MARKER = "# docguard-managed";

export interface UninstallHookOptions {
  readonly cwd: string;
  readonly purge?: boolean;
}

export interface UninstallHookResult {
  readonly hooksRemoved: readonly string[];
  readonly cacheRemoved: boolean;
  readonly configRemoved: boolean;
}

async function existsAsync(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function stripFromHook(path: string): Promise<boolean> {
  if (!existsSync(path)) return false;
  const existing = await readFile(path, "utf8");
  if (!existing.includes(HOOK_MARKER)) return false;

  const lines = existing.split("\n");
  const filtered: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.includes(HOOK_MARKER)) {
      i += 1;
      continue;
    }
    filtered.push(line);
  }

  const remaining = filtered.join("\n").trim();
  if (remaining === "" || remaining === "#!/usr/bin/env sh") {
    await unlink(path);
  } else {
    await writeFile(path, `${remaining}\n`, "utf8");
  }
  return true;
}

export async function uninstallHook(opts: UninstallHookOptions): Promise<UninstallHookResult> {
  const removed: string[] = [];
  const gitHook = resolve(opts.cwd, ".git", "hooks", "pre-commit");
  if (await stripFromHook(gitHook)) removed.push(gitHook);
  const huskyHook = resolve(opts.cwd, ".husky", "pre-commit");
  if (await stripFromHook(huskyHook)) removed.push(huskyHook);

  const dgDir = docguardDir(opts.cwd);
  let cacheRemoved = false;
  if (await existsAsync(dgDir)) {
    await rm(dgDir, { recursive: true, force: true });
    cacheRemoved = true;
  }

  let configRemoved = false;
  if (opts.purge === true) {
    const cfg = resolve(opts.cwd, ".docguard.json");
    if (await existsAsync(cfg)) {
      await unlink(cfg);
      configRemoved = true;
    }
  }

  return { hooksRemoved: removed, cacheRemoved, configRemoved };
}
