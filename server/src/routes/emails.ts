import { Elysia, t } from 'elysia';
import { Resend } from 'resend';
import { render } from '../render/render';
import { MissingVariablesError } from '../render/engine';
import { json, tooManyRequests, unauthorized, unprocessable } from '../lib/errors';
import { ANONYMOUS_RENDERS_PER_MINUTE, checkPerMinute, clientAddress } from '../lib/rate-limit';
import { TEMPLATE_CONTENT_MAX_LENGTH } from '@temply/shared/plans';
import { isEmailAddress } from '@temply/shared/email';
import { authPlugin } from '../plugins/auth';
import { dbPlugin } from '../plugins/db';

const FROM_ADDRESS = process.env.SENDING_FROM_ADDRESS || 'send@temply.app';
const FROM_LABEL = process.env.SENDING_FROM_LABEL || 'Temply';

function buildFrom(name?: string): string {
  const trimmed = name?.replace(/[<>"\r\n]/g, '').trim();
  const display = trimmed ? `${trimmed} via ${FROM_LABEL}` : FROM_LABEL;
  return `${display} <${FROM_ADDRESS}>`;
}

// In-process abuse guard for the shared debug sender: 20 test sends / hour /
// user. Resets on restart — acceptable for a debug aid.
const TEST_SENDS_PER_HOUR = 20;

/**
 * A test send goes to the people checking the email, not to a list. Uncapped,
 * the hourly guard above counted requests while each one could carry any
 * number of addresses — twenty sends an hour from a free account was as many
 * strangers as fit in the field, from Temply's own sending domain.
 */
const TEST_SEND_MAX_RECIPIENTS = 5;

const sendCounts = new Map<string, { hour: string; count: number }>();

function overRateLimit(userId: string): boolean {
  const hour = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH" (UTC)
  const entry = sendCounts.get(userId);
  if (!entry || entry.hour !== hour) {
    sendCounts.set(userId, { hour, count: 1 });
    return false;
  }
  if (entry.count >= TEST_SENDS_PER_HOUR) return true;
  entry.count += 1;
  return false;
}

export const emailsRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  /**
   * Signed out on purpose: the playground renders through here before a
   * visitor has an account. That makes it the one endpoint anyone can point
   * a loop at, so a stranger is fused by address and every caller is
   * bounded by size — the engine parses whatever HTML the document carries,
   * and that work is the cost. Someone signed in is not counted by address:
   * a workspace behind one office connection shares an address, and the
   * editor asks for a render on every pause in typing.
   */
  .post(
    '/api/v1/emails/preview',
    async ({ body, request, server, userId }) => {
      if (!userId) {
        const fuse = checkPerMinute(`address:${clientAddress(request, server)}`, ANONYMOUS_RENDERS_PER_MINUTE);
        if (!fuse.allowed) {
          return tooManyRequests(
            `Previews are limited to ${fuse.limit} a minute. Try again in ${fuse.retryAfterSeconds}s.`,
            fuse.retryAfterSeconds,
          );
        }
      }
      const { content, theme, previewText, payload, pretty, plainText } = body;
      const size = typeof content === 'string' ? content.length : JSON.stringify(content ?? null).length;
      if (size > TEMPLATE_CONTENT_MAX_LENGTH) {
        const message = `This email is too large to render — the limit is ${Math.round(TEMPLATE_CONTENT_MAX_LENGTH / 1000)}K characters of content.`;
        return json({ status: 413, message, errors: [message] }, 413);
      }
      const contentJson = typeof content === 'string' ? JSON.parse(content) : content;
      const html = await render(contentJson, {
        // The text alternative is the same render with the markup stripped, so
        // it stays in step with the email rather than being written twice.
        plainText: plainText === true,
        theme: theme || undefined,
        preview: previewText,
        // Absent means "composing": variables stay as placeholders and every
        // conditional block shows.
        payload: payload || undefined,
        // The editor's preview has nothing truer to show for an untyped
        // value than the placeholder the author wrote for exactly this.
        showPlaceholders: true,
        missing: 'placeholder',
        // Indented output for the source view. The email itself stays as
        // rendered — whitespace between table cells is not always harmless.
        pretty: pretty === true,
      });
      return json({ html });
    },
    {
      body: t.Object({
        previewText: t.Optional(t.String()),
        content: t.Any(),
        theme: t.Optional(t.Any()),
        payload: t.Optional(t.Any()),
        pretty: t.Optional(t.Boolean()),
        plainText: t.Optional(t.Boolean()),
      }),
    },
  )

  .post(
    '/api/v1/emails/send',
    async (ctx) => {
      const { body, userId } = ctx;
      if (!userId) return unauthorized();

      const recipients = body.to
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (recipients.length === 0) {
        return json({ status: 400, message: 'Add at least one recipient', errors: ['No recipients'] }, 400);
      }
      if (recipients.length > TEST_SEND_MAX_RECIPIENTS) {
        const message = `A test send goes to at most ${TEST_SEND_MAX_RECIPIENTS} addresses.`;
        return json({ status: 400, message, errors: [message] }, 400);
      }
      const malformed = recipients.find((address: string) => !isEmailAddress(address));
      if (malformed) {
        const message = `"${malformed}" is not an email address.`;
        return json({ status: 400, message, errors: [message] }, 400);
      }
      if (body.replyTo && !isEmailAddress(body.replyTo.trim())) {
        const message = 'Reply-to must be an email address.';
        return json({ status: 400, message, errors: [message] }, 400);
      }

      if (overRateLimit(userId)) {
        return json({ status: 429, message: 'Too many test sends — try again later.', errors: ['Rate limited'] }, 429);
      }

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return json({ status: 500, message: 'Sending is not configured', errors: ['RESEND_API_KEY missing'] }, 500);
      }

      const { previewText, subject, fromName, replyTo, content, theme, payload } = body;
      const contentJson = typeof content === 'string' ? JSON.parse(content) : content;
      // Absent payload means "composing": variables pass through as {{name}}.
      // With one, a test send resolves them the way a real render would.
      const renderOptions = {
        theme: theme || undefined,
        preview: previewText,
        payload: payload || undefined,
      };
      let html: string;
      let text: string;
      try {
        html = await render(contentJson, renderOptions);
        // A test send should be the email people actually receive, and a real
        // one carries a text alternative: filters score HTML-only mail worse,
        // and some clients show nothing else.
        text = await render(contentJson, { ...renderOptions, plainText: true });
      } catch (error) {
        if (error instanceof MissingVariablesError) {
          return unprocessable(`${error.message}. Add preview values before sending.`, { missing: error.missing });
        }
        throw error;
      }

      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: buildFrom(fromName),
        to: recipients,
        replyTo: replyTo?.trim() || undefined,
        subject,
        html,
        text,
      });
      if (error) return json({ status: 500, message: error.message, errors: [error.message] }, 500);

      return json({ status: 'ok' });
    },
    {
      // The editor sends every field it has, empty or not, so an address
      // that is optional is checked in the handler once it is known to be
      // there; the bounds here are what no email header should exceed.
      body: t.Object({
        previewText: t.Optional(t.String({ maxLength: 500 })),
        subject: t.String({ minLength: 1, maxLength: 255 }),
        fromName: t.Optional(t.String({ maxLength: 100 })),
        replyTo: t.Optional(t.String({ maxLength: 254 })),
        to: t.String({ minLength: 1, maxLength: 1000 }),
        content: t.String({ minLength: 1, maxLength: TEMPLATE_CONTENT_MAX_LENGTH }),
        theme: t.Optional(t.Any()),
        payload: t.Optional(t.Any()),
      }),
    },
  );
