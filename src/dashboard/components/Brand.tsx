// The product's name: as the overview's h1 with its tagline, and as the link
// home the other routes put in the same toolbar slot. One class for both, so
// the word is the same size on every route.
import Link from "next/link";
import type { ReactElement } from "react";
import { SITE_TITLE } from "../labels";
import styles from "./Brand.module.css";

export const Brand = (): ReactElement => (
  <>
    <h1 className={styles.title}>{SITE_TITLE}</h1>
    <p className={styles.tagline}>Core Web Vitals from real sessions, self-hosted.</p>
  </>
);

export const BrandLink = (): ReactElement => (
  <Link href="/" className={`${styles.title} ${styles.link}`}>
    {SITE_TITLE}
  </Link>
);
