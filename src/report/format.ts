import type { CheckOutcome, Finding } from "../types/result.js";

function tag(sev: Finding["severity"]): string {
  switch (sev) {
    case "block":
      return "BLOCK";
    case "warn":
      return "WARN ";
    case "pass":
      return "PASS ";
  }
}

function formatFinding(f: Finding): string {
  const lines: string[] = [];
  lines.push(`${tag(f.severity)} ${f.file}:${String(f.line)}  [${f.category}]`);
  lines.push(`  ${f.message}`);
  if (f.citation !== null) {
    lines.push(`  Cited: ${f.citation.file}:${String(f.citation.line)}`);
    lines.push(`    "${f.citation.quote}"`);
  }
  if (f.downgradeReason !== null) {
    lines.push(`  (downgraded: ${f.downgradeReason})`);
  }
  return lines.join("\n");
}

export function formatOutcome(outcome: CheckOutcome): string {
  const blocks = outcome.findings.filter((f) => f.severity === "block").length;
  const warns = outcome.findings.filter((f) => f.severity === "warn").length;

  const parts: string[] = [];
  for (const note of outcome.notes) {
    parts.push(`note: ${note}`);
  }

  if (outcome.findings.length === 0) {
    parts.push("DocGuard: no documented-rule violations detected.");
    return parts.join("\n");
  }

  for (const f of outcome.findings) {
    parts.push(formatFinding(f));
    parts.push("");
  }

  parts.push(`Summary: ${String(blocks)} error(s), ${String(warns)} warning(s).`);
  if (outcome.status === "block") {
    parts.push("Commit blocked. Bypass: git commit --no-verify  or  DOCGUARD_BYPASS=1 git commit");
  }
  return parts.join("\n");
}

export function exitCodeFor(outcome: CheckOutcome): number {
  return outcome.status === "block" ? 1 : 0;
}
