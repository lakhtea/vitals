// Check and CheckObservation. A check is shown at its latest observation (a
// health panel says "API health: failing since 10:04"), and the history behind
// it is a separate list so the overview never pays for rows it does not show.
import { listCheckHistory } from "@/db/queries/checks";
import type { CheckRow } from "@/db/schema";
import { builder } from "../builder";
import { CheckStatusEnum } from "../enums";

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 200;

const clampHistoryLimit = (limit: number): number => Math.min(Math.max(limit, 1), MAX_HISTORY_LIMIT);

const CheckObservationType = builder.objectRef<CheckRow>("CheckObservation").implement({
  description: "One result an application reported for a check.",
  fields: (t) => ({
    status: t.field({ type: CheckStatusEnum, resolve: (row) => row.status }),
    value: t.exposeFloat("value", { nullable: true, description: "The measurement behind the status, if the check has one." }),
    unit: t.exposeString("unit", { nullable: true }),
    observedAt: t.field({ type: "DateTime", resolve: (row) => row.observedAt }),
    detail: t.exposeString("detail", { nullable: true }),
  }),
});

export const CheckType = builder.objectRef<CheckRow>("Check").implement({
  description: "A health check an application reports, shown at its latest observation.",
  fields: (t) => ({
    checkId: t.exposeString("checkId", { description: "The application's own stable identifier, e.g. api-latency-p95." }),
    name: t.exposeString("name"),
    status: t.field({ type: CheckStatusEnum, resolve: (row) => row.status }),
    value: t.exposeFloat("value", { nullable: true, description: "The measurement behind the status, if the check has one." }),
    unit: t.exposeString("unit", { nullable: true }),
    observedAt: t.field({ type: "DateTime", resolve: (row) => row.observedAt }),
    detail: t.exposeString("detail", { nullable: true }),
    history: t.field({
      type: [CheckObservationType],
      description: "Past observations including this one, newest first. `limit` is clamped to 1..200.",
      args: { limit: t.arg.int({ defaultValue: DEFAULT_HISTORY_LIMIT }) },
      resolve: (row, args, ctx) =>
        listCheckHistory({
          db: ctx.db,
          siteId: row.siteId,
          checkId: row.checkId,
          limit: clampHistoryLimit(args.limit ?? DEFAULT_HISTORY_LIMIT),
        }),
    }),
  }),
});
