import { config as loadEnv } from 'dotenv';
import { mkdirSync } from 'node:fs';
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
export const STRIPE_URL = `http://127.0.0.1:${PORTS.stripe}`;

/** A fresh database per run. Under e2e/.tmp so a crashed run leaves a file
 *  you can open, and the next run does not see it. */
const tmp = join(import.meta.dirname, '.tmp');
mkdirSync(tmp, { recursive: true });
export const DB_PATH = join(tmp, `e2e-${RUN_ID}.db`);

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
    NEXT_PUBLIC_APP_URL: BASE_URL,
    API_URL,
    SQLITE_DB_PATH: DB_PATH,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || 'e2e-internal-secret',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_e2e',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_e2e',
    // The Stripe fake (Task 2) answers on its own port; nothing consumes this
    // yet.
    STRIPE_API_BASE: STRIPE_URL,
    IMAGEKIT_PUBLIC_KEY: 'public_e2e',
    IMAGEKIT_PRIVATE_KEY: 'private_e2e',
    IMAGEKIT_URL_ENDPOINT: `${FAKES_URL}/imagekit/cdn`,
    IMAGEKIT_UPLOAD_ENDPOINT: `${FAKES_URL}/imagekit/api/v1/files/upload`,
    IMAGEKIT_API_BASE: `${FAKES_URL}/imagekit/api`,
    RESEND_API_KEY: 're_e2e',
    RESEND_BASE_URL: `${FAKES_URL}/resend`,
  };
}
