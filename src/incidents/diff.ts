// Turns a revision's stored before and after contents into the unified diff a
// reviewer reads. Server-side only: the diff is derived on every read, never
// stored, so it cannot disagree with the contents it describes.
import { createTwoFilesPatch, FILE_HEADERS_ONLY } from "diff";
import type { RevisionFile } from "./fix";

/** Lines of unchanged context around each change, as `git diff` and `diff -u` default to. */
const CONTEXT_LINES = 3;

/** One file as `git diff` would print it: a/ and b/ headers, /dev/null for the missing side of an add or delete. */
export const unifiedFileDiff = ({ path, action, before, after }: RevisionFile): string =>
  createTwoFilesPatch(
    action === "add" ? "/dev/null" : `a/${path}`,
    action === "delete" ? "/dev/null" : `b/${path}`,
    before ?? "",
    after ?? "",
    undefined,
    undefined,
    { context: CONTEXT_LINES, headerOptions: FILE_HEADERS_ONLY },
  );

/** A whole revision, file after file, in the order given. */
export const unifiedRevisionDiff = (files: readonly RevisionFile[]): string => files.map(unifiedFileDiff).join("");
