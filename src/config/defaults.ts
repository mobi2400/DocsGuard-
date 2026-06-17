import type { DocGuardConfig } from "./schema.js";

export const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/**",
  "**/test/**",
  "**/tests/**",
  "**/__pycache__/**",
  "**/.pytest_cache/**",
  "**/node_modules/**",
  "**/.venv/**",
  "**/venv/**",
  "**/vendor/**",
];

export const DEFAULT_CONFIG: DocGuardConfig = {
  docs: ["./docs/**/*.md"],
  ignore: [...DEFAULT_IGNORE_PATTERNS],
  severity: {
    security: "block",
    architecture: "warn",
    "api-contract": "warn",
    naming: "warn",
    style: "warn",
  },
  priority: {},
  llm: {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
  },
  retrieval: {
    topK: 6,
    minScore: 0.15,
  },
  timeoutMs: 5000,
};
