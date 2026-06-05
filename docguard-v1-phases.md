# DocGuard V1 in 10 Sub-Phases

This document breaks the full V1 build into 10 practical sub-phases.

The goal is to help us build a small, usable first version of DocGuard without overengineering it.

DocGuard V1 should remain:

- focused
- explainable
- installable as an npm package
- useful from the first real commit check

The core V1 promise is simple:

**Check staged code changes against project documentation before commit, then return pass, warn, or block.**

---

## Phase 1: Project Scaffold and Tooling Foundation

### Goal

Create the base npm package and TypeScript CLI structure so the project can grow cleanly.

### What We Build

- `package.json`
- `tsconfig.json`
- `src/` folder structure
- CLI entrypoint
- build scripts
- dev scripts
- lint and test placeholders if needed

### Why This Phase Matters

Without a good scaffold, later phases become messy. This phase gives us a stable foundation for commands, modules, and future publishing.

### Main Deliverables

- npm package initialized
- TypeScript configured
- CLI executable wired
- basic folder structure created

### Suggested Output

- `docguard` command can run locally
- `npm run build` succeeds

### Done When

- the package builds
- the CLI entrypoint exists
- future commands can be added without restructuring

---

## Phase 2: CLI Commands and User Entry Flow

### Goal

Create the first user-facing commands and establish the command flow for the package.

### What We Build

- `docguard init`
- `docguard check`
- command parsing with Commander
- clean help text
- version output

### Why This Phase Matters

This is the public face of the product. Even if internal logic is incomplete, users should be able to understand how the tool is meant to work.

### Main Deliverables

- CLI command registration
- argument parsing
- basic command handlers
- helpful terminal usage output

### Suggested Output

- `npx docguard init`
- `npx docguard check`
- `npx docguard --help`

### Done When

- both commands execute without crashing
- help output is readable
- command architecture supports adding more commands later

---

## Phase 3: Config File System

### Goal

Create the config format DocGuard will use and validate it safely.

### What We Build

- default config template
- config loader
- config validator with Zod
- config types

### Recommended V1 Config Shape

```json
{
  "docs": ["./docs/architecture.md", "./docs/api-rules.md"],
  "ignore": ["**/*.test.ts", "**/*.spec.ts"],
  "severity": {
    "direct-db-access": "block",
    "naming-convention": "warn",
    "bypass-service-layer": "block"
  },
  "llm": {
    "provider": "openai",
    "model": "gpt-4.1-mini"
  }
}
```

### Why This Phase Matters

The config file is how the package becomes repo-specific. Without it, DocGuard cannot know which docs matter or which issues should block.

### Main Deliverables

- `.docguard.json` template
- validation errors with good messages
- defaults for missing optional fields

### Done When

- `docguard check` can load config
- invalid config shows clear error output
- the config can drive later phases

---

## Phase 4: Git Integration and Staged Diff Reader

### Goal

Read only the code that is about to be committed.

### What We Build

- staged file reader
- staged diff reader
- changed hunk extraction
- filtering ignored files

### Why This Phase Matters

V1 should inspect staged changes only, not the entire repository. That makes the tool faster, more relevant, and less noisy.

### Main Deliverables

- list of staged files
- diff content for each staged file
- line-level or hunk-level change data

### Design Notes

The git layer should answer:

- what files changed
- what type of files changed
- what new code was added
- what hunks need inspection

### Done When

- `docguard check` can print staged files and diff hunks
- ignored files are skipped correctly

---

## Phase 5: Markdown Docs Loader and Section Parser

### Goal

Read project docs and split them into meaningful sections with references.

### What We Build

- markdown file loader
- heading-based section parser
- line tracking if possible
- metadata extraction per section

### Metadata to Capture

- doc file path
- section heading
- section content
- line start
- line end
- optional tags or inferred category

### Why This Phase Matters

DocGuard must cite the docs clearly. If it cannot point to the exact file and section, users will not trust the output.

### Main Deliverables

- parsed doc sections
- references attached to each section
- support for multiple markdown files

### Done When

- docs can be loaded from config paths
- each section has usable metadata
- the parser works on common markdown layouts

---

## Phase 6: Lightweight Retrieval Layer

### Goal

Find only the most relevant doc sections for a given code change.

### What We Build

- document chunk ranking
- diff-to-doc matching
- top-N relevant chunk retrieval
- optional critical-doc prioritization

### How V1 Retrieval Should Work

1. Load all configured docs
2. Split docs into sections
3. Attach metadata
4. Rank sections against changed file path, diff text, and keywords
5. Return the top few relevant sections only

### Why This Phase Matters

If we send all docs to the model every time, the tool becomes noisy, slow, and expensive. Retrieval is the piece that makes semantic checking practical.

### V1 Retrieval Strategy

Keep this simple:

- keyword overlap
- file path hints
- rule category hints
- boost critical docs if configured

Embeddings can come later if needed.

### Done When

- each changed file can be mapped to a small set of relevant doc chunks
- unrelated docs are filtered out

---

## Phase 7: Deterministic Rule Engine

### Goal

Add fast, explainable checks that do not require an LLM.

### What We Build

- rule runner
- a few built-in V1 checks
- severity mapping
- finding objects with citations

### Good V1 Rule Examples

- banned imports
- direct DB access pattern
- bypassed service layer pattern
- naming convention checks

### Why This Phase Matters

Deterministic rules are reliable and cheap. They make the first version feel less random and reduce dependence on the semantic layer.

### Main Deliverables

- deterministic findings format
- pass or finding generation
- warning and blocking severities

### Done When

- at least a small set of hard checks works
- findings are tied to files and doc references where possible

---

## Phase 8: Semantic Checker with Controlled Prompting

### Goal

Use an LLM to detect higher-level doc violations that deterministic rules cannot catch.

### What We Build

- prompt builder
- relevant doc chunk packaging
- diff packaging
- model call abstraction
- structured response parsing

### What the Model Should Judge

- does the changed code conflict with documented architecture
- does it bypass a required layer
- does it violate a workflow or boundary described in docs
- how confident is the judgment

### Why This Phase Matters

This is the part that makes DocGuard truly documentation-aware instead of just another lint wrapper.

### Important V1 Guardrails

- do not send entire docs
- require doc citation in the model output
- use warnings when confidence is low
- block only on stronger evidence

### Done When

- semantic findings are returned in a structured format
- the model only sees top relevant chunks
- uncertainty is reflected in severity

---

## Phase 9: Result Scoring, CLI Reporting, and Bypass Handling

### Goal

Turn raw findings into a trustworthy user experience.

### What We Build

- pass, warn, block result aggregator
- terminal formatter
- human-readable explanations
- bypass detection and messaging

### Output Should Include

- file name
- possible line or hunk
- violated rule or concern
- doc file reference
- section reference
- recommended next step
- final commit status

### Bypass Support for V1

- standard `git commit --no-verify`
- optional `DOCGUARD_BYPASS=1`
- visible message when bypass is used

### Why This Phase Matters

The product lives or dies on trust. If the output is vague, people will ignore it. If the output is precise and understandable, they will rely on it.

### Done When

- findings are easy to read
- final status is unambiguous
- bypass behavior is intentional and visible

---

## Phase 10: Hook Installation, Testing, and V1 Hardening

### Goal

Make the package usable in a real repo and reliable enough to publish as a first version.

### What We Build

- `pre-commit` hook installer
- end-to-end command wiring
- smoke tests
- fixture docs and fixture diffs
- README usage instructions

### Test Coverage to Add

- config load success and failure
- staged diff reading
- markdown parsing
- retrieval relevance
- deterministic rule findings
- semantic engine response parsing
- reporter output
- hook install flow

### Why This Phase Matters

A product idea becomes a package only when setup, execution, and failure modes all work in a real project environment.

### Main Deliverables

- `docguard init` installs hook
- `docguard check` runs end to end
- docs explain setup and usage
- v1 ready for local testing and npm packaging

### Done When

- a sample repo can install and run DocGuard
- the pre-commit flow works
- README explains the real workflow clearly

---

## Recommended Build Order Summary

Build in this order:

1. scaffold package
2. build CLI commands
3. add config system
4. add staged diff reader
5. add markdown docs parser
6. add retrieval layer
7. add deterministic checks
8. add semantic checker
9. add result reporter and bypass logic
10. wire hooks, test, and harden

---

## What We Should Not Add in V1

To keep V1 realistic, avoid adding:

- multi-agent orchestration
- support for PDFs or Word docs
- deep multi-language AST coverage
- cloud dashboards
- organization admin features
- full repository continuous scanning
- too many built-in rules

V1 wins by being small, useful, and trustworthy.

---

## Success Criteria for the Full V1

V1 is successful if a developer can:

1. install the package quickly
2. run `docguard init`
3. point the tool to markdown docs
4. commit code normally
5. get meaningful pass, warn, or block results
6. understand exactly why a finding happened
7. trust the tool enough to keep it in the workflow

That is the real target for the first release.
