import { Elysia, t } from 'elysia';
import type { JSONContent } from '@tiptap/core';
import { eq, and, desc, sql } from 'drizzle-orm';
import { mails, templateVersions } from '@temply/shared/schema';
import { TEMPLATE_CONTENT_MAX_LENGTH } from '@temply/shared/plans';
import { generateShareToken, generateShortCode } from '../lib/codes';
import { nextStamp } from '../lib/stamp';
import { hasUnpublishedChanges } from '@temply/shared/publish';
import { checkTemplateLimit, shouldSnapshot } from '../lib/billing';
import { render } from '../render/render';
import type { EngineConfig } from '../render/engine';
import { json, unauthorized, notFound, paymentRequired, badRequest } from '../lib/errors';
import { authPlugin } from '../plugins/auth';
import { noWorkspace } from '../lib/workspace';
import { dbPlugin } from '../plugins/db';
import { defaultBrandTheme } from '../lib/brands';
import type { Db } from '../plugins/db';

type Row = typeof mails.$inferSelect;

/**
 * A template is two copies of one email: the draft the editor works on
 * (content, theme, preview_text) and the copy the public API renders
 * (published_*). Saving touches the draft; publishing copies it across under
 * one shared stamp — see shared/publish.ts for the flag that follows.
 */
function withFlags(row: Row) {
  return { ...row, has_unpublished_changes: hasUnpublishedChanges(row) };
}

/** The draft as the published copy, under one shared stamp. */
function publishedPatch(row: Pick<Row, 'content' | 'theme' | 'preview_text'>, stamp: string) {
  return {
    published_content: row.content,
    published_theme: row.theme,
    published_preview_text: row.preview_text,
    published_at: stamp,
    updated_at: stamp,
  };
}

/**
 * Keeps the newest ten. Versions are the publish history — a draft save
 * never snapshots, or autosave would flush every real publish out of the
 * list within minutes.
 */
async function snapshotVersion(db: Db, row: Row) {
  const [maxVersion] = await db
    .select({ max: sql<number>`COALESCE(MAX(${templateVersions.version_number}), 0)` })
    .from(templateVersions)
    .where(eq(templateVersions.template_id, row.id));
  const vn = (maxVersion?.max ?? 0) + 1;
  await db.insert(templateVersions).values({
    id: crypto.randomUUID(),
    template_id: row.id,
    user_id: row.user_id,
    org_id: row.org_id,
    title: row.title,
    preview_text: row.preview_text,
    content: row.content,
    theme: row.theme,
    version_number: vn,
  });
  await db
    .delete(templateVersions)
    .where(
      sql`${templateVersions.id} NOT IN (SELECT id FROM (SELECT ${templateVersions.id} FROM ${templateVersions} WHERE ${templateVersions.template_id} = ${row.id} ORDER BY ${templateVersions.created_at} DESC LIMIT 10)) AND ${templateVersions.template_id} = ${row.id}`,
    );
}

/**
 * What a save may carry. The document and the theme are bounded by the
 * content ceiling: the request limit above them is sized for an image
 * upload, and autosave writes the document on every pause in typing, so
 * an unbounded one would be stored, versioned and rendered at any weight.
 */
const templateBody = t.Object({
  title: t.String({ minLength: 3, maxLength: 200 }),
  previewText: t.Optional(t.String({ maxLength: 500 })),
  content: t.String({ maxLength: TEMPLATE_CONTENT_MAX_LENGTH }),
  theme: t.Optional(t.String({ maxLength: TEMPLATE_CONTENT_MAX_LENGTH })),
});

async function ownRow(db: Db, orgId: string, id: string): Promise<Row | undefined> {
  const [row] = await db.select().from(mails).where(and(eq(mails.id, id), eq(mails.org_id, orgId))).limit(1);
  return row;
}

export const templatesRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  /**
   * The list, as the dashboard draws it: a title, a code, two dates and a
   * flag per row. It used to select every column — the document, the
   * published copy and the theme rode along for each template, megabytes
   * per dashboard load that the page then threw away. The flag needs only
   * the two stamps, so the row carries only what is shown.
   */
  .get('/api/v1/templates', (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    return ctx.db
      .select({
        id: mails.id,
        title: mails.title,
        preview_text: mails.preview_text,
        short_code: mails.short_code,
        created_at: mails.created_at,
        updated_at: mails.updated_at,
        published_at: mails.published_at,
      })
      .from(mails)
      .where(eq(mails.org_id, ctx.orgId))
      .orderBy(desc(mails.updated_at))
      .then((rows) => json({ templates: rows.map((row) => ({ ...row, has_unpublished_changes: hasUnpublishedChanges(row) })) }));
  })

  .get('/api/v1/templates/:id', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const template = await ownRow(ctx.db, ctx.orgId, ctx.params.id);
    if (!template) return notFound('Template not found');
    return json({ template: withFlags(template) });
  })

  /**
   * The draft rendered as the dashboard thumbnails show it: no payload, so
   * the engine stays in composing mode — every conditional block is visible
   * — but each pill is drawn as its fallback, since a card is there to show
   * what the email looks like, not how it is wired. Recipient-shaped output
   * belongs to the public render endpoint, not here.
   */
  .get('/api/v1/templates/:id/preview', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const template = await ownRow(ctx.db, ctx.orgId, ctx.params.id);
    if (!template) return notFound('Template not found');

    let content: unknown;
    try {
      content = JSON.parse(template.content);
    } catch {
      return json({ status: 500, message: 'Template content is corrupt', errors: ['Unparseable content'] }, 500);
    }

    // A corrupt theme degrades the thumbnail to the default theme; only the
    // document itself being unreadable is worth failing the card over.
    let theme: EngineConfig['theme'];
    try {
      theme = template.theme ? JSON.parse(template.theme) : undefined;
    } catch {
      theme = undefined;
    }

    const html = await render(content as JSONContent, {
      theme,
      preview: template.preview_text ?? undefined,
      showPlaceholders: true,
    });

    // Cacheable forever only when the caller keyed the URL to this exact
    // updated_at (?v=…) — an edit changes the key, so stale HTML is never
    // served. An unversioned request has no such guarantee and must not stick.
    const versioned = ctx.query.v !== undefined && ctx.query.v === template.updated_at;
    return new Response(JSON.stringify({ html, updatedAt: template.updated_at }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': versioned ? 'private, max-age=31536000, immutable' : 'no-store',
        // The browser HTTP cache keys by URL alone; this keeps a cached
        // preview from surviving a session change on a shared profile.
        Vary: 'Cookie',
      },
    });
  })

  // A new template is published in the same request, so it can be rendered
  // through the API straight away instead of answering 404 until its author
  // finds the Publish button.
  //
  // A template that arrives without a theme starts on the workspace's
  // default brand, decided here rather than left to the editor: the row is
  // published in this same request, so the thumbnail and the API render
  // would otherwise show the shipped default until the editor had opened
  // and autosaved the brand it adopts — and an autosave on open reads as
  // unpublished changes to a template nobody has touched. The editor keeps
  // its own adoption for the rows this could not reach: the playground has
  // no row, and templates from before this rule still hold null.
  .post('/api/v1/templates', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const limit = await checkTemplateLimit(ctx.db, ctx.orgId);
    if (!limit.allowed) return paymentRequired(limit.message!);
    const { title, previewText, content, theme } = ctx.body;
    const id = crypto.randomUUID();
    const shortCode = generateShortCode();
    const draft = { content, theme: theme ?? (await defaultBrandTheme(ctx.db, ctx.orgId)), preview_text: previewText ?? null };
    const stamp = nextStamp();
    await ctx.db.insert(mails).values({
      id,
      user_id: ctx.userId,
      org_id: ctx.orgId,
      title,
      ...draft,
      short_code: shortCode,
      created_at: stamp,
      ...publishedPatch(draft, stamp),
    });
    const [inserted] = await ctx.db.select().from(mails).where(eq(mails.id, id)).limit(1);
    return json({ template: withFlags(inserted) });
  }, { body: templateBody })

  // Saves the draft. The published copy is untouched until /publish.
  .post('/api/v1/templates/:id', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const { title, previewText, content, theme } = ctx.body;
    // `theme` is omitted rather than null when the client is not editing it,
    // so an absent field must not wipe a theme the template already has.
    // SQLite has no ON UPDATE — the bump has to be written here.
    const patch: Record<string, unknown> = {
      title,
      preview_text: previewText ?? null,
      content,
      updated_at: nextStamp(),
    };
    if (theme !== undefined) patch.theme = theme;
    await ctx.db.update(mails).set(patch).where(and(eq(mails.id, ctx.params.id), eq(mails.org_id, ctx.orgId)));
    return json({ status: 'ok' });
  }, { body: templateBody })

  .post('/api/v1/templates/:id/publish', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const row = await ownRow(ctx.db, ctx.orgId, ctx.params.id);
    if (!row) return notFound('Template not found');
    const stamp = nextStamp();
    await ctx.db.update(mails).set(publishedPatch(row, stamp)).where(eq(mails.id, row.id));
    if (await shouldSnapshot(ctx.db, ctx.orgId)) await snapshotVersion(ctx.db, row);
    const [published] = await ctx.db.select().from(mails).where(eq(mails.id, row.id)).limit(1);
    return json({ template: withFlags(published) });
  })

  // Throws the draft away: the published copy becomes the draft again and the
  // shared stamp clears the unpublished flag.
  .post('/api/v1/templates/:id/discard', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const row = await ownRow(ctx.db, ctx.orgId, ctx.params.id);
    if (!row) return notFound('Template not found');
    if (row.published_at === null || row.published_content === null) {
      return badRequest('This template has never been published, so there is nothing to go back to.');
    }
    await ctx.db
      .update(mails)
      .set({
        content: row.published_content,
        theme: row.published_theme,
        preview_text: row.published_preview_text,
        updated_at: row.published_at,
      })
      .where(eq(mails.id, row.id));
    const [restored] = await ctx.db.select().from(mails).where(eq(mails.id, row.id)).limit(1);
    return json({ template: withFlags(restored) });
  })

  // A review link. Creating one when it exists returns the same link — a
  // teammate who already has it should not be cut off by a second click.
  .post('/api/v1/templates/:id/share', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const row = await ownRow(ctx.db, ctx.orgId, ctx.params.id);
    if (!row) return notFound('Template not found');
    if (row.share_token) return json({ token: row.share_token });
    const token = generateShareToken();
    await ctx.db.update(mails).set({ share_token: token }).where(eq(mails.id, row.id));
    return json({ token });
  })

  .delete('/api/v1/templates/:id/share', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const row = await ownRow(ctx.db, ctx.orgId, ctx.params.id);
    if (!row) return notFound('Template not found');
    await ctx.db.update(mails).set({ share_token: null }).where(eq(mails.id, row.id));
    return json({ status: 'ok' });
  })

  .delete('/api/v1/templates/:id', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    await ctx.db.delete(mails).where(and(eq(mails.id, ctx.params.id), eq(mails.org_id, ctx.orgId)));
    return json({ status: 'ok' });
  })

  // The copy starts from the draft — what the author is looking at — and is
  // published at once, like a new template.
  .post('/api/v1/templates/:id/duplicate', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    // Duplicating adds a template, so it must respect the plan cap like create.
    const limit = await checkTemplateLimit(ctx.db, ctx.orgId);
    if (!limit.allowed) return paymentRequired(limit.message!);
    const template = await ownRow(ctx.db, ctx.orgId, ctx.params.id);
    if (!template) return notFound('Template not found');
    const newId = crypto.randomUUID();
    const shortCode = generateShortCode();
    const stamp = nextStamp();
    await ctx.db.insert(mails).values({
      id: newId,
      user_id: ctx.userId,
      org_id: ctx.orgId,
      title: `[DUPLICATE] ${template.title}`,
      preview_text: template.preview_text,
      content: template.content,
      theme: template.theme,
      short_code: shortCode,
      created_at: stamp,
      ...publishedPatch(template, stamp),
    });
    const [duplicated] = await ctx.db.select().from(mails).where(eq(mails.id, newId)).limit(1);
    return json({ template: withFlags(duplicated) });
  })

  .get('/api/v1/templates/:id/versions', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const versions = await ctx.db.select({ id: templateVersions.id, version_number: templateVersions.version_number, title: templateVersions.title, created_at: templateVersions.created_at }).from(templateVersions).where(eq(templateVersions.template_id, ctx.params.id)).orderBy(desc(templateVersions.created_at));
    return json({ versions });
  })

  .get('/api/v1/templates/:id/versions/:versionId', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const [version] = await ctx.db.select().from(templateVersions).where(and(eq(templateVersions.id, ctx.params.versionId), eq(templateVersions.template_id, ctx.params.id), eq(templateVersions.org_id, ctx.orgId))).limit(1);
    if (!version) return notFound('Version not found');
    return json({ version });
  })

  // Restoring writes the version into the draft. It does not publish, and it
  // does not snapshot: the history is what was published, and the draft the
  // restore replaces was never that.
  .post('/api/v1/templates/:id/versions/:versionId/restore', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const [version] = await ctx.db.select().from(templateVersions).where(and(eq(templateVersions.id, ctx.params.versionId), eq(templateVersions.template_id, ctx.params.id), eq(templateVersions.org_id, ctx.orgId))).limit(1);
    if (!version) return notFound('Version not found');
    // A null version theme means "snapshotted before themes were captured" —
    // unknown, not absent — so it must not wipe the template's current theme.
    const restorePatch: Record<string, unknown> = {
      title: version.title,
      preview_text: version.preview_text,
      content: version.content,
      updated_at: nextStamp(),
    };
    if (version.theme !== null) restorePatch.theme = version.theme;
    await ctx.db.update(mails).set(restorePatch).where(and(eq(mails.id, ctx.params.id), eq(mails.org_id, ctx.orgId)));
    // The restored row goes back with the response: the editor that asked
    // for the restore is holding the document this just replaced, and
    // without the new one on hand it would have to be reloaded to show it.
    const [restored] = await ctx.db.select().from(mails).where(and(eq(mails.id, ctx.params.id), eq(mails.org_id, ctx.orgId))).limit(1);
    // The version existing says nothing about the template: it can be deleted
    // between the write above and this read, and the row is then gone.
    if (!restored) return notFound('Template not found');
    return json({ template: withFlags(restored) });
  });
