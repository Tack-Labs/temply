# Temply

A block editor for transactional email. Build the email without code, keep
templates and brands in a workspace, and pull the rendered HTML into your
own application through an API. Your app sends the mail; Temply hands you
the markup.

## Tech stack

Bun 1.3 is the package manager, the test runner and the API runtime.
Never npm, yarn or pnpm.

**Client** (`client/`)

| | |
|---|---|
| Framework | Next.js 15.3 (App Router, Turbopack dev), React 19, TypeScript 5.8 |
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
| `API_URL` | client | production only | Where Next.js reaches the API. Unset in development (defaults to `http://127.0.0.1:3001`). |
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

Once something else is receiving the webhooks (the VM in *Production*), a
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
list plus both production builds, with the browser suite as its own job.

## Building

```bash
cd client && bun run build   # Next.js production build → .next
cd server && bun run build   # bundles src/index.ts → dist/
```

`next build` writes to the same `.next` the dev server uses and will
knock a running `next dev` over; restart it afterwards.

## Production

The API is a single Bun process with a SQLite file, so it runs on one
machine (a VPS, Fly, Railway — not serverless). Two ways to arrange it:

1. **One host.** Next.js and the API on the same machine; the API stays on
   loopback and Next proxies to it. One domain serves everything, and both
   webhooks point at `https://<domain>/api/webhooks/...`.
2. **Split.** Next.js on Vercel with `API_URL` pointing at the API's own
   host. The API must then bind to a reachable address; the proxy's
   `x-internal-token` is what keeps forwarded identities trustworthy.

Either way:

- Set every value in `.env.example` for production: live Clerk instance,
  live Stripe keys and price, `NEXT_PUBLIC_APP_URL=https://<domain>`,
  Resend with a verified domain, the Sentry DSNs.
- Point a health check at `GET /api/health` — 200 when the database is
  reachable, 503 when it is not.
- Back the database up. `bun run db:backup` (in `server/`) takes an
  online-safe snapshot and prunes old ones; run it from cron and ship the
  directory off the machine. `server/litestream.yml` is the continuous
  alternative.
- Confirm the facts in `client/lib/legal.ts` (operator, contact address,
  governing law) before the terms and privacy pages go live.

### On a single VM (Oracle Cloud Always Free, or any Ubuntu host)

`deploy/oracle/` is the one-host arrangement, scripted. On a fresh Ubuntu
24.04 machine with ports 80 and 443 open in the cloud firewall:

```bash
git clone <this repository> temply && cd temply
REPO_URL=<this repository> TEMPLY_HOST=<hostname> bash deploy/oracle/setup.sh
```

`setup.sh` installs Bun and Caddy, opens 80/443 in the VM's own firewall,
clones the repository to `/opt/temply`, installs two systemd services
(`temply-server` on loopback :3001, `temply-client` on :9000), a Caddy site
that terminates HTTPS for `TEMPLY_HOST` and proxies to :9000, and an hourly
`db:backup` cron. With no domain yet, leave `TEMPLY_HOST` unset and it uses
`<public-ip>.sslip.io`, a free DNS name that resolves to the IP.

Then fill in `client/.env` and `server/.env` under `/opt/temply` and run
`bash deploy/oracle/update.sh`, which pulls, installs, builds the client and
restarts both services — the same command deploys every later commit. Logs:
`journalctl -u temply-server -u temply-client -f`.

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
