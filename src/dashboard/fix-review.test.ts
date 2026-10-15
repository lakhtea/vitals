// The diff rows a reviewer reads: every line must carry the right old and new
// line number, or "line 14" in the panel points at the wrong code. Also the
// editor language a path gets, since a wrong guess silently loses highlighting.
import { describe, expect, it } from "vitest";
import { editorLanguageFor, parseUnifiedDiff } from "./fix-review";

// The shape the server returns: the `diff` package's createPatch output.
const timeoutDiff = [
  "Index: src/demo/slow-upstream.ts",
  "===================================================================",
  "--- src/demo/slow-upstream.ts",
  "+++ src/demo/slow-upstream.ts",
  "@@ -10,4 +10,5 @@",
  " export const loadOverview = async (): Promise<Overview> => {",
  "-  const response = await fetch(UPSTREAM_URL);",
  "-  return parse(response);",
  "+  const signal = AbortSignal.timeout(5_000);",
  "+  const response = await fetch(UPSTREAM_URL, { signal }).catch(() => null);",
  "+  return response === null ? FALLBACK : parse(response);",
  " };",
  "",
].join("\n");

describe("parseUnifiedDiff", () => {
  it("numbers context, removed, and added lines across a hunk and drops the file headers", () => {
    expect(parseUnifiedDiff(timeoutDiff)).toEqual([
      { kind: "hunk", text: "@@ -10,4 +10,5 @@", oldNumber: null, newNumber: null },
      { kind: "context", text: "export const loadOverview = async (): Promise<Overview> => {", oldNumber: 10, newNumber: 10 },
      { kind: "removed", text: "  const response = await fetch(UPSTREAM_URL);", oldNumber: 11, newNumber: null },
      { kind: "removed", text: "  return parse(response);", oldNumber: 12, newNumber: null },
      { kind: "added", text: "  const signal = AbortSignal.timeout(5_000);", oldNumber: null, newNumber: 11 },
      {
        kind: "added",
        text: "  const response = await fetch(UPSTREAM_URL, { signal }).catch(() => null);",
        oldNumber: null,
        newNumber: 12,
      },
      { kind: "added", text: "  return response === null ? FALLBACK : parse(response);", oldNumber: null, newNumber: 13 },
      { kind: "context", text: "};", oldNumber: 13, newNumber: 14 },
    ]);
  });

  it("reads a removed line that looks like a header as a removal, using the hunk's counts", () => {
    const diff = ["--- a/notes.md", "+++ b/notes.md", "@@ -1,2 +1,1 @@", "--- old divider", " kept"].join("\n");
    expect(parseUnifiedDiff(diff).map((line) => [line.kind, line.text])).toEqual([
      ["hunk", "@@ -1,2 +1,1 @@"],
      ["removed", "-- old divider"],
      ["context", "kept"],
    ]);
  });

  it("returns no rows for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });
});

describe("editorLanguageFor", () => {
  it.each([
    ["src/demo/slow-upstream.ts", "typescript"],
    ["src/app/page.tsx", "typescript"],
    ["scripts/build.mjs", "javascript"],
    ["src/app/globals.css", "css"],
    ["package.json", "json"],
    ["docs/README.MD", "markdown"],
    ["Dockerfile", "text"],
    [".env", "text"],
    ["config.d/settings", "text"],
  ] as const)("%s is %s", (path, language) => {
    expect(editorLanguageFor(path)).toBe(language);
  });
});
