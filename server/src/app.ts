import { captureException } from '@sentry/core';
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
import { stripeWebhookRoutes } from './routes/webhooks/stripe';
import { clerkWebhookRoutes } from './routes/webhooks/clerk';
import { authRoutes } from './routes/auth/logout';
import { healthRoutes } from './routes/health';
import { cspReportRoutes } from './routes/csp-report';
import { cronRoutes } from './routes/cron';
import { adminRoutes } from './routes/admin';

/**
 * The whole API, started by nothing. On Vercel the Next.js catch-all route
 * calls `app.handle` in-process; locally index.ts can also serve it with
 * Bun. Errors go through @sentry/core, so they reach whichever Sentry SDK
 * the host started, which only works while its version is pinned to the
 * one @sentry/nextjs uses.
 */
export const app = new Elysia()
  // Registered before the route modules and scoped global: a local onError
  // added after .use() never sees errors raised inside the mounted modules,
  // so validation failures would fall back to Elysia's own 422.
  .onError({ as: 'global' }, ({ error, code }) => {
    console.error(`Error [${code}]:`, error);
    // A miss, a bad body or a failed schema is the caller's doing and
    // already answered; anything else is ours to know about.
    if (code !== 'NOT_FOUND' && code !== 'VALIDATION' && code !== 'PARSE') captureException(error);
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
  .use(adminRoutes)
  .use(contactRoutes)
  .use(stripeWebhookRoutes)
  .use(clerkWebhookRoutes)
  .use(authRoutes)
  .use(healthRoutes)
  .use(cspReportRoutes)
  .use(cronRoutes);

// Vercel's Elysia service loads this entrypoint through its default export.
export default app;

export type App = typeof app;
