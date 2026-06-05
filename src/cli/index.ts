#!/usr/bin/env node
import { VERSION } from "../index.js";

const args: string[] = process.argv.slice(2);

if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write(`docguard ${VERSION}\n`);
  process.exit(0);
}

process.stdout.write(`docguard ${VERSION} — scaffold ready. CLI commands land in Phase 2.\n`);
process.exit(0);
