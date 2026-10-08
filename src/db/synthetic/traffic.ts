// Generates believable synthetic RUM traffic as plain row objects with no
// database access, so the distributions can be read, tuned, and tested alone.
// Shape of the fakery: per-path personalities (image-heavy blog posts have
// worse LCP and CLS, the JS-heavy dashboard has worse INP), slower devices and
// connections multiply timings, and TTFB < FCP < LCP always holds.
import type { ConnectionType, DeviceClass } from "@/vitals/dimensions";
import { type MetricName, rateMetric } from "@/vitals/metrics";
import type { MetricEventInsert, PageviewInsert, SessionInsert } from "../schema";
import { createRng, logNormal, pickWeighted, randomInt, type Rng, uniform, type Weighted } from "./random";

interface PathProfile {
  path: string;
  weight: number;
  lcpFactor: number;
  inpFactor: number;
  clsFactor: number;
}

const PATH_PROFILES: ReadonlyArray<PathProfile> = [
  { path: "/", weight: 30, lcpFactor: 1.0, inpFactor: 1.0, clsFactor: 1.0 },
  { path: "/pricing", weight: 12, lcpFactor: 0.9, inpFactor: 0.8, clsFactor: 0.6 },
  { path: "/docs", weight: 10, lcpFactor: 0.8, inpFactor: 0.7, clsFactor: 0.5 },
  { path: "/docs/getting-started", weight: 8, lcpFactor: 0.85, inpFactor: 0.7, clsFactor: 0.5 },
  { path: "/blog", weight: 8, lcpFactor: 1.2, inpFactor: 0.9, clsFactor: 1.4 },
  { path: "/blog/why-field-data-beats-lab-scores", weight: 6, lcpFactor: 1.6, inpFactor: 0.8, clsFactor: 2.2 },
  { path: "/about", weight: 5, lcpFactor: 0.9, inpFactor: 0.6, clsFactor: 0.7 },
  { path: "/login", weight: 8, lcpFactor: 0.7, inpFactor: 1.1, clsFactor: 0.4 },
  { path: "/dashboard", weight: 9, lcpFactor: 1.3, inpFactor: 1.9, clsFactor: 1.1 },
  { path: "/settings", weight: 4, lcpFactor: 1.1, inpFactor: 1.5, clsFactor: 0.9 },
];

const DEVICE_MIX: ReadonlyArray<Weighted<DeviceClass>> = [
  { value: "mobile", weight: 55 },
  { value: "desktop", weight: 40 },
  { value: "tablet", weight: 5 },
];

interface BrowserProfile {
  family: string;
  reportsConnection: boolean;
}

const BROWSER_MIX: ReadonlyArray<Weighted<BrowserProfile>> = [
  { value: { family: "Chrome", reportsConnection: true }, weight: 60 },
  { value: { family: "Safari", reportsConnection: false }, weight: 25 },
  { value: { family: "Firefox", reportsConnection: false }, weight: 8 },
  { value: { family: "Edge", reportsConnection: true }, weight: 5 },
  { value: { family: "Other", reportsConnection: false }, weight: 2 },
];

const REPORTED_CONNECTION_MIX: ReadonlyArray<Weighted<ConnectionType>> = [
  { value: "4g", weight: 80 },
  { value: "3g", weight: 15 },
  { value: "2g", weight: 4 },
  { value: "slow-2g", weight: 1 },
];

const PAGEVIEWS_PER_SESSION: ReadonlyArray<Weighted<number>> = [
  { value: 1, weight: 35 },
  { value: 2, weight: 30 },
  { value: 3, weight: 18 },
  { value: 4, weight: 10 },
  { value: 5, weight: 7 },
];

const DEVICE_SLOWDOWN: Record<DeviceClass, number> = { desktop: 1, tablet: 1.2, mobile: 1.5, unknown: 1.2 };
const CONNECTION_SLOWDOWN: Record<ConnectionType, number> = {
  "4g": 1,
  "3g": 1.8,
  "2g": 3.5,
  "slow-2g": 6,
  unknown: 1.1,
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const INTERACTION_PROBABILITY = 0.7;

interface PageviewMetrics {
  TTFB: number;
  FCP: number;
  LCP: number;
  CLS: number;
  INP: number | null;
}

const sampleCls = (rng: Rng, clsFactor: number): number => {
  const roll = rng();
  if (roll < 0.7) {
    return uniform(rng, 0, 0.04) * clsFactor;
  }
  if (roll < 0.9) {
    return uniform(rng, 0.05, 0.2) * clsFactor;
  }
  return uniform(rng, 0.25, 0.9) * clsFactor;
};

const sampleMetrics = ({
  rng,
  profile,
  device,
  connection,
}: {
  rng: Rng;
  profile: PathProfile;
  device: DeviceClass;
  connection: ConnectionType;
}): PageviewMetrics => {
  const deviceSlowdown = DEVICE_SLOWDOWN[device];
  const connectionSlowdown = CONNECTION_SLOWDOWN[connection];

  const ttfb = logNormal({ rng, median: 350 * connectionSlowdown, sigma: 0.45 });
  const fcp = ttfb + logNormal({ rng, median: 700 * deviceSlowdown * Math.sqrt(connectionSlowdown), sigma: 0.4 });
  const lcp = fcp + logNormal({ rng, median: 900 * profile.lcpFactor * deviceSlowdown, sigma: 0.6 });
  const hasInteraction = rng() < INTERACTION_PROBABILITY;
  const inp = hasInteraction ? logNormal({ rng, median: 110 * profile.inpFactor * deviceSlowdown, sigma: 0.7 }) : null;

  return {
    TTFB: Math.round(ttfb),
    FCP: Math.round(fcp),
    LCP: Math.round(lcp),
    CLS: Number(sampleCls(rng, profile.clsFactor).toFixed(4)),
    INP: inp === null ? null : Math.round(inp),
  };
};

export interface SyntheticTraffic {
  sessions: SessionInsert[];
  pageviews: PageviewInsert[];
  metricEvents: MetricEventInsert[];
}

export const generateSyntheticTraffic = ({
  siteId,
  sessionCount,
  now,
  seed,
}: {
  siteId: string;
  sessionCount: number;
  now: number;
  seed: number;
}): SyntheticTraffic => {
  const rng = createRng(seed);
  const traffic: SyntheticTraffic = { sessions: [], pageviews: [], metricEvents: [] };

  const recordEvent = ({
    pageviewId,
    name,
    value,
    recordedAt,
  }: {
    pageviewId: string;
    name: MetricName;
    value: number;
    recordedAt: number;
  }): void => {
    traffic.metricEvents.push({
      pageviewId,
      metricId: `${pageviewId}-${name}`,
      name,
      value,
      rating: rateMetric({ name, value }),
      recordedAt,
    });
  };

  for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex += 1) {
    const sessionId = `seed-s${sessionIndex}`;
    const device = pickWeighted(rng, DEVICE_MIX);
    const browser = pickWeighted(rng, BROWSER_MIX);
    const connection = browser.reportsConnection ? pickWeighted(rng, REPORTED_CONNECTION_MIX) : "unknown";
    const sessionStartedAt = now - Math.floor(uniform(rng, 0, SEVEN_DAYS_MS));

    traffic.sessions.push({
      id: sessionId,
      siteId,
      startedAt: sessionStartedAt,
      deviceClass: device,
      connectionType: connection,
      userAgentFamily: browser.family,
    });

    let pageviewStartedAt = sessionStartedAt;
    const pageviewCount = pickWeighted(rng, PAGEVIEWS_PER_SESSION);

    for (let pageviewIndex = 0; pageviewIndex < pageviewCount; pageviewIndex += 1) {
      const pageviewId = `${sessionId}-p${pageviewIndex}`;
      const profile = pickWeighted(
        rng,
        PATH_PROFILES.map((candidate) => ({ value: candidate, weight: candidate.weight })),
      );
      traffic.pageviews.push({ id: pageviewId, sessionId, path: profile.path, startedAt: pageviewStartedAt });

      const metrics = sampleMetrics({ rng, profile, device, connection });
      recordEvent({ pageviewId, name: "TTFB", value: metrics.TTFB, recordedAt: pageviewStartedAt + metrics.TTFB });
      recordEvent({ pageviewId, name: "FCP", value: metrics.FCP, recordedAt: pageviewStartedAt + metrics.FCP });
      recordEvent({ pageviewId, name: "LCP", value: metrics.LCP, recordedAt: pageviewStartedAt + metrics.LCP });
      recordEvent({
        pageviewId,
        name: "CLS",
        value: metrics.CLS,
        recordedAt: pageviewStartedAt + randomInt(rng, 2_000, 20_000),
      });
      if (metrics.INP !== null) {
        recordEvent({
          pageviewId,
          name: "INP",
          value: metrics.INP,
          recordedAt: pageviewStartedAt + randomInt(rng, 3_000, 40_000),
        });
      }

      pageviewStartedAt += randomInt(rng, 5_000, 120_000);
    }
  }

  return traffic;
};
