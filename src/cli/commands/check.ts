export interface CheckOptions {
  readonly cwd?: string;
  readonly config?: string;
}

export async function runCheck(_options: CheckOptions = {}): Promise<number> {
  process.stdout.write("docguard check — not yet implemented (wires up in Phases 3-9)\n");
  return 0;
}
