import { loadConfig } from "../../config/load.js";
import { listStagedFiles } from "../../git/staged-files.js";
import { readStagedDiff } from "../../git/staged-diff.js";
import { loadDocs } from "../../docs/load.js";
import { chunkDocs } from "../../docs/chunk.js";
import { embedChunksWithCache } from "../../embeddings/cache.js";
import { rankChunksForDiffs } from "../../retrieval/rank.js";
import { createGroqProvider } from "../../llm/groq.js";
import { runSemanticCheck } from "../../rules/semantic/run.js";
import { gradeFindings } from "../../grading/apply-severity.js";
import { exitCodeFor } from "../../report/format.js";
import { printOutcome } from "../../report/print.js";
import { bypassRequested } from "../../bypass/env.js";
import { logBypass } from "../../bypass/log.js";
import { DocGuardError } from "../../utils/errors.js";
import { LlmAuthError } from "../../llm/provider.js";
import type { DocChunk } from "../../types/docs.js";
import type { CheckOutcome } from "../../types/result.js";

export interface CheckOptions {
  readonly cwd?: string;
  readonly config?: string;
}

export async function runCheck(options: CheckOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd();

  if (bypassRequested()) {
    await logBypass({ cwd, reason: "DOCGUARD_BYPASS env var set" });
    process.stdout.write("docguard: bypass requested via DOCGUARD_BYPASS, skipping checks\n");
    return 0;
  }

  try {
    const loaded = await loadConfig({
      cwd,
      ...(options.config !== undefined ? { configPath: options.config } : {}),
    });
    const cfg = loaded.config;

    const files = await listStagedFiles({ cwd, ignore: cfg.ignore });
    if (files.length === 0) {
      process.stdout.write("docguard: no staged changes to check\n");
      return 0;
    }
    const diffs = await readStagedDiff(files, { cwd });
    if (diffs.length === 0) {
      process.stdout.write("docguard: nothing to evaluate after filtering\n");
      return 0;
    }

    const docs = await loadDocs({ cwd, patterns: cfg.docs });
    const notes: string[] = [];
    if (docs.length === 0) {
      notes.push("no docs matched config.docs patterns");
      const outcome: CheckOutcome = { findings: [], status: "pass", notes };
      printOutcome(outcome);
      return exitCodeFor(outcome);
    }

    const chunks: readonly DocChunk[] = chunkDocs(docs, { cwd });

    const apiKey = process.env["GROQ_API_KEY"] ?? "";
    if (apiKey.length === 0) {
      notes.push("GROQ_API_KEY not set, semantic check skipped");
      const outcome: CheckOutcome = { findings: [], status: "pass", notes };
      printOutcome(outcome);
      return exitCodeFor(outcome);
    }

    const docShaByFile = new Map<string, string>();
    for (const d of docs) {
      const rel = d.path.replace(/\\/g, "/");
      docShaByFile.set(rel, d.sha);
    }
    for (const c of chunks) {
      if (!docShaByFile.has(c.file)) {
        const match = docs.find((d) => d.path.replace(/\\/g, "/").endsWith(c.file));
        if (match !== undefined) docShaByFile.set(c.file, match.sha);
      }
    }

    const embedded = await embedChunksWithCache(chunks, { cwd, docShaByFile });
    const retrieved = await rankChunksForDiffs(diffs, embedded, {
      topK: cfg.retrieval.topK,
      minScore: cfg.retrieval.minScore,
      priority: cfg.priority,
    });

    const seen = new Set<string>();
    const relevant: DocChunk[] = [];
    for (const r of retrieved) {
      for (const h of r.hits) {
        if (!seen.has(h.chunk.id)) {
          seen.add(h.chunk.id);
          relevant.push(h.chunk);
        }
      }
    }

    let provider;
    try {
      provider = createGroqProvider({ apiKey });
    } catch (err) {
      if (err instanceof LlmAuthError) {
        notes.push(err.message);
        const outcome: CheckOutcome = { findings: [], status: "pass", notes };
        printOutcome(outcome);
        return exitCodeFor(outcome);
      }
      throw err;
    }

    const semantic = await runSemanticCheck(relevant, diffs, {
      provider,
      model: cfg.llm.model,
      timeoutMs: cfg.timeoutMs,
    });
    if (semantic.note !== null) notes.push(semantic.note);

    const outcome = gradeFindings(semantic.violations, {
      severity: cfg.severity,
      chunks,
      extraNotes: notes,
    });
    printOutcome(outcome);
    return exitCodeFor(outcome);
  } catch (err) {
    if (err instanceof DocGuardError) {
      process.stderr.write(`docguard: ${err.message}\n`);
      return 1;
    }
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`docguard: unexpected error: ${message}\n`);
    return 0;
  }
}
