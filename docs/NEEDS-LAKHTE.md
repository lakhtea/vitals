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

## M10: hosting

- **Decide and create the hosting account.**
  The plan leans Vercel with an ephemeral demo-mode SQLite per cold start, or libSQL/Turso for a persistent database.
  Claude Code will write the decision entry and the demo-mode code first; you create the account and connect the repo.
- **Environment variables to set on the host** (names will be finalised in M10 and listed here):
  - `VITALS_DB_PATH` (file path) or a Turso URL + auth token if the persistent option is chosen.
  - A demo-mode flag if the ephemeral option is chosen.
- **Custom domain** (optional).

## M11: going public

- Create `github.com/lakhtea/vitals` and push.
  Claude Code never pushes to a remote it was not given.
- Swap `<USER>` in the README badge for `lakhtea`.
- Review and sign off on the README "build story" framing before it lands.
- `npm publish` of `@lakhtea/vitals-client` (or whichever name you choose) from your npm account.
- Set the GitHub repo description and topics (suggestions will be listed in PLAN.md's Session Log).

## Log of additions

- 2026-10-07: file created during M0 with environment notes, M3, M10, and M11 items.
- 2026-10-07: M3 brief is ready; the `vitals-dashboard` site is seeded so dogfooding works as soon as the library does.
