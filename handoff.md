# Handoff: future PostgreSQL and scaling work on Railway

**Status:** follow-up proposal. The current Railway deployment configuration is in the root `Dockerfile`, `railway.json` and `.github/workflows/ci.yml`; see the README for setup. Phase 1 (§3) was done on 2026-09-23. Its e2e run is still owed, because the local Clerk and e2e credentials were blank that day. The PostgreSQL and scaling proposals after it remain unimplemented and need revalidation against that configuration.
**Written:** 2026-09-21, from `feature/development` at `f047479`.
**For:** whoever picks this up next, whether a person or an agent session. Read §1–§2 first. Each phase after that is a unit of work you can ship on its own. The decisions still open are in §9.

---

## TL;DR

- On Railway, each environment runs three services: **`web`** (Next.js), **`api`** (Elysia on Bun) and **`postgres`**. Only `web` gets a public domain. `api` is reachable only over Railway's private network, which already fits how the code works: everything enters through the Next.js proxy.
- **SQLite is what stops us adding replicas when load grows.** Railway doesn't allow replicas on a service with a volume, and redeploying a service that has a volume causes downtime. Most of this work is therefore porting the API from `bun:sqlite` to Postgres. The rate limiters that used to live in memory are already in the database (§3.1).
- On Railway, "scales" means two things. Each replica grows vertically on its own, up to the plan's limit. The **replica count** is a number we set (dashboard, `railway scale`, or the API). Railway has no built-in horizontal autoscaler; §7 covers when to add one and how.
- A Bun or Node process runs JavaScript on one core. Vertical scaling stops helping the API once rendering fills about 1 vCPU per replica. **Adding replicas is what actually increases capacity**, and the code has to be stateless before replicas are safe.
- Order of work: harden the API while it still runs on SQLite (§3). Port to Postgres on a branch (§4). Containerise and stand up staging (§5). Cut over in one maintenance window (§6). Then tune the scaling settings (§7).

---

## 1. Where things stand

| Area | Today | Why it matters for Railway |
|---|---|---|
| Hosting | Configured as one Railway service: Next on :8080 → API on loopback :3001, supervised by `deploy/railway/start.sh`. GitHub Actions deploys after CI passes. | Splitting this into `web` and `api` services is future work. |
| Database | A SQLite file (`SQLITE_DB_PATH`, default `maily.db`), opened lazily in `server/src/plugins/db.ts:194`. The schema is created and migrated **at boot** by `initTables` (`db.ts:10-131`) using `ALTER TABLE`-if-missing plus one-off backfills. | A single-writer file on one disk. It can't be shared between replicas, and a Railway volume blocks replicas entirely. |
| Backups | Scheduled Railway volume backups are enabled during setup; `server/scripts/backup-db.ts` creates additional SQLite snapshots. | Replaced by Railway Postgres backups and a logical dump (§5.4). |
| In-memory state | Only the per-process monotonic clock `nextStamp` (`server/src/lib/stamp.ts:10`). Every rate limit counts in the `rate_windows` table (§3.1). | Each replica keeps its own clock, so two replicas can issue the same stamp (§4.4). |
| Request path | Every request goes through the catch-all proxy `client/app/api/[[...path]]/route.ts`: dashboard calls, the integrator API `/api/v1/...`, and both webhooks. The proxy forwards to `API_URL` and proves itself with `x-internal-token`. | The API never needs a public address. It only has to listen on a private interface. It binds to `HOST`, which defaults to `127.0.0.1` (`server/src/index.ts:72`), and `start.sh` pins it to loopback. |
| Files | None on local disk. Images live on ImageKit. | Nothing to migrate and no shared filesystem needed. |
| Third parties | Clerk, Stripe, Resend, ImageKit, Sentry. All SaaS. | They don't move. Only the webhook URLs, and possibly their secrets, change at cutover. |

---

## 2. Target architecture

```
                         ┌─────────────── Railway project "temply", environment: production ───────────────┐
                         │                                                                                  │
  browser / integrator   │   ┌──────────────┐   private network    ┌──────────────┐        ┌────────────┐  │
  Stripe, Clerk ─────────┼──▶│ web          │  http://api.railway  │ api          │  TCP   │ postgres   │  │
  https://<domain>       │   │ Next.js 15   │ ────.internal:3001──▶│ Elysia / Bun │───────▶│ single     │  │
                         │   │ replicas: 2+ │  x-internal-token    │ replicas: 2+ │  pool  │ instance,  │  │
                         │   └──────────────┘                      └──────────────┘        │ volume +   │  │
                         │     public domain                         no public domain      │ backups    │  │
                         │                                                                 └────────────┘  │
                         └──────────────────────────────────────────────────────────────────────────────────┘
                                         │                         │
                                         ▼                         ▼
                                       Clerk          Stripe · Resend · ImageKit · Sentry
```

| Service | Built from | Public | Replicas at launch | Health check |
|---|---|---|---|---|
| `web` | `client/Dockerfile` | yes, custom domain | 2 | `/api/health`, which goes through the proxy and so proves the whole web → api → db chain |
| `api` | `server/Dockerfile` | **no**, private network only | 2 | `/api/health` |
| `postgres` | Railway's Postgres template | no (the TCP proxy is on only during the cutover copy) | 1 | built in |

Launching with two replicas of each service is **not about load**. It gives zero-downtime deploys (Railway overlaps old and new replicas) and means one crashed replica doesn't take the site down.

A `staging` environment has the same shape with one replica each. It uses Clerk's dev instance and Stripe test mode.

**Tradeoffs for the follow-up**

- *SQLite on a Railway volume.* This is the current deployment configuration. It keeps the existing database but limits the service to one replica and introduces deployment downtime; this proposal addresses those limits.
- *Terraform or multi-cloud now.* Container images remain portable. Infrastructure-as-code can wait until we actually run on more than one provider. The proposed per-service settings would live in the repo as `railway.toml` files (§5.2).

---

## 3. Phase 1: harden the API while it's still on SQLite

These changes are driver-agnostic. Each one merges to `main` as a normal PR, passes every gate in `CLAUDE.md`, and keeps the current Railway deployment working. Doing them first keeps the Postgres port (§4) small.

- [x] **1.1 Move every limiter into the database.** The `rate_windows` table is `(bucket TEXT, window_start TEXT, count INTEGER, PRIMARY KEY (bucket, window_start))`. It isn't `(scope, window)` as first proposed, because `WINDOW` is a reserved word in both SQLite and Postgres. `checkWindow` in `server/src/lib/rate-limit.ts` counts and decides in one statement: `INSERT … ON CONFLICT DO UPDATE SET count = count + 1 WHERE count < limit RETURNING count`. No returned row means refused, and a refused call isn't counted. One in 100 calls deletes windows more than a day old. The key burst fuse, the test-send cap (still 20 per user per hour) and the per-address limits on anonymous previews, the contact form and CSP reports all use it, and `resetBurstWindows` is gone.
  *Why Postgres and not Redis:* this adds no new infrastructure, and it's one round trip on a path that already writes `org_usage` on every call. Switch to Redis only if §7's measurements show this row is a hot spot.
- [x] **1.2 Make aggregates return numbers.** Postgres returns `count(*)` and `sum()` as bigint, which postgres.js hands back as a **string**. Every count now uses Drizzle's `count()` helper, and the byte total in `billing.ts` uses `.mapWith(Number)`.
- [x] **1.3 Stop depending on `rowid`.** The asset library orders by `desc(assets.created_at), desc(assets.id)`. New assets get a `nextStamp()` rather than the column default, which counts whole seconds, so two uploads in one second still list in order. For the same reason, version history and its prune now order by `version_number` instead of `created_at`.
- [x] **1.4 Add the missing hot-path indexes.** `api_keys_key_hash` is on `api_keys(key_hash)`, and `template_versions_number` is a unique index on `template_versions(template_id, version_number)`. A separate `template_id` index would be redundant, because the unique index's leading column serves those lookups. Before building the unique index, `initTables` renumbers any clashing versions that already exist, moving each later copy to the top of its template's history, so an old clash can't fail the boot. `snapshotVersion` computes the number inside the insert, which is atomic on SQLite. §4.4 still applies on Postgres.
- [x] **1.5 Make the bind address configurable and shut down cleanly.** The API binds to `HOST`, default `127.0.0.1`. It's in the README's env table, and `start.sh` pins it to loopback so an inherited `HOST` can't expose the API in the single-service container. On `SIGTERM` or `SIGINT` the API stops taking connections, lets in-flight requests finish, calls `closeDb()` (which also folds the SQLite WAL back into the file) and exits. A second signal exits at once.
- [x] **1.6 Fix the burst message.** Done in c0b53f6.

---

## 4. Phase 2: port to Postgres (branch `feature/railway`)

This phase changes the database contract, so the work stays on a branch and staging deploys from it (§5). The branch merges at cutover (§6). Rebase it on `main` often.

- [ ] **2.1 Driver.** Use `postgres` (postgres.js) with `drizzle-orm/postgres-js`: it's Drizzle's most mature Postgres driver and runs on Bun. Config comes from `DATABASE_URL`, with the pool size set by `DB_POOL_MAX` (default 10). Create the pool once at module load in `db.ts` rather than lazily inside `.derive`, so a bad URL fails the boot instead of the first request.
  Keep the Elysia plugin name `'db'`, because `server/src/test/helpers.ts` relies on name-based deduplication.
- [ ] **2.2 Schema.** In `shared/schema.ts`, change `sqliteTable` to `pgTable`, and in `server/src/lib/purge.ts:2` change `AnySQLiteColumn` to `AnyPgColumn`. **Port like for like**: timestamps stay `text` and `is_default` stays an integer, so no API response or client type changes shape. Converting to `timestamptz` or `boolean` is a separate change for later.
  Replace the `now` default (`schema.ts:6`) with an expression that produces SQLite's exact `datetime('now')` format: `to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`. Read `shared/publish.ts` before changing any timestamp handling; it documents why the two formats must not mix. `client/db/schema.ts` only re-exports inferred types, so running typecheck is enough to confirm it.
- [ ] **2.3 Migrations become files and run once per deploy.** Add `drizzle-kit`, `server/drizzle.config.ts` and a `server/drizzle/` folder. The **first migration is the end state of `initTables`**: every column it adds, the `org_id` indexes, the partial unique index `subscriptions_org_id_unique … WHERE org_id IS NOT NULL`, `mails_share_token`, and the §3.4 indexes.
  The one-off backfills in `initTables` are SQLite history and don't get ported. That covers the `user_prefs` carry-over, the published-copy backfill, `scale` → `enterprise`, timestamp healing, short-code backfill and `renumberClashingVersions`. Confirm the source SQLite database has received them before copying its data in §6.
  Add a `db:migrate` script that uses Drizzle's migrator. Railway runs it as the pre-deploy command, which runs once before new replicas start; if it fails, the deploy stops. Delete `initTables`, `addColumnIfMissing` and `backfillShortCodes`.
  **Rule from now on, written into `CLAUDE.md`:** migrations are expand-then-contract. During a deploy, old replicas keep serving on the new schema. So add columns as nullable, backfill, and enforce constraints in a later deploy. Never drop or rename a column in the same deploy that stops using it.
- [ ] **2.4 Make concurrent writes safe.** SQLite serialised all writes in one process; Postgres with several replicas doesn't.
  - Wrap publish and `snapshotVersion` (`server/src/routes/templates.ts:47`) in `db.transaction`, starting with `SELECT … FOR UPDATE` on the `mails` row. The version number is already computed inside the insert (§3.4). That makes it atomic on SQLite, but under Postgres's default READ COMMITTED isolation two concurrent inserts can still read the same `MAX`. Without the lock, the §3.4 unique index would turn that race into a 500 rather than a duplicate.
  - `nextStamp()` is monotonic only within one process. Inside the same locked transaction, set the new stamp to the later of `nextStamp()` and the row's current `updated_at` plus 1 ms. That keeps the invariant "a draft save after a publish always shows unpublished changes" true across replicas.
  - Stripe can deliver two events for the same subscription to different replicas at once. `applySubscription` (`server/src/lib/stripe.ts`) already settles them: the webhook reads the subscription back from Stripe and stamps when it read it, the update applies only when that stamp is no older than the stored `stripe_synced_at`, and the check sits in the `UPDATE`'s own `WHERE`. Keep it there when the query moves to Postgres; a read-then-write would reopen the race. The same `UPDATE` sets `trial_ends_at` with SQLite's two-argument `min()`, which Postgres spells `LEAST`.
  - The overage reporter (`server/src/lib/overage.ts`) runs in every `api` replica. It claims `org_usage.reported` with a compare-and-set before Stripe hears anything, so two replicas never report the same calls. Keep that claim a single conditional `UPDATE`.
- [ ] **2.5 Health check.** `server/src/routes/health.ts:19` calls `db.get(...)` synchronously inside a `try`. With an async driver the `try` would miss the rejection, so it has to become `await db.execute(sql\`select 1\`)`.
- [ ] **2.6 Unit tests on PGlite.** Point `createTestDb()` (`server/src/test/helpers.ts:15`) at an in-process PGlite (`@electric-sql/pglite` + `drizzle-orm/pglite`) and apply the same migration files. The tests then keep tracking the real schema the way they track `initTables` today, and `bun test` still needs no Docker. There are 21 call sites across 18 test files. If starting a fresh PGlite per test is too slow, use one instance per file and `TRUNCATE` between tests. **Before committing to this, check that PGlite runs under Bun 1.4.2.** The fallback is a Docker Postgres with one schema per test file.
- [ ] **2.7 Local dev, e2e and CI.** Add a `compose.yaml` with a Postgres image matching the major version Railway provisions, and put `DATABASE_URL` in `server/.env`. In `e2e/env.ts:33,137`, create a `temply_e2e_<RUN_ID>` database instead of the temporary SQLite file, and drop stale ones the same way stale files are pruned today. The CI `e2e` job gets a `services: postgres` container, and so does the `check` job if 2.6 falls back to Docker. Update `.env.example` and the README tables: `DATABASE_URL` and `DB_POOL_MAX` come in (`HOST` is already there, §3.5); `SQLITE_DB_PATH`, `BACKUP_DIR` and `BACKUP_KEEP` go out.
- [ ] **2.8 Copy script.** Write `server/scripts/sqlite-to-postgres.ts`. It reads a SQLite snapshot and, in a single Postgres transaction, `TRUNCATE`s and re-inserts all 11 tables in batches: `mails`, `api_keys`, `template_versions`, `subscriptions`, `api_usage`, `org_usage`, `brands`, `user_prefs`, `org_prefs`, `contact_messages`, `assets`. `rate_windows` stays behind: no row in it is older than a day, and starting it empty just resets every limit once. It then prints each table's row count on both sides and exits non-zero if any differ, so it's safe to re-run. Copy by the Postgres schema's columns, not the source's: a column an older SQLite shape kept — the `lemonsqueezy_*` columns of a database from the unreleased Lemon Squeezy branch, say — has nowhere to go and nothing reads it. Rehearse it against a copy of the Railway SQLite database on staging (§5.5).
- [ ] **2.9 Remove the SQLite leftovers:** `server/scripts/backup-db.ts`, the `db:backup` script, the `bun:sqlite` imports and `closeDb`'s WAL note. On Postgres, `closeDb` becomes ending the pool.

---

## 5. Phase 3: containers, Railway config, staging

### 5.1 Dockerfiles (build context is the repo root, so `workspace:*` resolves)

- `server/Dockerfile`: base image `oven/bun:1.4.2`, the same pin as CI. Copy the root `package.json`, `bun.lock` and each workspace's `package.json`, run `bun install --frozen-lockfile` (use `--production` and a filter to the server and shared packages if `bun install --filter` works on 1.4.2), then copy `shared/` and `server/`. Run as a non-root user with `CMD ["bun", "src/index.ts"]` from `/app/server`.
- `client/Dockerfile`: multi-stage. The build stage declares **`ARG` for every `NEXT_PUBLIC_*` value** plus `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN`, because Next bakes `NEXT_PUBLIC_*` values in at build time and Railway passes service variables into a Dockerfile build only as declared `ARG`s. The runtime stage runs `next start`, which reads `PORT`. `output: 'standalone'` would shrink the image and is a later optimisation, not a prerequisite.
- Add a root `.dockerignore` covering `node_modules`, `.next*`, `e2e/`, `.git`, `*.db` and `.env*`.

### 5.2 Config as code

Set each service's config-file path in its settings (`/server/railway.toml`, `/client/railway.toml`). A sketch for `server/railway.toml`; check the key names against the config-as-code reference in the sources:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "server/Dockerfile"
watchPatterns = ["server/**", "shared/**", "bun.lock", "package.json"]

[deploy]
preDeployCommand = ["bun run db:migrate"]
healthcheckPath = "/api/health"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
drainingSeconds = "15"       # finish in-flight requests after SIGTERM (§3.5)

[deploy.multiRegionConfig."<region id>"]   # e.g. the Amsterdam region; copy the exact id from the dashboard
numReplicas = 2
```

`client/railway.toml` is the same without `preDeployCommand`, using `watchPatterns = ["client/**", "shared/**", "bun.lock", "package.json"]`. The watch paths keep a client-only commit from redeploying the API, and the reverse.

Turn on **Wait for CI** for both services so a red GitHub Actions run never deploys.

### 5.3 Variables

Set these once per environment. The `${{ }}` syntax is Railway's variable references, so secrets live in one place.

| Where | Variable | Value |
|---|---|---|
| shared | `INTERNAL_API_SECRET` | new random value per environment (the README has the command) |
| shared | `NEXT_PUBLIC_APP_URL` | `https://<domain>`, or the staging Railway domain |
| shared | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | live instance in production, dev instance in staging |
| shared | `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` / `staging` |
| api | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (the private URL) |
| api | `HOST`, `PORT`, `DB_POOL_MAX` | `::`, `3001`, `10` |
| api | everything else from the server block of `.env.example` | Stripe (key, webhook secret, three prices, meter event), the Clerk webhook secret, Resend, contact, sending, ImageKit, `SENTRY_DSN` |
| web | `API_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` |
| web | everything else from the client block | sign-in/up URLs, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`/`PROJECT`/`AUTH_TOKEN`, contact emails |

Changing a `NEXT_PUBLIC_*` value means rebuilding `web`, not just restarting it.

### 5.4 Backups

Turn on Railway's scheduled backups for the Postgres volume. Add a small cron service that runs `pg_dump` nightly to object storage outside Railway, because a backup that lives with the database is no backup if the provider has a problem. Restore once on staging before calling this done.

### 5.5 Stand up staging

- [ ] Create project `temply` with environments `production` and `staging`. Add Postgres, `api` (from `feature/railway`) and `web`. Generate a Railway domain for `web` only.
- [ ] Point the Clerk dev instance and Stripe test mode webhooks at `https://<staging domain>/api/webhooks/{clerk,stripe}`, and set up the test-mode meter, prices and customer portal as the README's *Setup* describes.
- [ ] Rehearse the §6 copy: take a snapshot of the Railway SQLite database, load it with `sqlite-to-postgres.ts`, and check the counts.
- [ ] Walk through the §6 smoke list on staging.
- [ ] **Load test to find the per-replica ceiling.** Hit the public render endpoint with `oha` or k6 at rising concurrency on one `api` replica, and record requests per second at an acceptable p95. That number turns traffic forecasts into replica counts (§7). The burst limiter and the test-key monthly cap will block a load test, so use a live key on an Enterprise-plan staging org, and raise the limits through staging-only variables if needed.

---

## 6. Phase 4: cutover runbook

Do this in one announced maintenance window, off-peak for UK users.

**The day before**
- [ ] Lower the TTL on the app's DNS record to 60 s.
- [ ] Deploy `production` on Railway from `feature/railway`. Migrations run and the database is empty. Add the custom domain to `web` and note the CNAME target. Apex domains need CNAME flattening or ALIAS at the DNS provider.
- [ ] Production Clerk is tied to the domain, so production can't be smoke-tested on the Railway-generated domain. Staging carries that risk instead.

**The window**
1. [ ] Pause writes to the current Railway service during the database transition.
2. [ ] Take and export a final consistent SQLite snapshot using the README's Railway backup procedure.
3. [ ] Turn on the Postgres TCP proxy briefly. Run `sqlite-to-postgres.ts` against production. **Go / no-go:** every table count matches. Turn the TCP proxy off again.
4. [ ] Move the production domain to the new Railway `web` service and verify its certificate.
5. [ ] If the domain is unchanged, the Clerk and Stripe webhook URLs don't change either. If it changes, repoint both webhooks and update `CLERK_WEBHOOK_SIGNING_SECRET`. Edit the existing Stripe endpoint's URL rather than adding a new one: an edited endpoint keeps its signing secret, while a new endpoint has a new one and `STRIPE_WEBHOOK_SECRET` would have to change with it.
6. [ ] Smoke test: sign in; switch workspace; open, edit and autosave a template; publish and check version history; fetch that template through the integrator API with a live key; upload an image; send a test email; submit the contact form; open the billing portal (no purchase); check `/api/health` and confirm Sentry receives a test error.
7. [ ] Merge `feature/railway` → `main` and point both Railway services at `main`.

**Rollback** (decide within the window): restore the previous Railway release and route the domain back to its service. If PostgreSQL has accepted writes, reconcile them into SQLite before reopening that service. Retain the original volume and final snapshot until the transition is verified.

---

## 7. Scaling playbook

**At launch:** `api` ×2, `web` ×2, Postgres ×1. Everything stays in one region, next to the database.

| Symptom | Setting to change |
|---|---|
| API p95 rises while each replica sits near 1 vCPU (rendering is single-threaded per process) | More `api` replicas, using the §5.5 ceiling for the number |
| Slow page loads, `web` CPU high | More `web` replicas |
| Postgres CPU high or slow queries | Indexes first (enable `pg_stat_statements` and look). Postgres then grows vertically on its own up to the plan limit |
| Connections approaching `max_connections` (`api` replicas × `DB_POOL_MAX`; Postgres defaults to 100) | Lower `DB_POOL_MAX`, or put Railway's PgBouncer template in front of Postgres, which is needed at about 8 or more `api` replicas |
| Load follows a predictable daily curve | Two cron jobs running `railway scale` with fixed replica counts |
| Load is spiky and unpredictable | An autoscaler service following Railway's guide: the `api` exposes in-flight requests, and the service polls that and calls `serviceInstanceUpdate(numReplicas)`. Scale up fast and down slowly. Keep its Railway API token in that one service |

**Worth knowing**
- Railway routes requests to replicas at random, with no sticky sessions. After §3 and §4 nothing depends on stickiness.
- The limit is 50 replicas per service across all regions. Check what your plan allows before relying on it.
- **Don't go multi-region yet.** Each integrator call makes about seven sequential queries (key lookup, burst window, usage, plan, template, `last_used_at`, usage upsert). An `api` replica in a different region from Postgres pays that round trip seven times. The first optimisation, when it's needed, is merging the writes and caching the key → org lookup for a few seconds.

---

## 8. Phase 5: tidy up

- [ ] Update `make deploy` and `make logs` for the proposed separate Railway services.
- [ ] Rewrite the README's *Production* section for Railway, and add the expand-then-contract migration rule to `CLAUDE.md`.
- [ ] Use `RAILWAY_GIT_COMMIT_SHA` as the Sentry release so errors map to commits.

---

## 9. Open decisions (recommendation first)

1. **Order of work.** Harden the current Railway SQLite service (§3), then port to Postgres (§4) and verify the proposed service split on staging before changing production.
2. **Region.** *Recommended:* Railway's EU West (Amsterdam). Usage periods are UK calendar months, which suggests a UK/EU user base. `api` and Postgres must share a region.
3. **Timestamp types.** *Recommended:* keep `text` during the port and convert to `timestamptz` in a separate PR later. Changing them together makes a failure hard to attribute.
4. **Rate-limit store.** *Recommended:* Postgres now, Redis only if measurements call for it (§3.1).
5. **Test database.** *Recommended:* PGlite in-process, once it's confirmed to run on Bun 1.4.2. Docker Postgres is the fallback (§4.6).
6. **Railway plan.** Pro, for replicas, backups and higher per-replica limits. Check current pricing and limits before signing up.
7. **Existing data.** Preserve the Railway SQLite database and rehearse its transfer before replacing it with PostgreSQL.

---

## 10. Found while reading (not part of the move)

- ~~The burst 429 message was missing its interpolations.~~ Fixed in c0b53f6 (§3.6).
- ~~`api_keys.key_hash` had no index.~~ Fixed in §3.4.
- The anonymous preview, the contact form and CSP reports all count in the one `address:<ip>` bucket. The contact form refuses once an address has made 5 of those calls in a minute, so an editor open in the playground, or a page firing CSP reports, can use up that address's contact allowance. Give each its own bucket prefix if that's ever reported. Not changed, because it predates Phase 1.

## 11. Not yet confirmed

Check these before relying on them:

- How `api.railway.internal` spreads connections across `api` replicas. If it pins to one replica, `web` → `api` traffic won't balance. The workaround is to give `api` a public domain and rely on `x-internal-token`, which is the "split" arrangement the README already describes.
- The exact region id to use in `multiRegionConfig`.
- Whether PGlite runs under Bun 1.4.2, and whether `bun install --filter` works for slimmer images.
- Which Postgres major version Railway provisions, so local dev and CI can match it.

## Sources

- Railway scaling (vertical autoscaling, replicas, random routing, no sticky sessions): https://docs.railway.com/reference/scaling
- Horizontal autoscaling guide (`serviceInstanceUpdate`, `railway scale`, 50-replica cap): https://docs.railway.com/guides/autoscale-horizontally
- Volumes (no replicas, downtime on redeploy): https://docs.railway.com/reference/volumes
- Pre-deploy command (runs before the deploy, failure stops it, has private network access): https://docs.railway.com/guides/pre-deploy-command
- Private networking (`*.railway.internal`, IPv4 and IPv6 in new environments): https://docs.railway.com/networking/private-networking/how-it-works
- Config as code (`railway.toml` keys): https://docs.railway.com/reference/config-as-code
