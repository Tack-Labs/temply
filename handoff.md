# Handoff: moving to Vercel and Supabase

**Status:** in progress. It replaces the Railway plan written on 2026-09-21 (`91501cf`), because Vercel + Supabase leaves less infrastructure for us to run. Phase 1 (§3) was done on 2026-09-23 and carries over unchanged. Phases 2 and 3 (§4, §5) and the code half of Phase 4 (`client/vercel.json`, the CI deploy job, the nightly backup) were done on `feature/vercel-supabase` on 2026-09-28, except the 5.0 spike, which needs a Vercel project. What's left is accounts and running things: §6 onwards, the spike, and the e2e run owed since Phase 1 (§12). On `main`, production still deploys with the Railway configuration in `Dockerfile`, `railway.json`, `deploy/railway/` and the Railway `deploy` job, so leave that configuration alone there. On the branch, CI already deploys to Vercel, which is one more reason it merges only at the cutover.
**Written:** 2026-09-27, from `main` at `a29c624`.
**For:** whoever picks this up next, whether a person or an agent session. Read §1–§2 first. Each phase after that is a unit of work you can ship on its own. The decisions still open are in §10, and §12 lists what to check before relying on it.

---

## TL;DR

- **Each environment is one Vercel project and one Supabase project.** Vercel serves Next.js *and* the API. The Elysia app stops being a separate server. Every API call already goes through the catch-all route `client/app/api/[[...path]]/route.ts`, and that route now calls `app.handle()` in the same process. The API still has no address of its own, and there's one deploy and one set of variables.
- **Supabase is only our Postgres.** Clerk stays the auth provider and ImageKit stays the image host. Supabase's Data API is switched off, because nothing but the API should reach our tables.
- **Porting from `bun:sqlite` to Postgres is still most of the work** (§4). Vercel runs as many instances of the API as traffic calls for, and they can't share a SQLite file.
- **Vercel functions lack four things the long-running Bun server gave us:**
  - A timer. The overage reporter becomes a Vercel Cron job.
  - A moment before start-up. Migrations move into CI, before the deploy.
  - An 8 MB body limit. Vercel's is 4.5 MB, so image uploads drop to 4 MB.
  - A trustworthy client address. It survives only because the API runs in-process (§10.1).
- **Scaling mostly stops being ours to operate.** Vercel adds and removes instances by itself, so there are no replica counts to set. What's left is Postgres: connections go through Supabase's transaction pooler, and capacity is the compute size.
- Order of work: Phase 1 is done (§3). Port to Postgres (§4). Move the API into Next (§5). Stand up Supabase, Vercel and staging (§6). Cut over (§7). Tidy up (§9).

---

## 1. Where things stand

| Area | Today | Why it matters on Vercel + Supabase |
|---|---|---|
| Hosting | One Railway service: Next on :8080 → API on loopback :3001, supervised by `deploy/railway/start.sh`. GitHub Actions deploys after CI passes. | Vercel runs no container of ours and no second process. The API has to become code that Next calls (§5). |
| API runtime | Bun, with `app.listen()` in `server/src/index.ts`. Next already runs on Node in production; the `Dockerfile`'s runtime stage is `node:22`. | On Vercel the API runs on Node inside the Next function. The only Bun-only import in `server/src` is `bun:sqlite`, and §4 removes it anyway. |
| Database | A SQLite file (`SQLITE_DB_PATH`), opened lazily in `server/src/plugins/db.ts`. `initTables` creates and migrates the schema at boot. | Functions have no persistent disk and run as any number of instances. Supabase Postgres replaces it, with migrations as files (2.3). |
| Backups | Railway volume backups, plus snapshots from `server/scripts/backup-db.ts`. | Replaced by Supabase's daily backups and a nightly `pg_dump` from GitHub Actions (§6.5). |
| Background work | `startOverageReporter()` runs `reportOverage` every 5 minutes on a `setInterval` (`server/src/lib/overage.ts`). | An instance runs only while it serves requests, so the timer can't be relied on to fire. It becomes a Vercel Cron job (5.3). |
| In-memory state | Only the per-process monotonic clock `nextStamp` (`server/src/lib/stamp.ts`). Every rate limit counts in `rate_windows` (1.1). | Each instance keeps its own clock, so two instances can issue the same stamp (2.4). |
| Request path | Every request goes through the catch-all proxy: dashboard calls, the integrator API `/api/v1/...` and both webhooks. It forwards to `API_URL` and proves itself with `x-internal-token`. `serverFetch` (`client/lib/server-fetch.ts`) does the same for server components. | Both switch to calling the app in-process (5.2). The trust contract with the auth plugin stays exactly as it is. |
| Request size | Next and the API both refuse bodies over 8 MB. Images can be up to 5 MB (`MAX_ASSET_BYTES`, `server/src/routes/assets.ts`). Template content is capped at 1,000,000 characters (`shared/plans.ts`). | Vercel answers any function request or response over 4.5 MB with its own 413 before our code runs. Uploads have to shrink (5.4). Template saves fit. |
| Client address | `clientAddress` (`server/src/lib/rate-limit.ts`) reads the last `x-forwarded-for` hop, which Railway's edge writes. | Vercel overwrites `x-forwarded-for` with the address it saw. That's correct for a browser's request, and wrong for one function calling another (§10.1). |
| Files | None on local disk. Images live on ImageKit. | Nothing to migrate. |
| Third parties | Clerk, Stripe, Resend, ImageKit, Sentry. All SaaS. | They don't move. Webhook URLs change only if the domain does. |

---

## 2. Target architecture

```
  browser · integrator · Stripe · Clerk
                 │  https://<domain>
                 ▼
  ┌──────────── Vercel project "temply" · functions in lhr1 (London) ────────────┐
  │                                                                              │
  │   Next.js 15 ── Clerk middleware ── app/api/[[...path]]/route.ts             │
  │                                          │ app.handle(request)               │
  │                                          ▼ same process, no network hop      │
  │                                     Elysia app (server/src/app.ts)           │
  │                                          ▲                                   │
  │   Vercel Cron, every 5 min ──── GET /api/cron/overage (Bearer CRON_SECRET)   │
  └──────────────────────────────────────────┬───────────────────────────────────┘
                                             │ TLS · transaction pooler :6543
                                             ▼
  ┌──────────── Supabase project "temply" · London (eu-west-2) ──────────────────┐
  │   Supavisor ──▶ Postgres       Data API and GraphQL off       daily backups  │
  └──────────────────────────────────────────▲───────────────────────────────────┘
                                             │ session pooler :5432 (IPv4)
                        GitHub Actions: migrations before each deploy, nightly pg_dump

                  Clerk · Stripe · Resend · ImageKit · Sentry (unchanged)
```

| Environment | Vercel | Supabase | Clerk / Stripe |
|---|---|---|---|
| production | production deployment of `main`, custom domain | `temply` (Pro) | live instance / live mode |
| staging | preview deployment of the `staging` branch, aliased to a fixed staging domain | `temply-staging` | dev instance / test mode |
| previews | preview deployment of any other branch | shares `temply-staging` | dev instance / test mode |

**Why the API runs inside Next, not as its own Vercel project.** The proxy route is already the only way into the API. Moving the app into that route removes four things:

- a network hop;
- a second function invocation, with its own cold start, on every request;
- a public URL for the API;
- a second set of variables.

It also keeps the client address correct. Vercel overwrites `x-forwarded-for` on every request it receives and doesn't forward external addresses. Behind a second Vercel project, the API would see the web function's address on every call, and all anonymous visitors would share one contact-form and preview allowance. The alternative, and what it would cost, is in §10.1.

**Tradeoffs**

- *Bun in production.* The API moves from Bun to Node. Vercel's Bun runtime is still in beta, and Next already runs on Node today. Bun stays the package manager, script runner and test runner.
- *The rest of Supabase.* We don't use its Auth, Storage or Realtime. Replacing Clerk or ImageKit with them would be a separate decision, not part of this move.

---

## 3. Phase 1: harden the API while it's still on SQLite (done)

Done on 2026-09-23. These changes don't depend on the database driver, and every one of them is still needed on Vercel.

- [x] **1.1 Move every limiter into the database.** The `rate_windows` table is `(bucket TEXT, window_start TEXT, count INTEGER, PRIMARY KEY (bucket, window_start))`. `WINDOW` is a reserved word in both SQLite and Postgres, so the table isn't `(scope, window)` as first proposed. `checkWindow` in `server/src/lib/rate-limit.ts` counts and decides in one statement: `INSERT … ON CONFLICT DO UPDATE SET count = count + 1 WHERE count < limit RETURNING count`. No returned row means the call is refused, and a refused call isn't counted. One call in 100 also deletes windows more than a day old. Everything uses it: the key burst fuse, the test-send cap (still 20 per user per hour), and the per-address limits on anonymous previews, the contact form and CSP reports. `resetBurstWindows` is gone.
  *Why Postgres and not Redis:* it adds no new infrastructure. It's also one round trip on a path that already writes `org_usage` on every call. Switch to Redis only if §8's measurements show this row is a hot spot.
- [x] **1.2 Make aggregates return numbers.** Postgres returns `count(*)` and `sum()` as bigint, which postgres.js hands back as a **string**. Every count now uses Drizzle's `count()` helper, and the byte total in `billing.ts` uses `.mapWith(Number)`.
- [x] **1.3 Stop depending on `rowid`.** The asset library orders by `desc(assets.created_at), desc(assets.id)`. The column default counts whole seconds, so new assets get a `nextStamp()` instead, and two uploads in the same second still list in order. For the same reason, version history and its prune order by `version_number` instead of `created_at`.
- [x] **1.4 Add the missing hot-path indexes.** `api_keys_key_hash` is on `api_keys(key_hash)`. `template_versions_number` is a unique index on `template_versions(template_id, version_number)`, and its leading column already serves `template_id` lookups, so a separate index would be redundant. An existing clash would fail the boot when the unique index is built. So `initTables` first renumbers any clashing versions, moving each later copy to the top of its template's history. `snapshotVersion` computes the number inside the insert, which is atomic on SQLite. 2.4 still applies on Postgres.
- [x] **1.5 Make the bind address configurable and shut down cleanly.** The API binds to `HOST`, default `127.0.0.1`, and `start.sh` pins it to loopback. On `SIGTERM` or `SIGINT` it stops taking connections, lets in-flight requests finish, calls `closeDb()` and exits. A second signal exits at once. Only the standalone Bun server uses this now: `dev:server`, and Railway until the cutover. Nothing on Vercel binds a port or receives the signal.
- [x] **1.6 Fix the burst message.** Done in c0b53f6.

---

## 4. Phase 2: port to Postgres (branch `feature/vercel-supabase`)

This phase changes the database contract, so the work stays on a branch and staging deploys from it (§6.6). The branch merges at cutover (§7). Rebase it on `main` often.

- [x] **2.1 Driver.** Use postgres.js (`postgres`) with `drizzle-orm/postgres-js`.
  - **As built:** `pg` with `drizzle-orm/node-postgres`, the fallback below, because `pg` is the client Vercel documents `attachDatabasePool` with. `pg` sends unnamed statements, so the pooler needs no `prepare: false`. The pool is one per instance, made on the first query rather than at import, so `next build` and the tests connect to nothing.
  - **Connection.** `DATABASE_URL` is Supabase's **transaction pooler** URL (port 6543), which Supabase recommends for serverless functions. Transaction mode doesn't support prepared statements, so create the client with `prepare: false`.
  - **Pool.** Create the client once at module scope in `db.ts`, not lazily inside `.derive`. Fluid compute serves many requests from one instance, and they should share one small pool. Take its size from `DB_POOL_MAX`, default 5. Vercel advises against a pool of 1: it harms concurrency without reducing the total number of connections. Use a short idle timeout, about 5 s, so an idle instance doesn't hold connections open.
  - **Cleanup.** Register the pool with `attachDatabasePool` from `@vercel/functions`, which closes idle connections before an instance suspends. Vercel's guide shows it only with `pg`, so check that it accepts a postgres.js client before building on it (§12). If it doesn't, use `pg` with `drizzle-orm/node-postgres`.
  - Keep the Elysia plugin name `'db'`, because `server/src/test/helpers.ts` relies on name-based deduplication.
- [x] **2.2 Schema.** In `shared/schema.ts`, change `sqliteTable` to `pgTable`, and in `server/src/lib/purge.ts` change `AnySQLiteColumn` to `AnyPgColumn`. **Port like for like**: timestamps stay `text` and `is_default` stays an integer, so no API response or client type changes shape. Converting to `timestamptz` or `boolean` is a separate change for later.
  The `now` default in `shared/schema.ts` becomes an expression that produces SQLite's exact `datetime('now')` format: `to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`. Read `shared/publish.ts` before changing any timestamp handling; it documents why the two formats must not mix. The client imports only the inferred `Mail` type from `@temply/shared/schema`, so typecheck is enough to confirm it.
- [x] **2.3 Migrations become files and run once per deploy.**
  - **Files.** Add `drizzle-kit`, `server/drizzle.config.ts` and a `server/drizzle/` folder. The **first migration is the end state of `initTables`**: every column it adds, the `org_id` indexes, the partial unique index `subscriptions_org_id_unique … WHERE org_id IS NOT NULL`, `mails_share_token`, and the 1.4 indexes.
  - **Backfills.** The one-off backfills in `initTables` are SQLite history and don't get ported: the `user_prefs` carry-over, the published-copy backfill, `scale` → `enterprise`, timestamp healing, the short-code backfill and `renumberClashingVersions`. Before copying data in §7, confirm the source SQLite database has already had them.
  - **Running them.** Add a `db:migrate` script that uses Drizzle's migrator. Vercel has no pre-deploy step, so CI runs it after the build succeeds and before the deploy (§6.4). It reads `MIGRATION_DATABASE_URL`, the **session pooler** URL (port 5432 on the pooler host). The direct connection won't do: it is IPv6-only unless the project pays for the IPv4 add-on, and GitHub-hosted runners have no IPv6.
  - **Removals.** Delete `initTables`, `addColumnIfMissing` and `backfillShortCodes`.
  - **Rule from now on, written into `CLAUDE.md`:** migrations are expand-then-contract. Two things run old code against the new schema. One is instances of the previous deployment that are still finishing requests. The other is Vercel's Instant Rollback, which restores the previous deployment without undoing any migration. So add columns as nullable, backfill, and enforce constraints in a later deploy. Never drop or rename a column in the same deploy that stops using it.
- [x] **2.4 Make concurrent writes safe.** SQLite serialised all writes in one process. Postgres, with any number of function instances writing to it, doesn't.
  - **Publish and `snapshotVersion`** (`server/src/routes/templates.ts`). Wrap both in `db.transaction`, starting with `SELECT … FOR UPDATE` on the `mails` row. The version number is already computed inside the insert (1.4), which is atomic on SQLite. Under Postgres's default READ COMMITTED isolation, two concurrent inserts can still read the same `MAX`. Without the lock, the unique index turns that race into a 500 rather than a duplicate.
  - **What the pooler allows.** In transaction mode a transaction holds one server connection for its whole life, so the lock works through the pooler. Anything that outlives a transaction doesn't: a session-level `SET`, session advisory locks, `LISTEN`, prepared statements. If one is ever needed, use `SET LOCAL` or `pg_advisory_xact_lock`.
  - **`nextStamp()`** is monotonic only within one process. Inside the same locked transaction, set the new stamp to the later of `nextStamp()` and the row's current `updated_at` plus 1 ms. That keeps one invariant true across instances: a draft save after a publish always shows unpublished changes.
  - **Duplicate Stripe events.** Stripe can deliver two events for the same subscription to different instances at once. `applySubscription` (`server/src/lib/stripe.ts`) already settles them. The webhook reads the subscription back from Stripe and stamps when it read it. The update applies only when that stamp is no older than the stored `stripe_synced_at`, and the check sits in the `UPDATE`'s own `WHERE`. Keep it there when the query moves to Postgres; a read-then-write would reopen the race. The same `UPDATE` sets `trial_ends_at` with SQLite's two-argument `min()`, which Postgres spells `LEAST`.
  - **The overage reporter** (`server/src/lib/overage.ts`) now runs from a cron request (5.3), and a slow run can overlap the next one. It claims `org_usage.reported` with a compare-and-set before Stripe hears anything, so two runs never report the same calls. Keep that claim a single conditional `UPDATE`.
- [x] **2.5 Health check.** `server/src/routes/health.ts` calls `db.get(...)` synchronously inside a `try`. With an async driver the `try` would miss the rejection, so it becomes `await db.execute(sql\`select 1\`)`.
- [x] **2.6 Unit tests on PGlite.** Point `createTestDb()` (`server/src/test/helpers.ts`) at an in-process PGlite (`@electric-sql/pglite` + `drizzle-orm/pglite`), and apply the same migration files. The tests then keep tracking the real schema the way they track `initTables` today, and `bun test` still needs no Docker. There are 21 call sites across 18 test files. If a fresh PGlite per test is too slow, use one instance per file and `TRUNCATE` between tests. **Before committing to this, check that PGlite runs under Bun 1.4.2.** The fallback is a Docker Postgres with one schema per test file.
- [x] **2.7 Local dev, e2e and CI.**
  - **Local.** Add a `compose.yaml` with a plain Postgres image of the major version Supabase provisions (§12). The Supabase CLI's local stack also works, but it starts containers for services we don't use.
  - **e2e.** In `e2e/env.ts`, create a `temply_e2e_<RUN_ID>` database instead of the temporary SQLite file. Drop stale ones the same way stale files are pruned today.
  - **CI.** The `e2e` job gets a `services: postgres` container, and so does the `check` job if 2.6 falls back to Docker.
  - **Docs.** Update `.env.example` and the README tables. `DATABASE_URL`, `MIGRATION_DATABASE_URL` and `DB_POOL_MAX` come in. `SQLITE_DB_PATH`, `BACKUP_DIR` and `BACKUP_KEEP` go out.
- [x] **2.8 Copy script.** Write `server/scripts/sqlite-to-postgres.ts`.
  - **What it copies.** It reads a SQLite snapshot and, in a single Postgres transaction, `TRUNCATE`s and re-inserts all 11 tables in batches: `mails`, `api_keys`, `template_versions`, `subscriptions`, `api_usage`, `org_usage`, `brands`, `user_prefs`, `org_prefs`, `contact_messages`, `assets`.
  - **What it leaves.** `rate_windows` stays behind. No row in it is older than a day, and starting it empty only resets every limit once.
  - **Checking.** It prints each table's row count on both sides and exits non-zero if any differ, so it's safe to re-run. It connects over `MIGRATION_DATABASE_URL`.
  - **Columns.** Copy by the Postgres schema's columns, not the source's. A column that only an older SQLite shape has has nowhere to go, and nothing reads it. An example is the `lemonsqueezy_*` columns in a database from the unreleased Lemon Squeezy branch.
  - Rehearse it on staging (§6.6).
- [x] **2.9 Remove the SQLite leftovers:** `server/scripts/backup-db.ts`, the `db:backup` script, the `bun:sqlite` import, and the WAL note on `closeDb`. On Postgres, `closeDb` becomes ending the pool.

---

## 5. Phase 3: run the API inside Next

Everything after 5.0 assumes the spike works, so do it first.

- [ ] **5.0 Spike (about half a day, once 2.1–2.3 are on the branch).** Deploy a Vercel preview from the branch with 5.1 and 5.2 applied, pointed at `temply-staging`. It passes when:
  - `next build` bundles the Elysia app without errors. Elysia compiles its handlers with `new Function` at runtime, which Node allows.
  - a template renders;
  - an integrator call with a test key gets past Clerk's middleware;
  - `/api/health` answers.
  If the spike fails, fall back to the alternative in §10.1 and budget for its extra work.
  - **Checked locally on 2026-09-28**, under `next start` on Node against a local Postgres: the build bundles the app with `pg`; `/api/health` queries the database; a signed-out render, a multipart upload with `t.File` validation, our 413 over the limit and the cron route's 503 without a secret all answer; the rate limit keys on `x-forwarded-for`. The Clerk steps and Vercel itself are what the spike still has to show.
- [x] **5.1 Split the entry point.**
  - **`server/src/app.ts`** builds and exports the Elysia app: the global `onError` and every `.use()`. It has no `listen`, no timer and no signal handler.
  - **`server/src/index.ts`** keeps the standalone Bun server for `dev:server`: the Sentry init, `listen` with `HOST` and the body limit, the overage timer and the SIGTERM drain.
  - **Sentry.** The `onError` in `app.ts` and `overage.ts` import `captureException` from `@sentry/core` instead of `@sentry/bun`. They then report to whichever SDK the host started: `@sentry/bun` in `index.ts`, or `@sentry/nextjs` on Vercel. Sentry keeps its global state per SDK version. Pin `@sentry/core` to exactly the version `@sentry/nextjs` uses, or the API's errors reach nobody. The smoke list checks this.
- [x] **5.2 Call the app, not the network.**
  - **The route.** In the catch-all route, build a `Request` with the same path, method, body and headers it sends today, `x-internal-token` included. Return `await app.handle(request)` where it calls `fetch(targetUrl)` now. The response handling after that call stays as it is. `serverFetch` gets the same change.
  - **Packaging.** `client/package.json` gains `"@temply/server": "workspace:*"`. Add it to `transpilePackages` if Next won't compile its TypeScript otherwise. Export `runtime = 'nodejs'` and a `maxDuration` from the route; 60 s is plenty for a render.
  - **The fetch path.** Keep it behind `API_URL`. When `API_URL` is set, the route forwards as it does today, so a standalone Bun API is still available for debugging. When it's unset, the route calls the app in-process. e2e runs with it unset, because that's what production runs.
  - **The token.** Keep `INTERNAL_API_SECRET`. In-process the token proves little, but the auth plugin stays as it is, and a stray `API_URL` still can't open a hole.
  - **Local env.** Next loads only `client/.env*`, so for local dev the server block of `.env.example` moves into the client's env file. `server/.env` remains for `dev:server` and `bun test`.
- [x] **5.3 Report overage on a schedule.**
  - Add `GET /api/cron/overage` to the API. It compares `Authorization: Bearer <CRON_SECRET>` in constant time, calls `reportOverage(db)` and returns the count. Vercel Cron sends that header when `CRON_SECRET` is set.
  - Schedule it in `client/vercel.json`: `"crons": [{ "path": "/api/cron/overage", "schedule": "*/5 * * * *" }]`. A cron that runs more than once a day needs Vercel Pro.
  - `startOverageReporter` stays only in `index.ts`.
- [x] **5.4 Fit uploads under 4.5 MB.** A request body over 4.5 MB gets Vercel's own 413 before the route runs, so the customer would see a raw error instead of ours.
  - Lower `MAX_ASSET_BYTES` to 4 MB, and lower the proxy's 8 MB check to match.
  - Change the copy everywhere it appears: the upload hint, the toast and the 413 body all say "Images must be under 4 MB."
  - This is customer-visible, so it ships with its case in `e2e/specs`.
  - Direct uploads to ImageKit would lift the cap later (§10.2).
- [x] **5.5 Rewrite the comments that describe Railway:** the listen comment and shutdown doc in `index.ts`, the proxy's `x-forwarded-for` comment, and the doc on `clientAddress`.

---

## 6. Phase 4: Supabase, Vercel and staging

### 6.1 Supabase projects

- [ ] Create `temply` (production, Pro plan) and `temply-staging`, both in London (eu-west-2), next to Vercel's `lhr1`. An integrator call makes about seven sequential queries, so every millisecond between function and database is paid seven times.
- [ ] Turn off the Data API, and GraphQL with it, in each project's settings. We connect only over Postgres. With the Data API on, anyone with the project's anon key could reach tables in `public` that lack row-level security. Supabase stops exposing tables by default for existing projects on 2026-10-30, but having the API off is simpler to reason about than grants.
- [ ] Enforce SSL on incoming connections. The database password lives only in Vercel's and GitHub's secrets.
- [ ] Confirm `pg_stat_statements` is enabled; §8 depends on it.

### 6.2 Vercel project

- [ ] **Project.** Create one project, `temply`, with Root Directory `client`, and include source files outside the root directory in the build, because it imports `server/` and `shared/`. Set the install command to `bun install --frozen-lockfile`, so CI and Vercel install the same tree.
- [x] **`client/vercel.json`.** Add three settings:
  - `"regions": ["lhr1"]`. The default is `iad1`, in Washington.
  - the cron from 5.3.
  - `"git": { "deploymentEnabled": { "main": false, "staging": false } }`, so neither branch deploys from Git on its own. CI deploys both after the gates and the migration (§6.4). Other branches keep their Git previews.
- [ ] **Plan.** Use Pro. Hobby is for non-commercial use, and it limits crons to once a day.
- [ ] **Spend.** Turn on Spend Management with a cap and an alert, so an abusive integrator can't run up a bill unnoticed.

### 6.3 Variables

Set these per Vercel environment (Production and Preview), and in GitHub Actions where noted.

| Where | Variable | Value |
|---|---|---|
| Vercel | `DATABASE_URL` | the transaction pooler URL (:6543) of that environment's Supabase project |
| Vercel | `DB_POOL_MAX` | `5` |
| Vercel | `INTERNAL_API_SECRET` | a new random value per environment (the README has the command) |
| Vercel | `CRON_SECRET` | random; production only, since crons run only on production deployments |
| Vercel | `NEXT_PUBLIC_APP_URL` | `https://<domain>`, or the staging domain |
| Vercel | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | live instance in Production, dev instance in Preview |
| Vercel | `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` / `staging` |
| Vercel | everything else in `.env.example`, both blocks, now in one project | Stripe (key, webhook secret, three prices, meter event), the Clerk webhook secret, Resend, contact, sending, ImageKit, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`/`PROJECT`/`AUTH_TOKEN`, sign-in/up URLs, contact emails |
| GitHub | `MIGRATION_DATABASE_URL`, one per environment | the session pooler URL (:5432) |
| GitHub | `APP_URL`, one per environment (a variable) | `https://<domain>`, or the staging domain; the deploy job aliases and health-checks it |
| GitHub | `VERCEL_TOKEN` (a secret); `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (repository variables) | from the Vercel project |
| not on Vercel | `HOST`, `PORT`, `API_URL` | read only by `dev:server`, the API on its own |
| removed | `SQLITE_DB_PATH`, `BACKUP_DIR`, `BACKUP_KEEP` | |

Changing a `NEXT_PUBLIC_*` value still means a new build, not just a redeploy of the old one.

### 6.4 Deploys from CI

Replace the `container` and `deploy` jobs in `.github/workflows/ci.yml`. After `check` and `e2e` pass on `main`:

1. Run `vercel pull --yes --environment=production`, then `vercel build --prod`. A failed build stops here, before the database is touched.
2. Run `bun run db:migrate` with the production `MIGRATION_DATABASE_URL`. If it fails, the deploy stops and the running release keeps serving.
3. Run `vercel deploy --prebuilt --prod`, then check `https://<domain>/api/health` the way `deploy/railway/deploy.sh` checks Railway today.

On the `staging` branch, the same job migrates `temply-staging`, deploys with `vercel deploy --prebuilt`, and runs `vercel alias` to point the staging domain at the result.

**Done on the branch:** the `deploy` job, with the Vercel CLI pinned to 60.1.3, reading the GitHub rows of §6.3 from the `production` and `staging` environments. The `container` job is gone with the old `deploy`. The `check` job also fails when `shared/schema.ts` changes without a migration, which works only once `server/drizzle/` is committed.

### 6.5 Backups

- Supabase Pro takes daily backups; check the retention (§12). Point-in-time recovery is an add-on. It's worth buying once customers have data we couldn't recreate.
- A backup that lives with the database is no backup if the provider has a problem. Add a scheduled GitHub Actions workflow that runs `pg_dump` nightly over the session pooler and stores the dump outside Supabase, encrypted, for example in an R2 or S3 bucket. Restore it once into `temply-staging` before calling this done.
  - **Written on the branch:** `.github/workflows/backup.yml` dumps `public` and `drizzle` with `pg_dump` 17, encrypts with age to a public key and uploads to any S3-compatible bucket. The README's *Backups* has its variables and the restore, which was rehearsed against a local Postgres. **Still owed:** the bucket, a write-only key for it, the age key pair, a first run, and the one restore into `temply-staging`.

### 6.6 Stand up staging

- [ ] Deploy `feature/vercel-supabase` to staging. Point the Clerk dev instance and Stripe test mode webhooks at `https://<staging domain>/api/webhooks/{clerk,stripe}`, and set up the test-mode meter, prices and customer portal as the README's *Setup* describes.
- [ ] Rehearse the copy: take a snapshot of the Railway SQLite database, load it into `temply-staging` with `sqlite-to-postgres.ts`, and check the counts.
- [ ] Walk through the §7 smoke list on staging. Include one cron run, triggered from the Vercel dashboard or `vercel crons`, and a Sentry test error raised inside an API route.
- [ ] **Load test.** Vercel adds instances as load grows, so there's no longer a per-replica ceiling to find. Find these three numbers instead:
  - p95 of the public render endpoint at rising concurrency;
  - which part of Supabase gives out first: pooler client connections or database CPU;
  - Vercel active CPU per 1,000 renders. This is the cost behind the $1 per 1,000 calls overage price (`shared/plans.ts`), so it gives the margin.
  The burst limiter and the test-key monthly cap would block the test. Use a live key on an Enterprise-plan staging org, and raise the limits through staging-only variables if needed. Read Vercel's load-testing guidance first, so the test isn't treated as an attack.

---

## 7. Phase 5: cutover runbook

If Railway production has never held customer data, skip the window: deploy, add the domain, walk the smoke list, and go on to §9.

Otherwise, do it in one announced maintenance window, off-peak for UK users.

**The day before**
- [ ] Lower the TTL on the app's DNS record to 60 s.
- [ ] Deploy production on Vercel from `feature/vercel-supabase`. Migrations run, and the database stays empty. Add the custom domain to the project and note the DNS records Vercel asks for.
- [ ] Production Clerk is tied to the domain, so production can't be smoke-tested before the domain moves. Staging carries that risk instead.

**The window**
1. [ ] Pause writes to the Railway service.
2. [ ] Take and export a final consistent SQLite snapshot, following the README's Railway backup procedure.
3. [ ] Run `sqlite-to-postgres.ts` against production Supabase over the session pooler. **Go / no-go:** every table count matches.
4. [ ] Point the domain's DNS at Vercel and wait for its certificate.
5. [ ] If the domain is unchanged, the Clerk and Stripe webhook URLs don't change either. If it changes, repoint both webhooks and update `CLERK_WEBHOOK_SIGNING_SECRET`. Edit the existing Stripe endpoint's URL rather than adding a new one. An edited endpoint keeps its signing secret. A new endpoint gets a new one, and `STRIPE_WEBHOOK_SECRET` would have to change with it.
6. [ ] Smoke test:
   - sign in and switch workspace;
   - open, edit and autosave a template;
   - publish, then check version history;
   - fetch that template through the integrator API with a live key;
   - upload an image, and check that a 4.5 MB one gets our message;
   - send a test email and submit the contact form;
   - open the billing portal (no purchase);
   - trigger the overage cron once;
   - check `/api/health`, and confirm Sentry receives a test error from an API route.
7. [ ] Merge `feature/vercel-supabase` → `main`. From here on, CI deploys to Vercel.

**Rollback** (decide within the window): point DNS back at Railway. If Postgres has accepted writes, reconcile them into SQLite before reopening that service. Keep the Railway service, its volume and the final snapshot until the move is verified, for example after a week of normal traffic.

---

## 8. Scaling playbook

**At launch** nothing is set by hand. Vercel scales function instances with traffic, up to 30,000 concurrent on Pro, and Supabase runs one Postgres. Everything stays in London.

| Symptom | What to change |
|---|---|
| p95 rises while Postgres CPU is high, or queries are slow | Indexes first (`pg_stat_statements`), then a larger Supabase compute size |
| The pooler refuses clients with a max-connections error | Lower `DB_POOL_MAX`. The pooler's client limit and Postgres's `max_connections` both grow with compute size |
| Renders are slow while the database is quiet | Raise the function's memory, which also raises its CPU (Pro allows up to 4 GB / 2 vCPU). Each render is CPU-bound |
| One integrator is hammering the API | Add a Vercel Firewall rate-limit rule on `/api/v1/*`, which refuses the calls before a function runs. The database limiters stay as the exact count |

**Worth knowing**
- Vercel doesn't pin a client to one instance. After §3 and §4, nothing depends on it.
- **Don't go multi-region yet.** A function outside London pays the round trip to the database about seven times per integrator call: key lookup, burst window, usage, plan, template, `last_used_at`, usage upsert. When that's needed, the first optimisation is merging the writes and caching the key → org lookup for a few seconds.

---

## 9. Phase 6: tidy up

- [ ] Delete the Railway setup: `Dockerfile`, `railway.json`, `deploy/railway/` (with `deploy.test.ts`), the `bash -n deploy/railway/...` step in the `check` job, the README's *Production on Railway* section, and the server's `build` script, which only the Dockerfile uses. The `container` job went with §6.4. Retire the Railway service once rollback is off the table.
- [ ] `make deploy` runs the §6.4 steps by hand, and `make logs` becomes `vercel logs`.
- [x] Rewrite the README's *Production* section for Vercel and Supabase, and add the expand-then-contract migration rule to `CLAUDE.md`. Done early, on the branch; the Railway section beside it goes with the first item.
- [ ] Use `VERCEL_GIT_COMMIT_SHA` as the Sentry release, so errors map to commits. `withSentryConfig` may already pick it up on Vercel, so check before adding it.
- [ ] If nothing uses `dev:server` once dev runs in-process, delete the standalone server in `index.ts` and `HOST` with it.

---

## 10. Open decisions (recommendation first)

1. **Where the API runs.** *Recommended:* inside the Next route (§5). *Alternative:* `server/` as a second Vercel project on the Bun runtime, which is in beta. It would need `export default app`, because Vercel doesn't support `app.listen`. It keeps Bun in production, at these costs:
   - a public URL for the API, protected only by `x-internal-token`;
   - a second invocation and cold start on every request;
   - variables in two projects;
   - a new header for the client address, which Vercel overwrites on the second project. The proxy would send it, and the API would trust it only alongside the token.
2. **Image size.** *Recommended:* 4 MB now (5.4). Browsers could upload straight to ImageKit with a signed token from the API instead. That keeps the bytes off our functions and allows bigger images, but it moves the file-type check the API does today to ImageKit's side.
3. **Region.** *Recommended:* London for both (Vercel `lhr1`, Supabase eu-west-2). Usage periods are UK calendar months, which suggests a UK/EU user base.
4. **Preview databases.** *Recommended:* every preview shares `temply-staging`. The cost is that a branch whose migration isn't on staging yet breaks other previews until it lands. If that starts to hurt, Supabase Branching gives each pull request its own database, at a cost per branch.
5. **Timestamp types.** *Recommended:* keep `text` during the port and convert to `timestamptz` in a separate PR later. Changing both at once makes a failure hard to attribute.
6. **Rate-limit store.** *Recommended:* Postgres now, with Vercel Firewall rules for coarse abuse. Add Redis only if measurements call for it (1.1).
7. **Test database.** *Recommended:* PGlite in-process, once it's confirmed to run on Bun 1.4.2. Docker Postgres is the fallback (2.6).
8. **Plans.** Vercel Pro and Supabase Pro. Vercel's Hobby plan is for non-commercial use and runs crons at most once a day. Supabase's free tier pauses idle projects. Check current pricing and limits before signing up.
9. **Existing data.** Preserve the Railway SQLite database, and rehearse its copy (§6.6) before it's replaced.

---

## 11. Found while reading (not part of the move)

- ~~The burst 429 message was missing its interpolations.~~ Fixed in c0b53f6 (1.6).
- ~~`api_keys.key_hash` had no index.~~ Fixed in 1.4.
- The anonymous preview, the contact form and CSP reports all count in the one `address:<ip>` bucket. The contact form refuses once an address has made 5 of those calls in a minute. So an editor open in the playground, or a page firing CSP reports, can use up that address's contact allowance. Give each its own bucket prefix if that's ever reported. It predates Phase 1, so it wasn't changed.

## 12. Not yet confirmed

Check these before relying on them:

- That Next bundles the Elysia app and runs it on Node (spike 5.0). Confirmed locally under `next start` (5.0's note); a Vercel preview still has to show it.
- ~~Whether `attachDatabasePool` accepts a postgres.js client (2.1).~~ Moot: 2.1 uses `pg`.
- That `captureException` from `@sentry/core` reaches the `@sentry/nextjs` client when the versions match (5.1). The versions match, 10.73.0 with one copy in `bun.lock`; the arrival is for staging (§6.6).
- Which Postgres major version Supabase provisions, so local dev and CI can match it. `compose.yaml`, CI and the backup job assume 17.
- That `pg` connects to Supabase with `sslmode=require` in the URL. `pg-connection-string` 2.14 reads `require` as `verify-full`, and Supabase's certificate is signed by Supabase's own CA, so the connection may be refused. The fix is either the CA from the project's settings passed to the pool, or `uselibpqcompat=true&sslmode=require` in both `DATABASE_URL` and `MIGRATION_DATABASE_URL`. Try it on `temply-staging` first.
- That `vercel build` run from the repository root honours the project's Root Directory `client`.
- That the staging domain answers Stripe, Clerk and the deploy job's health check. Vercel's Standard Deployment Protection covers every domain but production's, so staging needs protection off or an exception for `/api/webhooks/*` and `/api/health`.
- The e2e suite on Postgres, owed since Phase 1 and now including the move itself, `specs/assets.e2e.ts` among it. It needs `e2e/.env`'s Clerk keys.
- The deploy job and the backup workflow, which have not run yet.
- Supabase Pro's backup retention, and the price of point-in-time recovery.
- The pooler's client-connection limit at the compute size we choose.
- That `git.deploymentEnabled` in `vercel.json` still stops a branch deploying from Git, and that crons run only on production deployments.
- That no rendered response comes near 4.5 MB. Template content is capped at 1,000,000 characters, so saves fit, but a render with inlined CSS is larger than its source.
- ~~Whether PGlite runs under Bun 1.4.2.~~ It does; the server tests run on it.

## Sources

- Elysia on Vercel (`export default app`, `app.listen` not supported, Bun runtime): https://vercel.com/docs/frameworks/backend/elysia
- Bun runtime on Vercel (beta, `bunVersion`): https://vercel.com/docs/functions/runtimes/bun
- Function limits (4.5 MB bodies, durations, memory, `iad1` default, 30,000 concurrency): https://vercel.com/docs/functions/limitations
- Request headers (`x-forwarded-for` overwritten, external IPs not forwarded): https://vercel.com/docs/headers/request-headers
- Cron limits per plan: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Connection pooling with Fluid compute (`attachDatabasePool`, idle timeout, pool size): https://vercel.com/kb/guide/connection-pooling-with-functions
- Supabase connection types (transaction pooler for serverless, prepared statements off, direct connection IPv6 unless the add-on): https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase tables no longer exposed to the Data API by default: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- Securing the Supabase Data API: https://supabase.com/docs/guides/api/securing-your-api
