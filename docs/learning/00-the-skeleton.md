# 00 - The walking skeleton

> Read this before anything else.
> It explains the repo exactly as it stood at the start of M0, before the Vitals domain existed.
> Every later chapter assumes you know what is here.

## What was built

A "walking skeleton" is the thinnest possible slice that touches every layer of a system and actually runs.
Ours is one GraphQL query that travels from a React component in the browser, over HTTP, through a GraphQL server, into a SQL database, and back into a table on the page.
It also carries the full quality harness: TypeScript strict mode, ESLint, unit tests with an in-memory database, a browser test with Playwright, and a CI workflow that runs all of it.

The domain inside the skeleton was a job-application tracker, because that is what the scaffold was first built for.
The Vitals project keeps the skeleton and throws away the domain.
Milestone 1 replaces every tracker noun (application, contact, stage) with the RUM domain (site, session, pageview, metric event).
So read this chapter for the plumbing, not for the tables.

## The request path, end to end

Follow one page load of `http://localhost:3000`:

1. Next.js serves `src/app/page.tsx`.
   It is a client component, so React runs it in the browser.
2. The component calls Apollo Client's `useQuery` with a GraphQL document.
3. Apollo sends `POST /api/graphql` with a JSON body `{ query, variables }`.
4. Next.js routes that URL to `src/app/api/graphql/route.ts`, a route handler.
5. The route handler hands the request to GraphQL Yoga.
   Yoga parses the query string, validates it against the schema, and executes it.
6. Execution calls one resolver function per requested field.
   The root resolver runs a Drizzle query, which compiles to SQL and runs on better-sqlite3.
7. SQLite reads `.data/pipeline.db` on disk and returns rows.
8. Yoga serialises the result to JSON.
   Apollo stores it in its normalized cache and re-renders the component with the data.

Every file below exists to make one of those steps work or to prove that it still works.

## Why every file exists

### Project configuration

- `package.json`: the script names are the public interface of the repo (`dev`, `test`, `test:e2e`, `typecheck`, `lint`, `db:seed`).
  CI and the docs use these exact names, so changing one means changing them everywhere.
  The `allowScripts` block tells npm 11 that better-sqlite3 is allowed to run its native build step, because npm now blocks install scripts by default.
  The `engines` field and `.nvmrc` pin the Node major that CI uses, so local and CI builds match.
- `tsconfig.json`: strict mode is on, and the `@/*` alias maps to `src/*`.
  The alias is how cross-feature imports are written, so a reader can tell "this import crosses a boundary" from "this import is local".
- `next.config.ts`: empty today.
  It exists so that config changes later (bundle analysis, headers) have an obvious home.
- `eslint.config.mjs`: the flat-config format ESLint 9 uses, extending the Next.js Core Web Vitals and TypeScript presets.
  It is `.mjs` because ESLint loads it as an ES module.
- `vitest.config.mts`: tells Vitest where tests live and which files count for coverage.
  The `graphql` alias is the one non-obvious line.
  Some dependencies load the CommonJS build of graphql-js while Vite loads the ESM build, and graphql-js refuses to execute a schema built by a different copy of itself.
  Forcing one resolved path avoids that error.
  The file is `.mts` so Node treats it as an ES module without a `"type": "module"` in package.json.
- `playwright.config.ts`: boots the app (`db:seed` then `dev`) before the browser tests, pointing the database at a separate file so e2e runs never touch your dev data.
- `drizzle.config.ts`: tells drizzle-kit where the schema lives and where to write migrations.
  It is not used yet because the database is bootstrapped inline (see `src/db/index.ts`).

### The database layer (`src/db/`)

- `schema.ts`: the tables as TypeScript.
  Drizzle derives both the SQL and the row types (`typeof table.$inferSelect`) from this one definition, so there is no second copy of the model to drift.
- `index.ts`: opens the SQLite file (or `:memory:`), turns on WAL mode, creates the tables if they are missing, and wraps the connection with Drizzle.
  `makeDb(url)` exists so tests can build a private in-memory database per test.
  The exported `db` is the shared handle the app uses.
- `seed.ts`: inserts synthetic rows so the UI has something to show.
  It is idempotent (it checks before inserting), which is what lets Playwright and humans run it repeatedly without duplicates.

### The GraphQL layer (`src/graphql/`)

- `builder.ts`: constructs the Pothos schema builder once and registers plugins.
  Everything that defines a type imports this builder, so plugin configuration lives in exactly one place.
- `context.ts`: defines what every resolver receives as its third argument.
  Today that is just `{ db }`.
  Passing the database through context rather than importing it is what makes resolvers testable with `:memory:`.
- `schema.ts`: the object types, root queries, and mutations.
  The last line, `builder.toSchema()`, is where Pothos emits a real graphql-js `GraphQLSchema`.
- `schema.test.ts`: unit tests that execute real queries with the `graphql()` function from graphql-js, no HTTP involved.
  Each test gets a fresh in-memory database, so tests cannot leak state into each other.

### The HTTP and UI layer (`src/app/`)

- `api/graphql/route.ts`: a Next.js route handler that exports `GET`, `POST`, and `OPTIONS`.
  Yoga speaks the standard `Request` and `Response` types, which is exactly what route handlers expect, so the glue is three lines.
  `GET` matters because that is how GraphiQL (the in-browser query editor) is served.
- `layout.tsx`: the root HTML shell.
  It wraps every page in `Providers`.
- `providers.tsx`: creates the Apollo Client with an `HttpLink` to `/api/graphql` and an `InMemoryCache`, and exposes it through `ApolloProvider`.
  It is a client component because Apollo's hooks need React context in the browser.
- `page.tsx`: the one page.
  It declares a query, calls `useQuery`, and renders loading, error, empty, and table states.
- `globals.css`: baseline reset and colour variables.

### Tests and CI

- `e2e/home.spec.ts`: one Playwright test that opens the page and asserts seeded rows appear.
  It is the only test that proves the whole chain, browser included.
- `.github/workflows/ci.yml`: two jobs.
  `quality` runs lint, typecheck, and unit tests with coverage.
  `e2e` installs Chromium and runs Playwright, uploading the HTML report on failure.
  The commands are the same npm scripts you run locally, so "it passed on my machine" and "it passed in CI" mean the same thing.

## How the technology works

### GraphQL, from first principles

GraphQL is two things: a query language and an execution engine.
The client sends a tree-shaped document naming exactly the fields it wants.
The server holds a schema, which is a typed description of every object and field it can serve.
Execution walks the client's document and, for each field, calls a resolver: a plain function `(parent, args, context, info) => value`.
Resolvers for a list run once per item, which is why a naive schema can issue one SQL query per row.
That is the N+1 problem, and Milestone 4 is dedicated to it.

### Code-first schemas with Pothos

There are two ways to write a GraphQL schema.
Schema-first (SDL) means writing the types in GraphQL's own language and attaching resolvers separately.
Code-first means writing TypeScript that constructs the types, and letting the library emit the SDL.
Pothos is code-first.
Its payoff is that the resolver's return type, the field's declared type, and the context type are all checked by the TypeScript compiler, with no code generation step on the server.
The README logs why this was chosen over SDL-first.

### GraphQL Yoga

Yoga is the HTTP layer.
Given a schema, it handles parsing the request body, running graphql-js `parse`, `validate`, and `execute`, formatting errors, and serving GraphiQL on `GET`.
It is built on the Fetch API's `Request` and `Response`, so it plugs into any runtime that speaks those, including Next.js route handlers, without an adapter.

### Apollo Client and the normalized cache

Apollo Client is more than a fetch wrapper.
When a response arrives, it splits every object with an `id` and `__typename` into its own cache entry keyed by `Typename:id`, and stores the query result as references to those entries.
This is normalization.
The payoff is that two different queries returning the same `Application:3` share one record, so an update to it re-renders both.
The skeleton does not exercise this yet, but it is why Apollo was chosen for the client.

### Drizzle and SQLite

Drizzle is a typed SQL query builder, not a heavy ORM.
You write `db.select().from(table).where(eq(table.id, 3))` and it produces the SQL and the row type.
better-sqlite3 is a synchronous native binding to SQLite.
Synchronous is fine here: SQLite is in-process and reads from a local file, so there is no network to wait on, and synchronous code is simpler to read and test.
WAL (write-ahead logging) mode lets readers continue while a write is in progress.

### The test pyramid in this repo

Unit tests (Vitest) execute the schema directly against an in-memory database, so they run in milliseconds and cannot flake on ports or browsers.
The e2e test (Playwright) boots the real server and a real browser, so it is slow but proves the integration.
TESTING_RULES.md at the repo root describes how to decide which test to write.
The short version: protect contracts and core behaviour, and do not write a test just because a function exists.

## How to see it working

```bash
npm install
npm run db:seed        # creates .data/pipeline.db and inserts demo rows
npm run dev            # http://localhost:3000
```

Open `http://localhost:3000/api/graphql` to get GraphiQL and run:

```graphql
{ applications { id company stage } }
```

Then run the harness:

```bash
npm run typecheck && npm run lint && npm run test
npm run test:e2e
```

Open the Network tab in the browser while the page loads and find the `graphql` request.
Its request body is the query from `page.tsx`.
Its response is what Yoga returned.

## Self-check

1. Why does `createContext` return the database instead of resolvers importing it directly?
2. What would break if `vitest.config.mts` dropped the `graphql` alias?
3. Which file turns Pothos definitions into something graphql-js can execute, and on which line?
4. Why does the route handler export `GET` as well as `POST`?
5. The e2e config points the database at `.data/e2e.db`. What problem does that avoid?

<details>
<summary>Answers</summary>

1. So tests can hand resolvers a `:memory:` database and the production app can hand them the file-backed one, without either knowing the difference.
2. Two copies of graphql-js would load, and graphql-js would throw "Cannot use GraphQLSchema from another module or realm" when the test tried to execute a query.
3. `src/graphql/schema.ts`, the final `builder.toSchema()` call.
4. GraphiQL, the browser IDE, is served on `GET`; queries are sent on `POST`.
5. Playwright reseeds and asserts on a known data set; using your dev database would make the test depend on whatever you last did locally and could overwrite your data.

</details>
