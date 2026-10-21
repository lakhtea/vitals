// BreakdownTable populated with a realistic device split, empty, every cell
// poor (the dots must not be the only signal), and a value the labels module
// has no name for yet, long enough to test the row-label column.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { BreakdownRowData } from "../pageDetail";
import { BreakdownTable } from "./BreakdownTable";

const DEVICE_ROWS: BreakdownRowData[] = [
  {
    value: "MOBILE",
    metrics: {
      LCP: { p75: 3120, rating: "needs-improvement" },
      CLS: { p75: 0.04, rating: "good" },
      INP: { p75: 240, rating: "needs-improvement" },
      TTFB: { p75: 910, rating: "needs-improvement" },
      FCP: { p75: 1980, rating: "needs-improvement" },
    },
    sampleCount: 612,
  },
  {
    value: "DESKTOP",
    metrics: {
      LCP: { p75: 1840, rating: "good" },
      CLS: { p75: 0.02, rating: "good" },
      INP: { p75: 140, rating: "good" },
      TTFB: { p75: 420, rating: "good" },
      FCP: { p75: 1210, rating: "good" },
    },
    sampleCount: 488,
  },
  {
    value: "TABLET",
    metrics: {
      LCP: { p75: 4710, rating: "poor" },
      CLS: { p75: 0.31, rating: "poor" },
      TTFB: { p75: 1460, rating: "good" },
      FCP: { p75: 2890, rating: "needs-improvement" },
    },
    sampleCount: 41,
  },
];

const ALL_POOR_ROWS: BreakdownRowData[] = [
  {
    value: "SLOW_2G",
    metrics: {
      LCP: { p75: 9800, rating: "poor" },
      CLS: { p75: 0.42, rating: "poor" },
      INP: { p75: 880, rating: "poor" },
      TTFB: { p75: 3900, rating: "poor" },
      FCP: { p75: 6200, rating: "poor" },
    },
    sampleCount: 12,
  },
  {
    value: "TWO_G",
    metrics: {
      LCP: { p75: 7100, rating: "poor" },
      CLS: { p75: 0.28, rating: "poor" },
      INP: { p75: 610, rating: "poor" },
      TTFB: { p75: 2400, rating: "poor" },
      FCP: { p75: 4500, rating: "poor" },
    },
    sampleCount: 27,
  },
];

const LONG_LABEL_ROWS: BreakdownRowData[] = [
  {
    value: "SOME_FUTURE_CONNECTION_TYPE_THE_LABELS_MODULE_DOES_NOT_NAME_YET",
    metrics: {
      LCP: { p75: 2210, rating: "good" },
      CLS: { p75: 0.09, rating: "good" },
      INP: { p75: 190, rating: "good" },
      TTFB: { p75: 640, rating: "good" },
      FCP: { p75: 1500, rating: "good" },
    },
    sampleCount: 3,
  },
  ...ALL_POOR_ROWS,
];

const meta = {
  title: "Dashboard/BreakdownTable",
  component: BreakdownTable,
} satisfies Meta<typeof BreakdownTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ByDevice: Story = {
  args: { dimension: "device", rows: DEVICE_ROWS },
};

export const Empty: Story = {
  args: { dimension: "connection", rows: [] },
};

export const AllPoor: Story = {
  args: { dimension: "connection", rows: ALL_POOR_ROWS },
};

export const LongLabels: Story = {
  args: { dimension: "connection", rows: LONG_LABEL_ROWS },
};
