# DocGuard V1 in 10 Phases

Phased build plan for DocGuard v1, aligned 1:1 with [SPEC.md](SPEC.md).

The v1 promise stays simple:

**Check staged code changes against project documentation before commit, then return pass, warn, or block — with mandatory doc citations and high-trust defaults.**

Each phase below lists what to build, why it matters, and a concrete "done when" gate. The build order matches the dependency graph — earlier phases unblock later ones.

---

## Phase 1: Project Scaffold and Tooling Foundation

### Goal
Stable npm + TypeScript foundation the rest of the package grows on.

### Build
- `package.json` with `engines.node: ">=18.17"` (decision 17) and a `files` whitelist (`dist/`, `templates/`, `README.md`, `LICENSE`)
- `tsconfig.json` (strict, ES2022, NodeNext)
- `src/` folder structure (already scaffolded)
- CLI bin entry wired in `package.json` → `dist/cli/index.js`
- `build` (tsc), `dev` (tsx watch), `test` (vitest) scripts
- vitest configured

### Done when
- `npm run build` succeeds
- `node dist/cli/index.js --help` runs
- `npm test` runs (empty suite is fine)

---

## Phase 2: CLI Commands and User Entry Flow

### Goal
Public command surface, even with stub handlers.

### Build
- Commander.js setup in `src/cli/index.ts`
- `docguard init` — stub
- `docguard check` — stub
- `docguard uninstall` — stub (success criteria: "uninstall is one command, no residue")
- `--help`, `--version` working
- Version stamp in output includes `PROMPT_VERSION` (decision 12) once it exists

### Done when
- all three commands execute without crashing
- help text is readable
- adding new commands needs no restructuring

---

## Phase 3: Config File System

### Goal
Repo-specific configuration loaded and validated safely.

### Build
- `templates/.docguard.json` matching the locked schema below
- `src/config/schema.ts` — zod schema
- `src/config/defaults.ts` — defaults merged into partial user config
- `src/config/load.ts` — read `.docguard.json` from repo root, validate, return typed config

### Locked Config Shape (from SPEC §Config Schema)
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

Notes (per SPEC):
- Severity is **per-category** (`security`/`architecture`/`api-contract`/`naming`/`style`) — never per-named-rule.
- Provider default is **Groq + Llama 3.3 70B**, not OpenAI.
- Root-level docs (`README.md`, `CHANGELOG.md`) **excluded by default** (decision 13).

### Done when
- `docguard check` loads + validates config
- invalid config prints a clear zod error
- missing optional fields are filled from defaults

---

## Phase 4: Git Integration and Staged Diff Reader

### Goal
Pull only what's about to be committed.

### Build
- `src/git/staged-files.ts` — list of staged paths via `simple-git`
- `src/git/staged-diff.ts` — diff hunks per file, with ~5 lines of surrounding context (decision 7)
- ignore-glob filtering (from config)
- skip binary files and lockfiles
- skip removed-only changes

### Done when
- `docguard check` (debug mode) prints staged files + extracted hunks
- ignored / binary files are skipped
- large diffs degrade gracefully: process first N hunks, warn "diff truncated for retrieval"

---

## Phase 5: Markdown Docs Loader and Chunker

### Goal
Parse configured markdown into retrieval-ready chunks with line metadata.

### Build
- `src/docs/load.ts` — resolve `docs` globs, read files
- `src/docs/parse-markdown.ts` — remark-based AST parse
- `src/docs/chunk.ts` — chunking per decision 14:
  - split by `#` / `##`
  - if chunk > 1500 chars → sub-split on `###`
  - if still too large → split on paragraph breaks
  - hard cap 2000 chars, truncate with `[...]` and log warning
  - each chunk carries `{ id, file, heading, lineStart, lineEnd, charCount, text }`
  - `id` format: `"<file>#<slugified-heading>"` (used later as `chunk_id` citation)

### Done when
- docs from config globs load successfully
- every chunk has full metadata + stable `id`
- oversized sections sub-split correctly
- works on common README/architecture markdown shapes

---

## Phase 6: Embeddings and Cache

### Goal
Local embeddings with disk cache. No second API dependency.

### Build
- `src/embeddings/embed.ts` — wrapper around `@xenova/transformers` (`all-MiniLM-L6-v2`)
- `src/embeddings/cache.ts` — JSON cache at `.docguard/cache/embeddings.json`
  - keyed by `{ chunkId, docFileSha, modelName }`
  - invalidate entries whose `docFileSha` changed
- pre-warm helper used by `docguard init` (decision 18)

### Done when
- chunks embed in a stable, deterministic way
- second run pulls from cache, no model call
- editing one doc only re-embeds that doc's chunks
- first run downloads model with a progress indicator

---

## Phase 7: Retrieval Layer

### Goal
Send the LLM only the top relevant chunks per diff.

### Build
- `src/retrieval/cosine.ts` — vector similarity
- `src/retrieval/path-boost.ts` — boost chunks whose source-doc path matches the changed file path heuristically (decision 8: changes in `src/auth/**` boost docs named/tagged auth/security)
- `src/retrieval/rank.ts` — combine cosine + path boost + config `priority` (critical/normal/low), return `topK` above `minScore`
- diff-hunk → query embedding (per hunk, then merge results per file)

### Done when
- each changed file maps to ≤ `topK` doc chunks
- unrelated docs are filtered out
- critical-priority docs surface first when relevant
- ranking is stable across runs (no flakiness)

---

## Phase 8: LLM Provider, Prompt, and Response Validator

### Goal
The semantic-checking core, with all hallucination guards in place.

### Build
- `src/llm/provider.ts` — minimal provider interface (`complete(messages, opts): Promise<string>`)
- `src/llm/groq.ts` — Groq SDK impl (default model from config)
- `src/llm/prompts/semantic.ts` — exports `PROMPT_VERSION` constant (decision 12) and `buildSemanticPrompt(chunks, hunks)`
- `src/rules/semantic/run.ts` — orchestrates: build prompt → call provider → validate response
- `src/rules/semantic/validate-response.ts` — zod schema + guard rules below
- 5-second hard timeout (decision 5) — on timeout, return empty violations + "skipped (timeout)" note, never block

### Locked Response Schema (from SPEC §LLM Response Schema)
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

### Mandatory Guardrails (decision 15 + 3)
- Model returns `chunk_id`, **never** invents file/line for the citation
- DocGuard computes the citation's `file` and `lineStart` from chunk metadata
- `quote` must be a substring of the chunk text — otherwise downgrade to `warn`
- Missing or unknown `chunk_id` → downgrade to `warn`
- `confidence: "low"` → downgrade to `warn`
- Malformed JSON → skip semantic check, pass (decision 9)

### Done when
- semantic findings are returned in the locked structured shape
- the model only sees retrieved top chunks, never full docs
- all four downgrade rules above fire correctly under tests
- a missing `GROQ_API_KEY` makes the run warn once and skip semantic (decision 9), never crashes

---

## Phase 9: Grading, Reporter, and Bypass

### Goal
Turn raw findings into trustworthy CLI output.

### Build
- `src/grading/apply-severity.ts` — applies SPEC §LLM Response Rules (downgrades + config severity lookup)
- `src/report/format.ts` — formats findings into the locked CLI layout (SPEC §CLI Output)
- `src/report/print.ts` — colored terminal output + final summary line + exit code
- `src/bypass/env.ts` — reads `DOCGUARD_BYPASS=1`, short-circuits with visible message
- `src/bypass/log.ts` — appends to `.docguard/bypass.log` (`timestamp, commitSha, reason`) — local only, no network (decision 11)

### Output Must Include
- file:line for offending code (computed from diff)
- category + severity
- cited doc `file:line` (computed from chunk metadata, never model-supplied) + quoted excerpt
- one-line message
- final status banner: `PASS` / `WARN` / `BLOCK` with counts
- bypass hint line when blocked

### Done when
- output matches SPEC §CLI Output exactly
- exit code: `0` on pass/warn, `1` on block (unless bypassed)
- bypass via `--no-verify` or env var produces a logged, visible message
- deterministic findings default to configured severity; semantic findings flow through grading first

---

## Phase 10: Hook Installation, Uninstall, Pre-warm, and Hardening

### Goal
Real-repo usability and v1 publish-readiness.

### Build
- `src/git/install-hook.ts`
  - detects Husky; uses it if present, else writes `.git/hooks/pre-commit` directly
  - hook content: `#!/usr/bin/env sh\nexec npx --no-install docguard check`
  - **LF line endings, no BOM** (decision 16) — enforced in writer + verified by a test
  - best-effort `chmod +x` on POSIX, no-op on Windows
- `src/git/uninstall-hook.ts` — removes hook, deletes `.docguard/`, leaves `.docguard.json` alone unless `--purge`
- `docguard init` flow:
  - Node version check (≥18.17) — refuses with clear message otherwise (decision 17)
  - one prompt: "Path to your docs folder?" (default `./docs`)
  - writes `.docguard.json` from template
  - installs hook
  - pre-warms MiniLM model (decision 18) with progress bar; on offline, warn + skip
  - **does not** ask for API key — prints: `Set GROQ_API_KEY to enable semantic checks. Free key at console.groq.com.`
  - appends `.docguard/cache/` and `.docguard/bypass.log` to `.gitignore`
  - prints one pass example and one block example

### Test Coverage
- config load: valid, invalid, partial
- staged diff: text / binary / removed-only / ignored
- markdown chunking: small / oversized / deeply-nested headings
- embedding cache: hit / miss / invalidation on file change
- retrieval: ranking + path boost + priority
- semantic: schema-valid, missing citation, hallucinated quote, low confidence, timeout, missing key
- grading: every downgrade rule
- reporter: pass / warn / block / bypassed
- hook installer: fresh repo, existing Husky, LF endings preserved (read raw bytes)
- end-to-end: fixture repo with fixture docs → fake diff → assert exit code + output

### Cross-platform CI
- Run smoke tests on both Ubuntu and Windows GitHub runners. Hook must execute on both before any tag.

### Done when
- a fresh sample repo can run `npx docguard init` → make a commit → see real output
- pre-commit flow works on Windows (Git Bash), macOS, Linux
- `docguard uninstall` removes hook + cache, leaves no residue
- README explains install, BYOK setup, bypass, and uninstall

---

## Build Order Summary

1. Scaffold (Phase 1)
2. CLI surface (Phase 2)
3. Config + zod (Phase 3)
4. Staged diff reader (Phase 4)
5. Docs loader + chunker (Phase 5)
6. **Embeddings + cache** (Phase 6) — dedicated phase, not a footnote
7. Retrieval (Phase 7)
8. LLM provider + prompt + validator (Phase 8) — the trust-critical phase
9. Grading + reporter + bypass (Phase 9)
10. Hook install + uninstall + pre-warm + hardening (Phase 10)

Deterministic rule engine is **stubbed in v1**, real implementation deferred to v1.1 (per SPEC §v1 Scope). The folder exists at `src/rules/deterministic/` so v1.1 can add files without restructuring.

---

## Explicitly Out of v1 (mirror of SPEC §v1 Scope — Out)

- pre-push hook
- multi-agent orchestration
- auto-fix suggestions
- VS Code / IDE extensions
- web dashboards or telemetry
- non-markdown docs (PDF, Word, RST, Notion, Confluence)
- custom rule DSL / user-authored named rules
- per-team config inheritance
- monorepo multi-config support
- real deterministic AST rules (deferred to v1.1)

V1 wins by being small, trustworthy, and fast.

---

## v1 Success Criteria (mirror of SPEC §v1 Success Criteria)

A developer can:

1. `npx docguard init` on a fresh repo in under 30 seconds
2. commit code normally
3. get a pre-commit result in under 3 seconds (5s hard cap)
4. see every violation with both `code file:line` and a cited `doc file:line` + quoted excerpt
5. trust the tool — zero false-positive **blocks** in week-one dogfooding (warns are fine)
6. `docguard uninstall` cleanly with no residue
