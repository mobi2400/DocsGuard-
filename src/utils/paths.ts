import { resolve } from "node:path";

export const DOCGUARD_DIR = ".docguard";
export const CACHE_DIR = "cache";
export const EMBEDDINGS_FILE = "embeddings.json";
export const BYPASS_LOG_FILE = "bypass.log";

export function docguardDir(cwd: string): string {
  return resolve(cwd, DOCGUARD_DIR);
}

export function cacheDir(cwd: string): string {
  return resolve(docguardDir(cwd), CACHE_DIR);
}

export function embeddingsCachePath(cwd: string): string {
  return resolve(cacheDir(cwd), EMBEDDINGS_FILE);
}

export function bypassLogPath(cwd: string): string {
  return resolve(docguardDir(cwd), BYPASS_LOG_FILE);
}
