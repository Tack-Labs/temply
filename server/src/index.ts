import * as Sentry from '@sentry/bun';
import { Elysia } from 'elysia';
import { errorResponse } from './lib/errors';
import { authPlugin } from './plugins/auth';
import { dbPlugin } from './plugins/db';
import { templatesRoutes } from './routes/templates';
import { apiKeysRoutes } from './routes/api-keys';
import { brandsRoutes } from './routes/brands';
import { assetsRoutes } from './routes/assets';
import { billingRoutes } from './routes/billing';
import { quotaRoutes } from './routes/quota';
import { emailsRoutes } from './routes/emails';
import { publicRoutes } from './routes/public';
import { workspaceRoutes } from './routes/workspace';
import { contactRoutes } from './routes/contact';
import { webhookRoutes } from './routes/webhooks/stripe';
import { clerkWebhookRoutes } from './routes/webhooks/clerk';
import { authRoutes } from './routes/auth/logout';
import { healthRoutes } from './routes/health';
import { cspReportRoutes } from './routes/csp-report';

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

// Overridable so the e2e stack can run its own instance on a port that
// doesn't collide with a dev server already listening on the default.
const port = Number(process.env.PORT) || 3001;

const app = new Elysia()
  // Registered before the route modules and scoped global: a local onError
  // added after .use() never sees errors raised inside the mounted modules,
  // so validation failures would fall back to Elysia's own 422.
  .onError({ as: 'global' }, ({ error, code }) => {
    console.error(`Error [${code}]:`, error);
    // A miss, a bad body or a failed schema is the caller's doing and
    // already answered; anything else is ours to know about.
    if (code !== 'NOT_FOUND' && code !== 'VALIDATION' && code !== 'PARSE') Sentry.captureException(error);
    return errorResponse(code, error);
  })
  .use(authPlugin)
  .use(dbPlugin)
  .use(templatesRoutes)
  .use(apiKeysRoutes)
  .use(brandsRoutes)
  .use(assetsRoutes)
  .use(billingRoutes)
  .use(quotaRoutes)
  .use(emailsRoutes)
  .use(publicRoutes)
  .use(workspaceRoutes)
  .use(contactRoutes)
  .use(webhookRoutes)
  .use(clerkWebhookRoutes)
  .use(authRoutes)
  .use(healthRoutes)
  .use(cspReportRoutes)
  // Bind to loopback only: this service trusts a proxy-forwarded user id and
  // must never be reachable directly from the network.
  // The largest legitimate body is a 5 MB image plus multipart framing;
  // anything bigger is refused by Bun before a byte is buffered.
  .listen({ port, hostname: '127.0.0.1', maxRequestBodySize: 8 * 1024 * 1024 });

console.log(`🦊 Elysia server running on http://127.0.0.1:${port}`);
export type App = typeof app;
