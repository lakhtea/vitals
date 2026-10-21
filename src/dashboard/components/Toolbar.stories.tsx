// Toolbar as the overview composes it (brand, a status pill, the site select,
// and the filters as a second row) and as a bare brand bar.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Brand } from "./Brand";
import { DEFAULT_FILTERS, FilterBar } from "./FilterBar";
import { SelectField } from "./SelectField";
import { Toolbar } from "./Toolbar";

const meta = {
  title: "Dashboard/Toolbar",
  component: Toolbar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Toolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  args: {
    brand: <Brand />,
    children: (
      <SelectField id="story-site" label="Site" value="demo" onChange={() => undefined}>
        <option value="demo">Demo site (synthetic traffic)</option>
      </SelectField>
    ),
    secondRow: <FilterBar value={DEFAULT_FILTERS} onChange={() => undefined} />,
  },
};

export const BrandOnly: Story = {
  args: { brand: <Brand /> },
};
