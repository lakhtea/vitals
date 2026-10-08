// GraphQL input types. TrafficFilter is the one "for whom and when" argument
// every traffic field accepts, so a client learns it once and passes the same
// variable to pages, metrics, and sessions.
import type { TrafficFilter } from "@/db/queries/filter";
import { builder } from "./builder";
import { ConnectionTypeEnum, DeviceClassEnum } from "./enums";

export const TrafficFilterInput = builder.inputType("TrafficFilter", {
  description: "Narrow traffic to a half-open time window [from, to) and/or session dimensions. Every field is optional.",
  fields: (t) => ({
    from: t.field({ type: "DateTime" }),
    to: t.field({ type: "DateTime" }),
    deviceClass: t.field({ type: DeviceClassEnum }),
    connectionType: t.field({ type: ConnectionTypeEnum }),
  }),
});

type TrafficFilterInputShape = typeof TrafficFilterInput.$inferInput;

export const toTrafficFilter = (input: TrafficFilterInputShape | null | undefined): TrafficFilter => ({
  from: input?.from ?? null,
  to: input?.to ?? null,
  deviceClass: input?.deviceClass ?? null,
  connectionType: input?.connectionType ?? null,
});
