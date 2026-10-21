// The shell every inline glyph shares: a square viewBox drawn in currentColor
// with round 1.5 px strokes, hidden from assistive technology because the
// words beside it carry the meaning. Callers pass only their paths.
import type { ReactElement, ReactNode } from "react";

export interface IconProps {
  /** Pixels on each side; the viewBox matches, so paths are drawn on a grid of this size. */
  size?: number;
  className?: string;
  children: ReactNode;
}

const DEFAULT_SIZE = 16;

export const Icon = ({ size = DEFAULT_SIZE, className, children }: IconProps): ReactElement => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox={`0 0 ${size} ${size}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);
