// A path in the pages table becomes a page-detail URL, and the route reads the
// same path back. These prove the round trip for the paths URL segments
// handle badly (a trailing slash, an empty segment, a space, a percent sign,
// non-ASCII), through both of the ways this Next.js hands params down.
import { describe, expect, it } from "vitest";
import { parsePagePathParam } from "./pageDetail";
import { pageDetailHref, pathFromSegments, siteIdFromParam, type ParamEncoding } from "./routes";

/** The URL split as Next's matcher does: /sites/<siteId>/pages/<...segments>?<search>. */
const parseHref = (href: string) => {
  const url = new URL(href, "http://vitals.test");
  const [, , siteId, , ...segments] = url.pathname.split("/");
  return { siteId, segments, raw: Object.fromEntries(url.searchParams) };
};

/** What the route resolves from an href under either param encoding. */
const resolveRoute = ({ href, encoding }: { href: string; encoding: ParamEncoding }) => {
  const { siteId, segments, raw } = parseHref(href);
  // The page's params are the URL's segments as written; generateMetadata's are the decoded values.
  const params =
    encoding === "percent-encoded"
      ? { siteId, segments }
      : { siteId: decodeURIComponent(siteId), segments: segments.map(decodeURIComponent) };
  return {
    siteId: siteIdFromParam({ siteId: params.siteId, encoding }),
    path: parsePagePathParam(raw) ?? pathFromSegments({ segments: params.segments, encoding }),
  };
};

const PATHS = ["/", "/pricing", "/blog/post", "/blog/", "/a//b", "/docs/intro/", "/a b", "/café", "/100%"];

describe("the page-detail URL round trip", () => {
  it.each(PATHS)("%s comes back as itself for the page and for generateMetadata", (path) => {
    const href = pageDetailHref({ siteId: "demo", path });

    expect(resolveRoute({ href, encoding: "percent-encoded" })).toEqual({ siteId: "demo", path });
    expect(resolveRoute({ href, encoding: "decoded" })).toEqual({ siteId: "demo", path });
  });

  it("keeps a plain path as URL segments and only falls back to the path param when it must", () => {
    expect(pageDetailHref({ siteId: "demo", path: "/blog/post" })).toBe("/sites/demo/pages/blog/post");
    expect(pageDetailHref({ siteId: "demo", path: "/" })).toBe("/sites/demo/pages");
    expect(pageDetailHref({ siteId: "demo", path: "/blog/" })).toBe("/sites/demo/pages?path=%2Fblog%2F");
  });

  it("decodes a site id with characters the URL had to escape", () => {
    const href = pageDetailHref({ siteId: "my site/1", path: "/", filters: { range: "all", deviceClass: null, connectionType: null } });

    expect(href).toBe("/sites/my%20site%2F1/pages?range=all");
    expect(resolveRoute({ href, encoding: "percent-encoded" })).toEqual({ siteId: "my site/1", path: "/" });
    expect(resolveRoute({ href, encoding: "decoded" })).toEqual({ siteId: "my site/1", path: "/" });
  });

  it("answers a malformed percent escape with null rather than throwing", () => {
    expect(pathFromSegments({ segments: ["100%"], encoding: "percent-encoded" })).toBeNull();
    expect(siteIdFromParam({ siteId: "%E0%A4%A", encoding: "percent-encoded" })).toBeNull();
    // The same bytes are a fine value once Next has decoded them for generateMetadata.
    expect(pathFromSegments({ segments: ["100%"], encoding: "decoded" })).toBe("/100%");
  });

  it("ignores a path param that is not a pathname", () => {
    expect(parsePagePathParam({ path: "relative" })).toBeNull();
    expect(parsePagePathParam({ path: ["/a", "/b"] })).toBeNull();
    expect(parsePagePathParam({})).toBeNull();
    expect(parsePagePathParam({ path: "/blog/" })).toBe("/blog/");
  });
});
