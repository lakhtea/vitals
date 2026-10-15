# 14 - Fix review

> Milestone 14 made the human gate more than a yes or no.
> The person reviewing an incident sees the agent's proposed change as a diff and can make a small edit in place (a timeout from five seconds to ten) before approving; every edit is a new revision, and approving pins the exact revision the worker will turn into a pull request.
> This chapter explains how a change is represented and why, what a diff algorithm does, how CodeMirror 6 is built, why the editor is lazy-loaded and how the bundle budget sees it, and why revisions are immutable.

## What was built

- `fix_revisions` and `fix_revision_files`: a proposed change is a base commit SHA, a target repository, a summary, and each touched file's path, action, and full before and after text.
- GraphQL: `Incident.fixRevisions`, `latestFixRevision`, `approvedRevision`; `FixRevision.diff` and `FixRevisionFile.diff`, computed on the server.
  `submitFixRevision` (agents, with the service token), `editFixRevision` (people), and `approveIncident(revisionId)`, which pins what was approved.
- MCP: a `submit_fix` tool, so the M15 fix agent proposes through the same boundary as everything else.
- The incident page's "Proposed change" section: a read-only diff per file in the server HTML, an Edit button that loads CodeMirror only when clicked, Save as a new revision, the revision history, and an "Edited since last review" marker.
- A flag-gated regression, `VITALS_DEMO_REGRESSION=1`, that makes the overview wait on a simulated slow upstream call, and a seeded agent revision that wraps that call in a `5_000` ms timeout: something real to review and edit before M15 produces revisions of its own.
- A second bundle baseline, for `/incidents/[id]`.

## How a change is represented

### Two candidates

A unified diff is the familiar way to show a change: hunks of context, removed lines prefixed `-`, added lines `+`, and `@@ -12,7 +12,9 @@` headers saying where each hunk sits and how long it is.
It is a fine view and a poor thing to edit.
Change one line inside a hunk and the line counts in the header are wrong; a tool applying the patch then rejects it, or worse, applies it somewhere else.
And a patch only means something relative to the file it was made against: `git apply` needs the base.

So a revision here stores what a patch is derived from instead: the base commit SHA, and for each file its full text before and after.
The diff on the page is computed from those two texts on the server, every time.
Editing means changing the after text of a file, which a person understands, and the worker in M15 writes whole files on a branch cut from the base SHA, which cannot half-apply.

### Why revisions are immutable

A person's edit does not modify the agent's revision; it writes revision N + 1 with author `human`, copying the files it did not touch.
The record therefore shows exactly what the agent proposed and exactly what the person changed, which is what you want to read after an incident, and what an evaluation of the agents (M15) needs: a human edit is a labelled correction.
Approval pins a revision id, and approval with anything but the latest revision is refused, so "I approved revision 2" can never quietly mean revision 3.
The "Edited since last review" marker exists because the reviewer agent reviewed revision 1; until a review step covers the latest revision, the page says so, and the worker re-runs review before opening the pull request.

## What a diff algorithm does

Given two sequences of lines, a diff finds the shortest edit script: the fewest insertions and deletions that turn one into the other.
That is the same as finding their longest common subsequence: the lines both share in order are context, everything else is removed or added.
The classic algorithm, Eugene Myers' 1986 "O(ND) difference algorithm", explores edit scripts in order of their length D, so on two files that differ in a few lines it finishes quickly no matter how long they are; `git diff` and the `diff` package used here both descend from it.
The output is then grouped into hunks: each run of changes plus a few lines of context on either side (three here), with the header recording the starting line and length in the old and new file.

## CodeMirror 6

CodeMirror 6 separates what the document is from how it is shown.

- **State.** An `EditorState` is an immutable value: the document text, the selection, and the configuration.
  Nothing changes it in place.
- **Transactions.** A change is a transaction: a description of edits (insert these characters here) plus any selection or effect changes.
  Applying it produces a new state; undo history is just a record of transactions.
- **View.** An `EditorView` owns the DOM: it renders the current state into a `contenteditable` element, turns keystrokes into transactions, and updates the DOM from each new state.
- **Extensions.** Everything else is an extension added to the state's configuration: line numbers, history, keymaps, a language's parser, highlighting, the theme.
  The core is small, which is why the editor here ships only what it uses.

Because the visible text is a real `contenteditable` element, screen readers can read and edit it, and the editor takes an accessible name like any text field.
CodeMirror deliberately leaves Tab unbound unless asked: if Tab inserted indentation, a keyboard user who tabbed into the editor could never tab out.
This editor does not bind it.

## Lazy loading and the bundle budget

Most visitors to an incident page never edit anything, so they should not download an editor.
The editor component is imported with `next/dynamic` and rendered only after a click on Edit; the bundler puts CodeMirror in its own chunk, the browser fetches it at that moment, and a small placeholder holds the space while it loads.
The diffs themselves are plain server-rendered tables, so the page reads completely with JavaScript off.

The bundle budget now has a baseline per route (`bundle-budget.json`).
The incident route's was recorded at M13, before the editor existed, at 707,920 bytes; the CI check fails if a change grows it more than 10%.
A lazily loaded chunk is not part of a route's first-load JavaScript, so this baseline is exactly what proves the editor stayed out of the initial download.
The overview keeps its M8 baseline: recording a new route never resets an older one.

## What it does not do yet, honestly

- The seeded fix does not make the demo fast.
  The planted regression waits 1.5 seconds on a simulated upstream; the seeded agent revision bounds that wait with a 5-second timeout, which caps the worst case and removes none of the 1.5 seconds.
  It exists to give the review surface a real change to read and edit (and the e2e a `5_000` to turn into `10_000`), not as an example of a good fix.
  Finding a fix that actually removes the delay is the M15 fix agent's job, and a good test of it.
- The overview's first-load JavaScript grew 8,161 bytes in this milestone without the overview changing.
  Codegen's client preset puts every dashboard document into one map that any `graphql()` import bundles, so the incident page's new fragment and the edit mutation ride along on every page.
  M13 split the agents' documents out for the same reason; splitting per page, or the preset's build plugin that rewrites `graphql()` calls into direct imports, is the fix if this keeps growing.

## Why every new file exists

The change and its rules:

- `src/incidents/fix.ts`: the authors, actions, caps (20 files, 200 KB per file), and `validateRevisionFiles`, the one place that decides what a valid revision is (relative paths only, no `..`, the right contents for each action).
- `src/incidents/diff.ts`: unified diffs from before and after text with the `diff` package (a Myers implementation), three lines of context.
- `drizzle/0002_fix_revisions.sql` and `src/db/schema.ts`: the two tables and `incidents.approved_revision_id`.
- `src/db/queries/fix-revisions.ts`: listing, submit, and edit; each write is one transaction, and an edit copies the files it does not touch into the new revision.
  `decideIncident` in `incidents.ts` learned the pinning rule: with revisions, approval needs the latest one.

The API and the agents' tool:

- `src/graphql/types/fix-revisions.ts`: `FixRevision` and `FixRevisionFile`, with the diffs computed per request.
- `src/graphql/schema.ts`, `enums.ts`, `inputs.ts`: the two mutations, the new `approveIncident` argument, `FixAuthor`, `FileAction`, `FixFileInput`, `FixFileEdit`.
- `services/vitals-mcp`: `submit_fix`, and `get_incident_context` now shows the latest revision.

The demo:

- `src/demo/slow-upstream.ts`: the flag-gated regression the overview awaits.
- `src/db/synthetic/proposed-fix.ts`: the seeded agent revision; its `before` text must equal the file on disk byte for byte, which a test enforces.
- `attachSeededFix` in `src/db/seed.ts`: attaches it to the `/pricing` incident after detection, because the incident does not exist until the detector opens it.

The page:

- `src/dashboard/fix-review.ts`: parses the server's unified diff into numbered lines, plus labels and the editor's language from a file extension.
- `DiffView.tsx`: a server-rendered table per file, with `+` and `-` in a gutter and visually hidden "added" and "removed" text, so the change reads without colour and without JavaScript.
- `CodeEditor.tsx`: the CodeMirror 6 wrapper; colours go through CSS `light-dark()` so highlighting stays readable in dark mode, lines wrap instead of scrolling inside the editor, and Tab is never captured.
- `FixReview.tsx`: the panel; one file in edit mode at a time, focus returned to that file's Edit button after save or cancel, a failed save keeps what was typed.
- `IncidentFixReview.tsx`: runs `editFixRevision` and refreshes the server render, the same pattern as `IncidentDecision`, which now sends the latest revision id when approving.
- `scripts/check-bundle-budget.ts` and `bundle-budget.json`: one baseline per route.

Tests:

- `src/graphql/fix-revisions.test.ts`, `src/incidents/diff.test.ts`, `src/db/synthetic/proposed-fix.test.ts`, `src/dashboard/fix-review.test.ts`, the MCP case in `services/vitals-mcp/tools.test.ts`, fifteen stories (axe on each), and `e2e/fix-review.spec.ts`: an agent proposes, a person changes `5_000` to `10_000` in the editor, saves revision 2, and approves by keyboard; the test asserts revision 2 by a person is the one pinned, and runs axe with the editor open.
  The e2e opens its own incident through `/api/checks` so it never races the spec that dismisses the seeded one.

Measured: the incident route's First Load JS went from 707,920 bytes (before the editor) to 730,404 (+3.2%); CodeMirror is a separate 542 KB chunk fetched on the first Edit click.

## How to see it working

```bash
npm run db:seed && npm run incidents:detect   # also attaches the seeded proposed fix
VITALS_DEMO_REGRESSION=1 npm run dev
```

Open the overview and notice it takes a moment longer to arrive: that is the regression the seeded fix addresses.
Open the "LCP on /pricing" incident; under the evidence, "Proposed change" shows the agent's revision 1 as a diff of `src/demo/slow-upstream.ts`.
Press Edit, change `5_000` to `10_000`, add a note, and save: revision 2 by Person appears, the diff shows your change against the base, and the "Edited since last review" marker appears.
Approve: the incident pins revision 2.

## Self-check

1. Why does a revision store whole file contents and a base SHA instead of the diff the page shows?
2. A person edits revision 1 and saves. What exactly is written to the database?
3. What does "shortest edit script" have to do with "longest common subsequence"?
4. In CodeMirror 6, what is the difference between the state and the view, and where does undo history live?
5. Why does the editor not bind the Tab key?
6. The incident route's First Load JS did not grow when CodeMirror was added. Why, and what would make it grow?

<details>
<summary>Answers</summary>

1. A patch is only meaningful against its base and breaks when edited by hand (hunk headers count lines). Whole files at a known base are what a person edits naturally and what the worker can write onto a branch without a partial apply; the diff is derived for display.
2. A new `fix_revisions` row with the next number and author `human`, a `fix_revision_files` row per file (the edited one with the new after text, the others copied), and a `human` step in the incident's timeline with the note.
3. They are the same problem seen from two sides: the lines kept in order (the common subsequence) are exactly the lines the edit script does not touch, so maximising one minimises the other.
4. The state is an immutable value (document, selection, configuration) and the view renders a state into the DOM and turns input into transactions. Undo history is part of the state, recorded by the history extension as transactions.
5. If Tab inserted indentation, a keyboard user could tab into the editor but never out of it.
6. The editor is loaded with `next/dynamic` after a click, so it is a separate chunk outside the route's first load. Importing it statically (a normal `import` in the page or in a component rendered on load) would pull it into the first-load JavaScript and the budget check would fail.

</details>
