// Turns any HTTP health endpoint into a pushed check result: fetch it once,
// time it, and classify the outcome as ok, degraded, or failing. This is how
// Vitals watches an application that does not push its own checks; the CLI in
// scripts/check-probe.ts runs it and posts the result to /api/checks.
import type { CheckStatus } from "./status";

export type ProbeOutcome =
  | { kind: "response"; httpStatus: number; latencyMs: number }
  | { kind: "error"; message: string; latencyMs: number };

export interface ProbeVerdict {
  status: CheckStatus;
  /** Round-trip time in milliseconds, so the health panel shows how slow "ok" was. */
  value: number;
  unit: "ms";
  detail: string | null;
}

export const DEFAULT_PROBE_TIMEOUT_MS = 5_000;
export const DEFAULT_DEGRADED_AFTER_MS = 1_000;

const msFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const isSuccess = (httpStatus: number): boolean => httpStatus >= 200 && httpStatus < 300;

/** A 2xx inside the latency budget is ok, a slow 2xx is degraded, anything else is failing. */
export const classifyProbe = ({
  outcome,
  url,
  degradedAfterMs,
}: {
  outcome: ProbeOutcome;
  url: string;
  degradedAfterMs: number;
}): ProbeVerdict => {
  const value = Math.round(outcome.latencyMs);
  if (outcome.kind === "error") {
    return { status: "failing", value, unit: "ms", detail: `No response from ${url}: ${outcome.message}` };
  }
  if (!isSuccess(outcome.httpStatus)) {
    return { status: "failing", value, unit: "ms", detail: `HTTP ${outcome.httpStatus} from ${url}` };
  }
  if (outcome.latencyMs > degradedAfterMs) {
    return {
      status: "degraded",
      value,
      unit: "ms",
      detail: `Slow: ${msFormat.format(value)} ms against a budget of ${msFormat.format(degradedAfterMs)} ms`,
    };
  }
  return { status: "ok", value, unit: "ms", detail: null };
};

/** One timed GET; never throws, because a probe that cannot connect has still learned something. */
export const probeOnce = async ({
  url,
  timeoutMs,
  fetchImpl = fetch,
  clock = () => performance.now(),
}: {
  url: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  clock?: () => number;
}): Promise<ProbeOutcome> => {
  const startedAt = clock();
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    // Drain the body so the connection is released and the timing covers the whole response.
    await response.arrayBuffer();
    return { kind: "response", httpStatus: response.status, latencyMs: clock() - startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "error", message, latencyMs: clock() - startedAt };
  }
};
