import { config as loadEnv } from 'dotenv';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Loaded here, ahead of everything below that reads process.env, rather than
// in the config: a static `import './env'` runs before any of the config's
// own top-level statements, so a dotenv call placed after that import would
// still be too late for the alias a few lines down.
loadEnv({ path: join(import.meta.dirname, '.env') });

/** One id per run: it names every template a test makes, so leftovers say
 *  which run left them. */
export const RUN_ID = process.env.E2E_RUN_ID ?? Math.random().toString(36).slice(2, 6);
// Playwright workers are separate processes, each re-executing this module —
// without writing the id back, every worker (and the DB_PATH below) would
// pick its own random value instead of sharing the one the config computed.
process.env.E2E_RUN_ID = process.env.E2E_RUN_ID ?? RUN_ID;

// A dev checkout is already running on 9000/3001 and must not be touched, so
// the e2e stack gets its own ports throughout. Client is 9101, not 9100: on
// this machine 9100 is held by an unrelated long-running Flutter DevTools
// process for a different project.
export const PORTS = { client: 9101, api: 3101, fakes: 3999, stripe: 3998 } as const;
export const BASE_URL = `http://localhost:${PORTS.client}`;
export const API_URL = `http://127.0.0.1:${PORTS.api}`;
export const FAKES_URL = `http://127.0.0.1:${PORTS.fakes}`;
/** The Stripe fake has an origin of its own: the SDK takes a host and a port
 *  but no base path, so it cannot share the fakes port under a prefix. */
export const STRIPE_URL = `http://127.0.0.1:${PORTS.stripe}`;

/**
 * What the stack's Stripe is set up with. Fixed rather than read from the
 * environment: the fake is the only Stripe this stack talks to, and a real
 * key copied into e2e/.env must never reach it. The prices only have to be
 * told apart — the app knows seats, overage and packs by these ids.
 */
export const STRIPE = {
  secretKey: 'sk_test_e2e',
  webhookSecret: 'whsec_e2e',
  prices: { seat: 'price_e2e_seat', apiOverage: 'price_e2e_api_overage', templatePack: 'price_e2e_template_pack' },
} as const;

/** A fresh database per run. Under e2e/.tmp so a crashed run leaves a file
 *  you can open, and the next run does not see it. */
const tmp = join(import.meta.dirname, '.tmp');
mkdirSync(tmp, { recursive: true });
export const DB_PATH = join(tmp, `e2e-${RUN_ID}.db`);

/**
 * One run per checkout, taken before anything below touches shared state.
 *
 * The stack has fixed ports, one `.next-e2e`, one snapshot of the two tracked
 * files a build rewrites, and the sweep just below deletes every other run
 * id's database — so a second run does not queue behind the first, it
 * corrupts it, and the failure it produces (a SQLite I/O error, a half-built
 * `.next`) says nothing about what went wrong.
 *
 * The lock is taken by the process that reads the config and given back when
 * that process ends. Every other process that imports this module — the
 * workers, the fakes server — is a child of it and inherits the marker below,
 * which is what keeps them from asking for a lock their own parent holds.
 *
 * A lock a killed run left behind must not wedge the next one, so liveness —
 * not age — is what says whether it still holds. `bun run e2e:ui` keeps the
 * ports, the database and this lock for as long as a developer has Playwright's
 * UI open, which is hours; an age cap applied to a live pid would wave the
 * next run straight into the sweep below and corrupt the very run it was
 * added to protect. The timestamp is only the fallback for a lock whose
 * liveness cannot be established at all — one written by a version that did
 * not record a pid, or truncated by a crash mid-write — and an hour is longer
 * than any run of this suite.
 */
const LOCK = join(tmp, 'run.lock');
const UNREADABLE_LOCK_HOLDS_FOR = 60 * 60 * 1000;
if (process.env.E2E_LOCK_PID === undefined) {
  /** 0: free. A pid: that run still holds it. -1: held, by something this
   *  process cannot name. */
  let heldBy = 0;
  try {
    const { pid, at } = JSON.parse(readFileSync(LOCK, 'utf8')) as { pid?: number; at?: number };
    if (typeof pid === 'number' && pid > 0) {
      try {
        process.kill(pid, 0);
        heldBy = pid;
      } catch (error) {
        // ESRCH is the only answer that means gone. EPERM means a process
        // with that pid is running under an owner this one may not signal,
        // which is still a process.
        if ((error as NodeJS.ErrnoException).code === 'EPERM') heldBy = pid;
      }
    } else if (typeof at === 'number' && Date.now() - at < UNREADABLE_LOCK_HOLDS_FOR) {
      heldBy = -1;
    }
  } catch {
    // No lock, or one nothing can be read out of: the checkout is free.
  }
  if (heldBy) {
    const whose = heldBy > 0 ? ` (pid ${heldBy})` : '';
    console.error(`an e2e run is already in progress in this checkout${whose}. The stack has one set of ports, one build directory and one database, so a second run would corrupt both. Wait for it, or stop it and delete e2e/.tmp/run.lock.`);
    process.exit(1);
  }
  writeFileSync(LOCK, JSON.stringify({ pid: process.pid, at: Date.now() }));
  process.env.E2E_LOCK_PID = String(process.pid);
  const release = () => {
    try {
      if ((JSON.parse(readFileSync(LOCK, 'utf8')) as { pid: number }).pid === process.pid) rmSync(LOCK, { force: true });
    } catch {
      // Already gone, or someone else's: either way there is nothing to give back.
    }
  };
  process.on('exit', release);
  // A signal ends the process without running an `exit` handler, and Ctrl-C
  // is how a run is most often ended.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => { release(); process.exit(1); });
  }
}

// Earlier runs' databases are removed here, at the start of the next run,
// rather than by a teardown at the end of their own: the API webServer that
// holds the file open outlives globalTeardown, so a run cannot delete its
// own. Only files of other run ids go — this run's, and its -wal/-shm
// companions, are left for the stack that is about to open them.
for (const file of readdirSync(tmp)) {
  if (/^e2e-.+\.db(-wal|-shm)?$/.test(file) && !file.startsWith(`e2e-${RUN_ID}.db`)) rmSync(join(tmp, file), { force: true });
}

/** The two Clerk users on the dev instance. Passwords come from the
 *  environment (local: e2e/.env, CI: secrets); never from the repo. */
export const TEST_USER = { email: process.env.E2E_USER_EMAIL ?? '', password: process.env.E2E_USER_PASSWORD ?? '' };
export const TEST_USER_2 = { email: process.env.E2E_USER_2_EMAIL ?? '', password: process.env.E2E_USER_2_PASSWORD ?? '' };

// @clerk/testing's clerkSetup() reads the publishable key under this exact
// name; the app and this package's .env both use the NEXT_PUBLIC_ variant.
process.env.CLERK_PUBLISHABLE_KEY ??= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/** The env the API and the client are started with. Everything that must
 *  agree between them is set here once. */
export function stackEnv(): Record<string, string> {
  return {
    ...process.env as Record<string, string>,
    NODE_ENV: 'test',
    // A failing e2e run must never page anyone: the DSN is emptied here
    // even though nothing in the checkout's .env files sets one today.
    SENTRY_DSN: '',
    SENTRY_ENVIRONMENT: 'e2e',
    NEXT_PUBLIC_SENTRY_DSN: '',
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: 'e2e',
    NEXT_PUBLIC_APP_URL: BASE_URL,
    API_URL,
    SQLITE_DB_PATH: DB_PATH,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || 'e2e-internal-secret',
    STRIPE_SECRET_KEY: STRIPE.secretKey,
    STRIPE_WEBHOOK_SECRET: STRIPE.webhookSecret,
    STRIPE_API_BASE: STRIPE_URL,
    STRIPE_PRICE_SEAT: STRIPE.prices.seat,
    STRIPE_PRICE_API_OVERAGE: STRIPE.prices.apiOverage,
    STRIPE_PRICE_TEMPLATE_PACK: STRIPE.prices.templatePack,
    IMAGEKIT_PUBLIC_KEY: 'public_e2e',
    IMAGEKIT_PRIVATE_KEY: 'private_e2e',
    IMAGEKIT_URL_ENDPOINT: `${FAKES_URL}/imagekit/cdn`,
    IMAGEKIT_UPLOAD_ENDPOINT: `${FAKES_URL}/imagekit/api/v1/files/upload`,
    IMAGEKIT_API_BASE: `${FAKES_URL}/imagekit/api`,
    RESEND_API_KEY: 're_e2e',
    RESEND_BASE_URL: `${FAKES_URL}/resend`,
  };
}
