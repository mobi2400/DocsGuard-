export interface InitOptions {
  readonly cwd?: string;
}

export async function runInit(_options: InitOptions = {}): Promise<number> {
  process.stdout.write("docguard init — not yet implemented (lands in Phase 10)\n");
  return 0;
}
