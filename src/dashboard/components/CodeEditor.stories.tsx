// CodeEditor on a TypeScript file, with the interaction test that proves the
// editable area carries its accessible name and that a keystroke reaches
// onChange. FixReview loads this same component lazily.
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { CodeEditor } from "./CodeEditor";

const slowUpstream = `// Loads the overview's announcements from the slow demo upstream.
const UPSTREAM_URL = "http://localhost:3000/api/demo/slow";
const UPSTREAM_TIMEOUT_MS = 5_000;

export const loadOverviewExtras = async (): Promise<OverviewExtras> => {
  try {
    const response = await fetch(UPSTREAM_URL, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    return (await response.json()) as OverviewExtras;
  } catch {
    return EMPTY_EXTRAS;
  }
};
`;

const meta = {
  title: "Dashboard/CodeEditor",
  component: CodeEditor,
  args: { onChange: fn() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TypeScriptFile: Story = {
  args: { value: slowUpstream, language: "typescript", label: "Edit src/demo/slow-upstream.ts" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "Edit src/demo/slow-upstream.ts" });
    await expect(editor).toHaveTextContent("UPSTREAM_TIMEOUT_MS = 5_000");
    // Highlighting is on: a keyword takes its token colour (the light half of its light-dark() pair).
    const keyword = within(editor).getAllByText("const")[0];
    await expect(getComputedStyle(keyword).color).toBe("rgb(119, 0, 136)");
    await userEvent.click(editor);
    await userEvent.keyboard("x");
    await waitFor(() => expect(args.onChange).toHaveBeenCalled());
    // Tab is not trapped: it moves focus out of the editor.
    await userEvent.tab();
    await expect(editor).not.toHaveFocus();
  },
};
