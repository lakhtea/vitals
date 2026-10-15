// The proposed fix the demo seed attaches to the planted /pricing LCP incident,
// so the review editor has a real change to show and edit before the M15 agent
// writes revisions itself. `before` must match src/demo/slow-upstream.ts byte for byte.
import type { RevisionFile } from "@/incidents/fix";

const BEFORE = `// A deliberate, flag-gated regression. With VITALS_DEMO_REGRESSION=1 the
// overview waits on a slow upstream call with no timeout, so TTFB and LCP get
// worse for real; it exists so the M15 fix agent has a real cause to find.

/** How long the pretend upstream service takes to answer. */
const UPSTREAM_DELAY_MS = 1_500;

const simulateUpstreamCall = (): Promise<string> =>
  new Promise((resolve) => {
    setTimeout(() => resolve("upstream: ok"), UPSTREAM_DELAY_MS);
  });

/** The status line the overview shows; slow only when the regression flag is on. */
export const loadUpstreamStatus = async (): Promise<string> => {
  if (process.env.VITALS_DEMO_REGRESSION !== "1") {
    return "upstream: skipped";
  }
  return simulateUpstreamCall();
};
`;

const AFTER = `// A deliberate, flag-gated regression. With VITALS_DEMO_REGRESSION=1 the
// overview waits on a slow upstream call with no timeout, so TTFB and LCP get
// worse for real; it exists so the M15 fix agent has a real cause to find.

/** How long the pretend upstream service takes to answer. */
const UPSTREAM_DELAY_MS = 1_500;

/** Past this, the overview stops waiting and shows the last status it knew. */
const UPSTREAM_TIMEOUT_MS = 5_000;
const STALE_STATUS = "upstream: stale (timed out)";

const simulateUpstreamCall = (): Promise<string> =>
  new Promise((resolve) => {
    setTimeout(() => resolve("upstream: ok"), UPSTREAM_DELAY_MS);
  });

/** Resolves with the call's answer, or with STALE_STATUS once the timeout passes. */
const withTimeout = async (call: Promise<string>): Promise<string> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(STALE_STATUS), UPSTREAM_TIMEOUT_MS);
  });
  try {
    return await Promise.race([call, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

/** The status line the overview shows; slow only when the regression flag is on. */
export const loadUpstreamStatus = async (): Promise<string> => {
  if (process.env.VITALS_DEMO_REGRESSION !== "1") {
    return "upstream: skipped";
  }
  return withTimeout(simulateUpstreamCall());
};
`;

export const SEEDED_FIX = {
  path: "src/demo/slow-upstream.ts",
  targetRepo: "lakhtea/vitals",
  baseSha: "seeded-demo",
  summary: "Bound the overview's upstream call with a 5 second timeout that falls back to a stale status",
  before: BEFORE,
  after: AFTER,
} as const;

/** SEEDED_FIX as the one file of a revision. */
export const SEEDED_FIX_FILES: RevisionFile[] = [
  { path: SEEDED_FIX.path, action: "modify", before: SEEDED_FIX.before, after: SEEDED_FIX.after },
];
