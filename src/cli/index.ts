#!/usr/bin/env node
import { Command } from "commander";
import { VERSION, PROMPT_VERSION } from "../index.js";
import { runInit, type InitOptions } from "./commands/init.js";
import { runCheck, type CheckOptions } from "./commands/check.js";
import { runUninstall, type UninstallOptions } from "./commands/uninstall.js";

interface GlobalOptions {
  readonly cwd?: string;
}

function resolveCwd(opts: GlobalOptions): string {
  return opts.cwd ?? process.cwd();
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("docguard")
    .description("Documentation-aware code guard for AI-assisted development.")
    .version(`${VERSION} (prompt ${PROMPT_VERSION})`, "-v, --version", "print version")
    .option("--cwd <path>", "run as if started from this directory")
    .showHelpAfterError();

  program
    .command("init")
    .description("install the pre-commit hook and write .docguard.json")
    .action(async (_localOpts: Record<string, unknown>, cmd: Command): Promise<void> => {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const options: InitOptions = { cwd: resolveCwd(globalOpts) };
      process.exitCode = await runInit(options);
    });

  program
    .command("check")
    .description("check staged changes against the configured docs")
    .option("-c, --config <path>", "path to .docguard.json")
    .option("--debug-scores", "print retrieval scores per chunk")
    .action(async (localOpts: { config?: string; debugScores?: boolean }, cmd: Command): Promise<void> => {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const options: CheckOptions = {
        cwd: resolveCwd(globalOpts),
        ...(localOpts.config !== undefined ? { config: localOpts.config } : {}),
        ...(localOpts.debugScores !== undefined ? { debugScores: localOpts.debugScores } : {}),
      };
      process.exitCode = await runCheck(options);
    });

  program
    .command("uninstall")
    .description("remove the pre-commit hook and DocGuard cache")
    .option("--purge", "also delete .docguard.json")
    .action(async (localOpts: { purge?: boolean }, cmd: Command): Promise<void> => {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const options: UninstallOptions = {
        cwd: resolveCwd(globalOpts),
        ...(localOpts.purge !== undefined ? { purge: localOpts.purge } : {}),
      };
      process.exitCode = await runUninstall(options);
    });

  await program.parseAsync(process.argv);
}

main().catch((err: unknown): void => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`docguard: ${message}\n`);
  process.exit(1);
});
