export interface LoadedDoc {
  readonly path: string;
  readonly sha: string;
  readonly text: string;
}

export interface DocChunk {
  readonly id: string;
  readonly file: string;
  readonly heading: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly charCount: number;
  readonly text: string;
  readonly truncated: boolean;
}
