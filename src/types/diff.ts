export type ChangeKind = "added" | "modified" | "deleted" | "renamed";

export interface StagedFile {
  readonly path: string;
  readonly oldPath: string | null;
  readonly kind: ChangeKind;
  readonly isBinary: boolean;
}

export interface DiffHunk {
  readonly file: string;
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly header: string;
  readonly body: string;
}

export interface FileDiff {
  readonly file: StagedFile;
  readonly hunks: readonly DiffHunk[];
  readonly truncated: boolean;
}
