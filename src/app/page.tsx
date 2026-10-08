// The overview route, a Server Component. It resolves the site list and the
// first Dashboard result in-process (SchemaLink, no HTTP) and passes them down
// as props, so the HTML is complete without JavaScript and hydration fetches nothing.
import { connection } from "next/server";
import type { ReactElement } from "react";
import { query } from "@/app/apollo/rsc-client";
import { DashboardHeader } from "@/dashboard/components/DashboardHeader";
import { DashboardView, type DashboardSite, type SiteOption } from "@/dashboard/components/DashboardView";
import styles from "@/dashboard/components/DashboardView.module.css";
import { DEFAULT_FILTERS, toTrafficFilter } from "@/dashboard/filters";
import { DASHBOARD, SITES } from "@/dashboard/queries";

interface Overview {
  /** The one clock reading for this request; every time window counts back from it. */
  asOf: number;
  sites: SiteOption[];
  /** The first site under DEFAULT_FILTERS; null only when there are no sites at all. */
  initialSite: DashboardSite | null;
}

const loadOverview = async (): Promise<Overview> => {
  // better-sqlite3 answers synchronously, so without this Next would happily
  // prerender the page at build time with whatever the database held then.
  await connection();
  const asOf = Date.now();

  const sitesResult = await query({ query: SITES });
  if (sitesResult.data === undefined) {
    throw new Error("The Sites query returned no data.");
  }
  const sites = sitesResult.data.sites;
  const firstSite = sites[0];
  if (firstSite === undefined) {
    return { asOf, sites, initialSite: null };
  }

  const dashboardResult = await query({
    query: DASHBOARD,
    variables: { siteId: firstSite.id, filter: toTrafficFilter({ filters: DEFAULT_FILTERS, now: asOf }) },
  });
  const initialSite = dashboardResult.data?.site ?? null;
  if (initialSite === null) {
    throw new Error(`The Dashboard query returned no data for site "${firstSite.id}".`);
  }
  return { asOf, sites, initialSite };
};

// Deliberately no <Suspense> or loading.tsx around this page. The data is
// in-process and synchronous, so the shell waits a few milliseconds and the
// HTML arrives complete. A boundary would make React outline anything over
// ~12.8 KB behind an inline script, hiding the tables from a visitor without
// JavaScript (see e2e/ssr.spec.ts).
export default async function Home(): Promise<ReactElement> {
  const { asOf, sites, initialSite } = await loadOverview();

  if (initialSite === null) {
    return (
      <main className={styles.page}>
        <DashboardHeader />
        <p className={styles.status} role="status">
          No sites yet. Run <code>npm run db:seed</code> for synthetic demo data.
        </p>
      </main>
    );
  }

  return <DashboardView sites={sites} initialSite={initialSite} asOf={asOf} />;
}
