// The one pill for every status, rating, and file action on the three routes:
// a tone (the three web.dev rating colours, or neutral) and a size. No hooks,
// so Server Components and client panels render the same element.
import type { ReactElement } from "react";
import type { PillTone } from "../incidents";
import { RatingDot } from "./RatingDot";
import styles from "./StatusPill.module.css";

export type PillSize = "sm" | "lg";

export interface StatusPillProps {
  tone: PillTone;
  /** "lg" is the headline status in the header, with a dot so the tone has a shape as well as a colour. */
  size?: PillSize;
  children: string;
}

export const StatusPill = ({ tone, size = "sm", children }: StatusPillProps): ReactElement => (
  <span className={styles.pill} data-tone={tone ?? "none"} data-size={size}>
    {size === "lg" && <RatingDot rating={tone} />}
    {children}
  </span>
);
