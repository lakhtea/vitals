// A deliberate, flag-gated regression. With VITALS_DEMO_REGRESSION=1 the
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
