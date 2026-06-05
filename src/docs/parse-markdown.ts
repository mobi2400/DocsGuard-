export interface MarkdownSection {
  readonly heading: string;
  readonly depth: number;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly text: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function splitMarkdownByHeading(text: string, maxDepth: number): MarkdownSection[] {
  const lines = text.split("\n");
  const sections: MarkdownSection[] = [];
  let currentHeading = "(intro)";
  let currentDepth = 0;
  let currentStart = 1;
  let buffer: string[] = [];

  const flush = (endLine: number): void => {
    const trimmed = buffer.join("\n").trim();
    if (trimmed.length === 0) {
      buffer = [];
      return;
    }
    sections.push({
      heading: currentHeading,
      depth: currentDepth,
      lineStart: currentStart,
      lineEnd: endLine,
      text: buffer.join("\n"),
    });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const m = HEADING_RE.exec(line);
    const lineNo = i + 1;
    if (m !== null) {
      const hashes = m[1] ?? "";
      const title = (m[2] ?? "").trim();
      const depth = hashes.length;
      if (depth <= maxDepth) {
        flush(lineNo - 1);
        currentHeading = title;
        currentDepth = depth;
        currentStart = lineNo;
        buffer = [line];
        continue;
      }
    }
    buffer.push(line);
  }
  flush(lines.length);

  return sections;
}
