// The 0.5 rem dot that carries a rating's colour beside a figure or a status
// word, drawn once for the tables, the health cards, the attention strip, and
// the headline pill. Decorative on its own; pass `label` to speak the rating
// where no visible word sits beside the dot.
import type { ReactElement } from "react";
import type { MetricRating } from "@/vitals/metrics";
import styles from "./RatingDot.module.css";

export interface RatingDotProps {
  /** null is the neutral dot, in the ink of its context: no data, or a state with no rating. */
  rating: MetricRating | null;
  /** The rating word for screen readers, when nothing visible beside the dot says it. */
  label?: string;
  className?: string;
}

export const RatingDot = ({ rating, label, className }: RatingDotProps): ReactElement => (
  <>
    <span
      className={className === undefined ? styles.dot : `${styles.dot} ${className}`}
      data-rating={rating ?? "none"}
      aria-hidden="true"
    />
    {label !== undefined && <span className={styles.visuallyHidden}>{label}</span>}
  </>
);
