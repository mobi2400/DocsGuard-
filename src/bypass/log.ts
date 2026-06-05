import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { simpleGit } from "simple-git";
import { bypassLogPath } from "../utils/paths.js";

export interface LogBypassOptions {
  readonly cwd: string;
  readonly reason: string;
}

async function currentHead(cwd: string): Promise<string> {
  try {
    const git = simpleGit({ baseDir: cwd });
    const sha = await git.revparse(["HEAD"]);
    return sha.trim();
  } catch {
    return "(no-head)";
  }
}

export async function logBypass(opts: LogBypassOptions): Promise<void> {
  const path = bypassLogPath(opts.cwd);
  await mkdir(dirname(path), { recursive: true });
  const head = await currentHead(opts.cwd);
  const line = `${new Date().toISOString()}\t${head}\t${opts.reason}\n`;
  await appendFile(path, line, "utf8");
}
