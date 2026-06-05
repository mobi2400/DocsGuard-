import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { ZodError } from "zod";
import { ConfigError, ConfigNotFoundError } from "../utils/errors.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import {
  partialConfigSchema,
  configSchema,
  type DocGuardConfig,
  type PartialDocGuardConfig,
  type SeverityMap,
  type LlmConfig,
  type RetrievalConfig,
} from "./schema.js";

export const CONFIG_FILENAME = ".docguard.json";

export interface LoadConfigOptions {
  readonly cwd: string;
  readonly configPath?: string;
}

export interface LoadedConfig {
  readonly config: DocGuardConfig;
  readonly path: string;
}

export function resolveConfigPath(opts: LoadConfigOptions): string {
  if (opts.configPath !== undefined) {
    return isAbsolute(opts.configPath) ? opts.configPath : resolve(opts.cwd, opts.configPath);
  }
  return resolve(opts.cwd, CONFIG_FILENAME);
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

function parseJson(raw: string, path: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Failed to parse ${path}: ${message}`);
  }
}

function pick<T extends object>(
  base: T,
  overrides: { [K in keyof T]?: T[K] | undefined } | undefined,
): T {
  if (overrides === undefined) return base;
  const merged: T = { ...base };
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const value = overrides[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

function mergeWithDefaults(partial: PartialDocGuardConfig): DocGuardConfig {
  const severity: SeverityMap = pick(DEFAULT_CONFIG.severity, partial.severity);
  const llm: LlmConfig = pick(DEFAULT_CONFIG.llm, partial.llm);
  const retrieval: RetrievalConfig = pick(DEFAULT_CONFIG.retrieval, partial.retrieval);
  return {
    docs: partial.docs ?? DEFAULT_CONFIG.docs,
    ignore: partial.ignore ?? DEFAULT_CONFIG.ignore,
    severity,
    priority: partial.priority ?? DEFAULT_CONFIG.priority,
    llm,
    retrieval,
    timeoutMs: partial.timeoutMs ?? DEFAULT_CONFIG.timeoutMs,
  };
}

export async function loadConfig(opts: LoadConfigOptions): Promise<LoadedConfig> {
  const path = resolveConfigPath(opts);

  if (!existsSync(path)) {
    throw new ConfigNotFoundError(path);
  }

  const raw = await readFile(path, "utf8");
  const parsed = parseJson(raw, path);

  const partialResult = partialConfigSchema.safeParse(parsed);
  if (!partialResult.success) {
    throw new ConfigError(`Invalid config at ${path}:\n${formatZodError(partialResult.error)}`);
  }

  const merged = mergeWithDefaults(partialResult.data);

  const finalResult = configSchema.safeParse(merged);
  if (!finalResult.success) {
    throw new ConfigError(`Config failed final validation:\n${formatZodError(finalResult.error)}`);
  }

  return { config: finalResult.data, path };
}
