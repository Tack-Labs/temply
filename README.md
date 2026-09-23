# Temply

A block editor for transactional email. Build the email without code, keep
templates and brands in a workspace, and pull the rendered HTML into your
own application through an API. Your app sends the mail; Temply hands you
the markup.

## Tech stack

Bun 1.4.2 is the package manager, the test runner and the API runtime.
Never npm, yarn or pnpm.

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
| Framework | Elysia 1 on Bun, listening on `127.0.0.1:3001` |
| Database | SQLite via `bun:sqlite` and Drizzle ORM 0.45; schema in `shared/schema.ts`, boot-time migrations in `src/plugins/db.ts` |
| Rendering | `@react-email/render` + `juice` turn the editor document into table-based, inlined HTML (`src/render/`) |
| Auth | `@clerk/backend` 3 verifies sessions and webhooks; proxied requests carry identity in headers proven by `INTERNAL_API_SECRET` |
| Billing | Stripe SDK 22 (Checkout, Customer Portal, webhooks) |
| Email | Resend 4 for test sends and the contact form |
| Images | ImageKit 6 for uploads |
| Validation | zod 3 and Elysia's `t` schemas |
| Monitoring | `@sentry/bun` 10 |

**Shared** (`shared/`): the Drizzle schema, plan limits, the renderer
theme type and contrast maths, the preflight checks, and the public API
path helpers — one source for both sides.

## Setup

```bash
bun install
cp .env.example client/.env     # then keep only the client block
cp .env.example server/.env     # then keep only the server block
```

`.env.example` is one file with two blocks; each side loads only its own
file. Where a key appears in both blocks the values must match
(`INTERNAL_API_SECRET`, `NEXT_PUBLIC_APP_URL`, the Clerk keys).

What you need before the app is useful:

| Service | Keys | Used for |
|---|---|---|
| [Clerk](https://clerk.com) | publishable + secret | Sign-in, organizations, team membership. Enable **Organizations** in the Clerk dashboard. |
| [Stripe](https://stripe.com) | secret, a Pro price id, webhook secret | Plans and billing. Checkout sells Pro only; Enterprise is by hand. |
| [Resend](https://resend.com) | API key, a verified sender | Test sends from the editor, contact-form delivery. |
| [ImageKit](https://imagekit.io) | public + private key, URL endpoint | Image uploads. Without it, images are URL-only. |
| [Sentry](https://sentry.io) | DSN | Error reports. Optional; nothing is sent without a DSN. |

`INTERNAL_API_SECRET` is a random string that proves a request to the API
came from the Next.js proxy. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Environment variables

`client/.env` and `server/.env` are separate files; `.env.example` shows
both blocks with comments. "Both" below means the same value must be in
each file.

| Variable | Side | Required | What it does |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | both | yes | Clerk instance; the client mounts the sign-in UI with it, the API needs it to verify a session token presented directly. |
| `CLERK_SECRET_KEY` | both | yes | Clerk server key. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | server | for purges | Verifies `organization.deleted` / `user.deleted` webhooks. Without it the endpoint answers 503 and deleted workspaces are never purged. |
| `INTERNAL_API_SECRET` | both | yes | Random string proving a request came from the Next.js proxy. Without it the API ignores forwarded identities and every dashboard call is signed out. |
| `NEXT_PUBLIC_APP_URL` | both | yes | The site's own address. Client: metadata, sitemap, docs snippets, legal pages, dev-origin allow-list. Server: absolute image URLs in rendered email, Stripe return URLs. `bun run dev:public` writes it. |
| `API_URL` | client | no | Where Next.js reaches the API. Defaults to `http://127.0.0.1:3001`; the Railway container sets this automatically. |
| `SQLITE_DB_PATH` | server | no | Database file, default `maily.db` in `server/`. Created on first run. |
| `STRIPE_SECRET_KEY` | server | for billing | Checkout, portal and webhook verification. |
| `STRIPE_PRICE_PRO` | server | for billing | The Pro plan's recurring price id — the only thing Checkout sells. |
| `STRIPE_WEBHOOK_SECRET` | server | for billing | Signing secret of the `/api/webhooks/stripe` endpoint. |
| `RESEND_API_KEY` | server | for sending | Test sends from the editor and contact-form delivery. Without it sends are refused and contact messages are stored but not delivered. |
| `SENDING_FROM_ADDRESS`, `SENDING_FROM_LABEL` | server | no | The verified sender test sends go out from; users set a display name only. Defaults `send@temply.app` / `Temply`. |
| `CONTACT_EMAIL`, `CONTACT_FROM_EMAIL` | server | for contact form | Where contact-form messages are delivered, and the sender they arrive from. |
| `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` | server | for uploads | Image uploads. Unset: the library and uploads are off, pasted image URLs still work. |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` | client / both | no | Error reporting. The `NEXT_PUBLIC_` one reaches the browser bundle; server runtimes read `SENTRY_DSN` first. Nothing is reported when unset. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_ENVIRONMENT` | client / server | no | Environment tag on reports; defaults to `NODE_ENV`. |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | client build | no | Source-map upload during `next build`. Without the token the upload is skipped and the build still succeeds. |
| `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_SALES_EMAIL` | client | no | Addresses printed on the legal and plan pages. Defaults in `client/lib/site.ts`. |
| `BACKUP_DIR`, `BACKUP_KEEP` | server | no | Where `bun run db:backup` writes snapshots and how many it keeps (defaults `backups`, 48). |

## Running it

### Local

```bash
bun run dev
```

Client on http://localhost:9000, API on http://127.0.0.1:3001. The API
binds to loopback only: everything reaches it through the Next.js proxy.

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
`NEXT_PUBLIC_APP_URL`, re-points the Stripe webhook endpoint through the
API, prints the Clerk endpoint URL for you to paste into the Clerk
dashboard, then runs `bun run dev`. One address then serves the site, the
API and both webhooks — the same shape as production.

A quick tunnel's address changes every time it starts, which is why the
script does the re-pointing. Flags:

- `--url <address>` — reuse an address instead of starting a tunnel (a
  tunnel already up, or a named tunnel on your own domain, which is the
  way to make the address stop changing).
- `--no-dev` — configure only; the dev servers are already running.

Neither `bun --watch` nor `next dev` re-reads `.env`. After changing an
env file, restart the servers.

Set both webhooks up once:

- **Clerk** → Webhooks → add endpoint `<address>/api/webhooks/clerk` for
  `organization.deleted` and `user.deleted`; put the signing secret in
  `CLERK_WEBHOOK_SIGNING_SECRET`. A deleted workspace is purged and its
  subscription cancelled.
- **Stripe** → `<address>/api/webhooks/stripe` for
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`; secret in `STRIPE_WEBHOOK_SECRET`. The
  script creates this one for you if it does not exist. Stripe also needs
  a Customer Portal configuration (Settings → Billing → Customer portal)
  before "Manage subscription" works.

Test cards: `4242 4242 4242 4242` with any future expiry and any CVC.

Once the production Railway service is receiving the webhooks, a
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
list, with browser tests and a production-container build/smoke test as separate jobs.
All three must pass before a push to `main` deploys to Railway.

## Building

```bash
cd client && bun run build   # Next.js production build → .next
cd server && bun run build   # bundles src/index.ts → dist/
```

`next build` writes to the same `.next` the dev server uses and will
knock a running `next dev` over; restart it afterwards.

## Production on Railway

One Railway service runs Next.js on `0.0.0.0:$PORT` and the Bun API on
loopback `:3001`. Railway provides HTTPS; Next proxies `/api/*`, including
both webhooks. `Dockerfile` builds the Next standalone runtime and the API;
`deploy/railway/start.sh` supervises both processes and stops the container
if either exits. `railway.json` sets one replica, restart policy and the
`/api/health` deployment check, which exercises Next, the API and SQLite.

The database lives at `/data/maily.db` on a Railway volume. Startup refuses
to run on Railway without a volume mounted at `/data`. Migrations run on
the first database request after the volume is mounted, including the
health check; do not move them to a pre-deploy command, where Railway
volumes are unavailable. Keep one replica: SQLite is a single writer here.
A volume-backed service has a short interruption during replacement, so
this setup does not promise zero-downtime releases.

### One-time setup

1. Create an empty Railway project and a service named `temply` in its
   `production` environment. Deploy from the **repository root**, with
   `/railway.json` as the config path and no custom build/start command.
   Leave GitHub autodeploys disconnected: GitHub Actions owns deployment
   and must finish its gates first.
2. Attach a persistent volume to that service at **`/data`**. Enable daily,
   weekly and monthly volume backups in the service's **Backups** tab.
   Railway backs up the SQLite file and its WAL together. These settings
   are managed in Railway, not by `railway.json`.
3. Generate a Railway domain or attach your domain, targeting port **8080**.
   Set service variables from `.env.example`, combining the two blocks into
   one set with matching values. At minimum, set:

   ```dotenv
   NEXT_PUBLIC_APP_URL=https://your-domain.example
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   INTERNAL_API_SECRET=<a-random-64-character-hex-string>
   ```

   `PORT=8080`, `SQLITE_DB_PATH=/data/maily.db` and
   `BACKUP_DIR=/data/backups` are image defaults. Leave `API_URL` unset;
   startup supplies the loopback URL. Add Clerk/Stripe webhook secrets,
   Stripe price and key, Resend and ImageKit values for the features you
   use. Runtime secrets belong in Railway, not the Dockerfile or GitHub
   build arguments. `NEXT_PUBLIC_*` values are compiled into the client,
   so changing one requires a new build. The Docker build deliberately
   uses no real Clerk secret. Runtime Sentry reporting is supported;
   this container build does not upload Sentry source maps.
4. Create a Railway **project token scoped to the production environment**.
   In the GitHub repository, create an Actions environment named
   **`production`**, restricted to the `main` branch. Add its secret and
   variables (repository-level values also work):

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `RAILWAY_TOKEN` | The environment-scoped Railway project token |
   | Variable | `RAILWAY_SERVICE_ID` | The `temply` service ID from Railway settings |
   | Variable | `RAILWAY_PUBLIC_URL` | The same HTTPS URL as `NEXT_PUBLIC_APP_URL` |

   Keep the six existing `E2E_*` repository secrets described in
   [e2e/README.md](e2e/README.md). They use the Clerk **development**
   instance, independently of the live service keys.
5. Push to `main`, or run **CI / CD → Run workflow** on `main` for the first
   deployment. The pipeline runs typechecking, lint, the dependency audit,
   unit tests, design gates, browser tests and container smoke checks.
   Only after all pass does it upload that checkout to Railway. It waits
   for the **specific deployment ID** to reach `SUCCESS`, then checks the
   public `/api/health`. Failed builds, startup, database health or smoke
   checks fail the workflow. Production runs are serialized and are not
   cancelled halfway through a release.
6. Set Clerk's allowed production domain and register the webhooks at
   `https://<domain>/api/webhooks/clerk` and
   `https://<domain>/api/webhooks/stripe`, using the events in *Setup*.
   Confirm the operator/contact details in `client/lib/legal.ts`.

Use branch protection on `main` to require the three validation jobs:
**Typecheck, test, design gates**, **Browser tests**, and
**Production container**. Pull requests and `feature/**` pushes validate
without deploying; production deploys only from `main`. Missing deployment
credentials fail explicitly instead of silently skipping a release.

This configuration follows Railway's [Dockerfile variable handling](https://docs.railway.com/builds/dockerfiles),
[volume lifecycle](https://docs.railway.com/volumes) and
[volume backups](https://docs.railway.com/volumes/backups).

### Local container check and operations

```bash
docker build -t temply:ci \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:8080 \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk .
bash deploy/railway/smoke.sh temply:ci
```

The smoke test uses disposable storage to verify the home page, static
assets, proxy authentication, database health, persistence across container
replacement, database snapshots and process shutdown. It requires Docker,
Bash, curl and jq. No live credentials or database are used.

For manual operations, install the pinned CLI with
`bun add --global @railway/cli@5.30.1`, export the three `RAILWAY_*` values
above, then use `make deploy` or `make logs`. `make deploy` uploads your
current checkout; CI is the normal release path.

For an additional consistent snapshot, run the existing backup script
**inside the deployed container**, through `railway ssh`:
`cd /app/server && bun scripts/backup-db.ts`. Do not use `railway run` for
this: it runs locally and cannot access the mounted volume. Export useful
snapshots off the volume and enable scheduled Railway volume backups.
`server/litestream.yml` remains an optional replication
example and is not launched by this image.

### Restoring data and rollback

To seed a new Railway volume from a consistent SQLite snapshot, keep a
separate copy of the snapshot. With the service stopped and the new volume
attached, link the Railway CLI to the project/service/environment and use
`railway volume files upload ./snapshot.db /maily.db` to seed the volume
before its first application start. Do not overwrite a running SQLite
file or mix it with another database's `-wal`/`-shm` files.

Deploy, check `/api/health`, sign in and verify templates, brands, API keys
and billing before opening the service to users.

For a bad application release, redeploy the last working deployment in
Railway. This preserves the current volume; a code rollback does not undo
schema/data changes. Take a volume backup before a future schema change
and check compatibility before rolling back code. Restore a volume backup
only when a database rollback is intended.

## Layout worth knowing

```
client/
  app/                  routes: (marketing) (auth) (app) (share), api proxy
  components/           UI; ui/ holds the primitives and surfaces vocabulary
  core/editor/          the tiptap editor
  lib/site.ts           SITE_URL and friends — the only place the domain lives
  scripts/check-*.ts    the design gates
server/
  src/routes/           one file per resource; webhooks/ for Stripe and Clerk
  src/render/           the email renderer
  src/plugins/db.ts     SQLite schema and the boot-time migrations
  scripts/backup-db.ts
shared/
  schema.ts plans.ts theme.ts preflight.ts
scripts/dev-public.ts   the tunnel workflow
```

Two theme systems that never touch: the app UI themes through the `.dark`
class and `--ds-*` tokens; the editor canvas is painted from the
template's own theme and ignores app dark mode. Colours belong in the
token layer, which is what the contrast gates enforce. `CLAUDE.md` has the
rest of the working conventions.
