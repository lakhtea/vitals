// DiffView for each kind of file change a fix can carry: a modified file, a new
// file, a deleted file, lines too long for the panel, and an empty diff. The
// diffs are the shape the server returns (the `diff` package's createPatch).
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { DiffView } from "./DiffView";

const meta = {
  title: "Dashboard/DiffView",
  component: DiffView,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DiffView>;

export default meta;

type Story = StoryObj<typeof meta>;

const modifyDiff = `Index: src/demo/slow-upstream.ts
===================================================================
--- src/demo/slow-upstream.ts
+++ src/demo/slow-upstream.ts
@@ -8,8 +8,12 @@
 const UPSTREAM_URL = "http://localhost:3000/api/demo/slow";
+const UPSTREAM_TIMEOUT_MS = 5_000;
 
 export const loadOverviewExtras = async (): Promise<OverviewExtras> => {
-  const response = await fetch(UPSTREAM_URL);
-  return (await response.json()) as OverviewExtras;
+  try {
+    const response = await fetch(UPSTREAM_URL, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
+    return (await response.json()) as OverviewExtras;
+  } catch {
+    return EMPTY_EXTRAS;
+  }
 };
`;

const addDiff = `Index: src/demo/fallback.ts
===================================================================
--- src/demo/fallback.ts
+++ src/demo/fallback.ts
@@ -0,0 +1,3 @@
+// What the overview shows when the slow upstream does not answer in time.
+export const EMPTY_EXTRAS = { announcements: [], degraded: true } as const;
+export type OverviewExtras = typeof EMPTY_EXTRAS;
`;

const deleteDiff = `Index: src/demo/retry.ts
===================================================================
--- src/demo/retry.ts
+++ src/demo/retry.ts
@@ -1,4 +0,0 @@
-// Retried the upstream call forever; the timeout replaces it.
-export const retryForever = async <T,>(call: () => Promise<T>): Promise<T> => {
-  for (;;) try { return await call(); } catch { /* try again */ }
-};
`;

const longLinesDiff = `--- src/demo/messages.ts
+++ src/demo/messages.ts
@@ -1,2 +1,2 @@
-export const SLOW_UPSTREAM_MESSAGE = "The overview is waiting on the announcements service, which has not answered yet; the page will finish loading once it does, however long that takes.";
+export const SLOW_UPSTREAM_MESSAGE = "The announcements service did not answer within five seconds, so the overview is showing without them; reload the page to try again, or carry on without the announcements.";
 export const SLOW_UPSTREAM_DOCS = "https://example.com/docs/operations/runbooks/overview-page/slow-upstream-announcements-service-timeouts-and-fallbacks";
`;

export const Modify: Story = {
  args: { path: "src/demo/slow-upstream.ts", diff: modifyDiff },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole("table", { name: "Changes to src/demo/slow-upstream.ts" });
    await expect(table).toBeVisible();
    // The added constant is new line 9; the first removed line was old line 11.
    const added = within(table).getByText("const UPSTREAM_TIMEOUT_MS = 5_000;").closest("tr");
    await expect(added).toHaveTextContent(/^9\+added: const UPSTREAM_TIMEOUT_MS = 5_000;$/);
    const removed = within(table).getByText("  const response = await fetch(UPSTREAM_URL);", { normalizer: (text) => text }).closest("tr");
    await expect(removed).toHaveTextContent(/^11-removed:/);
  },
};

export const Add: Story = {
  args: { path: "src/demo/fallback.ts", diff: addDiff },
};

export const Delete: Story = {
  args: { path: "src/demo/retry.ts", diff: deleteDiff },
};

export const LongLines: Story = {
  args: { path: "src/demo/messages.ts", diff: longLinesDiff },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Keyboard users reach the sideways scroller through its own tab stop.
    const scroller = canvas.getByRole("region", { name: "Diff of src/demo/messages.ts" });
    await expect(scroller).toHaveAttribute("tabindex", "0");
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  },
};

export const Empty: Story = {
  args: { path: "src/demo/slow-upstream.ts", diff: "" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No changes.")).toBeVisible();
    await expect(canvas.queryByRole("table")).toBeNull();
  },
};
