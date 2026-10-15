// Plain helpers for the "Proposed change" panel: reading a unified diff into
// numbered rows, the words for file actions and revision authors, and which
// editor language a path gets. No React, so the server and tests share them.

export type FixAuthorName = "agent" | "human";
export type FileActionName = "add" | "modify" | "delete";
export type EditorLanguage = "typescript" | "javascript" | "css" | "json" | "markdown" | "text";

export interface DiffLine {
  kind: "context" | "added" | "removed" | "hunk";
  text: string;
  oldNumber: number | null;
  newNumber: number | null;
}

// "@@ -12,7 +12,9 @@ optional section name"; a missing count means one line.
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

interface HunkCursor {
  oldNumber: number;
  newNumber: number;
  oldRemaining: number;
  newRemaining: number;
}

const startHunk = (match: RegExpExecArray): HunkCursor => ({
  oldNumber: Number(match[1]),
  newNumber: Number(match[3]),
  oldRemaining: match[2] === undefined ? 1 : Number(match[2]),
  newRemaining: match[4] === undefined ? 1 : Number(match[4]),
});

const isInsideHunk = (cursor: HunkCursor | null): cursor is HunkCursor =>
  cursor !== null && (cursor.oldRemaining > 0 || cursor.newRemaining > 0);

/**
 * Parses one file's unified diff text (as the server returns it) into lines
 * with old and new line numbers. File headers (Index, ===, ---, +++) are
 * dropped and @@ lines are kept as "hunk" rows. The hunk header's line counts
 * decide where a hunk ends, so a removed line that itself starts with "--" is
 * never mistaken for a header.
 */
export const parseUnifiedDiff = (diff: string): DiffLine[] => {
  const lines: DiffLine[] = [];
  let cursor: HunkCursor | null = null;

  for (const raw of diff.replace(/\r\n/g, "\n").split("\n")) {
    if (isInsideHunk(cursor)) {
      const marker = raw.charAt(0);
      const text = raw.slice(1);
      if (marker === "+") {
        lines.push({ kind: "added", text, oldNumber: null, newNumber: cursor.newNumber });
        cursor.newNumber += 1;
        cursor.newRemaining -= 1;
        continue;
      }
      if (marker === "-") {
        lines.push({ kind: "removed", text, oldNumber: cursor.oldNumber, newNumber: null });
        cursor.oldNumber += 1;
        cursor.oldRemaining -= 1;
        continue;
      }
      if (marker === "\\") {
        // "\ No newline at end of file" describes the line above; it is not a line of the file.
        continue;
      }
      // A context line; some tools strip the leading space from a blank one.
      lines.push({ kind: "context", text, oldNumber: cursor.oldNumber, newNumber: cursor.newNumber });
      cursor.oldNumber += 1;
      cursor.newNumber += 1;
      cursor.oldRemaining -= 1;
      cursor.newRemaining -= 1;
      continue;
    }

    const hunk = HUNK_HEADER.exec(raw);
    if (hunk !== null) {
      cursor = startHunk(hunk);
      lines.push({ kind: "hunk", text: raw, oldNumber: null, newNumber: null });
    }
    // Anything else outside a hunk is a file header or trailing blank line.
  }

  return lines;
};

const FILE_ACTION_LABELS: Record<FileActionName, string> = {
  add: "Added",
  modify: "Modified",
  delete: "Deleted",
};

export const fileActionLabel = (action: FileActionName): string => FILE_ACTION_LABELS[action];

const FIX_AUTHOR_LABELS: Record<FixAuthorName, string> = {
  agent: "Agent",
  human: "Person",
};

export const fixAuthorLabel = (author: FixAuthorName): string => FIX_AUTHOR_LABELS[author];

const LANGUAGE_BY_EXTENSION: Record<string, EditorLanguage> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  css: "css",
  json: "json",
  md: "markdown",
  mdx: "markdown",
};

/** Language for the editor from the file extension; anything unknown is plain text. */
export const editorLanguageFor = (path: string): EditorLanguage => {
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return "text";
  return LANGUAGE_BY_EXTENSION[fileName.slice(dot + 1).toLowerCase()] ?? "text";
};
