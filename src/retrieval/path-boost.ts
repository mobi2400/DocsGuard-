const STOP_SEGMENTS = new Set([
  "src",
  "lib",
  "app",
  "test",
  "tests",
  "spec",
  "index",
  "main",
  "components",
  "utils",
  "helpers",
]);

function tokenize(path: string): string[] {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  const stripped = lower.replace(/\.[a-z0-9]+$/i, "");
  const parts = stripped.split(/[\/\-_.]+/).filter((p) => p.length > 1 && !STOP_SEGMENTS.has(p));
  return parts;
}

export function pathOverlap(codePath: string, docPath: string): number {
  const codeTokens = new Set(tokenize(codePath));
  const docTokens = tokenize(docPath);
  if (codeTokens.size === 0 || docTokens.length === 0) return 0;
  let hits = 0;
  for (const t of docTokens) {
    if (codeTokens.has(t)) hits += 1;
  }
  return hits / docTokens.length;
}

export function pathBoost(codePath: string, docPath: string, weight: number): number {
  return pathOverlap(codePath, docPath) * weight;
}
