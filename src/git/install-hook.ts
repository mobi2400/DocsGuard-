import { writeFile, mkdir, chmod, access, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const HOOK_BODY = "#!/usr/bin/env sh\nexec npx --no-install docguard check\n";
const HOOK_MARKER = "# docguard-managed";
const HOOK_BODY_WITH_MARKER = `#!/usr/bin/env sh\n${HOOK_MARKER}\nexec npx --no-install docguard check\n`;

export type HookKind = "git" | "husky";

export interface InstallHookResult {
  readonly kind: HookKind;
  readonly path: string;
  readonly action: "created" | "appended" | "unchanged";
}

export interface InstallHookOptions {
  readonly cwd: string;
}

async function huskyDir(cwd: string): Promise<string | null> {
  const dir = resolve(cwd, ".husky");
  try {
    await access(dir);
    return dir;
  } catch {
    return null;
  }
}

async function writeLfFile(path: string, content: string): Promise<void> {
  const lf = content.replace(/\r\n/g, "\n");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, lf, { encoding: "utf8" });
  try {
    await chmod(path, 0o755);
  } catch {
    // chmod is best-effort on Windows
  }
}

async function appendHusky(path: string): Promise<InstallHookResult["action"]> {
  if (!existsSync(path)) {
    await writeLfFile(path, HOOK_BODY_WITH_MARKER);
    return "created";
  }
  const existing = await readFile(path, "utf8");
  if (existing.includes(HOOK_MARKER)) return "unchanged";
  const updated = `${existing.replace(/\s*$/, "")}\n${HOOK_MARKER}\nexec npx --no-install docguard check\n`;
  await writeLfFile(path, updated);
  return "appended";
}

export async function installHook(opts: InstallHookOptions): Promise<InstallHookResult> {
  const husky = await huskyDir(opts.cwd);
  if (husky !== null) {
    const path = resolve(husky, "pre-commit");
    const action = await appendHusky(path);
    return { kind: "husky", path, action };
  }

  const path = resolve(opts.cwd, ".git", "hooks", "pre-commit");
  if (existsSync(path)) {
    const existing = await readFile(path, "utf8");
    if (existing.includes(HOOK_MARKER)) {
      return { kind: "git", path, action: "unchanged" };
    }
    const updated = `${existing.replace(/\s*$/, "")}\n${HOOK_MARKER}\nexec npx --no-install docguard check\n`;
    await writeLfFile(path, updated);
    return { kind: "git", path, action: "appended" };
  }

  await writeLfFile(path, HOOK_BODY_WITH_MARKER);
  return { kind: "git", path, action: "created" };
}
