import { Elysia } from 'elysia';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { json } from '../../lib/errors';
import { getImageKit } from '../../lib/imagekit';
import { getStripe, syncSeats } from '../../lib/stripe';
import { purgeLegacyUser, purgeOrganization } from '../../lib/purge';
import { dbPlugin } from '../../plugins/db';

/**
 * Clerk tells us when an account goes, and when someone joins or leaves a
 * workspace; nothing else does. Without it a deleted organization kept its
 * templates, keys and — worst — its subscription, so a customer who left
 * kept paying, and a team billed per member was billed for last month's
 * team. Register the endpoint in the Clerk dashboard for
 * organization.deleted, user.deleted, organizationMembership.created and
 * organizationMembership.deleted.
 */
export const clerkWebhookRoutes = new Elysia()
  .use(dbPlugin)
  .post('/api/webhooks/clerk', async (ctx) => {
    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (!signingSecret) return json({ status: 503, message: 'Clerk webhook secret is not configured' }, 503);

    let event: Awaited<ReturnType<typeof verifyWebhook>>;
    try {
      event = await verifyWebhook(ctx.request, { signingSecret });
    } catch (error) {
      // Say why: a forged request and a stale secret or a stripped header
      // read the same to the caller but must not to whoever reads the log.
      console.error('Clerk webhook rejected:', error instanceof Error ? error.message : error);
      return json({ status: 400, message: 'Invalid signature' }, 400);
    }

    const effects = {
      cancelSubscription: process.env.STRIPE_SECRET_KEY ? async (id: string) => { await getStripe().subscriptions.cancel(id); } : undefined,
      deleteFile: (() => {
        const ik = getImageKit();
        return ik ? async (id: string) => { await ik.deleteFile(id); } : undefined;
      })(),
    };

    switch (event.type) {
      case 'organization.deleted': {
        if (!event.data.id) break;
        const report = await purgeOrganization(ctx.db, event.data.id, effects);
        console.log(`Purged organization ${event.data.id}:`, report);
        break;
      }
      case 'user.deleted': {
        if (!event.data.id) break;
        const report = await purgeLegacyUser(ctx.db, event.data.id, effects);
        console.log(`Purged user ${event.data.id}:`, report);
        break;
      }
      case 'organizationMembership.created':
      case 'organizationMembership.deleted': {
        // A failure answers 500 so Clerk retries: a missed count bills the
        // wrong number of members until the next one.
        await syncSeats(ctx.db, event.data.organization.id);
        break;
      }
    }
    return json({ received: true });
  });
