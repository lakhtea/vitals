// The one planted vitals regression the demo seed carries, so the detector has
// something real to find: the same visitors load /pricing at the same time on
// two consecutive days and only the second day's LCP is slower. TTFB, FCP,
// CLS, INP, and the device and connection mix repeat exactly, so "only LCP
// moved" is true by construction rather than by luck of the random seed.
import { createRng, uniform } from "./random";
import {
  metricEventsForPageview,
  pathProfileFor,
  pickVisitor,
  sampleMetrics,
  type PageviewMetrics,
  type SyntheticTraffic,
} from "./traffic";

export const REGRESSION_FIXTURE = {
  path: "/pricing",
  /** Well above the detector's sample floor, so the pair is judged in both windows. */
  visitorCount: 30,
  /** Pushes a needs-improvement p75 deep into poor and far past the +50% trigger. */
  lcpMultiplier: 2.5,
  /** Every generated id starts with this, so the fixture never collides with the demo traffic. */
  idPrefix: "regress",
} as const;

const slowerLcp = (metrics: PageviewMetrics): PageviewMetrics => ({
  ...metrics,
  LCP: Math.round(metrics.LCP * REGRESSION_FIXTURE.lcpMultiplier),
});

/**
 * Visits fall in the busy middle half of each window (a site's daytime). The
 * detector is usually run minutes after the seed but may run hours later; while
 * its windows have drifted by less than a quarter window, both still hold
 * exactly the same visits, so the comparison stays clean instead of the p75 of
 * a 30-sample set jumping a rank as visits fall off the edge.
 */
const BUSY_HOURS = { startFraction: 0.25, endFraction: 0.75 } as const;

/**
 * Two batches of single-pageview sessions on the regression path: a baseline
 * batch in [now - 2 * windowMs, now - windowMs) and a slower batch in
 * [now - windowMs, now), the same visitor at the same time of day in each.
 */
export const generateVitalsRegression = ({
  siteId,
  now,
  seed,
  windowMs,
}: {
  siteId: string;
  now: number;
  seed: number;
  windowMs: number;
}): SyntheticTraffic => {
  const rng = createRng(seed);
  const profile = pathProfileFor(REGRESSION_FIXTURE.path);
  const traffic: SyntheticTraffic = { sessions: [], pageviews: [], metricEvents: [] };

  const recordVisit = ({
    sessionId,
    startedAt,
    visitor,
    metrics,
  }: {
    sessionId: string;
    startedAt: number;
    visitor: ReturnType<typeof pickVisitor>;
    metrics: PageviewMetrics;
  }): void => {
    const pageviewId = `${sessionId}-p0`;
    traffic.sessions.push({
      id: sessionId,
      siteId,
      startedAt,
      deviceClass: visitor.device,
      connectionType: visitor.connection,
      userAgentFamily: visitor.browserFamily,
    });
    traffic.pageviews.push({ id: pageviewId, sessionId, path: REGRESSION_FIXTURE.path, startedAt });
    traffic.metricEvents.push(...metricEventsForPageview({ rng, pageviewId, startedAt, metrics }));
  };

  for (let index = 0; index < REGRESSION_FIXTURE.visitorCount; index += 1) {
    const visitor = pickVisitor(rng);
    const metrics = sampleMetrics({ rng, profile, device: visitor.device, connection: visitor.connection });
    const timeOfDay = Math.floor(uniform(rng, BUSY_HOURS.startFraction * windowMs, BUSY_HOURS.endFraction * windowMs));
    const baselineStartedAt = now - 2 * windowMs + timeOfDay;
    const currentStartedAt = now - windowMs + timeOfDay;

    recordVisit({
      sessionId: `${REGRESSION_FIXTURE.idPrefix}-before-s${index}`,
      startedAt: baselineStartedAt,
      visitor,
      metrics,
    });
    recordVisit({
      sessionId: `${REGRESSION_FIXTURE.idPrefix}-after-s${index}`,
      startedAt: currentStartedAt,
      visitor,
      metrics: slowerLcp(metrics),
    });
  }

  return traffic;
};
