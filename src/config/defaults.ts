import type { DocGuardConfig } from "./schema.js";

export const DEFAULT_CONFIG: DocGuardConfig = {
  docs: ["./docs/**/*.md"],
  ignore: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"],
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
