// The contract of POST /api/checks: the JSON an application pushes when it
// reports health-check results, validated with zod at the boundary so nothing
// untyped reaches the database. One batch = one site + up to 50 observations.
import { z } from "zod";
import { CLOCK_SKEW_ALLOWANCE_MS, MAX_ID_LENGTH } from "@/collect/payload";
import { CHECK_STATUSES } from "./status";

// The same body cap as /api/collect, so operators learn one number for both
// endpoints. It bounds what the server buffers, not what a batch may say: a
// reporter with fifty long details splits the delivery.
export { MAX_BODY_BYTES } from "@/collect/payload";

/** Enough for a scheduler to report every check it owns at once; more is a loop bug. */
export const MAX_CHECKS_PER_BATCH = 50;

const MAX_NAME_LENGTH = 120;
const MAX_UNIT_LENGTH = 16;
const MAX_DETAIL_LENGTH = 2000;
const EARLIEST_PLAUSIBLE_TIMESTAMP_MS = Date.UTC(2020, 0, 1);

/** Site ids and check ids share the shape of every other id the API accepts. */
const identifier = z.string().min(1).max(MAX_ID_LENGTH);

const makeCheckSchema = (now: number) =>
  z.object({
    id: identifier,
    name: z.string().min(1).max(MAX_NAME_LENGTH),
    status: z.enum(CHECK_STATUSES),
    /** The measurement behind the status, when there is one (a latency, a queue depth). */
    value: z.number().nullish(),
    unit: z.string().max(MAX_UNIT_LENGTH).nullish(),
    observedAt: z
      .number()
      .int()
      .min(EARLIEST_PLAUSIBLE_TIMESTAMP_MS)
      .max(now + CLOCK_SKEW_ALLOWANCE_MS, { error: "timestamp is in the future" }),
    detail: z.string().max(MAX_DETAIL_LENGTH).nullish(),
  });

/** Built per request because "not in the future" depends on the current time. */
export const makeChecksPayloadSchema = (now: number) =>
  z.object({
    siteId: identifier,
    checks: z.array(makeCheckSchema(now)).min(1).max(MAX_CHECKS_PER_BATCH),
  });

export type ChecksPayload = z.infer<ReturnType<typeof makeChecksPayloadSchema>>;
