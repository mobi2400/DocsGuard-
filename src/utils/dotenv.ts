import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const LINE_RE = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i;

export interface LoadDotenvOptions {
  readonly cwd: string;
  readonly filename?: string;
  readonly override?: boolean;
}

export interface LoadDotenvResult {
  readonly loaded: boolean;
  readonly path: string;
  readonly keys: readonly string[];
}

function unquote(raw: string): string {
  if (raw.length >= 2) {
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = raw.slice(1, -1);
      if (first === '"') {
        return inner.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
      }
      return inner;
    }
  }
  return raw;
}

export function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const m = LINE_RE.exec(line);
    if (m === null) continue;
    const key = m[1];
    const valueRaw = m[2] ?? "";
    if (key === undefined) continue;
    const value = unquote(valueRaw.replace(/\s+#.*$/, "").trim());
    out[key] = value;
  }
  return out;
}

export function loadDotenv(opts: LoadDotenvOptions): LoadDotenvResult {
  const filename = opts.filename ?? ".env";
  const path = resolve(opts.cwd, filename);
  if (!existsSync(path)) {
    return { loaded: false, path, keys: [] };
  }
  const content = readFileSync(path, "utf8");
  const parsed = parseDotenv(content);
  const keys: string[] = [];
  const override = opts.override === true;
  for (const [k, v] of Object.entries(parsed)) {
    if (override || process.env[k] === undefined) {
      process.env[k] = v;
      keys.push(k);
    }
  }
  return { loaded: true, path, keys };
}
