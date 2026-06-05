import { uninstallHook } from "../../git/uninstall-hook.js";

export interface UninstallOptions {
  readonly cwd?: string;
  readonly purge?: boolean;
}

export async function runUninstall(options: UninstallOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const result = await uninstallHook({
    cwd,
    ...(options.purge !== undefined ? { purge: options.purge } : {}),
  });

  if (result.hooksRemoved.length === 0) {
    process.stdout.write("docguard uninstall: no managed hooks found\n");
  } else {
    for (const p of result.hooksRemoved) {
      process.stdout.write(`  removed hook entry: ${p}\n`);
    }
  }
  if (result.cacheRemoved) process.stdout.write("  removed .docguard/ directory\n");
  if (result.configRemoved) process.stdout.write("  removed .docguard.json\n");
  process.stdout.write("docguard uninstalled.\n");
  return 0;
}
