export interface UninstallOptions {
  readonly cwd?: string;
  readonly purge?: boolean;
}

export async function runUninstall(_options: UninstallOptions = {}): Promise<number> {
  process.stdout.write("docguard uninstall — not yet implemented (lands in Phase 10)\n");
  return 0;
}
