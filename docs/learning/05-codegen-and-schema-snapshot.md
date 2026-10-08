# 05 - Codegen and the schema snapshot

> Milestone 5 made the client's queries typed by the server's schema, and made the schema itself a committed, reviewable file that cannot silently drift.

## What was built

- `schema.graphql`: the schema Pothos builds, printed as SDL and sorted, committed at the repo root.
- `npm run codegen`: regenerates the snapshot and then runs GraphQL Codegen's `client` preset into `src/graphql/generated/`.
- `page.tsx` now writes its query through the generated `graphql()` function and gets its result type for free; the hand-written `SitesWithPagesData` interface is gone.
- Two drift guards: a unit test that compares the committed snapshot to the live schema, and a CI step (`codegen:check`) that regenerates everything and fails on any diff.

## The problem being solved

Before this milestone, `page.tsx` declared what the server would return:

```ts
interface SitesWithPagesData {
  sites: Array<{ id: string; name: string; pages: Array<{ path: string; pageviewCount: number }> }>;
}
```

Nothing checked it.
Rename `pageviewCount` on the server and the page compiles, deploys, and renders `undefined`.
Pothos gives the server end-to-end types; this milestone extends that guarantee across the HTTP boundary to the client.

## What a schema snapshot is

Pothos builds the schema in TypeScript, which is excellent for the server and invisible in a code review: a diff to `src/graphql/types/metrics.ts` does not show you what the API now looks like.
`scripts/print-schema.ts` calls graphql-js `printSchema` on the real schema (sorted with `lexicographicSortSchema` so the output order never depends on import order) and writes `schema.graphql`.

Now every schema change produces a second diff, in plain SDL, that a reviewer reads in ten seconds.
The file is also the input to codegen, which is why it must be regenerated before the client types are.

A snapshot is only useful if it cannot go stale.
`src/graphql/schema-snapshot.test.ts` reads the committed file and compares it to a fresh print, so `npm test` fails locally the moment the code and the file disagree, with a message telling you to run `npm run codegen`.

## What codegen generates

Run `npm run codegen` and look inside `src/graphql/generated/`:

- `graphql.ts`: TypeScript types for every schema type (`Site`, `MetricSummary`, the enums as string unions) and, for every operation found in the source, a result type and a variables type (`SitesWithPagesQuery`, `SitesWithPagesQueryVariables`), plus a `TypedDocumentNode` constant per operation.
- `gql.ts`: the `graphql()` function.
  It is a set of TypeScript overloads, one per operation string the generator found.
  Call it with the exact source text of a known operation and the return type is that operation's `TypedDocumentNode`; call it with an unknown string and the fallback overload returns `unknown`, so a typo in a query is a type error at the call site.
- `index.ts`: re-exports.

The trick that makes this work is that the generator scans `src/**/*.tsx` for calls to `graphql(`, parses the string inside, validates it against `schema.graphql`, and emits types for exactly those selections.
Ask for three fields, get a type with three fields.

## How `useQuery` becomes typed

A `TypedDocumentNode<Result, Variables>` is an ordinary GraphQL document object with two phantom type parameters.
Apollo's `useQuery` is declared as `useQuery<TData, TVariables>(query: TypedDocumentNode<TData, TVariables>, ...)`, so passing the generated document lets TypeScript infer `TData`.
`data.sites[0].pages[0].pageviewCount` is now `number`, and `data.sites[0].pages[0].eventCont` is a compile error.
No annotation, no cast, no duplicate interface.

The same document works anywhere a `DocumentNode` does: a server component fetching through Yoga in M7, or a test calling `graphql-js` `execute`.
That is why typed documents were chosen over generated hooks (see the README decision): a hook per operation would have tied every consumer to Apollo's React API.

## What the types caught on day one

The first typecheck after the migration failed with `'site.pages' is possibly 'null'`.
The hand-written interface had declared `pages` as a plain array; the schema, it turned out, declared `pages: [Page!]` with no outer `!`, because Pothos v4 makes every field nullable unless told otherwise.
`id: ID`, `name: String`, `sites: [Site!]`: every field in the API was optional, and nothing had noticed for four milestones because the client's types were written by hand to match the client's hopes.

The fix went to the source: the builder now sets `defaultFieldNullability: false`, so fields are non-null unless they opt in (`site(id:)` does, because an unknown id legitimately returns null).
`schema.graphql` changed in forty places in that one commit, which is exactly the kind of diff the snapshot exists to make visible.
Keep this story for interviews: it is a concrete example of generated types finding a real contract bug that tests and manual QA both missed.

## Why CI regenerates instead of trusting the commit

The unit test only guards `schema.graphql`.
The generated client module could still be stale if someone edited a query in `page.tsx` and forgot to run codegen; the app might even compile, because the old overload still matches the old string.
`npm run codegen:check` in CI regenerates both the snapshot and the client module from scratch and runs `git diff --exit-code` on them.
Any difference between what is committed and what the generator produces fails the build.
It is the cheapest possible guarantee that "what is in the repo" and "what the code does" are the same thing.

## Why every new file exists

- `schema.graphql`: the snapshot described above. Generated; never edited by hand.
- `scripts/print-schema.ts`: produces it. Exports `printSchemaSnapshot` so the test can call the same function the script does.
- `codegen.ts`: codegen configuration. Points at the snapshot, scans `src/**` for documents, excludes tests and the generated folder, turns fragment masking off.
- `src/graphql/generated/`: the output. Committed so a fresh clone typechecks without a generate step, and so reviewers see type changes in diffs. Lint-ignored and excluded from coverage because it is not hand-maintained.
- `src/graphql/schema-snapshot.test.ts`: the drift test.
- `.github/workflows/ci.yml`: gains the `codegen:check` step.
- `src/graphql/builder.ts`: gains `defaultFieldNullability: false` (see "What the types caught on day one").

## How to see it working

```bash
npm run codegen
git status            # clean: nothing to regenerate
```

Now break something on purpose:

1. In `src/graphql/schema.ts`, rename `eventCount` to `eventTotal`.
2. `npm test` fails: the snapshot test says the schema and `schema.graphql` disagree.
3. `npm run codegen` rewrites the snapshot and the generated module.
4. `npm run typecheck` now fails in `page.tsx`, because the query still asks for `eventCount`, which the generated types no longer know.
5. Revert the rename and run `npm run codegen` again.

That sequence is the whole value of the milestone: a server change cannot reach production without the client being updated or the build going red.

## Self-check

1. Why is the snapshot sorted before it is written?
2. What does the generated `graphql()` function return when you pass it a query string the generator has never seen?
3. The unit test passes but CI's `codegen:check` fails. What most likely happened?
4. Why were typed documents chosen over generated hooks?
5. What has to be committed together when you add a field to `MetricSummary` and use it in the page?

<details>
<summary>Answers</summary>

1. So the file's order never depends on import order or object key order in the TypeScript source; an unchanged schema produces a byte-identical file and a real change produces a minimal diff.
2. `unknown`, from the fallback overload, so `useQuery` cannot infer a result type and the call fails to typecheck.
3. The schema did not change but a client query did, and `npm run codegen` was not run, so `src/graphql/generated/` is stale while `schema.graphql` is still correct.
4. A `TypedDocumentNode` works with any GraphQL client or executor, including server-side fetches in M7 and tests, whereas a generated hook ties each operation to Apollo's React API and adds one export per operation.
5. The server code, `schema.graphql`, `src/graphql/generated/`, and `page.tsx`; the snapshot test and `codegen:check` fail if any of them is missing.

</details>
