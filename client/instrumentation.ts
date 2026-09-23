import * as Sentry from '@sentry/nextjs';

/** Next.js calls this once per runtime at boot. Each runtime loads only its
 *  own Sentry config; the DSN is read there and nothing happens without it. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config');
}

/** Errors thrown while rendering or in route handlers on the server. */
export const onRequestError = Sentry.captureRequestError;
