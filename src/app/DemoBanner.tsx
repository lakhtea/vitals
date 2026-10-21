// One-line notice for the public demo (VITALS_DEMO_MODE=1): tells visitors the
// data is synthetic and ephemeral. A server component, so the env check never
// reaches the browser bundle; it renders nothing outside demo mode.
import type { ReactElement } from "react";
import { isDemoMode } from "@/config/demo-mode";
import styles from "./DemoBanner.module.css";

export const DemoBanner = (): ReactElement | null => {
  if (!isDemoMode()) {
    return null;
  }
  return (
    <p role="status" className={styles.banner}>
      Demo mode: synthetic data, resets on each cold start.
    </p>
  );
};
