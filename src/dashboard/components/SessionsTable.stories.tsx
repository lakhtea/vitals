// SessionsTable with a realistic mix of devices, connections, and journey
// lengths (including one long enough to truncate), the empty state, and the
// 2,000-row stress case that scripts/measure-render.ts benchmarks.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";
import { SessionsTable, type SessionRowData } from "./SessionsTable";

const pages = (...paths: string[]): Array<{ path: string }> => paths.map((path) => ({ path }));

const STRESS_ROW_COUNT = 2000;
const STRESS_SEED = 2000;
const STRESS_WINDOW_END = Date.parse("2026-10-07T23:59:00.000Z");
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_STRESS_PAGEVIEWS = 7;
const STRESS_PATHS = ["/", "/pricing", "/docs", "/docs/getting-started", "/blog", "/login", "/dashboard", "/settings"];
const STRESS_DEVICES = ["MOBILE", "DESKTOP", "TABLET", "UNKNOWN"];
const STRESS_CONNECTIONS = ["SLOW_2G", "TWO_G", "THREE_G", "FOUR_G", "UNKNOWN"];
const STRESS_BROWSERS = ["Chrome", "Chrome Mobile", "Safari", "Mobile Safari", "Firefox", "Edge", "Samsung Internet"];

/** mulberry32, the same PRNG as the seed, so the story is identical on every run and machine. */
const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const generateStressSessions = (count: number): SessionRowData[] => {
  const rng = createRng(STRESS_SEED);
  const pick = <T,>(options: readonly T[]): T => options[Math.floor(rng() * options.length)];
  const sessions = Array.from({ length: count }, (_, index): SessionRowData => {
    const pageviewCount = 1 + Math.floor(rng() * MAX_STRESS_PAGEVIEWS);
    return {
      id: `ses_stress_${String(index).padStart(4, "0")}`,
      startedAt: new Date(STRESS_WINDOW_END - Math.floor(rng() * THIRTY_DAYS_MS)).toISOString(),
      deviceClass: pick(STRESS_DEVICES),
      connectionType: pick(STRESS_CONNECTIONS),
      userAgentFamily: pick(STRESS_BROWSERS),
      pageviews: Array.from({ length: pageviewCount }, () => ({ path: pick(STRESS_PATHS) })),
    };
  });
  // Newest first, the order the sessions resolver returns.
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
};

const SESSIONS: SessionRowData[] = [
  {
    id: "ses_01",
    startedAt: "2026-10-07T21:14:05.000Z",
    deviceClass: "MOBILE",
    connectionType: "FOUR_G",
    userAgentFamily: "Chrome Mobile",
    pageviews: pages("/", "/pricing", "/signup"),
  },
  {
    id: "ses_02",
    startedAt: "2026-10-07T20:48:51.000Z",
    deviceClass: "DESKTOP",
    connectionType: "UNKNOWN",
    userAgentFamily: "Safari",
    pageviews: pages("/docs", "/docs/getting-started", "/docs/api", "/docs/api/collect", "/docs/faq", "/pricing"),
  },
  {
    id: "ses_03",
    startedAt: "2026-10-07T19:02:12.000Z",
    deviceClass: "TABLET",
    connectionType: "THREE_G",
    userAgentFamily: "Firefox",
    pageviews: pages("/blog"),
  },
  {
    id: "ses_04",
    startedAt: "2026-10-07T09:05:00.000Z",
    deviceClass: "MOBILE",
    connectionType: "SLOW_2G",
    userAgentFamily: "Samsung Internet",
    pageviews: pages("/", "/blog/2026/how-we-cut-largest-contentful-paint-in-half-without-touching-the-cdn"),
  },
  {
    id: "ses_05",
    startedAt: "2026-10-06T23:40:33.000Z",
    deviceClass: "DESKTOP",
    connectionType: "FOUR_G",
    userAgentFamily: "Edge",
    pageviews: pages("/pricing", "/signup", "/signup/verify", "/"),
  },
  {
    id: "ses_06",
    startedAt: "2026-10-06T07:12:47.000Z",
    deviceClass: "UNKNOWN",
    connectionType: "TWO_G",
    userAgentFamily: "Chrome",
    pageviews: pages("/status"),
  },
];

const meta = {
  title: "Dashboard/SessionsTable",
  component: SessionsTable,
} satisfies Meta<typeof SessionsTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { sessions: SESSIONS },
};

export const Empty: Story = {
  args: { sessions: [] },
};

// Visible window plus overscan on both sides, with headroom; well under 2,000.
const MAX_WINDOWED_ROWS = 60;

const STRESS_SESSIONS = generateStressSessions(STRESS_ROW_COUNT);

// No play function on purpose: scripts/measure-render.ts times this story's
// first paint, and a play-driven scroll would land inside the measurement.
export const TwoThousandRows: Story = {
  args: { sessions: STRESS_SESSIONS },
};

export const TwoThousandRowsScrolledToEnd: Story = {
  args: { sessions: STRESS_SESSIONS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const lastRowIndex = STRESS_ROW_COUNT + 1;
    await expect(canvas.getByRole("table")).toHaveAttribute("aria-rowcount", String(lastRowIndex));
    // Only the window is in the DOM (spacer rows are aria-hidden, so not counted here).
    await expect(canvas.getAllByRole("row").length).toBeLessThan(MAX_WINDOWED_ROWS);

    const scroller = canvas.getByRole("region", { name: "Recent sessions" });
    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => expect(canvasElement.querySelector(`tr[aria-rowindex="${lastRowIndex}"]`)).not.toBeNull());
  },
};
