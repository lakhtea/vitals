# Needs Lakhte

> The single list of everything that requires your accounts, your keyboard, or your sign-off.
> Claude Code builds everything else and appends here when it hits one of these.
> Items are grouped by when you need them.
> Nothing in this file is blocking local development.

## Now: after cloning on a new machine

- **Node version.**
  CI uses Node 22 (`.nvmrc`).
  Node 24 works too, but better-sqlite3 has no prebuilt binary for it yet and compiles from source, which needs the Xcode command line tools (`xcode-select --install`).
- **npm 11 install scripts.**
  npm 11 blocks native build steps unless approved.
  `package.json` already carries `allowScripts.better-sqlite3`, so `npm ci` works without prompts.
  If npm ever reports better-sqlite3 as "not yet covered", run `npm approve-scripts better-sqlite3`.
- **Playwright browsers.**
  After `npm ci`, run `npx playwright install chromium` once.
  The browser build must match the installed `@playwright/test` version, so rerun it after upgrading that package.

## M3: the browser library (your build)

- Implement `lib/vitals-client` yourself, following `docs/learning/03-library-brief.md` (written 2026-10-07; start with its reading list and acceptance criteria).
  Claude Code reviews in `docs/learning/03-library-review.md` and never edits the library.
- Wire the library into the dashboard in dev (one script tag or import) so the dashboard dogfoods itself.
- Write the closing section of chapter 03 in your own words.

## M10: hosting (code is ready; the account and the deploy are yours)

The decision is made and logged in README "Decisions": Vercel plus demo mode (`VITALS_DEMO_MODE=1`), an ephemeral SQLite in the function's temp dir, seeded on every cold start.
The code is built and verified locally (`VITALS_DEMO_MODE=1 npm run build && VITALS_DEMO_MODE=1 npm run start`).
Steps for you:

1. **Create the Vercel account and project.**
   The Git integration needs `github.com/lakhtea/vitals` to exist (M11), so either push first or deploy from the laptop with `npx vercel login` then `npx vercel`.
2. **Project settings.**
   Framework preset Next.js; build command `npm run build`; install command default; root directory the repo root.
   Node.js version 22 (Project Settings > General); `package.json` already declares `engines.node >= 22`.
3. **Environment variables** (Production, and Preview if previews should be demos too):
   - `VITALS_DEMO_MODE` = `1` (needed at build time and runtime; Vercel applies project env vars to both by default).
   - `VITALS_DB_PATH`: leave unset. Only `/tmp` is writable in a function and the default already points there in demo mode.
4. **Verify from a clean browser after the first deploy.**
   `/` shows the banner and the seeded sites; `GET /api/graphql` does not serve GraphiQL while the dashboard's POST queries work; `POST /api/collect` returns 202 and the 121st batch for one site inside a minute returns 429 with `retry-after`; the function log shows a `seed:` line on each cold start.
5. **Know what resets.**
   The data resets on every deploy, when Vercel recycles an idle instance, and per instance when it scales out.
   Beacons live only in the instance that accepted them, so the self-measurement panel demonstrates the loop, not durable history.
6. **Custom domain** (optional), then paste the live URL at the top of README.md.
7. **If you ever want persistence** instead of a demo: libSQL/Turso keeps Drizzle and the schema; the driver swap makes every query `await`. Not planned for v1.

## M11: going public

- Create `github.com/lakhtea/vitals` and push.
  Claude Code never pushes to a remote it was not given.
- Swap `<USER>` in the README badge for `lakhtea`.
- **Sign off on the README build-story framing** (draft below) before it lands; edit freely, it must sound like you.
- `npm publish` of `@lakhtea/vitals-client` (or whichever name you choose) from your npm account, after M3.
- Set the GitHub repo description and topics. Suggested description: "Self-hostable real-user monitoring: a tiny Core Web Vitals browser library plus a GraphQL analytics dashboard (Next.js, Pothos, Yoga, Apollo, Drizzle, SQLite)". Suggested topics: `web-vitals`, `real-user-monitoring`, `rum`, `graphql`, `pothos`, `graphql-yoga`, `apollo-client`, `nextjs`, `react-server-components`, `drizzle-orm`, `sqlite`, `storybook`, `dataloader`, `typescript`, `performance`.

### Draft: README "How this was built" (needs your sign-off)

> This repository was built with AI assistance by design, and the split is deliberate.
> The browser library in `lib/vitals-client` is written by me, by hand, from a brief; it is the part a reviewer can hold me to line by line.
> The dashboard, API, data layer, tests, and tooling were built with Claude Code working from `PLAN.md`, in milestones I set, under guardrails I wrote (no estimated numbers, tests in the same commit as the feature, a learning chapter per milestone).
> Every file has a stated reason to exist and every non-obvious choice has a decision entry; `docs/learning/` is the record I used to understand the code well enough to explain any of it, and `docs/TOUR.md` is where I would start if I were you.
> The git history is honest about which commits are which.
> I think this is what shipping with AI tools looks like when it is done carefully: the human owns the plan, the standards, the review, and the parts that prove skill directly.

## Not blocking, but yours when you have a moment

- Read chapter 05's "What the types caught on day one" and chapter 04's interview answers; both are written as preparation for conversations with hiring managers.
- Decide whether `Site.pages` should be converted to a DataLoader (chapter 04's exercise). It is a good first hands-on change.

## Log of additions

- 2026-10-07: file created during M0 with environment notes, M3, M10, and M11 items.
- 2026-10-07: M3 brief is ready; the `vitals-dashboard` site is seeded so dogfooding works as soon as the library does.
- 2026-10-07 (late): M10 decision made and demo-mode code built; the Vercel steps above are concrete. M11 build-story draft added for sign-off; repo description and topics suggested.
