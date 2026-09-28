import { Elysia } from 'elysia';
import { json, unauthorized } from '../lib/errors';
import { reportOverage } from '../lib/overage';
import { stripePrices } from '../lib/stripe';
import { matchesSecret } from '../plugins/auth';
import { dbPlugin } from '../plugins/db';

/**
 * Vercel Cron calls this every five minutes (client/vercel.json), sending
 * `Authorization: Bearer <CRON_SECRET>`. A slow run can overlap the next,
 * which reportOverage's compare-and-set claim makes safe.
 */
export const cronRoutes = new Elysia()
  .use(dbPlugin)
  .get('/api/cron/overage', async ({ db, request }) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return json({ status: 503, message: 'Cron is not configured' }, 503);
    if (!matchesSecret(request.headers.get('authorization'), `Bearer ${secret}`)) return unauthorized();
    // Billing not set up here has nothing to report, as in startOverageReporter.
    if (!stripePrices()) return json({ reported: 0 });
    return json({ reported: await reportOverage(db) });
  });
