// Session and Pageview types. Session.pageviews is the second DataLoader
// relation: a plain one-to-many, there to show the batching pattern is not
// specific to the percentile query.
import { listPageviewsBySession, type PageviewRow, type SessionRow } from "@/db/queries/sessions";
import { builder } from "../builder";
import { ConnectionTypeEnum, DeviceClassEnum } from "../enums";

const PageviewType = builder.objectRef<PageviewRow>("Pageview").implement({
  description: "One navigation within a session.",
  fields: (t) => ({
    id: t.exposeID("id"),
    path: t.exposeString("path"),
    startedAt: t.field({ type: "DateTime", resolve: (pageview) => pageview.startedAt }),
  }),
});

export const SessionType = builder.objectRef<SessionRow>("Session").implement({
  description: "One visitor's visit: who they were (coarsely) and when.",
  fields: (t) => ({
    id: t.exposeID("id"),
    startedAt: t.field({ type: "DateTime", resolve: (session) => session.startedAt }),
    deviceClass: t.field({ type: DeviceClassEnum, resolve: (session) => session.deviceClass }),
    connectionType: t.field({ type: ConnectionTypeEnum, resolve: (session) => session.connectionType }),
    userAgentFamily: t.exposeString("userAgentFamily"),
    pageviews: t.loadableList({
      type: PageviewType,
      description: "This session's navigations, in visit order.",
      // Called once per request with every session id resolved in the same tick.
      load: (sessionIds: string[], ctx) => Promise.resolve(listPageviewsBySession({ db: ctx.db, sessionIds })),
      resolve: (session) => session.id,
    }),
  }),
});
