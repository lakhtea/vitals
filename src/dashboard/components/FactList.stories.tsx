// FactList as the incident header and the page detail header use it: a few
// label-over-value pairs that divide with hairlines and wrap on a phone.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Fact, FactList } from "./FactList";
import { StatusPill } from "./StatusPill";
import { Timestamp } from "./Timestamp";

const meta = {
  title: "Dashboard/FactList",
  component: FactList,
} satisfies Meta<typeof FactList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const IncidentFacts: Story = {
  args: { children: null },
  render: () => (
    <FactList>
      <Fact label="Source">Web vitals</Fact>
      <Fact label="Detected (UTC)">
        <Timestamp value="2026-10-08T09:40:00Z" />
      </Fact>
      <Fact label="Status">
        <StatusPill tone="poor" size="lg">
          Failing
        </StatusPill>
      </Fact>
    </FactList>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("term")).toHaveLength(3);
    await expect(canvas.getAllByRole("definition")).toHaveLength(3);
  },
};

export const PageFacts: Story = {
  args: { children: null },
  render: () => (
    <FactList>
      <Fact label="Pageviews">1,204</Fact>
      <Fact label="Metric samples">5,612</Fact>
    </FactList>
  ),
};
