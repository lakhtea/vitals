// FixReview as a reviewer meets it: the agent's first revision, a revision a
// person edited (with the badge and the history), a closed incident that can no
// longer be edited, a fix touching several files, and the keyboard edit flow.
import { EditorView } from "@codemirror/view";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { FixReview, type FixFileData, type FixRevisionData, type FixRevisionSummary } from "./FixReview";

const BASE_SHA = "4f2c9e1b7a3d5c8e0f6a2b9d1c4e7f3a5b8c0d2e";
const AGENT_AT = Date.UTC(2026, 9, 14, 21, 42);
const PERSON_AT = Date.UTC(2026, 9, 14, 22, 5);

const slowUpstreamAfter = `// Loads the overview's announcements from the slow demo upstream.
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

const slowUpstream: FixFileData = {
  path: "src/demo/slow-upstream.ts",
  action: "modify",
  afterContent: slowUpstreamAfter,
  diff: `Index: src/demo/slow-upstream.ts
===================================================================
--- src/demo/slow-upstream.ts
+++ src/demo/slow-upstream.ts
@@ -1,8 +1,12 @@
 // Loads the overview's announcements from the slow demo upstream.
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
`,
};

const personEdit: FixFileData = {
  ...slowUpstream,
  afterContent: slowUpstreamAfter.replace("5_000", "10_000"),
  diff: slowUpstream.diff.replace("5_000", "10_000"),
};

const fallback: FixFileData = {
  path: "src/demo/fallback.ts",
  action: "add",
  afterContent: `// What the overview shows when the slow upstream does not answer in time.
export const EMPTY_EXTRAS = { announcements: [], degraded: true } as const;
`,
  diff: `--- src/demo/fallback.ts
+++ src/demo/fallback.ts
@@ -0,0 +1,2 @@
+// What the overview shows when the slow upstream does not answer in time.
+export const EMPTY_EXTRAS = { announcements: [], degraded: true } as const;
`,
};

const retry: FixFileData = {
  path: "src/demo/retry.ts",
  action: "delete",
  afterContent: null,
  diff: `--- src/demo/retry.ts
+++ src/demo/retry.ts
@@ -1,3 +0,0 @@
-// Retried the upstream call forever; the timeout replaces it.
-export const retryForever = async <T,>(call: () => Promise<T>): Promise<T> => {
-};
`,
};

const changelog: FixFileData = {
  path: "docs/operations.md",
  action: "modify",
  afterContent: "# Operations\n\nThe overview gives up on announcements after five seconds.\n",
  diff: `--- docs/operations.md
+++ docs/operations.md
@@ -1,3 +1,3 @@
 # Operations
 
-The overview waits for announcements.
+The overview gives up on announcements after five seconds.
`,
};

const agentSummary = "Wrap the announcements call in a 5 s timeout and fall back to an empty list, so TTFB no longer waits on it.";

const agentRevision: FixRevisionData = {
  id: "rev-1",
  number: 1,
  author: "agent",
  createdAt: AGENT_AT,
  summary: agentSummary,
  targetRepo: "lakhtea/vitals",
  baseSha: BASE_SHA,
  reviewed: true,
  files: [slowUpstream],
};

const agentHistory: FixRevisionSummary[] = [{ number: 1, author: "agent", createdAt: AGENT_AT, summary: agentSummary }];

const meta = {
  title: "Dashboard/FixReview",
  component: FixReview,
  args: {
    revision: agentRevision,
    history: agentHistory,
    editable: true,
    onSave: fn(async () => {}),
    busy: false,
    error: null,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FixReview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AgentRevision: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 2, name: "Proposed change" })).toBeVisible();
    await expect(canvas.getByText(/^Revision 1 by Agent,/, { selector: "p" })).toHaveTextContent(
      /against lakhtea\/vitals at 4f2c9e1$/,
    );
    await expect(canvas.queryByText("Edited since last review")).toBeNull();
    await expect(canvas.getByRole("table", { name: "Changes to src/demo/slow-upstream.ts" })).toBeVisible();
  },
};

export const EditedByPerson: Story = {
  args: {
    revision: {
      ...agentRevision,
      id: "rev-2",
      number: 2,
      author: "human",
      createdAt: PERSON_AT,
      summary: "Ten seconds: the announcements service is slow but rarely dead.",
      reviewed: false,
      files: [personEdit],
    },
    history: [
      ...agentHistory,
      {
        number: 2,
        author: "human",
        createdAt: PERSON_AT,
        summary: "Ten seconds: the announcements service is slow but rarely dead.",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Edited since last review")).toBeVisible();
    const history = within(canvas.getByRole("list", { name: "Revision history" }));
    await expect(history.getAllByRole("listitem")).toHaveLength(2);
    await expect(history.getAllByRole("listitem")[1]).toHaveTextContent(/^Revision 2 by Person, .*Ten seconds/);
  },
};

export const NotEditable: Story = {
  args: { editable: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.getByRole("table", { name: "Changes to src/demo/slow-upstream.ts" })).toBeVisible();
  },
};

export const ManyFiles: Story = {
  args: { revision: { ...agentRevision, files: [slowUpstream, fallback, retry, changelog] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Added and modified files can be edited; a deleted file has nothing to edit.
    await expect(canvas.getAllByRole("button", { name: /^Edit / })).toHaveLength(3);
    await expect(canvas.queryByRole("button", { name: "Edit src/demo/retry.ts" })).toBeNull();
    await expect(canvas.getByText("Deleted")).toBeVisible();
  },
};

export const EditFlow: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const editButton = canvas.getByRole("button", { name: "Edit src/demo/slow-upstream.ts" });
    await userEvent.click(editButton);
    const editor = await canvas.findByRole("textbox", { name: "Edit src/demo/slow-upstream.ts" }, { timeout: 5000 });
    await expect(editor).toHaveTextContent("UPSTREAM_TIMEOUT_MS = 5_000");

    // Saving without a change says so and writes no revision.
    await userEvent.click(canvas.getByRole("button", { name: "Save as new revision" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Nothing changed.");
    await expect(args.onSave).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Edit src/demo/slow-upstream.ts" })).toHaveFocus());
    await expect(canvas.queryByRole("textbox", { name: "Edit src/demo/slow-upstream.ts" })).toBeNull();
  },
};

export const SaveEdit: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit src/demo/slow-upstream.ts" }));
    const editor = await canvas.findByRole("textbox", { name: "Edit src/demo/slow-upstream.ts" }, { timeout: 5000 });
    // Typing is the CodeEditor story's job. Here the edit goes through CodeMirror's own API: synthetic
    // keystrokes race its asynchronous selection sync, and on a slow CI runner they landed out of order.
    const view = EditorView.findFromDOM(editor.closest<HTMLElement>(".cm-editor") ?? editor);
    if (view === null) {
      throw new Error("No CodeMirror view behind the editor");
    }
    view.dispatch({ changes: { from: view.state.doc.length, insert: "// reviewed\n" } });
    await userEvent.type(canvas.getByLabelText("Why you changed it (optional)"), "  Marked as reviewed.  ");
    await userEvent.click(canvas.getByRole("button", { name: "Save as new revision" }));
    await expect(args.onSave).toHaveBeenCalledWith({
      revisionId: "rev-1",
      files: [{ path: "src/demo/slow-upstream.ts", afterContent: expect.stringContaining("// reviewed") }],
      note: "Marked as reviewed.",
    });
    await waitFor(() => expect(canvas.getByRole("button", { name: "Edit src/demo/slow-upstream.ts" })).toHaveFocus());
  },
};

export const SaveFailed: Story = {
  args: { error: "Could not save the edit: the file is larger than 200 KB." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit src/demo/slow-upstream.ts" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(/Could not save the edit/);
  },
};
