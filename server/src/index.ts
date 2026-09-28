import * as Sentry from '@sentry/bun';
import { MAX_REQUEST_BYTES } from '@temply/shared/plans';
import { app } from './app';
import { startOverageReporter } from './lib/overage';
import { closeDb } from './plugins/db';

// Error monitoring, off without a DSN so a checkout reports nothing by
// accident. Only errors: no tracing, and nothing about the user beyond what
// the error carries.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

const port = Number(process.env.PORT) || 3001;

// The API standalone, for debugging it apart from Next.js: the catch-all
// route forwards here when API_URL is set. It trusts a forwarded user id,
// so it must never be reachable from the internet, and listens on loopback
// unless HOST says otherwise. Bun refuses a body over Vercel's limit before
// buffering it, so a standalone run fails where production would.
app.listen({ port, hostname: process.env.HOST || '127.0.0.1', maxRequestBodySize: MAX_REQUEST_BYTES });

console.log(`🦊 Elysia server running on ${app.server?.url}`);

const stopOverageReporter = startOverageReporter();

/**
 * Stopping the server refuses new connections and waits for the requests
 * already in flight; the database closes after them, so none loses it
 * mid-write. A second signal is someone who has stopped waiting.
 */
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) process.exit(1);
  stopping = true;
  console.log(`${signal}: finishing requests in flight, then stopping`);
  stopOverageReporter();
  await app.stop();
  await closeDb();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
