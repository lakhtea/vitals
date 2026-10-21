// The icon shell with one set of paths, at the default size and larger.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Icon } from "./Icon";

const CHECK_IN_CIRCLE = (
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="m5.5 8 1.75 1.75L10.5 6.5" />
  </>
);

const meta = {
  title: "Dashboard/Icon",
  component: Icon,
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: CHECK_IN_CIRCLE },
};

export const Larger: Story = {
  args: {
    size: 20,
    children: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="m7 10 2 2 4-4" />
      </>
    ),
  },
};
