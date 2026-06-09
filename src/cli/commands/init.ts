import { readFile, writeFile, access, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installHook } from "../../git/install-hook.js";

const MIN_NODE_MAJOR = 18;
const MIN_NODE_MINOR = 17;

const GITIGNORE_ENTRIES = [
  "# DocGuard",
  ".docguard/cache/",
  ".docguard/bypass.log",
  ".docguard/errors.log",
];

export interface InitOptions {
  readonly cwd?: string;
}

interface NodeVersionCheck {
  readonly ok: boolean;
  readonly message: string;
}

function parseNodeVersion(version: string): { major: number; minor: number } | null {
  const m = /^v?(\d+)\.(\d+)/.exec(version);
  if (m === null) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

function checkNodeVersion(): NodeVersionCheck {
  const parsed = parseNodeVersion(process.version);
  if (parsed === null) return { ok: true, message: "" };
  const ok =
    parsed.major > MIN_NODE_MAJOR ||
    (parsed.major === MIN_NODE_MAJOR && parsed.minor >= MIN_NODE_MINOR);
  return {
    ok,
    message: ok
      ? ""
      : `DocGuard requires Node >=${String(MIN_NODE_MAJOR)}.${String(MIN_NODE_MINOR)}. You have ${process.version}.`,
  };
}

async function locateTemplate(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "..", "..", "..", "templates", ".docguard.json"),
    resolve(here, "..", "..", "templates", ".docguard.json"),
    resolve(process.cwd(), "templates", ".docguard.json"),
  ];
  for (const c of candidates) {
    try {
      await access(c);
      return c;
    } catch {
      continue;
    }
  }
  throw new Error("Could not locate templates/.docguard.json");
}

async function writeConfigIfMissing(cwd: string): Promise<{ written: boolean; path: string }> {
  const target = resolve(cwd, ".docguard.json");
  if (existsSync(target)) return { written: false, path: target };
  const tmpl = await locateTemplate();
  const content = await readFile(tmpl, "utf8");
  await writeFile(target, content, "utf8");
  return { written: true, path: target };
}

async function ensureGitignore(cwd: string): Promise<void> {
  const path = resolve(cwd, ".gitignore");
  let existing = "";
  if (existsSync(path)) {
    existing = await readFile(path, "utf8");
  }
  const needed = GITIGNORE_ENTRIES.filter((e) => !existing.includes(e));
  if (needed.length === 0) return;
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await appendFile(path, `${prefix}${needed.join("\n")}\n`, "utf8");
}

async function prewarmEmbedder(): Promise<{ ok: boolean; message: string }> {
  try {
    const { getEmbedder } = await import("../../embeddings/embed.js");
    const embedder = await getEmbedder();
    await embedder("docguard pre-warm");
    return { ok: true, message: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export async function runInit(options: InitOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const node = checkNodeVersion();
  if (!node.ok) {
    process.stderr.write(`docguard: ${node.message}\n`);
    return 1;
  }

  if (!existsSync(resolve(cwd, ".git"))) {
    process.stderr.write("docguard: not a git repository. Run `git init` first.\n");
    return 1;
  }

  process.stdout.write("docguard init\n");

  const cfg = await writeConfigIfMissing(cwd);
  process.stdout.write(`  ${cfg.written ? "wrote" : "exists"} ${cfg.path}\n`);

  const hook = await installHook({ cwd });
  process.stdout.write(`  hook ${hook.action} at ${hook.path} (${hook.kind})\n`);

  await ensureGitignore(cwd);
  process.stdout.write("  .gitignore updated\n");

  process.stdout.write("  pre-warming embedding model (one-time ~25MB download)...\n");
  const warm = await prewarmEmbedder();
  if (warm.ok) {
    process.stdout.write("  embedding model ready\n");
  } else {
    process.stdout.write(`  pre-warm skipped: ${warm.message}\n`);
  }

  process.stdout.write("\nNext: set GROQ_API_KEY to enable semantic checks.\n");
  process.stdout.write("       Get a free key at https://console.groq.com.\n");
  process.stdout.write("\nTry it:  git commit -m \"...\"\n");
  process.stdout.write("Bypass:  git commit --no-verify  or  DOCGUARD_BYPASS=1 git commit\n");
  return 0;
}
