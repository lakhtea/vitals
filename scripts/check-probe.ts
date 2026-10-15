// CLI behind `npm run checks:probe`: probes one HTTP health endpoint and pushes
// the verdict to POST /api/checks, so an application that reports nothing can
// still open incidents. Run it from cron, CI, or by hand:
//   VITALS_WRITE_KEY=demo-write-key npm run checks:probe -- --site demo --url https://example.com/healthz
import { parseArgs } from "node:util";
import { classifyProbe, DEFAULT_DEGRADED_AFTER_MS, DEFAULT_PROBE_TIMEOUT_MS, probeOnce } from "@/checks/probe";

const DEFAULT_VITALS_URL = "http://localhost:3000";

const fail = (message: string): never => {
  console.error(`checks:probe: ${message}`);
  process.exit(1);
};

const positiveNumber = ({ name, raw, fallback }: { name: string; raw: string | undefined; fallback: number }): number => {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fail(`--${name} must be a positive number of milliseconds`);
};

const { values } = parseArgs({
  options: {
    site: { type: "string" },
    url: { type: "string" },
    "check-id": { type: "string" },
    name: { type: "string" },
    "degraded-ms": { type: "string" },
    "timeout-ms": { type: "string" },
    vitals: { type: "string" },
  },
});

const siteId = values.site ?? fail("--site <id> is required");
const url = values.url ?? fail("--url <health endpoint> is required");
const writeKey = process.env.VITALS_WRITE_KEY ?? fail("set VITALS_WRITE_KEY to the site's write key");
const vitalsUrl = values.vitals ?? process.env.VITALS_URL ?? DEFAULT_VITALS_URL;
const checkId = values["check-id"] ?? `http-${new URL(url).host}`;
const name = values.name ?? `HTTP ${new URL(url).host}${new URL(url).pathname}`;
const degradedAfterMs = positiveNumber({ name: "degraded-ms", raw: values["degraded-ms"], fallback: DEFAULT_DEGRADED_AFTER_MS });
const timeoutMs = positiveNumber({ name: "timeout-ms", raw: values["timeout-ms"], fallback: DEFAULT_PROBE_TIMEOUT_MS });

// The package is CommonJS, which has no top-level await, so the run lives in a function.
const main = async (): Promise<void> => {
  const observedAt = Date.now();
  const verdict = classifyProbe({ outcome: await probeOnce({ url, timeoutMs }), url, degradedAfterMs });

  const response = await fetch(`${vitalsUrl}/api/checks`, {
    method: "POST",
    headers: { authorization: `Bearer ${writeKey}`, "content-type": "application/json" },
    body: JSON.stringify({ siteId, checks: [{ id: checkId, name, observedAt, ...verdict }] }),
  });

  console.log(`checks:probe: ${checkId} ${verdict.status} (${verdict.value} ms)${verdict.detail ? `: ${verdict.detail}` : ""}`);
  if (response.status !== 202) {
    fail(`POST ${vitalsUrl}/api/checks answered ${response.status}: ${await response.text()}`);
  }
};

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
