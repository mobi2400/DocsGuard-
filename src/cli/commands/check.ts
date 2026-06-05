import { loadConfig } from "../../config/load.js";
import { listStagedFiles } from "../../git/staged-files.js";
import { readStagedDiff } from "../../git/staged-diff.js";
import { DocGuardError } from "../../utils/errors.js";

export interface CheckOptions {
  readonly cwd?: string;
  readonly config?: string;
}

export async function runCheck(options: CheckOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  try {
    const loaded = await loadConfig({
      cwd,
      ...(options.config !== undefined ? { configPath: options.config } : {}),
    });
    process.stdout.write(`docguard: config loaded from ${loaded.path}\n`);

    const files = await listStagedFiles({ cwd, ignore: loaded.config.ignore });
    if (files.length === 0) {
      process.stdout.write("docguard: no staged changes to check\n");
      return 0;
    }

    const diffs = await readStagedDiff(files, { cwd });
    process.stdout.write(`docguard: ${String(files.length)} staged file(s), ${String(diffs.length)} with text changes\n`);

    for (const d of diffs) {
      const note = d.truncated ? " (truncated)" : "";
      process.stdout.write(`  ${d.file.kind.padEnd(8)} ${d.file.path}  [${String(d.hunks.length)} hunk(s)${note}]\n`);
    }

    process.stdout.write("docguard check — semantic pipeline lands in Phases 5-9\n");
    return 0;
  } catch (err) {
    if (err instanceof DocGuardError) {
      process.stderr.write(`docguard: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
}
