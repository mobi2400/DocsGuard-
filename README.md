# DocGuard

> **Early beta — expect rough edges.** Documentation-aware pre-commit guard for AI-assisted development.

DocGuard reads your project's markdown docs, looks at staged code changes, and blocks commits that contradict the rules you've written down. It is not a linter. It enforces *your* project's documented intent.

```
BLOCK src/userController.ts:5  [architecture]
  Direct db.query() call from controller
  Cited: docs/architecture.md:23
    "All DB access must go through the repository layer"

Summary: 1 error(s), 0 warning(s).
Commit blocked. Bypass: git commit --no-verify  or  DOCGUARD_BYPASS=1 git commit
```

---

## Install

```bash
npm install --save-dev @mobasshirkhan/docguard
npx docguard init
```

`docguard init` will:

- write `.docguard.json`
- install a `pre-commit` hook (Husky-aware, falls back to `.git/hooks/`)
- update `.gitignore`
- pre-warm the local embedding model (~25 MB one-time download)

You also need a Groq API key (free tier works). Three ways to set it:

**`.env` file in your project root (easiest):**
```
GROQ_API_KEY=gsk_...
```
DocGuard reads `.env` from the repo root automatically. Existing shell env vars are not overridden.

**Or shell session:**
```bash
export GROQ_API_KEY=gsk_...
```

**Or system-wide (Windows):**
```powershell
setx GROQ_API_KEY "gsk_..."
```

Get a key at [console.groq.com](https://console.groq.com). Without one, DocGuard skips semantic checks and lets commits through.

## Requirements

- Node `>= 18.17`
- Disk: `@xenova/transformers` adds ~70 MB to `node_modules` (local embeddings, no per-commit API cost)

## Usage

The hook runs automatically on every `git commit`. To run manually:

```bash
docguard check
```

Bypass:

```bash
git commit --no-verify          # standard git escape hatch
DOCGUARD_BYPASS=1 git commit    # explicit, logged to .docguard/bypass.log
```

Uninstall:

```bash
docguard uninstall              # removes hook + cache
docguard uninstall --purge      # also removes .docguard.json
```

## Configuration

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
    "./docs/architecture.md": "critical"
  },
  "llm": {
    "provider": "groq",
    "model": "llama-3.3-70b-versatile"
  },
  "retrieval": {
    "topK": 6,
    "minScore": 0.15
  },
  "timeoutMs": 5000
}
```

- **severity** — per-category, never per-named-rule. Categories are fixed: `security`, `architecture`, `api-contract`, `naming`, `style`.
- **priority** — boost retrieval ranking for critical docs.
- **timeoutMs** — hard cap on the semantic check. On timeout, commit is allowed.

## How it works

1. Reads staged hunks via `git diff --cached`.
2. Splits configured markdown into ≤1500-char chunks by heading.
3. Embeds chunks locally with MiniLM (`@xenova/transformers`), cached to `.docguard/cache/`.
4. Ranks chunks against the diff by cosine + path overlap + priority.
5. Sends only the top-relevant chunks plus the diff to Groq for judgment.
6. Validates the response: every violation must cite a `chunk_id` with a quote that is a real substring of the chunk. Otherwise it's downgraded to a warning.

## Trust guarantees

- **No telemetry.** Nothing leaves your machine except the redacted diff + relevant doc chunks going to Groq for the semantic check.
- **Citation-or-downgrade.** Every blocking violation must reference a real chunk and quote real text. Hallucinated citations are auto-downgraded to warn.
- **DocGuard never blocks on its own bugs.** Internal errors fail open (commit proceeds, error logged).
- **Bypass is local, visible, and logged.**

## Project docs

- [SPEC.md](SPEC.md) — locked v1 build spec
- [docguard-v1-phases.md](docguard-v1-phases.md) — phased build plan
- [docs/explainer.md](docs/explainer.md) — long-form intro

## License

MIT
