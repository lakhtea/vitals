"use client";

// The page detail's filter bar. Unlike the overview, a change here is a
// navigation: the new filters become search params and the Server Component
// renders the page again, so the URL is always the whole view. Local state
// shows the chosen value at once; the server's answer wins when it lands.
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";
import type { DashboardFilters } from "../filters";
import { pageDetailHref } from "../routes";
import { FilterBar } from "./FilterBar";
import { ToolbarStatus } from "./Toolbar";

export interface PageFiltersProps {
  siteId: string;
  path: string;
  /** The filters the server rendered this page with, parsed from the URL. */
  filters: DashboardFilters;
}

export const PageFilters = ({ siteId, path, filters }: PageFiltersProps): ReactElement => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const serverHref = pageDetailHref({ siteId, path, filters });

  // Compared as the URL rather than by object identity: every server render
  // hands down a fresh object, but only a changed URL means new filters.
  const [value, setValue] = useState(filters);
  const [syncedHref, setSyncedHref] = useState(serverHref);
  if (serverHref !== syncedHref) {
    setSyncedHref(serverHref);
    setValue(filters);
  }

  const handleChange = (next: DashboardFilters): void => {
    setValue(next);
    // push, not replace: Back undoes a filter change instead of leaving the page.
    startTransition(() => {
      router.push(pageDetailHref({ siteId, path, filters: next }), { scroll: false });
    });
  };

  // Rendered straight into the toolbar's second row: the bar and the status
  // pill sit on one line that scrolls sideways, as on the overview, rather
  // than wrapping and growing the sticky bar while a change loads.
  return (
    <>
      <FilterBar value={value} onChange={handleChange} />
      <ToolbarStatus status={isPending ? "Updating…" : null} />
    </>
  );
};
