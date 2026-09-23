import { Elysia } from 'elysia';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { json } from '../../lib/errors';
import { getImageKit } from '../../lib/imagekit';
import { cancelSubscription } from '../../lib/lemonsqueezy';
import { purgeLegacyUser, purgeOrganization } from '../../lib/purge';
import { dbPlugin } from '../../plugins/db';

/**
 * Clerk tells us when an account goes; nothing else does. Without this a
 * deleted organization kept its templates, keys and — worst — its
 * subscription, so a customer who left kept paying. Register the endpoint
 * in the Clerk dashboard for organization.deleted and user.deleted.
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
      cancelSubscription: process.env.LEMONSQUEEZY_API_KEY ? cancelSubscription : undefined,
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
    }
    return json({ received: true });
  });
