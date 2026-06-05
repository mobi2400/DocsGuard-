import { loadConfig } from "../../config/load.js";
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
    process.stdout.write(`  docs: ${loaded.config.docs.join(", ")}\n`);
    process.stdout.write(`  provider: ${loaded.config.llm.provider} (${loaded.config.llm.model})\n`);
    process.stdout.write("docguard check — pipeline wires up in Phases 4-9\n");
    return 0;
  } catch (err) {
    if (err instanceof DocGuardError) {
      process.stderr.write(`docguard: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
}
