// The page a route shows when its id names nothing (an incident, a site): the
// same toolbar, column, and breadcrumb as the found page would have, and the one
// EmptyState shape with a way back. Both not-found files render it and differ
// only in their words.
import type { ReactElement, ReactNode } from "react";
import { BackToOverview } from "./BackToOverview";
import { BrandLink } from "./Brand";
import { EmptyState } from "./EmptyState";
import shared from "./shared.module.css";
import { Toolbar } from "./Toolbar";

export interface NotFoundViewProps {
  /** The fact, as the page's h1: "No such incident". */
  title: string;
  /** Where the id may have come from, and where the real ones are listed. */
  children: ReactNode;
}

export const NotFoundView = ({ title, children }: NotFoundViewProps): ReactElement => (
  <>
    <Toolbar brand={<BrandLink />} />
    <main className={shared.column}>
      <BackToOverview />
      <EmptyState icon="search" title={title} titleLevel="h1" action={{ href: "/", label: "Go to the overview" }}>
        {children}
      </EmptyState>
    </main>
  </>
);
