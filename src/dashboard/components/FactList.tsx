// Label-over-value facts in a row: "Source / Detected / Resolved" under an
// incident's title, "Pageviews / Metric samples" under a path. A <dl> whose
// pairs divide with hairlines and fall into two columns on a phone, shared by
// the incident page and the page detail so the same kind of fact reads the same.
import type { ReactElement, ReactNode } from "react";
import styles from "./FactList.module.css";

export interface FactListProps {
  /** Facts, plus any full-width pair the caller lays out itself. */
  children: ReactNode;
}

export const FactList = ({ children }: FactListProps): ReactElement => <dl className={styles.facts}>{children}</dl>;

export interface FactProps {
  label: string;
  children: ReactNode;
}

export const Fact = ({ label, children }: FactProps): ReactElement => (
  <div className={styles.fact}>
    <dt className={styles.label}>{label}</dt>
    <dd className={styles.value}>{children}</dd>
  </div>
);
