import { Elysia, t } from 'elysia';
import { Resend } from 'resend';
import { contactMessages } from '@temply/shared/schema';
import { json, tooManyRequests } from '../lib/errors';
import { CONTACT_MESSAGES_PER_MINUTE, checkPerMinute, clientAddress } from '../lib/rate-limit';
import { authPlugin } from '../plugins/auth';
import { dbPlugin } from '../plugins/db';

/**
 * The landing page's contact form. Public — a visitor has no account.
 *
 * Order matters: the message is stored before any delivery attempt, so a mail
 * outage (or simply an unconfigured RESEND_API_KEY in dev) never loses it.
 * Delivery is best-effort on top.
 */
export const contactRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  .post(
  '/api/v1/contact',
  async (ctx) => {
    const { name, email, message, company } = ctx.body;

    // Honeypot: humans never see this field. Pretend success so the bot moves on.
    if (company) return json({ status: 'ok' });

    // The honeypot catches the bots that fill every field; the fuse is for
    // the ones that do not, and for a script — every message is stored and
    // delivered, so a burst is a full table and a full inbox.
    const fuse = checkPerMinute(`address:${clientAddress(ctx.request, ctx.server)}`, CONTACT_MESSAGES_PER_MINUTE);
    if (!fuse.allowed) {
      return tooManyRequests(`That is a lot of messages at once. Try again in ${fuse.retryAfterSeconds}s.`, fuse.retryAfterSeconds);
    }

    await ctx.db
      .insert(contactMessages)
      .values({ id: crypto.randomUUID(), name, email, message });

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.CONTACT_EMAIL;
    if (apiKey && to) {
      try {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: process.env.CONTACT_FROM_EMAIL || 'onboarding@resend.dev',
          to,
          replyTo: email,
          subject: `Contact form: ${name}`,
          text: `${message}\n\n— ${name} <${email}>`,
        });
      } catch (error) {
        console.error('contact form delivery failed', error);
      }
    }

    return json({ status: 'ok' });
  },
  {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 }),
      email: t.String({ format: 'email', maxLength: 254 }),
      message: t.String({ minLength: 1, maxLength: 5000 }),
      company: t.Optional(t.String()),
    }),
  },
);
