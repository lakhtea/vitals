// The bar at the top of every dashboard route: the brand on the left, the
// route's controls (site picker, status) on the right, and an optional second
// row for filters. Sticky, so the controls stay in reach while a long table
// scrolls. Shared by the overview and the page detail so the two routes line
// up to the pixel. A <header>, so the controls are inside a landmark on every
// route, whether the page puts the bar inside <main> or before it.
import type { ReactElement, ReactNode } from "react";
import styles from "./Toolbar.module.css";

export interface ToolbarProps {
  /** The brand slot: the overview puts its h1 here, other routes a link home. */
  brand: ReactNode;
  /** The right-hand controls of the first row. */
  children?: ReactNode;
  /** A second row, typically the filters; it scrolls sideways on narrow screens instead of wrapping. */
  secondRow?: ReactNode;
}

export const Toolbar = ({ brand, children, secondRow }: ToolbarProps): ReactElement => (
  <header className={styles.toolbar}>
    <div className={styles.inner}>
      <div className={styles.row}>
        <div className={styles.brand}>{brand}</div>
        {children !== undefined && <div className={styles.controls}>{children}</div>}
      </div>
      {secondRow !== undefined && <div className={styles.secondRow}>{secondRow}</div>}
    </div>
  </header>
);

export interface ToolbarStatusProps {
  /** What the bar has to say ("Updating…", an error), or null for nothing. */
  status: string | null;
  tone?: "neutral" | "poor";
}

/** The one line the toolbar reports on. The slot is always there, so the pill appearing moves nothing. */
export const ToolbarStatus = ({ status, tone = "neutral" }: ToolbarStatusProps): ReactElement => (
  <p className={styles.status} role="status" data-tone={tone}>
    {status !== null && <span className={styles.statusPill}>{status}</span>}
  </p>
);
