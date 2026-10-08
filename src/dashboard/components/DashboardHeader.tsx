// The dashboard's masthead: title, tagline, and a slot for the site picker.
// Shared by the live view, its loading skeleton, and the empty state so all
// three states line up to the pixel.
import type { ReactElement, ReactNode } from "react";
import styles from "./DashboardView.module.css";

interface DashboardHeaderProps {
  children?: ReactNode;
}

export const DashboardHeader = ({ children }: DashboardHeaderProps): ReactElement => (
  <header className={styles.header}>
    <div>
      <h1 className={styles.title}>Vitals</h1>
      <p className={styles.tagline}>Core Web Vitals from real sessions, self-hosted.</p>
    </div>
    {children}
  </header>
);
