import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import fg from "fast-glob";
import type { LoadedDoc } from "../types/docs.js";

export interface LoadDocsOptions {
  readonly cwd: string;
  readonly patterns: readonly string[];
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function loadDocs(opts: LoadDocsOptions): Promise<readonly LoadedDoc[]> {
  const paths = await fg([...opts.patterns], {
    cwd: opts.cwd,
    onlyFiles: true,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });

  const unique = Array.from(new Set(paths)).sort();
  const docs: LoadedDoc[] = [];

  for (const abs of unique) {
    const text = await readFile(abs, "utf8");
    docs.push({
      path: resolve(abs),
      sha: sha256(text),
      text,
    });
  }

  return docs;
}
