// The vocabulary and the rules of a proposed fix: who can author a revision,
// what a file in one can do, the caps that keep one reviewable, and the pure
// check every write runs before anything reaches the database.
export const FIX_AUTHORS = ["agent", "human"] as const;
export type FixAuthor = (typeof FIX_AUTHORS)[number];

export const FILE_ACTIONS = ["add", "modify", "delete"] as const;
export type FileAction = (typeof FILE_ACTIONS)[number];

/** A fix a person can review on one screen; a larger change is a pull request, not a hotfix. */
export const MAX_FILES_PER_REVISION = 20;
/** UTF-8 bytes per before or after content; larger files are generated or vendored, not hand-fixed. */
export const MAX_FILE_BYTES = 200_000;

export interface RevisionFile {
  path: string;
  action: FileAction;
  /** Null for an added file. */
  before: string | null;
  /** Null for a deleted file. */
  after: string | null;
}

export type RevisionFilesResult = { ok: true } | { ok: false; message: string };

const utf8Bytes = (text: string): number => Buffer.byteLength(text, "utf8");

/** The first problem with one path, or null when it is a plain relative path inside the repo. */
const pathProblem = (path: string): string | null => {
  if (path.trim() === "" || path !== path.trim()) {
    return `path "${path}" must be non-empty with no surrounding whitespace`;
  }
  if (path.startsWith("/") || path.includes("\\")) {
    return `path "${path}" must be relative and use forward slashes`;
  }
  if (path.split("/").some((segment) => segment === ".." || segment === "." || segment === "")) {
    return `path "${path}" must not contain "..", ".", or empty segments`;
  }
  return null;
};

/** The first problem with one file's contents for its action, or null when they agree. */
const contentProblem = (file: RevisionFile): string | null => {
  for (const content of [file.before, file.after]) {
    if (content !== null && utf8Bytes(content) > MAX_FILE_BYTES) {
      return `${file.path}: each content must be at most ${MAX_FILE_BYTES} UTF-8 bytes (got ${utf8Bytes(content)})`;
    }
  }
  switch (file.action) {
    case "add":
      return file.before === null && file.after !== null
        ? null
        : `${file.path}: an added file has no before content and must have after content`;
    case "delete":
      return file.before !== null && file.after === null
        ? null
        : `${file.path}: a deleted file must have before content and has no after content`;
    case "modify":
      if (file.before === null || file.after === null) {
        return `${file.path}: a modified file must have both before and after content`;
      }
      return file.before === file.after ? `${file.path}: a modified file must change something` : null;
  }
};

/** Checks a whole revision's file set: count, paths, uniqueness, sizes, and contents per action. */
export const validateRevisionFiles = (files: readonly RevisionFile[]): RevisionFilesResult => {
  if (files.length === 0 || files.length > MAX_FILES_PER_REVISION) {
    return { ok: false, message: `a revision must change 1 to ${MAX_FILES_PER_REVISION} files (got ${files.length})` };
  }
  const seen = new Set<string>();
  for (const file of files) {
    const problem = pathProblem(file.path) ?? contentProblem(file);
    if (problem !== null) {
      return { ok: false, message: problem };
    }
    if (seen.has(file.path)) {
      return { ok: false, message: `path "${file.path}" appears more than once` };
    }
    seen.add(file.path);
  }
  return { ok: true };
};
