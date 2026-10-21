// The top of the page detail: the breadcrumb back to the overview, the path as
// the title, and the facts that size every number below it (pageviews and
// metric samples). No hooks, so the Server Component renders it in the first
// HTML and the no-data state can show the same header without the facts.
import type { ReactElement } from "react";
import { BackToOverview } from "./BackToOverview";
import { Fact, FactList } from "./FactList";
import styles from "./PageDetail.module.css";

export interface PageDetailFacts {
  pageviewCount: number;
  /** Metric samples across all five metrics. */
  sampleCount: number;
}

export interface PageDetailHeaderProps {
  path: string;
  siteName: string;
  /** null when the page has no traffic under the current filter, so there is nothing to count. */
  facts: PageDetailFacts | null;
}

const numberFormat = new Intl.NumberFormat("en-US");

export const PageDetailHeader = ({ path, siteName, facts }: PageDetailHeaderProps): ReactElement => (
  <header className={styles.header}>
    <div className={styles.headerTop}>
      <BackToOverview />
      <div>
        <p className={styles.eyebrow}>Page on {siteName}</p>
        <h1 className={styles.path}>{path}</h1>
      </div>
    </div>
    {facts !== null && (
      <FactList>
        <Fact label="Pageviews">{numberFormat.format(facts.pageviewCount)}</Fact>
        <Fact label="Metric samples">{numberFormat.format(facts.sampleCount)}</Fact>
      </FactList>
    )}
  </header>
);
