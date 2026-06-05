import { simpleGit } from "simple-git";
import type { StagedFile, DiffHunk, FileDiff } from "../types/diff.js";

export interface ReadStagedDiffOptions {
  readonly cwd: string;
  readonly contextLines?: number;
  readonly maxHunksPerFile?: number;
}

const DEFAULT_CONTEXT = 5;
const DEFAULT_MAX_HUNKS = 50;

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

function parseHunks(file: string, diff: string, maxHunks: number): { hunks: DiffHunk[]; truncated: boolean } {
  const lines = diff.split("\n");
  const hunks: DiffHunk[] = [];
  let current: { header: string; oldStart: number; oldLines: number; newStart: number; newLines: number; bodyLines: string[] } | null = null;
  let truncated = false;

  const flush = (): void => {
    if (current === null) return;
    if (hunks.length >= maxHunks) {
      truncated = true;
      current = null;
      return;
    }
    hunks.push({
      file,
      header: current.header,
      oldStart: current.oldStart,
      oldLines: current.oldLines,
      newStart: current.newStart,
      newLines: current.newLines,
      body: current.bodyLines.join("\n"),
    });
    current = null;
  };

  for (const line of lines) {
    const m = HUNK_HEADER_RE.exec(line);
    if (m !== null) {
      flush();
      if (hunks.length >= maxHunks) {
        truncated = true;
        continue;
      }
      const oldStart = Number(m[1]);
      const oldLines = m[2] !== undefined ? Number(m[2]) : 1;
      const newStart = Number(m[3]);
      const newLines = m[4] !== undefined ? Number(m[4]) : 1;
      current = {
        header: line,
        oldStart,
        oldLines,
        newStart,
        newLines,
        bodyLines: [],
      };
    } else if (current !== null) {
      current.bodyLines.push(line);
    }
  }
  flush();

  return { hunks, truncated };
}

function isOnlyDeletion(hunks: readonly DiffHunk[]): boolean {
  if (hunks.length === 0) return false;
  for (const hunk of hunks) {
    for (const line of hunk.body.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) return false;
    }
  }
  return true;
}

export async function readStagedDiff(
  files: readonly StagedFile[],
  opts: ReadStagedDiffOptions,
): Promise<readonly FileDiff[]> {
  const git = simpleGit({ baseDir: opts.cwd });
  const context = opts.contextLines ?? DEFAULT_CONTEXT;
  const maxHunks = opts.maxHunksPerFile ?? DEFAULT_MAX_HUNKS;
  const result: FileDiff[] = [];

  for (const file of files) {
    if (file.isBinary) continue;
    if (file.kind === "deleted") continue;

    const diff = await git.raw([
      "diff",
      "--cached",
      `--unified=${String(context)}`,
      "--no-color",
      "--",
      file.path,
    ]);

    const { hunks, truncated } = parseHunks(file.path, diff, maxHunks);
    if (hunks.length === 0) continue;
    if (isOnlyDeletion(hunks)) continue;

    result.push({ file, hunks, truncated });
  }

  return result;
}
