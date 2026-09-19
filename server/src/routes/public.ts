import { Elysia, t } from 'elysia';
import type { JSONContent } from '@tiptap/core';
import { eq, and, isNull } from 'drizzle-orm';
import { mails, apiKeysTable } from '@temply/shared/schema';
import { hashApiKey } from '../lib/codes';
import { checkApiQuota, recordApiCall } from '../lib/api-quota';
import { checkBurst } from '../lib/rate-limit';
import { render } from '../render/render';
import { MissingVariablesError, RepeatNotListError } from '../render/engine';
import { json, notFound, tooManyRequests, unauthorized, unprocessable } from '../lib/errors';
import { authPlugin } from '../plugins/auth';
import { PUBLIC_PREVIEW_ROUTE, PUBLIC_RENDER_ROUTE, PUBLIC_TEMPLATE_ROUTE } from '@temply/shared/api';
import { dbPlugin, type Db } from '../plugins/db';

type Row = typeof mails.$inferSelect;

/** What the caller gets to see: the draft on a test key, else the published copy. */
type Served = { content: string; theme: string | null; previewText: string | null; stamp: string | null };

type Resolved =
  | { error: Response }
  | { key: { id: string; user_id: string; org_id: string | null; mode: 'live' | 'test' }; template: Row; served: Served };

/**
 * Everything both endpoints need before they can answer: a live key, quota
 * headroom, and a template **belonging to that key's owner**. The lookup used
 * to match on the short code alone, so any valid key could read any account's
 * template by guessing one.
 */
async function resolve(ctx: { request: Request; params: { shortCode: string }; db: Db }): Promise<Resolved> {
  const authHeader = ctx.request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: unauthorized('Missing or invalid Authorization header') };
  }

  const keyHash = hashApiKey(authHeader.slice(7));
  const [key] = await ctx.db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.key_hash, keyHash), isNull(apiKeysTable.revoked_at)))
    .limit(1);
  if (!key) return { error: unauthorized('Invalid or revoked API key') };

  // The fuse comes before the quota: a runaway loop must not spend the
  // month's budget while it burns.
  const burst = checkBurst(key.id, key.mode);
  if (!burst.allowed) {
    return {
      error: tooManyRequests(
        `This key may make ${burst.limit} calls a minute. Try again in ${burst.retryAfterSeconds}s.`,
        burst.retryAfterSeconds,
      ),
    };
  }

  const quota = await checkApiQuota(ctx.db, key.org_id ?? key.user_id, new Date(), key.mode);
  if (!quota.allowed) {
    return {
      error: json({ status: 429, message: quota.message!, errors: [quota.message!] }, 429),
    };
  }

  // The key's organization is the scope. A key from before organizations
  // that nobody has adopted yet still points at the rows its owner made.
  const scope = key.org_id
    ? eq(mails.org_id, key.org_id)
    : and(eq(mails.user_id, key.user_id), isNull(mails.org_id));
  const [template] = await ctx.db
    .select()
    .from(mails)
    .where(and(eq(mails.short_code, ctx.params.shortCode), scope))
    .limit(1);
  if (!template) return { error: notFound('Template not found') };
  // A live key serves the published copy only: a draft that has never been
  // published is the author's, not the integrator's, and a template whose
  // draft is mid-edit keeps serving what was last published. A test key is
  // the staging view — it sees the draft, published or not.
  let served: Served;
  if (key.mode === 'test') {
    served = { content: template.content, theme: template.theme, previewText: template.preview_text, stamp: template.updated_at };
  } else {
    if (template.published_at === null || template.published_content === null) {
      return { error: notFound('This template has not been published yet') };
    }
    served = { content: template.published_content, theme: template.published_theme, previewText: template.published_preview_text, stamp: template.published_at };
  }

  // The stamp is shown on the keys page to the minute, so it is written to
  // the minute: every render used to cost a third write for a value that
  // had not visibly changed since the last one.
  const now = new Date();
  if (!key.last_used_at || now.getTime() - Date.parse(key.last_used_at) >= 60_000) {
    await ctx.db
      .update(apiKeysTable)
      .set({ last_used_at: now.toISOString() })
      .where(eq(apiKeysTable.id, key.id));
  }
  await recordApiCall(ctx.db, key.org_id ?? key.user_id, new Date(), key.mode);

  return { key, template, served };
}

export const publicRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  /**
   * The review page's data. No key and no quota: the secret in the URL is
   * the whole credential, and the author handed it out on purpose. It shows
   * the draft — a review is of the work in progress, not of what shipped —
   * with placeholders intact, the way the editor's own preview does.
   */
  .get(PUBLIC_PREVIEW_ROUTE, async (ctx) => {
    const [template] = await ctx.db
      .select()
      .from(mails)
      .where(eq(mails.share_token, ctx.params.token))
      .limit(1);
    if (!template) return notFound('This link is not active');
    let content: unknown;
    try {
      content = JSON.parse(template.content);
    } catch {
      return json({ status: 500, message: 'Template content is corrupt', errors: ['Unparseable content'] }, 500);
    }
    let theme;
    try {
      theme = template.theme ? JSON.parse(template.theme) : undefined;
    } catch {
      theme = undefined;
    }
    // A reviewer reads the email, not its wiring: pills show their placeholders.
    const html = await render(content as JSONContent, { theme, preview: template.preview_text ?? undefined, showPlaceholders: true });
    return json({ title: template.title, previewText: template.preview_text, html, updatedAt: template.updated_at });
  })
  .get(PUBLIC_TEMPLATE_ROUTE, async (ctx) => {
    const resolved = await resolve(ctx);
    if ('error' in resolved) return resolved.error;
    const { template, served, key } = resolved;

    // updatedAt is the time the served copy last changed: the publish time
    // on a live key, the draft's on a test key. It is the field an
    // integrator caches on, so it moves with the content, not the typing.
    return json({
      id: template.id,
      shortCode: template.short_code,
      title: template.title,
      previewText: served.previewText,
      publishedAt: template.published_at,
      updatedAt: served.stamp,
      mode: key.mode,
    });
  })

  /**
   * The endpoint that makes a stored template worth storing: the caller's own
   * data in, the finished email out. Without it the API could only report that
   * a template exists, which is not enough to send anything — and "Show if"
   * conditions had nowhere to be evaluated outside the editor's preview.
   */
  .post(
    PUBLIC_RENDER_ROUTE,
    async (ctx) => {
      const resolved = await resolve(ctx);
      if ('error' in resolved) return resolved.error;
      const { template, served, key } = resolved;

      let content: unknown;
      try {
        content = JSON.parse(served.content);
      } catch {
        return json(
          { status: 500, message: 'Template content is corrupt', errors: ['Unparseable content'] },
          500,
        );
      }

      const renderOptions = {
        theme: served.theme ? JSON.parse(served.theme) : undefined,
        preview: served.previewText ?? undefined,
        // Omitted entirely when the caller sends none, which keeps variables as
        // `{{placeholders}}` and every conditional block visible.
        payload: ctx.body?.data,
      };

      // The parse above only proves it is JSON; the editor wrote it, so the
      // document shape is a cast, not a check — same trust as before.
      try {
        const html = await render(content as JSONContent, renderOptions);
        // The same email with the markup stripped. A caller building a
        // multipart message needs it, and generating it here keeps the two in
        // step — writing the text version by hand is how they drift.
        const text = await render(content as JSONContent, { ...renderOptions, plainText: true });
        return json({ html, text, shortCode: template.short_code, updatedAt: served.stamp, mode: key.mode });
      } catch (error) {
        // Data was sent but a variable has no value. The placeholder in the
        // editor is for previews; mailing it would put wrong words in front
        // of a real recipient, so the render is refused and says what to add.
        if (error instanceof MissingVariablesError) {
          return unprocessable(error.message, { missing: error.missing });
        }
        if (error instanceof RepeatNotListError) {
          return unprocessable(error.message, { key: error.key });
        }
        throw error;
      }
    },
    { body: t.Optional(t.Object({ data: t.Optional(t.Any()) })) },
  );
