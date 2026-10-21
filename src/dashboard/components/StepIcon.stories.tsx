// Every step glyph on one row, each with its role beside it, since the icon is
// decorative and the word is what a reader gets.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { STEP_ROLES } from "@/incidents/vocabulary";
import { stepRoleLabel } from "../incidents";
import { StepIcon, type StepIconName } from "./StepIcon";

const NAMES: ReadonlyArray<{ name: StepIconName; label: string }> = [
  ...STEP_ROLES.map((role) => ({ name: role, label: stepRoleLabel(role) })),
  { name: "empty", label: "No steps yet" },
];

const meta = {
  title: "Dashboard/StepIcon",
  component: StepIcon,
} satisfies Meta<typeof StepIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EveryRole: Story = {
  args: { name: "summarize" },
  render: () => (
    <ul style={{ display: "grid", gap: "0.5rem", listStyle: "none" }}>
      {NAMES.map(({ name, label }) => (
        <li key={name} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <StepIcon name={name} />
          {label}
        </li>
      ))}
    </ul>
  ),
};
