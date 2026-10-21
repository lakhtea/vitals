// The heading every section opens with, on all three routes: the title, an
// optional count beside it ("Incidents · 2"), an optional pill after it, and an
// optional one-line explanation. One component so the sections share one type
// size and one rhythm; the optional id lets a section name itself by it.
import type { ReactElement, ReactNode } from "react";
import styles from "./SectionHeader.module.css";

export interface SectionHeaderProps {
  title: string;
  /** Set on the h2 so the enclosing section can point at it with aria-labelledby. */
  id?: string;
  count?: number;
  /** A pill beside the title, outside the heading so it never joins the heading's name. */
  badge?: ReactNode;
  /** Rendered as a muted line under the title; a string or richer content such as a <code> span. */
  description?: ReactNode;
}

const countFormat = new Intl.NumberFormat("en-US");

export const SectionHeader = ({ title, id, count, badge, description }: SectionHeaderProps): ReactElement => {
  const heading = (
    <h2 id={id} className={styles.title}>
      {title}
      {count !== undefined && (
        <>
          <span className={styles.separator} aria-hidden="true">
            ·
          </span>
          <span className={styles.count}>{countFormat.format(count)}</span>
        </>
      )}
    </h2>
  );

  return (
    <div className={styles.header}>
      {badge === undefined ? (
        heading
      ) : (
        <div className={styles.titleRow}>
          {heading}
          {badge}
        </div>
      )}
      {description !== undefined && <p className={styles.description}>{description}</p>}
    </div>
  );
};
