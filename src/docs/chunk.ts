import { relative, isAbsolute } from "node:path";
import type { LoadedDoc, DocChunk } from "../types/docs.js";
import { splitMarkdownByHeading, type MarkdownSection } from "./parse-markdown.js";

export interface ChunkOptions {
  readonly cwd: string;
  readonly softMax?: number;
  readonly hardMax?: number;
}

const DEFAULT_SOFT_MAX = 1500;
const DEFAULT_HARD_MAX = 2000;

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function relPath(cwd: string, path: string): string {
  if (!isAbsolute(path)) return path.replace(/\\/g, "/");
  return relative(cwd, path).replace(/\\/g, "/");
}

interface RawChunk {
  readonly heading: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly text: string;
}

function sectionToRaw(section: MarkdownSection): RawChunk {
  return {
    heading: section.heading,
    lineStart: section.lineStart,
    lineEnd: section.lineEnd,
    text: section.text,
  };
}

function splitByChars(chunk: RawChunk, softMax: number): RawChunk[] {
  if (chunk.text.length <= softMax) return [chunk];
  const out: RawChunk[] = [];
  let offset = 0;
  while (offset < chunk.text.length) {
    const slice = chunk.text.slice(offset, offset + softMax);
    out.push({
      heading: chunk.heading,
      lineStart: chunk.lineStart,
      lineEnd: chunk.lineEnd,
      text: slice,
    });
    offset += softMax;
  }
  return out;
}

function splitOnParagraphs(chunk: RawChunk, softMax: number): RawChunk[] {
  const lines = chunk.text.split("\n");
  const out: RawChunk[] = [];
  let buf: string[] = [];
  let startLine = chunk.lineStart;
  let curLine = chunk.lineStart - 1;

  const flush = (endLine: number): void => {
    const text = buf.join("\n").trim();
    if (text.length === 0) {
      buf = [];
      return;
    }
    out.push({
      heading: chunk.heading,
      lineStart: startLine,
      lineEnd: endLine,
      text: buf.join("\n"),
    });
    buf = [];
    startLine = endLine + 1;
  };

  for (const line of lines) {
    curLine += 1;
    buf.push(line);
    const joined = buf.join("\n");
    if (line.trim() === "" && joined.length >= softMax) {
      flush(curLine);
    }
  }
  flush(curLine);

  const base = out.length === 0 ? [chunk] : out;
  const result: RawChunk[] = [];
  for (const piece of base) {
    if (piece.text.length > softMax) {
      result.push(...splitByChars(piece, softMax));
    } else {
      result.push(piece);
    }
  }
  return result;
}

function subSplit(chunk: RawChunk, softMax: number): RawChunk[] {
  if (chunk.text.length <= softMax) return [chunk];

  const subsections = splitMarkdownByHeading(chunk.text, 6).filter(
    (s) => s.depth === 0 || s.depth > 2,
  );

  if (subsections.length > 1) {
    const result: RawChunk[] = [];
    for (const s of subsections) {
      const shifted: RawChunk = {
        heading: s.heading === "(intro)" ? chunk.heading : `${chunk.heading} > ${s.heading}`,
        lineStart: chunk.lineStart + s.lineStart - 1,
        lineEnd: chunk.lineStart + s.lineEnd - 1,
        text: s.text,
      };
      if (shifted.text.length > softMax) {
        result.push(...splitOnParagraphs(shifted, softMax));
      } else {
        result.push(shifted);
      }
    }
    return result;
  }

  return splitOnParagraphs(chunk, softMax);
}

function applyHardCap(chunk: RawChunk, hardMax: number): { text: string; truncated: boolean } {
  if (chunk.text.length <= hardMax) return { text: chunk.text, truncated: false };
  return { text: `${chunk.text.slice(0, hardMax - 6)}\n[...]`, truncated: true };
}

export function chunkDocs(docs: readonly LoadedDoc[], opts: ChunkOptions): readonly DocChunk[] {
  const softMax = opts.softMax ?? DEFAULT_SOFT_MAX;
  const hardMax = opts.hardMax ?? DEFAULT_HARD_MAX;
  const chunks: DocChunk[] = [];
  const usedIds = new Map<string, number>();

  for (const doc of docs) {
    const file = relPath(opts.cwd, doc.path);
    const sections = splitMarkdownByHeading(doc.text, 2).map(sectionToRaw);

    for (const sec of sections) {
      const split = subSplit(sec, softMax);
      for (const piece of split) {
        const baseId = `${file}#${slug(piece.heading)}`;
        const count = usedIds.get(baseId) ?? 0;
        const id = count === 0 ? baseId : `${baseId}-${String(count + 1)}`;
        usedIds.set(baseId, count + 1);

        const { text, truncated } = applyHardCap(piece, hardMax);
        chunks.push({
          id,
          file,
          heading: piece.heading,
          lineStart: piece.lineStart,
          lineEnd: piece.lineEnd,
          charCount: text.length,
          text,
          truncated,
        });
      }
    }
  }

  return chunks;
}
