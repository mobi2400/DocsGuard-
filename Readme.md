# DocGuard V1 Explained in Simple Terms

## 1. What Problem Are We Solving?

When developers use AI tools to write code, the AI often creates code that *looks correct* but does not follow the project's own rules.

Those rules are usually written in documents such as:

- architecture notes
- API rules
- coding standards
- security guidelines
- setup instructions
- team decisions written in Markdown files

The problem is:

Even when those documents exist, AI may still:

- ignore them
- misunderstand them
- do the opposite of what they say
- produce code that works at first but breaks later

This becomes dangerous when someone commits the code and pushes it to production without noticing the mismatch.

In simple words:

**The docs say one thing, the AI writes another thing, and the bad code slips into the repository.**

That is the gap we want to fix.

---

## 2. What Is DocGuard?

DocGuard is an npm package that acts like a safety checker between AI-written code and your Git repository.

It checks whether the code you are about to commit matches the documented rules of the project.

You can think of it like this:

- Git protects version history
- ESLint checks coding style
- Prettier formats code
- **DocGuard checks whether code follows the project's documented decisions**

So DocGuard is not just a coding tool.

It is a **documentation-aware code guard**.

---

## 3. The Main Idea in One Sentence

Before code is committed, DocGuard reads the changed code, reads the important project docs, compares both, and then decides whether to:

- allow the commit
- show a warning
- block the commit

---

## 4. Why This Matters

This problem is useful to solve because many teams now work like this:

1. They write docs explaining how the project should be built.
2. They use AI to move faster.
3. The AI writes code quickly.
4. Nobody fully checks whether the code matches the docs.
5. Problems appear later in testing or production.

This causes:

- broken features
- architecture violations
- security mistakes
- inconsistent coding patterns
- loss of trust in AI-generated code

DocGuard helps stop that early.

Instead of finding the problem after the code is merged, it catches the issue **before the commit is completed**.

---

## 5. Who Is This For?

DocGuard is useful for:

- solo developers using AI coding tools
- startup teams moving fast with AI assistance
- engineering teams with strong architecture rules
- teams that maintain docs but struggle to enforce them
- projects where wrong code can cause production issues

Even a non-developer can understand the purpose:

**DocGuard makes sure the code follows the team's written instructions before it becomes part of the project.**

---

## 6. How the Product Works in Real Life

Here is the full journey in everyday language.

### Step 1: The team writes project docs

These docs explain things like:

- how authentication should work
- how the database should be accessed
- how APIs should be called
- naming rules
- what should never be done directly

### Step 2: The developer installs DocGuard

The developer adds the package to the project and runs a setup command.

Example:

```bash
npx docguard init
```

This setup creates:

- a config file
- a Git hook that runs before commit

### Step 3: The developer uses AI to write code

They use Codex, Cursor, Claude, ChatGPT, or any AI coding tool.

The AI generates or edits code.

### Step 4: The developer stages the changes

This means they prepare the code to be committed to Git.

### Step 5: The developer tries to commit

Example:

```bash
git commit -m "add login flow"
```

### Step 6: DocGuard runs automatically

Before Git finishes the commit, DocGuard starts checking.

### Step 7: DocGuard reads two things

- the code that changed
- the project documentation

### Step 8: DocGuard compares them

It asks:

- does this code match the documented architecture?
- does this code break any written team rules?
- did the AI bypass an approved pattern?

### Step 9: DocGuard gives a result

It can say:

- `PASS` = everything looks aligned
- `WARN` = something is questionable, but not serious enough to stop the commit
- `BLOCK` = this breaks an important documented rule, so the commit should stop

### Step 10: The developer fixes issues if needed

If a serious problem is found, the developer corrects the code and tries the commit again.

### Step 11: The developer can bypass intentionally if absolutely needed

There are real situations where a developer may still want to continue even after a block.

For example:

- emergency production fix
- false positive from the checker
- temporary exception approved by the team

So DocGuard should support a controlled bypass option.

This is important because a safety tool should guide developers, not trap them.

---

---

## 7. Simple Example

Imagine the project's docs say:

> All database access must go through the repository layer.

But the AI writes code that directly talks to the database inside a controller file.

Without DocGuard:

- the developer may miss the mistake
- the code gets committed
- the architecture becomes inconsistent

With DocGuard:

- it detects the direct database access
- it points to the changed file and line
- it shows which documented rule was broken
- it blocks the commit if the rule is marked as critical

So the developer catches the mistake before it enters the codebase.

---

## 8. What V1 Means

V1 means the **first usable version** of the product.

It is not the final dream version.

It is the smallest version that is still useful in the real world.

The goal of V1 is:

**Build something simple, clear, and reliable enough that developers can install it and immediately get value from it.**

That means V1 should not try to solve every possible problem.

Instead, it should solve the core problem well:

**Check whether staged code changes match the project's written docs before commit.**

---

## 9. What We Are Building in V1

V1 will include the following features.

### 9.1 `docguard init`

This command will:

- create a default config file
- help the user point to their docs
- install a Git pre-commit hook

Why this matters:

It makes setup easy. A developer should be able to start using the tool quickly.

### 9.2 `docguard check`

This command will:

- read the current staged changes
- read the documentation files
- compare the changed code against the docs
- show a final result

Why this matters:

It gives developers a manual command they can run any time, even outside Git hooks.

### 9.3 Markdown docs support

V1 will support documentation written in Markdown files such as:

- `README.md`
- `docs/architecture.md`
- `docs/api-rules.md`

Why this matters:

Markdown is the most common format for technical project docs.

### 9.4 Git staged diff checking

V1 will check only what is being committed right now.

It will not scan the entire project on every run.

Why this matters:

- faster checks
- less noise
- more relevant results

### 9.5 Three result levels

V1 will support:

- `pass`
- `warn`
- `block`

Why this matters:

Not every mismatch should stop a developer. Some issues are suggestions, others are serious.

### 9.6 Clear output with doc references

When there is a problem, V1 should show:

- file name
- changed area
- violated rule
- which documentation file mentions that rule
- if possible, the line or section reference

Why this matters:

The user must understand *why* the tool flagged the code. If the output feels random, nobody will trust it.

### 9.7 Basic semantic checking with AI

V1 will include a simple AI-powered check that compares:

- the changed code
- the relevant doc content

This part handles cases that are harder than simple pattern matching.

Why this matters:

Some project rules are not just syntax rules. They are architecture or intent rules.

Example:

- "Always go through the service layer"
- "Auth logic must stay inside middleware"
- "Never expose internal data shapes directly from API responses"

These are harder to catch with simple regex alone.

### 9.8 Bypass support for intentional overrides

V1 should allow the user to bypass a block when they knowingly want to proceed.

Examples:

- `git commit --no-verify`
- an environment variable such as `DOCGUARD_BYPASS=1`
- a future explicit command such as `docguard check --bypass`

Why this matters:

- real teams sometimes need emergency flexibility
- no automated tool is perfect
- users will trust the product more if it is strict but not controlling

Important note:

Bypass should exist, but it should be visible and intentional. It should never happen silently.

---

## 10. What We Are Not Building in V1

To keep the first version realistic, we will intentionally leave some things out.

V1 will not try to:

- support every programming language deeply
- build a full enterprise policy engine
- understand every document type like PDFs and Word docs
- give perfect architecture analysis in all cases
- scan the full repository continuously
- replace linting tools like ESLint
- guarantee 100% correctness

This is important.

A strong V1 is not the one that promises everything.

A strong V1 is the one that solves one real problem clearly and reliably.

---

## 11. The V1 Stack and Why We Chose It

We will use a practical stack that fits npm package development and command-line tools.

### Node.js

Why:

- this is an npm package
- Node.js is the natural runtime
- easy Git and file system access

### TypeScript

Why:

- makes the package easier to maintain
- helps avoid bugs while building
- good for scaling later

### Commander.js

Why:

- easy way to build CLI commands like `init` and `check`

### Zod

Why:

- validates the config file safely
- reduces setup mistakes

### fast-glob

Why:

- helps find docs and ignored files quickly

### Git diff reader

Either:

- direct Git commands
- or a small helper like `simple-git`

Why:

- we need to read staged changes

### Markdown parser

Why:

- V1 focuses on Markdown docs
- we need to split docs into sections and keep references

### Colors for CLI output

Example:

- `picocolors`

Why:

- makes warnings and blocked issues easy to read

### Optional LLM provider integration

Examples:

- OpenAI
- Groq
- Anthropic later

Why:

- needed for semantic judgment where hard-coded rules are not enough

---

## 12. The V1 Architecture in Plain English

The package will have a few simple internal parts.

### 12.1 CLI Layer

This is the front door.

It handles commands like:

- `docguard init`
- `docguard check`

### 12.2 Config Loader

This reads the configuration file and checks if it is valid.

Example things it reads:

- where the docs are
- what files to ignore
- what severity each rule should have

### 12.3 Git Diff Reader

This gets the code that is currently staged for commit.

It focuses only on the changed lines.

### 12.4 Docs Loader

This opens the Markdown files and breaks them into smaller useful pieces.

For example:

- Authentication Rules
- API Access Rules
- Naming Conventions
- Database Layer Rules

### 12.5 Rule Engine

This is the checker.

It looks at the changed code and asks:

- does this break any obvious documented rule?
- does this seem to violate the meaning of the docs?

### 12.6 Semantic Checker

This is the AI-assisted part.

It sends the relevant doc chunks and code diff to a model and asks for a judgment.

### 12.7 Result Reporter

This prints the final output in a clear human-readable form.

### 12.8 Git Hook Installer

This wires DocGuard into Git so the checks run automatically before commit.

---

## 13. The Full V1 Flow in Order

Here is the exact flow from start to finish in simple language.

### Setup Flow

1. The user installs the package.
2. The user runs `docguard init`.
3. DocGuard creates a config file.
4. DocGuard installs a pre-commit Git hook.
5. The user adds doc file paths in the config.

### Daily Usage Flow

1. The user writes or updates code, often with help from AI.
2. The user stages the changed files.
3. The user runs `git commit`.
4. The Git hook starts DocGuard automatically.
5. DocGuard reads the config.
6. DocGuard reads the staged diff.
7. DocGuard reads the selected documentation files.
8. DocGuard splits the docs into smaller sections.
9. DocGuard matches the changed code with relevant doc sections.
10. DocGuard runs rule checks.
11. DocGuard decides whether the result is pass, warn, or block.
12. DocGuard shows the result.
13. If blocked, the commit stops.
14. If warnings only, the commit continues.

---

## 14. How the Tool Makes Decisions

DocGuard will make decisions using three practical ideas.

### Pass

Use this when:

- no rule violation is found
- the code appears aligned with the docs

### Warn

Use this when:

- something seems questionable
- the mismatch is not severe
- confidence is not high enough to block

### Block

Use this when:

- a critical documented rule is broken
- the mismatch is clear
- the issue can cause real architecture or behavior problems

This matters because developers need trust.

If the tool blocks too aggressively, people will get annoyed and bypass it.

If it is too weak, it becomes useless.

So V1 should be careful and practical.

### Intentional bypass behavior

If the user chooses to bypass a block, DocGuard should:

- clearly show that a bypass happened
- explain what issue was bypassed
- avoid pretending that the code passed normally

In simple words:

**The tool can allow an override, but it should record that the warning was real.**

---

## 15. What Gains We Get in V1

V1 already gives strong value, even before advanced features.

### 15.1 Safer commits

The biggest gain is that bad AI-generated code is caught earlier.

Instead of discovering problems after merge or production, the team catches them before commit.

### 15.2 Better doc enforcement

Many teams write docs, but the docs are not actually enforced.

V1 turns docs from passive writing into active project rules.

### 15.3 More trust in AI-assisted coding

Developers can move fast with AI while having a safety layer.

This makes AI more usable in serious projects.

### 15.4 Reduced architectural drift

Projects slowly become messy when developers and AI ignore existing patterns.

V1 helps keep the codebase aligned with agreed design decisions.

### 15.5 Faster reviews

If obvious documentation mismatches are caught before commit, reviewers spend less time pointing out preventable issues.

### 15.6 Better onboarding

New team members may not know all the project rules.

DocGuard helps guide them automatically.

### 15.7 Useful product validation

From a product-building point of view, V1 gives something very important:

It lets us test whether developers actually want this and how they use it.

That feedback is more valuable than overbuilding too early.

### 15.8 Better balance between safety and speed

Bypass support gives an important practical gain:

- teams stay protected most of the time
- developers still have an escape hatch when speed matters more

This makes the product more realistic for real-world use instead of being too rigid.

---

## 16. Why V1 Should Stay Small

It is tempting to build:

- full AST analysis
- multi-language support
- deep policy engine
- advanced retrieval
- cloud dashboard
- analytics
- team admin controls

But doing all that too early can slow the project down and make it harder to ship.

The smarter path is:

1. ship a focused V1
2. get real developer feedback
3. learn what rules are most useful
4. improve precision
5. expand only after we know what users need most

---

## 17. Risks We Should Be Honest About

A good product doc should also be honest about the challenges.

### 17.1 AI can still be wrong

If the semantic checker is too loose or too aggressive, it may misjudge code.

That is why V1 should:

- keep outputs explainable
- show doc references
- use warnings often before blocking
- block only on stronger confidence

### 17.2 Bad docs produce bad checks

If project docs are vague, outdated, or contradictory, the tool cannot magically fix that.

DocGuard depends on decent project documentation.

### 17.3 Overblocking can frustrate users

If commits get blocked too often for weak reasons, people will bypass the tool.

So trust is a product requirement, not just a technical one.

That is also why intentional bypass support is important.

It reduces frustration while keeping the warning visible.

### 17.4 Different teams write docs differently

Some teams are very structured. Some are not.

V1 should therefore be flexible but opinionated enough to be useful.

---

## 18. What Success Looks Like for V1

V1 is successful if a developer can:

1. install the package in a few minutes
2. point it to their docs
3. commit code as usual
4. get meaningful warnings or blocks when code breaks documented rules
5. bypass intentionally if needed for valid reasons
6. understand the result clearly
7. feel that the tool is helping, not fighting them

If we achieve that, V1 is good.

We do not need perfection.

We need a working product that creates real trust and saves real mistakes.

---

## 19. Example of the User Experience

```bash
git commit -m "add payment endpoint"

DocGuard checking staged changes...

BLOCK: src/controllers/paymentController.ts
Reason: Direct service bypass detected.
Docs: docs/architecture.md, section "Request Flow"
Expected: Controllers must call the service layer, not the database directly.

WARN: src/routes/payment.ts
Reason: Route naming does not match the naming convention in docs.
Docs: docs/api-rules.md, section "Route Naming"

Commit blocked: 1 blocking issue found.
```

This is the kind of output that makes the product useful.

It is:

- clear
- specific
- actionable
- linked back to the docs

---

## 20. Final Summary

DocGuard V1 is a practical npm package that helps developers stop AI-generated code from violating project documentation.

It works by checking staged code changes against Markdown docs before commit.

The first version will focus on:

- simple setup
- Git hook integration
- Markdown docs
- staged diff checking
- pass, warn, block decisions
- controlled bypass support
- understandable CLI output
- basic AI-powered semantic checking

The value of V1 is not that it solves everything.

The value is that it turns project documentation into an active safety layer and gives developers a much safer way to use AI in real codebases.

That is a strong and genuinely useful first product.
