// SessionsTable with a realistic mix of devices, connections, and journey
// lengths (including one long enough to truncate), and the empty state.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionsTable, type SessionRowData } from "./SessionsTable";

const pages = (...paths: string[]): Array<{ path: string }> => paths.map((path) => ({ path }));

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
