// The GraphQL schema: object types, root queries, and the data access behind
// them. builder.toSchema() at the bottom is where Pothos emits a graphql-js schema.
import { eq } from "drizzle-orm";
import { type PageAggregate, listPagesForSite } from "@/db/queries/pages";
import { type SiteRow, sites } from "@/db/schema";
import { builder } from "./builder";

// A Page is an aggregate over pageviews, not a stored row, so it has no id of
// its own; Apollo keeps it nested under its parent Site in the cache.
const PageType = builder.objectRef<PageAggregate>("Page").implement({
  description: "Traffic for one URL path, aggregated over its pageviews.",
  fields: (t) => ({
    path: t.exposeString("path"),
    pageviewCount: t.exposeInt("pageviewCount"),
    eventCount: t.exposeInt("eventCount", { description: "Metric events recorded on this path." }),
  }),
});

const SiteType = builder.objectRef<SiteRow>("Site").implement({
  description: "A property being measured. v1 seeds exactly one.",
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    createdAt: t.string({ resolve: (site) => new Date(site.createdAt).toISOString() }),
    pages: t.field({
      type: [PageType],
      resolve: (site, _args, ctx) => listPagesForSite({ db: ctx.db, siteId: site.id }),
    }),
  }),
});

builder.queryFields((t) => ({
  sites: t.field({
    type: [SiteType],
    resolve: (_root, _args, ctx) => ctx.db.select().from(sites).orderBy(sites.name).all(),
  }),
  site: t.field({
    type: SiteType,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, args, ctx) =>
      ctx.db.select().from(sites).where(eq(sites.id, String(args.id))).get() ?? null,
  }),
  pages: t.field({
    type: [PageType],
    args: { siteId: t.arg.id({ required: true }) },
    resolve: (_root, args, ctx) => listPagesForSite({ db: ctx.db, siteId: String(args.siteId) }),
  }),
}));

export const schema = builder.toSchema();
