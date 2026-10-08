# 10 - Deploy and demo mode

> Milestone 10 puts the dashboard at a public URL.
> The hosting decision was written before the code (see README "Decisions"); this chapter explains what demo mode isolates and why, and what would change for real hosting.
> The deployment itself needs the owner's account; the steps are in `docs/NEEDS-LAKHTE.md`.

## The constraint: a single-tenant SQLite app on a serverless host

The whole kit is built around one SQLite file.
That is a feature for self-hosters (copy one file, you have the data) and a problem for serverless platforms, where the filesystem is read-only except for `/tmp`, nothing persists between cold starts, and several instances can run at once with no shared disk.

Three honest options:

1. **Persistent SQLite-compatible database** (libSQL/Turso): keep Drizzle, swap the driver, get durability and concurrency.
   Right for a real deployment; wrong for a demo that should be free, zero-maintenance, and impossible to vandalise.
2. **A long-lived container** (Fly.io, a VPS) with a volume: the simplest match for the architecture, but it costs money per month and someone must keep it patched.
3. **Demo mode on Vercel**: an ephemeral SQLite in `/tmp`, seeded on every cold start.
   Free, no state to protect, and the honesty of "this resets" is a feature for a portfolio demo.

Demo mode is what ships.
The chapter and the decision entry say so plainly, because a reader who assumes the demo is a production deployment has been misled.

## What demo mode isolates

`VITALS_DEMO_MODE=1` changes four things and nothing else:

- **Where the database lives.** `os.tmpdir()/vitals-demo.db`, the only writable place on the platform.
- **What it contains.** The idempotent seed runs when the database is opened, so every instance has the demo site and the dashboard's own site from the first request.
  Two instances may hold slightly different data (their own ingested sessions); that is accepted and stated in the banner.
- **What strangers can do.** `/api/collect` is rate-limited per site so a script cannot fill `/tmp`, and GraphiQL is turned off so the public endpoint is not an interactive playground.
  Queries still work, because the dashboard needs them.
- **What visitors see.** A one-line banner: synthetic data, resets on each cold start.

Everything else, including migrations, the schema, and the browser library wiring, is identical to local development.
A demo that runs different code from the real thing proves nothing; this one differs only in configuration.

## What would change for real multi-user hosting

- Replace the file database with a persistent one (option 1 above); Drizzle keeps the queries, the driver changes.
- Authenticate `/api/collect` per site with a write key and the dashboard with a login; `siteId` identifies today, it does not authenticate.
- Move rate limiting out of process memory into something shared across instances.
- Rotate or archive events; the schema has the timestamps and indexes for it, the policy does not exist yet.
- Keep demo mode: it remains the right way to run a public playground next to a real deployment.

## Why the migrations folder is traced

`makeDb()` applies migrations from `./drizzle` at runtime.
Serverless bundlers only ship files they can see from imports, and a folder read with `fs` is invisible to them, so `next.config.ts` lists `drizzle/**` in the output file tracing.
Without it the first request on the platform fails with "migrations folder not found", which is the kind of deploy-only error worth writing down.

## Self-check

1. Why not use the persistent database option for the demo?
2. Name the four things demo mode changes.
3. Two visitors on different instances see slightly different session lists. Is that a bug?
4. Why would the deploy fail without the output tracing entry, and why does it work locally?

<details>
<summary>Answers</summary>

1. It adds an account, a credential, and a durable store to protect from vandalism, for a demo whose value is being free and resettable; the honest answer for a demo is a reset.
2. Database location (`/tmp`), seeded content on open, abuse controls (collect rate limit, GraphiQL off), and the banner.
3. No; each instance has its own ephemeral file by design, and the banner says so. For real hosting it would be, which is why real hosting means a shared database.
4. The bundler ships only files reachable from imports; `migrate()` reads the folder with `fs`. Locally the whole repo is on disk, so nothing is missing.

</details>
