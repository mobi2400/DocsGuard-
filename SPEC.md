# DocGuard Build Context

Handoff context for building the `docguard` npm package. This is the build-ready spec for v1.

---

## Project Summary

**DocGuard** is a documentation-aware code guard for AI-assisted development.

It stops AI-generated code from violating the project's documented rules before that code is committed.

The core problem:

- developers write docs that explain architecture, rules, patterns, and constraints
- AI coding tools often ignore or misunderstand those docs
- developers commit the code anyway
- the project drifts away from its documented design
- bugs and production incidents follow

**DocGuard checks whether changed code aligns with the project's docs before it enters the repository.**

---

## Positioning

Not another linter. ESLint/Prettier/Husky handle generic quality. DocGuard enforces **project-specific documented intent**: architecture, API rules, security rules, naming rules, team decisions written in docs.

Tagline: **Documentation-aware guardrails for AI-generated code.**

---

## Flow

```
AI writes code → developer stages → git commit
   → DocGuard pre-commit hook fires
   → reads staged diff + retrieves relevant doc chunks
   → runs deterministic checks, then semantic check
   → returns pass / warn / block
   → if block: commit stops unless user bypasses
```

---

## v1 Scope (locked)

**In:**

- markdown docs only
- staged diff only (not full repo scan)
- one config file `.docguard.json`
- pre-commit hook only (no pre-push)
- single LLM semantic pass per commit
- three severities: `pass`, `warn`, `block`
- clear CLI output with doc-line citations
- BYOK (bring your own key)

**Out (explicit non-goals for v1):**

- pre-push hook
- multi-agent architecture
- auto-fix suggestions
- VS Code / IDE extensions
- web dashboard or telemetry
- non-markdown docs (no Confluence, Notion, PDF, RST)
- custom rule DSL or user-authored named rules
- per-team config inheritance
- monorepo-aware multi-config

---

## Architecture

Commands:

- `docguard init` — installs hook, writes config, prints setup instructions
- `docguard check` — runs against current staged diff (also what the hook calls)
- `docguard explain <rule>` — (optional, later) shows why a rule fired

Internal modules:

- `git-adapter` — gets staged files + hunks via `simple-git`
- `docs-loader` — parses markdown, splits by heading, attaches `{file, heading, lineStart, lineEnd}` metadata
- `retriever` — embeds chunks, finds top-k relevant per diff
- `rule-engine` — deterministic checks (AST/regex) — *stub in v1, real in v1.1*
- `semantic-engine` — single LLM call with retrieved chunks + diff
- `reporter` — formats CLI output with citations
- `hook-installer` — writes `.git/hooks/pre-commit` or wires Husky

---

## Key Design Decisions

### 1. LLM provider
**Default: Groq (Llama 3.3 70B) via BYOK.** Free tier, fast enough for pre-commit. User sets `GROQ_API_KEY`. Adapter interface allows OpenAI / Anthropic later, but only one impl in v1. DocGuard never hosts a proxy or pays for inference.

### 2. Rules are categories, not named rules
No user-authored rule names. The LLM tags each violation with a fixed category:

- `security`
- `architecture`
- `api-contract`
- `naming`
- `style`

Config sets severity per category. Zero setup beyond pointing at docs.

### 3. Citation is mandatory
Every semantic violation must include `{file, line, quoted_text}` from the docs. **No citation → auto-downgrade to `warn`.** This is the hallucination firewall. Enforced by JSON schema on the LLM response.

### 4. Default severity for semantic checks: `warn`
Deterministic rules can block from day one. Semantic (LLM) violations default to `warn` in v1. Users opt into `block` via config once they trust it. This is what keeps the install base from rage-uninstalling.

### 5. Latency budget: 5s hard cap
If retrieval + LLM exceeds 5s, print partial result + "semantic check skipped (timeout)" and let the commit through. A pre-commit hook that hangs gets `--no-verify`'d forever.

### 6. Embeddings: local, cached
Use `@xenova/transformers` (Node-native, no API). Cache to `.docguard/cache/embeddings.json`, keyed by doc-file SHA. No second API dependency, no per-commit embedding cost. Re-embed only when doc files change.

### 7. Diff retrieval unit
Embed full changed **hunks** plus ~5 lines of surrounding context, not just added lines. Removed-only changes → skip that file.

### 8. Many-docs handling
Retrieval is the answer. Even with 30 docs, the LLM sees only top 3–8 relevant chunks per commit. Config supports optional `priority` per doc path (`critical | normal | low`) to bias retrieval ranking. File-path heuristics also boost relevance (e.g. changes in `src/auth/**` boost docs tagged or named with `auth`/`security`).

### 9. Failure modes — DocGuard never blocks on its own bugs
Wrap everything in try/catch. Any internal failure → log + pass.

- no API key → warn once, skip semantic, run deterministic only, pass
- network down → same
- docs folder missing → init failed; tell user; skip
- LLM returns malformed JSON → skip semantic, pass
- doc file unreadable → skip that file, continue

### 10. Bypass mechanisms
- `git commit --no-verify` — standard git escape hatch
- `DOCGUARD_BYPASS=1` env var — for scripted/emergency commits
- Bypasses are logged to `.docguard/bypass.log` with timestamp + commit SHA (local only, no network)

### 11. No telemetry
None. Not opt-in, not anonymous, none. A tool that reads your code cannot phone home in v1.

### 12. Prompt versioning
Every prompt template carries a `PROMPT_VERSION` constant (e.g. `"v1.0.0"`). Cache keys for any cached LLM judgment include this version. Bumping the prompt invalidates old cached results automatically. Stamp it in CLI output too (`DocGuard v0.1.0 · prompt v1.0.0`) so reproducibility is debuggable.

### 13. What counts as a "doc"
Default glob: `["./docs/**/*.md"]`. Root-level `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` are **excluded by default** — too noisy, rarely encode enforceable rules. Users can add them explicitly. `init` does not auto-discover; it asks for the docs folder and writes the glob.

### 14. Chunking strategy
- Split by top-level heading (`#`, `##`) first.
- If a resulting chunk exceeds **1500 characters**, sub-split on `###`.
- If still too large, split on paragraph breaks (blank lines).
- Hard cap: 2000 chars per chunk. Anything beyond that gets truncated with a `[...]` marker and a warning logged.
- Each chunk carries `{file, heading, lineStart, lineEnd, charCount}`.

### 15. Citation line semantics
The LLM does **not** invent line numbers. It returns only the **chunk id** it relied on. DocGuard computes `file` and `line` from that chunk's stored `lineStart` metadata. The `quote` field is validated to be a substring of the chunk text — if not, downgrade to `warn`. This kills the entire class of hallucinated line citations.

Updated response schema field: `chunk_id` replaces direct `file`/`line` in the LLM output.

### 16. Cross-platform hook scripts
- Hook file written with **LF line endings**, no BOM, executable bit set (best-effort on Windows).
- Shebang: `#!/usr/bin/env sh` — works on Git Bash, WSL, macOS, Linux.
- Hook body is a one-liner: `exec npx --no-install docguard check`.
- CI smoke test runs the hook on both Ubuntu and Windows runners before any release.

### 17. Node version floor
- `engines.node: ">=18.17"` in `package.json` (required by `@xenova/transformers`).
- `init` checks Node version up front and refuses with a clear message on older runtimes.
- Documented in README.

### 18. Model pre-warm on init
`docguard init` downloads the MiniLM embedding model (~25MB) and runs one throwaway embedding to JIT-warm. This moves the first-run delay out of the first commit. Progress bar shown. If offline during init, skip with a warning — first commit will eat the cost instead.

---

## Config Schema

`.docguard.json`:

```json
{
  "docs": ["./docs/**/*.md"],
  "ignore": ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"],
  "severity": {
    "security":     "block",
    "architecture": "warn",
    "api-contract": "warn",
    "naming":       "warn",
    "style":        "warn"
  },
  "priority": {
    "./docs/architecture.md": "critical",
    "./docs/security.md":     "critical"
  },
  "llm": {
    "provider": "groq",
    "model": "llama-3.3-70b-versatile"
  },
  "retrieval": {
    "topK": 6,
    "minScore": 0.35
  },
  "timeoutMs": 5000
}
```

---

## LLM Response Schema (locked)

The semantic-engine prompt must require this exact JSON shape. Anything that doesn't parse → skip.

```json
{
  "violations": [
    {
      "file": "src/auth.ts",
      "line": 47,
      "category": "architecture",
      "confidence": "high",
      "doc_citation": {
        "chunk_id": "docs/architecture.md#repository-layer",
        "quote": "All DB access must go through the repository layer"
      },
      "message": "Direct db.query() call bypasses repository layer"
    }
  ]
}
```

Rules:
- `confidence: low` → force severity to `warn` regardless of config
- missing `doc_citation` or unknown `chunk_id` → force severity to `warn`
- `quote` not found as substring inside the referenced chunk → force severity to `warn` (hallucination guard)
- `confidence: high` + valid citation → use configured severity
- `file`/`line` in final output are computed from chunk metadata, never from the model

---

## CLI Output

```
git commit -m "add user endpoint"

DocGuard checking 3 changed files...

BLOCK  src/auth.ts:47  [architecture]
  Direct db.query() call bypasses repository layer.
  Cited: docs/architecture.md:23
    "All DB access must go through the repository layer"

WARN   src/userController.ts:12  [naming]
  Function 'getData' does not match documented convention.
  Cited: docs/architecture.md:45
    "Use verb + Resource format (e.g. getUser, createOrder)"

PASS   src/routes.ts

Commit blocked. 1 error, 1 warning.
Bypass: git commit --no-verify  or  DOCGUARD_BYPASS=1 git commit
```

---

## First-Run UX (`docguard init`)

1. Detects Husky; uses it if present, otherwise writes `.git/hooks/pre-commit` directly.
2. Writes `.docguard.json` with sensible defaults.
3. Asks one question: "Path to your docs folder?" (default `./docs`).
4. Does **not** ask for an API key. Prints: `Set GROQ_API_KEY in your shell to enable semantic checks. Get a free key at console.groq.com.`
5. Prints one example pass and one example block so the user knows what to expect.
6. Adds `.docguard/cache/` and `.docguard/bypass.log` to `.gitignore`.

---

## Tech Stack

| Concern             | Choice                          |
|---------------------|---------------------------------|
| Language            | TypeScript                      |
| CLI                 | Commander.js                    |
| Git                 | simple-git                      |
| Markdown parsing    | remark + remark-parse           |
| Embeddings (local)  | @xenova/transformers (all-MiniLM-L6-v2) |
| Vector search       | in-memory cosine (no DB in v1)  |
| LLM client          | groq-sdk                        |
| Hook install        | direct `.git/hooks` writer + Husky detection |
| Schema validation   | zod                             |
| Testing             | vitest                          |

---

## Open Risks (acknowledge, don't solve in v1)

- **LLM cost/latency drift** — Groq free tier limits could throttle; fallback adapter is the long-term fix.
- **Doc rot** — if docs are wrong, DocGuard enforces wrong rules. Out of scope; user problem.
- **Large diffs** — a 2000-line refactor will blow retrieval relevance. v1: warn and process first N hunks, document the limit.
- **Monorepos** — v1 expects one config at repo root. Document as a known limitation.
- **Binary/lockfile changes** — skip non-text files entirely.

---

## v1 Success Criteria

- `npx docguard init` works on a fresh repo in under 30 seconds
- pre-commit check on a typical diff completes in under 3 seconds (5s hard cap)
- zero false-positive *blocks* in the first week of dogfooding (warns are fine)
- every violation includes a clickable `file:line` for both the code and the cited doc
- uninstall is one command and leaves no residue
