// A short message the page wants noticed, with an icon and a tone: the gate is
// waiting on a person (amber), or a revision was approved (green). The words
// carry the meaning; the colour and icon only draw the eye. No hooks, so the
// route's Server Component renders it.
import type { ReactElement, ReactNode } from "react";
import styles from "./Callout.module.css";
import { Icon } from "./Icon";

export type CalloutTone = "waiting" | "approved";

const ICONS: Record<CalloutTone, ReactElement> = {
  // A hand: stop here until a person decides.
  waiting: <path d="M8 3.5v5M5.5 4.5v4M10.5 4.5v4M13 6v4.5a4.5 4.5 0 0 1-9 0V9l-1.5-2" />,
  // A check in a circle: decided.
  approved: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="m5.5 8 1.75 1.75L10.5 6.5" />
    </>
  ),
};

export interface CalloutProps {
  tone: CalloutTone;
  children: ReactNode;
}

export const Callout = ({ tone, children }: CalloutProps): ReactElement => (
  <div className={styles.callout} data-tone={tone}>
    <Icon className={styles.icon}>{ICONS[tone]}</Icon>
    <p className={styles.text}>{children}</p>
  </div>
);
