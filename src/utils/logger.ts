import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { docguardDir } from "./paths.js";

export function errorLogPath(cwd: string): string {
  return resolve(docguardDir(cwd), "errors.log");
}

export async function logError(cwd: string, where: string, err: unknown): Promise<void> {
  const path = errorLogPath(cwd);
  try {
    await mkdir(dirname(path), { recursive: true });
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    const line = `${new Date().toISOString()}\t${where}\t${message.replace(/\n/g, " | ")}\n`;
    await appendFile(path, line, "utf8");
  } catch {
    // swallow — never let logging crash the host
  }
}
