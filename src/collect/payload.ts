// The ingest contract: the exact JSON shape the browser library sends to
// POST /api/collect, validated with zod at the boundary so nothing untyped
// reaches the database. One batch = one session + one pageview + its events.
import { z } from "zod";
import { CONNECTION_TYPES, DEVICE_CLASSES } from "@/vitals/dimensions";
import { MAX_PLAUSIBLE_VALUE, METRIC_NAMES } from "@/vitals/metrics";

/** sendBeacon's own payload ceiling; a batch that large is a bug, not traffic. */
export const MAX_BODY_BYTES = 64 * 1024;
/** Five metrics, plus room for bfcache restores that re-report them. */
export const MAX_EVENTS_PER_BATCH = 25;
/** How far ahead of the server clock a client timestamp may be before it is rejected. */
export const CLOCK_SKEW_ALLOWANCE_MS = 5 * 60 * 1000;

const EARLIEST_PLAUSIBLE_TIMESTAMP_MS = Date.UTC(2020, 0, 1);
export const MAX_ID_LENGTH = 128;
const MAX_PATH_LENGTH = 2048;
const MAX_USER_AGENT_FAMILY_LENGTH = 64;

const identifier = z.string().min(1).max(MAX_ID_LENGTH);

const makeTimestampSchema = (now: number) =>
  z
    .number()
    .int()
    .min(EARLIEST_PLAUSIBLE_TIMESTAMP_MS)
    .max(now + CLOCK_SKEW_ALLOWANCE_MS, { error: "timestamp is in the future" });

const makeEventSchema = (timestamp: z.ZodNumber) =>
  z
    .object({
      id: identifier,
      name: z.enum(METRIC_NAMES),
      value: z.number().min(0),
      recordedAt: timestamp,
    })
    .refine((event) => event.value <= MAX_PLAUSIBLE_VALUE[event.name], {
      path: ["value"],
      error: "value is beyond the plausible range for this metric",
    });

/** Built per request because "not in the future" depends on the current time. */
export const makeCollectPayloadSchema = (now: number) => {
  const timestamp = makeTimestampSchema(now);
  return z.object({
    siteId: identifier,
    session: z.object({
      id: identifier,
      startedAt: timestamp,
      deviceClass: z.enum(DEVICE_CLASSES),
      connectionType: z.enum(CONNECTION_TYPES),
      userAgentFamily: z.string().min(1).max(MAX_USER_AGENT_FAMILY_LENGTH),
    }),
    pageview: z.object({
      id: identifier,
      path: z
        .string()
        .min(1)
        .max(MAX_PATH_LENGTH)
        .startsWith("/")
        .regex(/^[^?#]*$/, { error: "path must be a pathname, without a query string or fragment" }),
      startedAt: timestamp,
    }),
    events: z.array(makeEventSchema(timestamp)).min(1).max(MAX_EVENTS_PER_BATCH),
  });
};

export type CollectPayload = z.infer<ReturnType<typeof makeCollectPayloadSchema>>;
