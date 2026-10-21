// The page detail route, a Server Component: one path's vitals, resolved
// in-process (SchemaLink, no HTTP) under the filters named in the URL, so the
// HTML is complete without JavaScript for any filter and the URL is a
// shareable view. An unknown site is a 404; a known site with no traffic under
// the filter is an empty state, because a narrower filter is not a missing page.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { query } from "@/app/apollo/rsc-client";
import { PageDetailView } from "@/dashboard/components/PageDetailView";
import { toSeriesBucket, toTrafficFilter, type DashboardFilters } from "@/dashboard/filters";
import {
  pageDetailTitle,
  parsePageDetailSearchParams,
  parsePagePathParam,
  toPageDetail,
  type PageDetailData,
  type RawSearchParams,
} from "@/dashboard/pageDetail";
import { SITE_TITLE } from "@/dashboard/labels";
import { PAGE_DETAIL, SITES } from "@/dashboard/queries";
import { pathFromSegments, siteIdFromParam, type ParamEncoding } from "@/dashboard/routes";

interface PageDetailRouteProps {
  /** Both are Promises in this Next.js: the segments and the query string resolve per request. */
  params: Promise<{ siteId: string; path?: string[] }>;
  searchParams: Promise<RawSearchParams>;
}


interface RouteInput {
  siteId: string;
  path: string;
  filters: DashboardFilters;
}

/**
 * The page and generateMetadata read the same URL but are handed its dynamic
 * params differently (see ParamEncoding), so each says how its copy arrived.
 * A `path` search param carries a path the segment form cannot (a trailing
 * slash, an empty segment) and wins over the segments when present.
 */
const resolveRouteInput = async ({
  props,
  paramEncoding,
}: {
  props: PageDetailRouteProps;
  paramEncoding: ParamEncoding;
}): Promise<RouteInput> => {
  const [params, raw] = await Promise.all([props.params, props.searchParams]);
  const siteId = siteIdFromParam({ siteId: params.siteId, encoding: paramEncoding });
  const path = parsePagePathParam(raw) ?? pathFromSegments({ segments: params.path, encoding: paramEncoding });
  // A segment with a malformed percent escape names no site or page anyone could have recorded.
  if (siteId === null || path === null) {
    notFound();
  }
  return { siteId, path, filters: parsePageDetailSearchParams(raw) };
};

/**
 * "/pricing · Demo site - Vitals". The site list is enough for the title, and
 * cheaper than the detail query, whose time window would differ by the
 * milliseconds between two clock readings and so miss Apollo's cache.
 */
export async function generateMetadata(props: PageDetailRouteProps): Promise<Metadata> {
  const { siteId, path } = await resolveRouteInput({ props, paramEncoding: "decoded" });
  const result = await query({ query: SITES });
  const site = result.data?.sites.find((candidate) => candidate.id === siteId) ?? null;
  if (site === null) {
    return { title: `Site not found - ${SITE_TITLE}` };
  }
  return { title: pageDetailTitle({ path, siteName: site.name }) };
}

interface LoadedPageDetail extends RouteInput {
  /** null when the site does not exist; the route turns that into a 404. */
  site: { id: string; name: string } | null;
  /** null when the site has no traffic on the path under the filters. */
  detail: PageDetailData | null;
}

const loadPageDetail = async (props: PageDetailRouteProps): Promise<LoadedPageDetail> => {
  // better-sqlite3 answers synchronously, so without this Next would prerender
  // the route at build time with whatever the database held then.
  await connection();
  const input = await resolveRouteInput({ props, paramEncoding: "percent-encoded" });
  // The one clock reading for this request; every "last N days" window counts back from it.
  const now = Date.now();

  const result = await query({
    query: PAGE_DETAIL,
    variables: {
      siteId: input.siteId,
      path: input.path,
      filter: toTrafficFilter({ filters: input.filters, now }),
      bucket: toSeriesBucket(input.filters.range),
    },
  });
  if (result.data === undefined) {
    throw new Error(`The PageDetail query returned no data for "${input.path}" on site "${input.siteId}".`);
  }
  const site = result.data.site;
  if (site === null) {
    return { ...input, site: null, detail: null };
  }
  const detail = site.page === null ? null : toPageDetail({ site, page: site.page });
  return { ...input, site: { id: site.id, name: site.name }, detail };
};

export default async function PageDetailRoute(props: PageDetailRouteProps): Promise<ReactElement> {
  const { site, path, filters, detail } = await loadPageDetail(props);
  if (site === null) {
    notFound();
  }
  return <PageDetailView siteId={site.id} siteName={site.name} path={path} filters={filters} detail={detail} />;
}
