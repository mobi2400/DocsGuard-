import { simpleGit, type SimpleGit } from "simple-git";
import { minimatch } from "minimatch";
import type { StagedFile, ChangeKind } from "../types/diff.js";

const LOCKFILE_PATTERNS: readonly string[] = [
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/bun.lockb",
  "**/poetry.lock",
  "**/Cargo.lock",
  "**/composer.lock",
  "**/Gemfile.lock",
];

export interface ListStagedFilesOptions {
  readonly cwd: string;
  readonly ignore: readonly string[];
}

function statusToKind(status: string): ChangeKind | null {
  const code = status.trim().charAt(0);
  switch (code) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "added";
    case "T":
      return "modified";
    default:
      return null;
  }
}

function matchesAny(path: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (minimatch(path, pattern, { dot: true })) return true;
  }
  return false;
}

function isLockfile(path: string): boolean {
  return matchesAny(path, LOCKFILE_PATTERNS);
}

async function detectBinary(git: SimpleGit, path: string): Promise<boolean> {
  try {
    const out = await git.raw([
      "diff",
      "--cached",
      "--numstat",
      "--",
      path,
    ]);
    const first = out.split("\n").find((line) => line.length > 0);
    if (first === undefined) return false;
    const parts = first.split("\t");
    const added = parts[0];
    const removed = parts[1];
    return added === "-" && removed === "-";
  } catch {
    return false;
  }
}

export async function listStagedFiles(opts: ListStagedFilesOptions): Promise<readonly StagedFile[]> {
  const git: SimpleGit = simpleGit({ baseDir: opts.cwd });

  const raw = await git.raw([
    "diff",
    "--cached",
    "--name-status",
    "-z",
  ]);

  if (raw.length === 0) return [];

  const tokens = raw.split("\0").filter((t) => t.length > 0);
  const files: StagedFile[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const status = tokens[i];
    if (status === undefined) break;
    const kind = statusToKind(status);
    const isRename = status.startsWith("R") || status.startsWith("C");

    let oldPath: string | null = null;
    let path: string | undefined;

    if (isRename) {
      oldPath = tokens[i + 1] ?? null;
      path = tokens[i + 2];
      i += 2;
    } else {
      path = tokens[i + 1];
      i += 1;
    }

    if (kind === null || path === undefined) continue;
    if (matchesAny(path, opts.ignore)) continue;
    if (isLockfile(path)) continue;

    const isBinary = await detectBinary(git, path);
    files.push({ path, oldPath, kind, isBinary });
  }

  return files;
}
