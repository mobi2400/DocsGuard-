# DocGuard

Documentation-aware code guard for AI-assisted development.

DocGuard checks staged code changes against your project's Markdown docs before commit. It retrieves the most relevant doc sections for the diff, asks an LLM whether the change violates documented intent, and returns a clear `pass`, `warn`, or `block` result with citations.

This package is designed for teams using AI coding tools who want repo-specific guardrails, not just generic linting.

## Why DocGuard

AI-generated code often looks correct while quietly violating project rules such as:

- architecture boundaries
- security expectations
- API contracts
- naming conventions
- documented team decisions

DocGuard turns those docs into a pre-commit safety check.

## What It Does

- Reads staged Git diffs only, not the whole repository
- Loads Markdown docs from paths configured in `.docguard.json`
- Splits docs into section-based chunks with file and line references
- Uses local embeddings to retrieve the most relevant doc sections
- Sends only relevant chunks plus the diff to the LLM
- Reports `pass`, `warn`, or `block`
- Adds a Git `pre-commit` hook automatically
- Supports uninstall and local cache cleanup

## Current V0.1 Scope

DocGuard `0.1.0` is intentionally narrow:

- Markdown docs only
- semantic checking through Groq
- retrieval-backed doc selection
- pre-commit integration
- configurable severity by category

It does **not** yet provide deep deterministic AST rules such as import enforcement or service-layer static analysis. The current release is optimized around semantic doc-vs-diff review.

## Installation

```bash
npm install -D @mobasshirkhan/docguard
```

Node.js `18.17+` is required.

## Quick Start

1. Install the package.

```bash
npm install -D @mobasshirkhan/docguard
```

2. Initialize DocGuard in your repository.

```bash
npx docguard init
```

This will:

- create `.docguard.json` if it does not exist
- install a `pre-commit` hook into `.git/hooks` or `.husky/pre-commit`
- add DocGuard cache entries to `.gitignore`
- pre-warm the local embedding model

3. Set your Groq API key.

```bash
# macOS / Linux
export GROQ_API_KEY=your_key_here

# Windows PowerShell
$env:GROQ_API_KEY="your_key_here"
```

4. Commit as usual.

```bash
git add .
git commit -m "add auth flow"
```

You can also run checks manually:

```bash
npx docguard check
```

## Example Output

```text
BLOCK src/auth.ts:47  [security]
  Direct auth flow bypass detected in staged changes.
  Cited: docs/architecture.md:23
    "Authentication must be enforced through middleware."

WARN  src/controllers/user.ts:12  [naming]
  The change appears to conflict with documented naming rules.
  Cited: docs/conventions.md:45
    "Use verb + resource naming for handlers."

Summary: 1 error(s), 1 warning(s).
Commit blocked. Bypass: git commit --no-verify  or  DOCGUARD_BYPASS=1 git commit
```

## Commands

### `docguard init`

Creates `.docguard.json`, installs the pre-commit hook, updates `.gitignore`, and pre-warms the embedding model.

```bash
npx docguard init
```

### `docguard check`

Checks staged changes against configured docs.

```bash
npx docguard check
```

Optional config path:

```bash
npx docguard check --config ./my-docguard.json
```

### `docguard uninstall`

Removes the managed hook and deletes DocGuard cache. Use `--purge` to also remove `.docguard.json`.

```bash
npx docguard uninstall
npx docguard uninstall --purge
```

### Global Option

Run commands as if started from another directory:

```bash
npx docguard --cwd /path/to/repo check
```

## Configuration

DocGuard uses a `.docguard.json` file in the project root.

Default template:

```json
{
  "docs": ["./docs/**/*.md"],
  "ignore": ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"],
  "severity": {
    "security": "block",
    "architecture": "warn",
    "api-contract": "warn",
    "naming": "warn",
    "style": "warn"
  },
  "priority": {},
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

### Config Fields

- `docs`: Glob patterns for Markdown docs to load.
- `ignore`: File globs to ignore from staged changes.
- `severity`: Severity mapping by finding category.
- `priority`: Optional per-doc priority map. Values: `critical`, `normal`, `low`.
- `llm.provider`: Currently `groq`.
- `llm.model`: Groq model name.
- `retrieval.topK`: Number of top doc chunks to send to the semantic checker.
- `retrieval.minScore`: Minimum retrieval score.
- `timeoutMs`: Semantic check timeout in milliseconds.

### Supported Categories

- `security`
- `architecture`
- `api-contract`
- `naming`
- `style`

### Severity Values

- `pass`
- `warn`
- `block`

## How It Works

At commit time, DocGuard runs this pipeline:

1. Read `.docguard.json`
2. Read staged files and staged hunks from Git
3. Load matching Markdown docs
4. Split docs into heading-based chunks with line references
5. Embed and rank the chunks against the diff
6. Send only the most relevant chunks to the LLM
7. Parse findings and apply configured severity
8. Print a readable report and block only when needed

## Retrieval Model and Caching

DocGuard uses a local embedding model to rank documentation chunks before the semantic LLM call.

- the embedding model is pre-warmed during `docguard init`
- first-time setup may download about `25MB`
- cache files are stored under `.docguard/cache/`

This keeps prompts smaller, cheaper, and more relevant than sending all docs every time.

## Bypass Options

DocGuard supports intentional bypasses when you need them.

Standard Git bypass:

```bash
git commit --no-verify
```

Environment-variable bypass:

```bash
# macOS / Linux
DOCGUARD_BYPASS=1 git commit -m "hotfix"

# Windows PowerShell
$env:DOCGUARD_BYPASS="1"; git commit -m "hotfix"
```

When `DOCGUARD_BYPASS` is used, DocGuard logs the bypass to `.docguard/bypass.log`.

## Behavior When `GROQ_API_KEY` Is Missing

If `GROQ_API_KEY` is not set, DocGuard skips the semantic check and prints a note instead of failing the commit.

That means the package is installed correctly, but semantic enforcement is effectively disabled until the key is provided.

## Recommended Repo Layout

```text
your-project/
├─ docs/
│  ├─ architecture.md
│  ├─ api-rules.md
│  └─ security.md
├─ src/
├─ .docguard.json
└─ package.json
```

## Best Results

DocGuard works best when your docs are:

- specific
- opinionated
- structured by topic
- written in Markdown with clear headings

Good examples:

- "All DB access must go through repositories."
- "Auth logic must live in middleware."
- "Public API responses must not expose internal DTOs."

Weak docs produce weak checks, so clear documentation matters.

## Limitations

Current release limitations:

- Markdown docs only
- Groq is the only supported LLM provider
- semantic checking depends on doc quality
- no language-specific AST enforcement yet
- checks run on staged changes only

## Development

```bash
npm install
npm run build
npm test
```

Useful scripts:

- `npm run build`
- `npm run dev`
- `npm run typecheck`
- `npm test`
- `npm run test:watch`

## License

MIT
