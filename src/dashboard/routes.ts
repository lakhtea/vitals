// The dashboard's own URLs in one place, so a link in a table and the route
// that answers it cannot drift apart. A page's path keeps its slashes as URL
// segments ("/blog/post" -> "/sites/demo/pages/blog/post"); the root path is
// the bare route; a path the segment form cannot carry (a trailing slash, an
// empty segment) travels as a `path` search param instead.
import type { DashboardFilters } from "./filters";
import { DEFAULT_FILTERS } from "./filters";

export const PAGE_DETAIL_PARAM = { path: "path", range: "range", device: "device", connection: "connection" } as const;

/**
 * How a dynamic param reached the code reading it. This Next.js hands a page
 * its params percent-encoded per segment ("a b" arrives as "a%20b": the
 * matcher decodes the URL, then getDynamicParam re-encodes each value for the
 * component tree), but hands generateMetadata the decoded values
 * (resolve-metadata reads the interpolated params directly). Verified on the
 * dev server and a production build: a request for /sites/my%20site/pages/a%20b
 * logs siteId "my%20site" in the page and "my site" in generateMetadata.
 */
export type ParamEncoding = "percent-encoded" | "decoded";

/** The decoded value, or null for a malformed escape ("100%"): a bad URL the route answers with 404, not a crash. */
const decodeParam = ({ value, encoding }: { value: string; encoding: ParamEncoding }): string | null => {
  if (encoding === "decoded") {
    return value;
  }
  try {
    return decodeURIComponent(value);
  } catch (error) {
    if (error instanceof URIError) {
      return null;
    }
    throw error;
  }
};

const toSegments = (path: string): string[] => path.split("/").filter((segment) => segment !== "");

const joinSegments = (segments: readonly string[]): string => `/${segments.join("/")}`;

/** True when splitting into URL segments and joining back gives the same path: no trailing slash, no empty segment. */
const survivesSegmentForm = (path: string): boolean => joinSegments(toSegments(path)) === path;

/** Only the filters that differ from the defaults travel, so the default view has a clean URL. */
export const toFilterSearchParams = (filters: DashboardFilters): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.range !== DEFAULT_FILTERS.range) {
    params.set(PAGE_DETAIL_PARAM.range, filters.range);
  }
  if (filters.deviceClass !== null) {
    params.set(PAGE_DETAIL_PARAM.device, filters.deviceClass);
  }
  if (filters.connectionType !== null) {
    params.set(PAGE_DETAIL_PARAM.connection, filters.connectionType);
  }
  return params;
};

export const pageDetailHref = ({
  siteId,
  path,
  filters = DEFAULT_FILTERS,
}: {
  siteId: string;
  path: string;
  filters?: DashboardFilters;
}): string => {
  const base = `/sites/${encodeURIComponent(siteId)}/pages`;
  const params = new URLSearchParams();
  const resolvePathname = (): string => {
    if (!survivesSegmentForm(path)) {
      params.set(PAGE_DETAIL_PARAM.path, path);
      return base;
    }
    const segments = toSegments(path).map(encodeURIComponent).join("/");
    return segments === "" ? base : `${base}/${segments}`;
  };
  const pathname = resolvePathname();
  toFilterSearchParams(filters).forEach((value, key) => params.set(key, value));
  const search = params.toString();
  return search === "" ? pathname : `${pathname}?${search}`;
};

export const siteIdFromParam = ({ siteId, encoding }: { siteId: string; encoding: ParamEncoding }): string | null =>
  decodeParam({ value: siteId, encoding });

/** The route's optional catch-all segments back into the stored path: [] -> "/", ["blog","post"] -> "/blog/post". */
export const pathFromSegments = ({
  segments = [],
  encoding,
}: {
  segments?: readonly string[];
  encoding: ParamEncoding;
}): string | null => {
  const decoded: string[] = [];
  for (const segment of segments) {
    const value = decodeParam({ value: segment, encoding });
    if (value === null) {
      return null;
    }
    decoded.push(value);
  }
  return joinSegments(decoded);
};
