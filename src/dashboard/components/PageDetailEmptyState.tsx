// What the page detail shows when a known site has no traffic on the path
// under the current filter. A narrower filter is not a 404: the state says
// what was asked and offers the widest view, or, when nothing narrows the
// traffic, says the path has never been seen and points back to the overview.
import type { ReactElement } from "react";
import type { DashboardFilters } from "../filters";
import { isUnfilteredView } from "../pageDetail";
import { pageDetailHref } from "../routes";
import { EmptyState } from "./EmptyState";

export interface PageDetailEmptyStateProps {
  siteId: string;
  path: string;
  filters: DashboardFilters;
}

const ALL_TIME_FILTERS: DashboardFilters = { range: "all", deviceClass: null, connectionType: null };

export const PageDetailEmptyState = ({ siteId, path, filters }: PageDetailEmptyStateProps): ReactElement => {
  if (isUnfilteredView(filters)) {
    return (
      <EmptyState
        icon="page"
        title="No traffic recorded for this path"
        titleLevel="h2"
        action={{ href: "/", label: "Go to the overview" }}
      >
        Nothing has ever been reported under <code>{path}</code>. Check the spelling, or pick a path from the
        overview&apos;s pages table.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      icon="page"
      title="No traffic matches these filters"
      titleLevel="h2"
      action={{ href: pageDetailHref({ siteId, path, filters: ALL_TIME_FILTERS }), label: "Show all time" }}
    >
      Nothing was reported for <code>{path}</code> in this time range for the chosen device and connection. The path
      may still have traffic outside this view.
    </EmptyState>
  );
};
