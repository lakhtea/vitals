// One file's proposed change as a read-only unified diff: a table of old line,
// new line, and the line itself. No hooks and no "use client", so the route's
// Server Component puts the whole diff into the first HTML.
import type { ReactElement } from "react";
import { parseUnifiedDiff, type DiffLine } from "../fix-review";
import styles from "./DiffView.module.css";

export interface DiffViewProps {
  path: string;
  /** This file's unified diff text, as the server returns it. */
  diff: string;
}

// The gutter mark and the words a screen reader hears, so a change is never shown by colour alone.
const LINE_MARKS: Record<DiffLine["kind"], { mark: string; spoken: string | null }> = {
  added: { mark: "+", spoken: "added" },
  removed: { mark: "-", spoken: "removed" },
  context: { mark: " ", spoken: null },
  hunk: { mark: " ", spoken: null },
};

const LineNumber = ({ value }: { value: number | null }): ReactElement => (
  <td className={styles.number}>{value ?? ""}</td>
);

const DiffRow = ({ line }: { line: DiffLine }): ReactElement => {
  const { mark, spoken } = LINE_MARKS[line.kind];

  return (
    <tr className={styles.row} data-kind={line.kind}>
      <LineNumber value={line.oldNumber} />
      <LineNumber value={line.newNumber} />
      <td className={styles.line}>
        <span className={styles.mark} aria-hidden="true">
          {mark}
        </span>
        {spoken !== null && <span className={styles.visuallyHidden}>{spoken}: </span>}
        <span className={styles.text}>{line.text}</span>
      </td>
    </tr>
  );
};

export const DiffView = ({ path, diff }: DiffViewProps): ReactElement => {
  const lines = parseUnifiedDiff(diff);

  if (lines.length === 0) {
    return <p className={styles.empty}>No changes.</p>;
  }

  return (
    // A named, focusable region: long lines scroll sideways and the table has nothing focusable inside it.
    <div className={styles.scroller} role="region" aria-label={`Diff of ${path}`} tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Changes to {path}</caption>
        <thead className={styles.head}>
          <tr>
            <th scope="col">
              <span className={styles.visuallyHidden}>Old line number</span>
            </th>
            <th scope="col">
              <span className={styles.visuallyHidden}>New line number</span>
            </th>
            <th scope="col">
              <span className={styles.visuallyHidden}>Line</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            // Rows never reorder and have no identity beyond their position in this diff.
            <DiffRow key={index} line={line} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
