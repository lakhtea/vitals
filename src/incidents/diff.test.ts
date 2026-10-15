// The unified diff a reviewer reads, for each of the three things a fix can do to a file.
import { describe, expect, it } from "vitest";
import { unifiedFileDiff, unifiedRevisionDiff } from "./diff";

describe("unifiedFileDiff", () => {
  it("prints a modified file with a/ and b/ headers and three lines of context", () => {
    const before = ["one", "two", "three", "four", "five", "six", "seven", "eight"].join("\n") + "\n";
    const after = before.replace("five", "FIVE");
    expect(unifiedFileDiff({ path: "src/a.ts", action: "modify", before, after })).toBe(
      [
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -2,7 +2,7 @@",
        " two",
        " three",
        " four",
        "-five",
        "+FIVE",
        " six",
        " seven",
        " eight",
        "",
      ].join("\n"),
    );
  });

  it("prints an added file against /dev/null", () => {
    expect(unifiedFileDiff({ path: "new.md", action: "add", before: null, after: "hello\n" })).toBe(
      ["--- /dev/null", "+++ b/new.md", "@@ -0,0 +1,1 @@", "+hello", ""].join("\n"),
    );
  });

  it("prints a deleted file against /dev/null", () => {
    expect(unifiedFileDiff({ path: "old.md", action: "delete", before: "bye\n", after: null })).toBe(
      ["--- a/old.md", "+++ /dev/null", "@@ -1,1 +0,0 @@", "-bye", ""].join("\n"),
    );
  });

  it("joins a revision's files in order", () => {
    const files = [
      { path: "b.md", action: "add", before: null, after: "b\n" },
      { path: "a.md", action: "delete", before: "a\n", after: null },
    ] as const;
    const diff = unifiedRevisionDiff(files);
    expect(diff.indexOf("+++ b/b.md")).toBeLessThan(diff.indexOf("--- a/a.md"));
  });
});
