# Temply

A block editor for transactional email. Build the email without code, keep
templates and brands in a workspace, and pull the rendered HTML into your
own application through an API. Your app sends the mail; Temply hands you
the markup.

## Tech stack

Bun 1.4.2 is the package manager, the script runner and the test runner.
Never npm, yarn or pnpm. In production everything runs on Node, on Vercel:
the API is an Elysia app that the Next.js proxy route runs in-process.

**Client** (`client/`)

| | |
|---|---|
| Framework | Next.js 15.5 (App Router, Turbopack dev), React 19, TypeScript 5.8 |
| Styling | Tailwind CSS 4 with the design tokens in `app/globals.css` (`--ds-*`), `tailwind-merge`, `class-variance-authority` |
| UI primitives | Radix UI (dialog, dropdown, popover, tooltip), lucide-react icons, sonner toasts |
| Editor | tiptap 2 (ProseMirror) in `core/editor`, with custom nodes for the email blocks |
| Data | TanStack Query 5 over a thin `fetch` wrapper; every call goes through the `/api/[[...path]]` proxy |
| Auth | Clerk (`@clerk/nextjs` 7): sign-in, organizations, the user and organization profile components |
| Monitoring | `@sentry/nextjs` 10, initialised only when a DSN is set |

**API** (`server/`)

| | |
|---|---|
| Framework | Elysia 1 (`src/app.ts`), run inside the Next.js route `/api/[[...path]]`; `src/index.ts` also serves it on its own, on Bun at `127.0.0.1:3001`, for `bun run dev:server` |
| Database | Postgres 17 (Supabase in production) through `pg` and Drizzle ORM 0.45; schema in `shared/schema.ts`, generated migrations in `server/drizzle/`, applied by `bun run db:migrate` |
| Rendering | `@react-email/render` + `juice` turn the editor document into table-based, inlined HTML (`src/render/`) |
| Auth | `@clerk/backend` 3 verifies sessions and webhooks; proxied requests carry identity in headers proven by `INTERNAL_API_SECRET` |
| Billing | Stripe 22 (Checkout, the customer portal, a Billing Meter for API overage, webhooks). Temply sells the plan; Stripe processes the payment and holds the card |
| Email | Resend 4 for test sends and the contact form |
| Images | ImageKit 6 for uploads |
| Validation | Elysia's `t` schemas |
| Monitoring | Errors go through `@sentry/core`, so they reach whichever SDK started: `@sentry/nextjs` in production, `@sentry/bun` 10 under `dev:server` |

**Shared** (`shared/`): the Drizzle schema, plan limits, the renderer
theme type and contrast maths, the preflight checks, and the public API
path helpers — one source for both sides.

## Setup

```bash
bun install
cp .env.example client/.env     # everything the app reads, the API included
cp .env.example server/.env     # for db:migrate (and dev:server, if you use it)
docker compose up -d            # Postgres 17 on 127.0.0.1:5432
bun run db:migrate              # creates the tables in the `temply` database
```

`.env.example` holds only the values you have to supply. The API runs
inside Next.js, so `client/.env` is the file that matters; `server/.env` is
read only by what runs from `server/`. Any Postgres of your own works in
place of `compose.yaml`'s: point `DATABASE_URL` and
`MIGRATION_DATABASE_URL` at it.

What you need before the app is useful:

| Service | Keys | Used for |
|---|---|---|
| [Clerk](https://clerk.com) | publishable + secret | Sign-in, organizations, team membership. Enable **Organizations** in the Clerk dashboard. |
| [Stripe](https://stripe.com) | secret key, three prices, a meter, webhook secret | The Team plan: seats, API overage and template packs, at the prices in `shared/plans.ts`. Stripe is the payment processor, not the merchant of record. Checkout sells Team only; Enterprise is by hand. |
| [Resend](https://resend.com) | API key, a verified sender | Test sends from the editor, contact-form delivery. |
| [ImageKit](https://imagekit.io) | public + private key, URL endpoint | Image uploads. Without it, images are URL-only. |
| [Sentry](https://sentry.io) | DSN | Error reports. Optional; nothing is sent without a DSN. |

`INTERNAL_API_SECRET` is a random string that proves a request to the API
came from the Next.js proxy. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Environment variables

The full list, optional ones and their defaults included. *Side* says
which half reads a variable, but both halves run in one Next.js process, so
every one of them goes in `client/.env` locally and in the Vercel project
in production. `server/.env` needs the same values only for `dev:server`.

| Variable | Side | Required | What it does |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | both | yes | Clerk instance; the client mounts the sign-in UI with it, the API needs it to verify a session token presented directly. |
| `CLERK_SECRET_KEY` | both | yes | Clerk server key. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | server | for purges and seats | Verifies `organization.deleted`, `user.deleted` and `organizationMembership.created` / `.deleted` webhooks. Without it the endpoint answers 503, deleted workspaces are never purged, and a subscription's seats stop following the workspace's members. |
| `INTERNAL_API_SECRET` | both | yes | Random string proving a request came from the Next.js proxy. Without it the API ignores forwarded identities and every dashboard call is signed out. |
| `NEXT_PUBLIC_APP_URL` | both | yes | The site's own address. Client: metadata, sitemap, docs snippets, legal pages, dev-origin allow-list. Server: absolute image URLs in rendered email, the checkout return URL. `bun run dev:public` writes it. |
| `DATABASE_URL` | server | yes | The Postgres the API queries. Locally `compose.yaml`'s `temply` database; on Vercel, Supabase's transaction pooler (:6543). Nothing connects until the first query. |
| `MIGRATION_DATABASE_URL` | `db:migrate` | to migrate | Where `bun run db:migrate` applies `server/drizzle/`. It runs from `server/`, so locally it is read from `server/.env`; in CI it is a GitHub environment secret holding Supabase's session pooler URL (:5432). |
| `DB_POOL_MAX` | server | no | Connections one instance may hold, default 5. Lower it if the pooler refuses clients. |
| `CRON_SECRET` | server | in production | The bearer token Vercel Cron presents to `/api/cron/overage`, which reports overage to Stripe every five minutes. Unset, the route answers 503. `dev:server` reports on its own timer instead. |
| `API_URL` | client | no | Sends the proxy's calls to a standalone API (`bun run dev:server`, `http://127.0.0.1:3001`) instead of running it in-process. Unset everywhere else. |
| `HOST` | server | no | The interface `dev:server` listens on, default `127.0.0.1`. The API trusts the identity the Next proxy forwards, so a standalone API must never be reachable from the internet. |
| `STRIPE_SECRET_KEY` | server | for billing | Opens checkouts and portal sessions, changes seat and pack quantities, reports overage to the meter, and cancels the subscription of a deleted workspace. A test-mode key (`sk_test_…`) bills in test mode. |
| `STRIPE_WEBHOOK_SECRET` | server | for billing | The signing secret (`whsec_…`) of the `/api/webhooks/stripe` endpoint. Every endpoint has its own, so a new endpoint means a new secret; `bun run dev:public` writes it when it creates one. |
| `STRIPE_PRICE_SEAT` | server | for billing | The seat price: licensed, monthly, $5 a unit. Its quantity follows the workspace's Clerk members. |
| `STRIPE_PRICE_API_OVERAGE` | server | for billing | The overage price: usage-based on the meter below, $0.001 a unit (a unit amount of `0.1` cents), so 1,000 calls cost $1. |
| `STRIPE_PRICE_TEMPLATE_PACK` | server | for billing | The template pack price: licensed, monthly, $5 a unit. |
| `STRIPE_METER_EVENT` | server | no | The event name of the Billing Meter the overage price reads. Default `temply_api_calls`. |
| `STRIPE_API_BASE` | server | no | Points the Stripe client at another host. The e2e stack sets it to its fake; never set it anywhere else. |
| `RESEND_API_KEY` | server | for sending | Test sends from the editor and contact-form delivery. Without it sends are refused and contact messages are stored but not delivered. |
| `SENDING_FROM_ADDRESS`, `SENDING_FROM_LABEL` | server | no | The verified sender test sends go out from; users set a display name only. Defaults `send@temply.app` / `Temply`. |
| `CONTACT_EMAIL` | server | for contact form | Where contact-form messages are delivered. |
| `CONTACT_FROM_EMAIL` | server | no | The sender contact-form messages arrive from. Defaults to Resend's test sender `onboarding@resend.dev`; set a verified address in production. |
| `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` | server | for uploads | Image uploads. Unset: the library and uploads are off, pasted image URLs still work. |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` | client / both | no | Error reporting. The `NEXT_PUBLIC_` one reaches the browser bundle; server runtimes read `SENTRY_DSN` first. Nothing is reported when unset. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_ENVIRONMENT` | client / server | no | Environment tag on reports; defaults to `NODE_ENV`. |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | client build | no | Source-map upload during `next build`. Without the token the upload is skipped and the build still succeeds. |
| `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_SALES_EMAIL` | client | no | Addresses printed on the legal and plan pages. Defaults in `client/lib/site.ts`. |

## Running it

### Local

```bash
bun run dev
```

The app on http://localhost:9000, with the API running inside it as it
does on Vercel. Postgres has to be up (`docker compose up -d`) and migrated.

To run the API on its own, say to read its logs apart from Next's, start
`bun run dev:server` as well: it serves the API on http://127.0.0.1:3001,
loopback only, reading `server/.env`. Then set
`API_URL=http://127.0.0.1:3001` in `client/.env` so the proxy forwards to
it.

### On a phone, same Wi-Fi

Open `http://<your LAN IP>:9000`. The LAN address must be in
`allowedDevOrigins` in `client/next.config.mjs` (one is there already;
change it to yours), or Next refuses the phone's asset requests. Note
that a plain-HTTP LAN origin is not a secure context: browser APIs like
`crypto.randomUUID` are missing there, so anything that needs them has a
fallback.

### Public address — for webhooks and testing from anywhere

```bash
bun run dev:public
```

This starts a [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/downloads/)
quick tunnel to `:9000`, writes the address into both env files as
`NEXT_PUBLIC_APP_URL`, re-points the Stripe webhook endpoint through its
API, prints the Clerk endpoint URL for you to paste into the Clerk
dashboard, then runs `bun run dev`. One address then serves the site, the
API and both webhooks — the same shape as production.

A quick tunnel's address changes every time it starts, which is why the
script does the re-pointing. Flags:

- `--url <address>` — reuse an address instead of starting a tunnel (a
  tunnel already up, or a named tunnel on your own domain, which is the
  way to make the address stop changing).
- `--no-dev` — configure only; the dev server is already running.

Neither `bun --watch` nor `next dev` re-reads `.env`. After changing an
env file, restart the servers.

Set both webhooks up once:

- **Clerk** → Webhooks → add endpoint `<address>/api/webhooks/clerk` for
  `organization.deleted`, `user.deleted`, `organizationMembership.created`
  and `organizationMembership.deleted`; put the signing secret in
  `CLERK_WEBHOOK_SIGNING_SECRET`. A deleted workspace is purged and its
  subscription cancelled; a member joining or leaving changes the seats on
  the workspace's subscription, prorated.
- **Stripe** → Developers → Webhooks → `<address>/api/webhooks/stripe` for
  `customer.subscription.created`, `customer.subscription.updated` and
  `customer.subscription.deleted`, with its signing secret in
  `STRIPE_WEBHOOK_SECRET`. The script creates or re-points this one for
  you. Re-pointing an endpoint keeps its secret; creating one makes a new
  secret, which the script writes into `client/.env`.

Set Stripe up once, in test mode first:

1. **Meter.** Billing → Meters → create a meter with the event name
   `temply_api_calls` (or set `STRIPE_METER_EVENT` to yours), aggregation
   *Sum*, the customer read from the payload key `stripe_customer_id` and
   the value from `value`. The API reports each Team workspace's calls
   past the included ones to it every five minutes.
2. **Prices.** One product with three monthly prices: the seat (licensed,
   $5 a unit) in `STRIPE_PRICE_SEAT`; the overage (usage-based on that
   meter, per unit, a unit amount of 0.1 cents) in
   `STRIPE_PRICE_API_OVERAGE`; the template pack (licensed, $5 a unit) in
   `STRIPE_PRICE_TEMPLATE_PACK`. Billing counts as configured only when
   the key and all three are set.
3. **Customer portal.** Settings → Billing → Customer portal: let
   customers cancel (at the end of the period), update payment methods
   and see invoices. Do not let them change quantities or switch plans:
   seats follow Clerk membership, and packs change on the Plan page.
4. **Enterprise** is arranged by hand. Give the workspace's Stripe
   customer (made the first time an admin opens checkout; its metadata
   carries the `orgId`) a subscription whose metadata has `plan` set to
   `enterprise`. Checkout sells Team only.

Subscriptions renew at 00:00 UTC on the 1st, so a bill covers the month
the usage counter keeps; the days before the first renewal are prorated.
Every public API call counts toward the month, so point integrators at
the docs' Caching section (`/docs#caching`): render a broadcast once and
cache on the template's `updatedAt`.

Moving from the old plans: a paying subscription row that still says
`pro` reads as Team. A subscriber still paying the old Stripe Pro price
is not moved for you — swap their subscription onto the three prices
above by hand in the Stripe dashboard (seat quantity = the workspace's
members), and the webhook brings the row up to date.

In test mode, pay with `4242 4242 4242 4242`, any future expiry and any CVC.

Once production is receiving the webhooks, a
tunnel that only exists to look at the work from a phone should not move
them: `bun run dev:public --keep-webhooks` writes the envs and starts the
dev servers but leaves Stripe and Clerk where they point.

## Gates

Every one of these before a change is done:

```bash
bun run typecheck            # client, server, shared, e2e
bun run lint                 # Biome, on the rules that find a bug or an a11y gap; a warning fails
bun test                     # server + shared unit tests
bun run e2e                  # Playwright against a stack it starts itself; see e2e/README.md
cd client
bun run check:contrast       # every token pair meets its contrast threshold
bun run check:editor-contrast
bun run check:email-dark     # rendered email stays readable when a client forces dark mode
bun run check:motion         # every transition and shadow sits on a token
```

The spec is the test for UI: a change to something a customer sees ships
with its case in `e2e/specs`. CI (`.github/workflows/ci.yml`) runs the same
list, with the browser tests as their own job on a Postgres service, and
fails when `shared/schema.ts` has changed without its migration. Both jobs
must pass before a push to `main` deploys production, or a push to
`staging` deploys staging (see *Production*).

## Building

```bash
bun run build   # Next.js production build → client/.next, the API bundled in
```

`next build` writes to the same `.next` the dev server uses and will
knock a running `next dev` over; restart it afterwards.

## Production on Vercel and Supabase

One Vercel project, `temply`, serves the site and the API. Its Root
Directory is `client`, with source files outside it included, because the
build imports `server/` and `shared/`. Every `/api/*` request, both
webhooks included, reaches the route `app/api/[[...path]]`, which hands it
to the Elysia app in the same Node function (`client/lib/call-api.ts`).
The API has no address of its own.

Postgres is Supabase, in London beside the functions (`lhr1`, set in
`client/vercel.json`). The app connects through the transaction pooler
(:6543); migrations and backups use the session pooler (:5432), because
the direct connection is IPv6-only and GitHub's runners have no IPv6.
Supabase's Data API is off. Every table also has row level security on
with no policies, so its `anon` and `authenticated` roles would read
nothing even if the Data API were turned back on.

| Environment | Deploys | Database | Clerk / Stripe |
|---|---|---|---|
| production | `main`, from CI | `temply` | live instance / live mode |
| staging | `staging`, from CI: a preview deployment aliased to the staging domain | `temply-staging` | dev instance / test mode |
| previews | any other branch, from Vercel's Git integration | shares `temply-staging` | dev instance / test mode |

### Releases

The `deploy` job in `.github/workflows/ci.yml` runs once `check` and `e2e`
have passed. It builds with `vercel build`, runs `bun run db:migrate`
against that environment's database, releases with
`vercel deploy --prebuilt`, and asks the public domain for `/api/health`,
which queries the database. A failed build touches nothing; a failed
migration leaves the running release serving. `client/vercel.json` turns
Vercel's Git deploys off for `main` and `staging`, so CI is the only way
either is released.

The job needs, in GitHub:

| Kind | Name | Where | Value |
|---|---|---|---|
| Secret | `VERCEL_TOKEN` | repository | A Vercel token for the team |
| Variable | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | repository | From the project's `.vercel/project.json` after `vercel link` |
| Secret | `MIGRATION_DATABASE_URL` | environments `production` and `staging` | That environment's session pooler URL |
| Variable | `APP_URL` | environments `production` and `staging` | `https://<domain>`, or `https://<staging domain>` |

Changing a `NEXT_PUBLIC_*` value needs a new build, not a redeploy of the
old one.

CI sets `SITE_NOINDEX=1` for staging builds and `0` for production. This
keeps staging pages out of search even if the build has no `VERCEL_ENV`.
For a preview built outside CI, set `SITE_NOINDEX=1` in its build environment.

Keep the `E2E_*` repository secrets described in
[e2e/README.md](e2e/README.md). They use the Clerk **development**
instance, independently of the live keys. Use branch protection on `main`
to require **Typecheck, test, design gates** and **Browser tests**. Pull
requests and `feature/**` pushes run those two without deploying.

After the first release, set Clerk's allowed production domain, register
the webhooks at `https://<domain>/api/webhooks/clerk` and
`https://<domain>/api/webhooks/stripe` with the events in *Setup*, and set
up the live-mode meter, prices and customer portal the same way. Confirm
the operator and contact details in `client/lib/legal.ts`.

Logs are in the Vercel dashboard. `vercel logs <deployment url>` streams
them live for up to five minutes.

**Changing the schema.** Edit `shared/schema.ts`, run `bun run db:generate`,
and commit the new file in `server/drizzle/` with the change; CI fails a
schema change that has no migration. Migrations only ever add: expand,
then contract (`CLAUDE.md`), because the previous release keeps serving
against the new schema until the deploy lands.

**Rolling back.** Instant Rollback in the Vercel dashboard (or
`vercel rollback`) puts the previous deployment back in seconds. It
leaves the schema as it is, which is the other reason migrations only add.

### Limits and spend

- Vercel refuses a request body over 4.5 MB before the function runs, so
  images are capped at 4 MB (`shared/plans.ts`).
- The API route runs for at most 60 s (`maxDuration` in the proxy route).
- Overage goes to Stripe from Vercel Cron every five minutes
  (`client/vercel.json`), on production only, carrying `CRON_SECRET`.
  Crons that often need the Pro plan.
- Vercel adds instances as traffic grows, so there are no replicas to
  set. Keep Spend Management on with a cap and an alert, so an integrator
  hammering the API cannot run up a bill unnoticed.

### Backups

Supabase Pro takes a daily backup. Because that copy lives with the
database, `.github/workflows/backup.yml` also dumps production every night
at 02:30 UTC, encrypts the dump with [age](https://age-encryption.org)
and uploads it to an S3-compatible bucket (R2 or S3) outside Supabase.
Only the public half of the key is in GitHub; whoever holds the private
half is the only one who can read a dump. Set the bucket's lifecycle rule
to how long dumps should be kept.

| Kind | Name | Value |
|---|---|---|
| Variable | `BACKUP_AGE_RECIPIENT` | The public key printed by `age-keygen -o backup-key.txt`. Keep the file somewhere that is not GitHub or the bucket |
| Secret | `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | A key that can only write to the bucket |
| Variable | `BACKUP_BUCKET`, `BACKUP_S3_REGION` | The bucket, and its region (`auto` on R2) |
| Variable | `BACKUP_S3_ENDPOINT` | R2's `https://<account id>.r2.cloudflarestorage.com`; unset for S3 |

The job reads `MIGRATION_DATABASE_URL` from the `production` environment,
so a required reviewer on that environment would hold the nightly run too.

To restore, into a new, unmigrated project, with `pg_restore` 17:

```bash
age --decrypt --identity backup-key.txt temply-<run>.dump.age > temply.dump
# Every Supabase project already has the public schema: skip creating it.
pg_restore --list temply.dump | grep -v -E ' (SCHEMA|COMMENT) - (SCHEMA )?public ' > temply.list
pg_restore --no-owner --no-privileges --single-transaction --exit-on-error \
  --use-list=temply.list --dbname="<session pooler URL>" temply.dump
```

The dump carries the `drizzle` schema too, so `bun run db:migrate`
afterwards applies only what came after it.

## Layout worth knowing

```
client/
  app/                  routes: (marketing) (auth) (app) (share), api proxy
  components/           UI; ui/ holds the primitives and surfaces vocabulary
  core/editor/          the tiptap editor
  lib/site.ts           SITE_URL and friends — the only place the domain lives
  scripts/check-*.ts    the design gates
server/
  src/app.ts            the API as one Elysia app; src/index.ts serves it alone for dev:server
  src/routes/           one file per resource; webhooks/ for Stripe and Clerk
  src/render/           the email renderer
  src/plugins/db.ts     the Postgres pool, opened on first use
  drizzle/              generated migrations; scripts/migrate.ts applies them
  scripts/sqlite-to-postgres.ts  the one-off copy at the cutover
shared/
  schema.ts plans.ts theme.ts preflight.ts
e2e/                    Playwright specs, the fakes, database.ts (a fresh database per run)
compose.yaml            Postgres 17 for dev and e2e
client/vercel.json      region, the overage cron, Git deploys off for main and staging
scripts/dev-public.ts   the tunnel workflow
```

Two theme systems that never touch: the app UI themes through the `.dark`
class and `--ds-*` tokens; the editor canvas is painted from the
template's own theme and ignores app dark mode. Colours belong in the
token layer, which is what the contrast gates enforce. `CLAUDE.md` has the
rest of the working conventions.
