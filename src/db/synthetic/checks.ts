// The health-check history the demo seed plants beside the traffic: an API
// check that has just started failing (opens an incident), a steady database
// latency check, and a queue check with a single degraded blip that stays
// below the detector's streak and so must NOT open anything.
import type { CheckInsert } from "../schema";
import { createRng, uniform } from "./random";

export const DEMO_CHECKS = {
  apiHealth: { checkId: "api-health", name: "API health" },
  dbLatency: { checkId: "db-latency-p95", name: "Database latency p95", unit: "ms" },
  queueLag: { checkId: "queue-lag", name: "Queue lag", unit: "s" },
} as const;

/** Twelve observations five minutes apart: 55 minutes of history ending at `now`. */
const OBSERVATION_COUNT = 12;
const INTERVAL_MS = 5 * 60 * 1000;
/** The API check fails on the last two observations, so the incident is ten minutes old at seed time. */
const API_FAILING_TAIL = 2;
export const API_FAILURE_DETAIL = "HTTP 503 from /healthz";
/** One degraded queue reading in the middle, then back to OK: a blip, not an incident. */
const QUEUE_BLIP_INDEX = 5;
const QUEUE_BLIP_LAG_SECONDS = 12.4;

const roundTo = (value: number, decimals: number): number => Number(value.toFixed(decimals));

export const generateCheckObservations = ({
  siteId,
  now,
  seed,
}: {
  siteId: string;
  now: number;
  seed: number;
}): CheckInsert[] => {
  const rng = createRng(seed);

  return Array.from({ length: OBSERVATION_COUNT }, (_, index): CheckInsert[] => {
    const observedAt = now - (OBSERVATION_COUNT - 1 - index) * INTERVAL_MS;
    const isApiFailing = index >= OBSERVATION_COUNT - API_FAILING_TAIL;
    const isQueueBlip = index === QUEUE_BLIP_INDEX;

    return [
      {
        siteId,
        ...DEMO_CHECKS.apiHealth,
        status: isApiFailing ? "failing" : "ok",
        value: null,
        unit: null,
        observedAt,
        detail: isApiFailing ? API_FAILURE_DETAIL : null,
      },
      {
        siteId,
        ...DEMO_CHECKS.dbLatency,
        status: "ok",
        value: roundTo(uniform(rng, 40, 60), 1),
        observedAt,
        detail: null,
      },
      {
        siteId,
        ...DEMO_CHECKS.queueLag,
        status: isQueueBlip ? "degraded" : "ok",
        value: isQueueBlip ? QUEUE_BLIP_LAG_SECONDS : roundTo(uniform(rng, 0.4, 2.5), 2),
        observedAt,
        detail: isQueueBlip ? `lag above 10 s for one interval` : null,
      },
    ];
  }).flat();
};
