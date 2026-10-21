// The breadcrumb the incident page, the page detail, and their not-found
// pages share: one link back to the overview with its arrow, so the routes
// cannot drift apart.
import Link from "next/link";
import type { ReactElement } from "react";
import styles from "./BackToOverview.module.css";
import { Icon } from "./Icon";

export const BackToOverview = (): ReactElement => (
  <nav aria-label="Breadcrumb">
    <Link href="/" className={styles.back}>
      <Icon className={styles.icon}>
        <path d="M13 8H3m4.5-4.5L3 8l4.5 4.5" />
      </Icon>
      Back to the overview
    </Link>
  </nav>
);
