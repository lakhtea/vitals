// The one shape every "nothing here yet" takes: an icon, the fact in a short
// title, one sentence on what fills it in, and optionally a way forward. Used
// for no sites, no health checks, no self-measured sessions, a path with no
// traffic, and the two not-found pages, so they all read as one product.
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import styles from "./EmptyState.module.css";
import { Icon } from "./Icon";

export type EmptyStateIcon = "sites" | "checks" | "sessions" | "page" | "search";

const ICONS: Record<EmptyStateIcon, ReactElement> = {
  // A globe: no site has been registered.
  sites: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2.5 2.5 2.5 11.5 0 14M10 3c-2.5 2.5-2.5 11.5 0 14" />
    </>
  ),
  // A check in a circle: nothing has reported its health.
  checks: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m7 10 2 2 4-4" />
    </>
  ),
  // A pulse: no sessions have been measured.
  sessions: <path d="M2.5 10h3.5l2-5 4 10 2-5h3.5" />,
  // A page: the path has no traffic to show.
  page: (
    <>
      <path d="M5 2.5h6l4 4v11H5z" />
      <path d="M11 2.5v4h4M7.5 10h5M7.5 13h5" />
    </>
  ),
  // A magnifier: looked for the id, found nothing.
  search: (
    <>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m12.5 12.5 5 5" />
    </>
  ),
};

/** The title is a heading when the state stands for the whole page, a plain line inside a section. */
export type EmptyStateTitleLevel = "h1" | "h2";

export interface EmptyStateAction {
  href: string;
  label: string;
}

export interface EmptyStateProps {
  icon: EmptyStateIcon;
  /** The fact, e.g. "No sessions recorded yet". */
  title: string;
  titleLevel?: EmptyStateTitleLevel;
  /** One sentence on what fills it in; may contain <code>. */
  children: ReactNode;
  /** A link styled as the primary button, when there is somewhere to go from here. */
  action?: EmptyStateAction;
}

const ICON_SIZE = 20;

export const EmptyState = ({ icon, title, titleLevel, children, action }: EmptyStateProps): ReactElement => {
  const TitleTag: EmptyStateTitleLevel | "p" = titleLevel ?? "p";

  return (
    <div className={styles.empty}>
      <Icon className={styles.icon} size={ICON_SIZE}>
        {ICONS[icon]}
      </Icon>
      <TitleTag className={styles.title}>{title}</TitleTag>
      <p className={styles.text}>{children}</p>
      {action !== undefined && (
        <Link href={action.href} className={styles.action}>
          {action.label}
        </Link>
      )}
    </div>
  );
};
