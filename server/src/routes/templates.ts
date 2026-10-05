import { Elysia, t } from 'elysia';
import type { JSONContent } from '@tiptap/core';
import { eq, and, desc, isNull, lt, notInArray, or, sql } from 'drizzle-orm';
import { mails, templateVersions } from '@temply/shared/schema';
import { TEMPLATE_CONTENT_MAX_LENGTH } from '@temply/shared/plans';
import { generateShareToken, generateShortCode } from '../lib/codes';
import { nextStamp, stampAfter } from '../lib/stamp';
import { liveVersionOf, pinnedSince } from '../lib/versions';
import { hasUnpublishedChanges } from '@temply/shared/publish';
import { templateStage } from '@temply/shared/stage';
import { checkTemplateLimit, refuseWhenLapsed, versionsKept } from '../lib/billing';
import { render } from '../render/render';
import type { EngineConfig } from '../render/engine';
import { json, unauthorized, notFound, paymentRequired, badRequest, conflict } from '../lib/errors';
import { authPlugin } from '../plugins/auth';
import { askAnAdmin, isAdmin, noWorkspace } from '../lib/workspace';
import { dbPlugin } from '../plugins/db';
import { defaultBrandTheme } from '../lib/brands';
import type { Db } from '../plugins/db';

type Row = typeof mails.$inferSelect;

/** One copy of an email: what the editor, the candidate or the API holds. */
type Copy = { content: string; theme: string | null; preview_text: string | null };

/**
 * A template is up to three copies of one email: the draft the editor works
 * on (content, theme, preview_text), the candidate a member staged for
 * sign-off (staged_*), and the copy the public API renders (published_*).
 * Saving touches the draft; publishing copies it across under one shared
 * stamp, and approving does the same for the candidate — see
 * shared/publish.ts for the flag that follows and shared/stage.ts for the
 * stage. The newest version is what the API serves, since every way of going
 * live snapshots; a template born published has none until its first publish.
 */
async function present(db: Db, row: Row) {
  const [found] = await db.select({ live_version: liveVersionOf(sql`${mails}.id`) }).from(mails).where(eq(mails.id, row.id));
  return {
    ...row,
    has_unpublished_changes: hasUnpublishedChanges(row),
    stage: templateStage(row),
    live_version: found?.live_version ?? null,
  };
}

/** The draft as the published copy, under one shared stamp. */
function publishedPatch(row: Copy, stamp: string) {
  return {
    published_content: row.content,
    published_theme: row.theme,
    published_preview_text: row.preview_text,
    published_at: stamp,
    updated_at: stamp,
  };
}

/**
 * `copy` going live under `stamp`. When the draft already is that copy the
 * two stamps match and the template reads as published; when it is not, the
 * draft is left alone and only published_at moves, so the template reads as
 * having unpublished changes instead of quietly adopting a draft nobody
 * signed off.
 */
function goLivePatch(row: Row, copy: Copy, stamp: string) {
  const patch = publishedPatch(copy, stamp);
  if (row.content === copy.content && row.theme === copy.theme && row.preview_text === copy.preview_text) return patch;
  const { updated_at: _draftStamp, ...published } = patch;
  return published;
}

/** Everything about a review. Staging again and asking again start it over. */
const NO_REVIEW = {
  review_requested_at: null,
  review_requested_by: null,
  returned_at: null,
  returned_by: null,
  return_note: null,
};

/** The candidate and its review, dropped together: a candidate without its
 *  staged_at, or a review without a candidate, is a state no stage names. */
const NO_CANDIDATE = {
  staged_content: null,
  staged_theme: null,
  staged_preview_text: null,
  staged_at: null,
  staged_by: null,
  ...NO_REVIEW,
};

function stagedCopy(row: Row): Copy | undefined {
  if (!row.staged_at || row.staged_content === null) return undefined;
  return { content: row.staged_content, theme: row.staged_theme, preview_text: row.staged_preview_text };
}

function liveCopy(row: Row): Copy | undefined {
  if (row.published_at === null || row.published_content === null) return undefined;
  return { content: row.published_content, theme: row.published_theme, preview_text: row.published_preview_text };
}

/** A cleared candidate's cache key must never be reused by a later copy,
 * even when the instance that staged it had a clock ahead of this one. */
function workflowStamp(row: Row) {
  return stampAfter(row.updated_at, row.published_at, row.staged_at, row.review_requested_at, row.returned_at);
}

/**
 * Keeps the newest `keep` — the plan's number, which a template pack
 * raises — and any older version an API call pinned within the retention
 * window, which is how an app that has not moved to the live copy yet keeps
 * the one it renders. Versions are the publish history: a draft save never
 * snapshots, or autosave would flush every real publish out of the list
 * within minutes.
 */
async function snapshotVersion(tx: Db, row: Row, keep: number) {
  // The caller holds the template's row lock. Without it two publishes of
  // one template could both read the same MAX under READ COMMITTED, and the
  // unique index on (template_id, version_number) would refuse the second.
  const next = sql`(SELECT COALESCE(MAX(${templateVersions.version_number}), 0) + 1 FROM ${templateVersions} WHERE ${templateVersions.template_id} = ${row.id})`;
  await tx.insert(templateVersions).values({
    id: crypto.randomUUID(),
    template_id: row.id,
    user_id: row.user_id,
    org_id: row.org_id,
    title: row.title,
    preview_text: row.preview_text,
    content: row.content,
    theme: row.theme,
    version_number: next,
  });
  const newest = tx
    .select({ id: templateVersions.id })
    .from(templateVersions)
    .where(eq(templateVersions.template_id, row.id))
    .orderBy(desc(templateVersions.version_number))
    .limit(keep);
  await tx.delete(templateVersions).where(and(
    eq(templateVersions.template_id, row.id),
    notInArray(templateVersions.id, newest),
    or(isNull(templateVersions.pinned_at), lt(templateVersions.pinned_at, pinnedSince())),
  ));
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

/** The row, locked until `tx` ends. A second write to the same template
 *  waits here, then reads what the first one wrote. */
async function lockOwnRow(tx: Db, orgId: string, id: string): Promise<Row | undefined> {
  const [row] = await tx.select().from(mails).where(and(eq(mails.id, id), eq(mails.org_id, orgId))).limit(1).for('update');
  return row;
}

/**
 * One write under the template's row lock, answered as `{ template }`.
 * `change` returns the row it wrote, or a Response when the template is not
 * in a state that allows the move: nothing has been written by then, and
 * the refusal goes out as it is.
 */
function underLock(db: Db, orgId: string, id: string, change: (tx: Db, row: Row) => Promise<Row | Response>) {
  return db.transaction(async (tx) => {
    const row = await lockOwnRow(tx, orgId, id);
    if (!row) return notFound('Template not found');
    const result = await change(tx, row);
    return result instanceof Response ? result : json({ template: await present(tx, result) });
  });
}

export const templatesRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  // A workspace without a plan reads and deletes, and changes nothing.
  .onBeforeHandle(refuseWhenLapsed)
  /**
   * The list, as the dashboard draws it: a title, a code, the stamps the
   * stage and the status read from, and a flag per row. It used to select
   * every column — the document, the published copy and the theme rode along
   * for each template, megabytes per dashboard load that the page then threw
   * away. The stage and the flag need only stamps and the newest version
   * number, so the row carries only what is shown, and none of the three
   * copies.
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
        staged_at: mails.staged_at,
        review_requested_at: mails.review_requested_at,
        review_requested_by: mails.review_requested_by,
        returned_at: mails.returned_at,
        live_version: liveVersionOf(sql`${mails}.id`),
      })
      .from(mails)
      .where(eq(mails.org_id, ctx.orgId))
      .orderBy(desc(mails.updated_at))
      .then((rows) => json({ templates: rows.map((row) => ({ ...row, has_unpublished_changes: hasUnpublishedChanges(row), stage: templateStage(row) })) }));
  })

  .get('/api/v1/templates/:id', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const template = await ownRow(ctx.db, ctx.orgId, ctx.params.id);
    if (!template) return notFound('Template not found');
    return json({ template: await present(ctx.db, template) });
  })

  /**
   * A copy rendered as the dashboard thumbnails show it: no payload, so
   * the engine stays in composing mode — every conditional block is visible
   * — but each pill is drawn as its fallback, since a card is there to show
   * what the email looks like, not how it is wired. Recipient-shaped output
   * belongs to the public render endpoint, not here.
   *
   * `copy` picks the draft (the default), the staged candidate or what is
   * live. Each copy changes with a stamp of its own, and `updatedAt` answers
   * with the one for the copy asked about, so the client keys its next
   * request on the right one.
   */
  .get('/api/v1/templates/:id/preview', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const template = await ownRow(ctx.db, ctx.orgId, ctx.params.id);
    if (!template) return notFound('Template not found');

    const which = ctx.query.copy ?? 'draft';
    const shown = which === 'staged' ? stagedCopy(template) : which === 'live' ? liveCopy(template) : template;
    if (!shown) return notFound(which === 'staged' ? 'Nothing is staged for this template.' : 'This template has not been published.');
    const stamp = which === 'staged' ? template.staged_at : which === 'live' ? template.published_at : template.updated_at;

    let content: unknown;
    try {
      content = JSON.parse(shown.content);
    } catch {
      return json({ status: 500, message: 'Template content is corrupt', errors: ['Unparseable content'] }, 500);
    }

    // A corrupt theme degrades the thumbnail to the default theme; only the
    // document itself being unreadable is worth failing the card over.
    let theme: EngineConfig['theme'];
    try {
      theme = shown.theme ? JSON.parse(shown.theme) : undefined;
    } catch {
      theme = undefined;
    }

    const html = await render(content as JSONContent, {
      theme,
      preview: shown.preview_text ?? undefined,
      showPlaceholders: true,
    });

    // Cacheable forever only when the caller keyed the URL to the stamp of
    // the copy it asked for (?v=…) — a change to that copy changes the stamp,
    // so stale HTML is never served. An unversioned request has no such
    // guarantee and must not stick; neither does a key from another copy.
    const versioned = ctx.query.v !== undefined && ctx.query.v === stamp;
    return new Response(JSON.stringify({ html, updatedAt: stamp }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': versioned ? 'private, max-age=31536000, immutable' : 'no-store',
        // The browser HTTP cache keys by URL alone; this keeps a cached
        // preview from surviving a session change on a shared profile.
        Vary: 'Cookie',
      },
    });
  }, {
    query: t.Object({
      copy: t.Optional(t.Union([t.Literal('draft'), t.Literal('staged'), t.Literal('live')])),
      v: t.Optional(t.String()),
    }),
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
    return json({ template: await present(ctx.db, inserted) });
  }, { body: templateBody })

  // Saves the draft. The published copy is untouched until /publish.
  .post('/api/v1/templates/:id', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const { orgId, body: { title, previewText, content, theme } } = ctx;
    await ctx.db.transaction(async (tx) => {
      const row = await lockOwnRow(tx, orgId, ctx.params.id);
      if (!row) return;
      // `theme` is omitted rather than null when the client is not editing
      // it, so an absent field must not wipe a theme the template already
      // has. Nothing in the schema bumps updated_at, so the save writes it.
      const patch: Record<string, unknown> = {
        title,
        preview_text: previewText ?? null,
        content,
        updated_at: stampAfter(row.updated_at, row.published_at),
      };
      if (theme !== undefined) patch.theme = theme;
      await tx.update(mails).set(patch).where(eq(mails.id, row.id));
    });
    return json({ status: 'ok' });
  }, { body: templateBody })

  // Straight to live, for an admin: the draft goes out as it is and any
  // candidate or review in flight is dropped, since what it was for has
  // shipped or been overruled. A member's way there is stage, ask, approve.
  .post('/api/v1/templates/:id/publish', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    if (!isAdmin(ctx)) return askAnAdmin('publish templates');
    const orgId = ctx.orgId;
    const keep = await versionsKept(ctx.db, orgId);
    return underLock(ctx.db, orgId, ctx.params.id, async (tx, row) => {
      const [updated] = await tx
        .update(mails)
        .set({ ...publishedPatch(row, workflowStamp(row)), ...NO_CANDIDATE })
        .where(eq(mails.id, row.id))
        .returning();
      await snapshotVersion(tx, row, keep);
      return updated;
    });
  })

  // Puts the draft up as the candidate. It is a snapshot, so the author keeps
  // editing the draft while an admin looks at the copy that was put forward.
  .post('/api/v1/templates/:id/stage', (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const userId = ctx.userId;
    return underLock(ctx.db, ctx.orgId, ctx.params.id, async (tx, row) => {
      if (row.review_requested_at) return conflict('This template is waiting for sign-off. Ask an admin to send it back, or remove the staged copy first.');
      if (row.published_at !== null && !hasUnpublishedChanges(row)) return badRequest('There is nothing to stage. The draft matches what is live.');
      const [updated] = await tx
        .update(mails)
        .set({
          staged_content: row.content,
          staged_theme: row.theme,
          staged_preview_text: row.preview_text,
          staged_at: workflowStamp(row),
          staged_by: userId,
          ...NO_REVIEW,
        })
        .where(eq(mails.id, row.id))
        .returning();
      return updated;
    });
  })

  // Takes the candidate back, a request for sign-off with it. Any member may,
  // the one who asked included: a copy staged by mistake needs a way out that
  // does not wait for an admin. The draft and what is live are untouched.
  .post('/api/v1/templates/:id/unstage', (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    return underLock(ctx.db, ctx.orgId, ctx.params.id, async (tx, row) => {
      if (!row.staged_at) return conflict('There is no staged copy to remove.');
      const [updated] = await tx.update(mails).set(NO_CANDIDATE).where(eq(mails.id, row.id)).returning();
      return updated;
    });
  })

  .post('/api/v1/templates/:id/request-signoff', (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const userId = ctx.userId;
    return underLock(ctx.db, ctx.orgId, ctx.params.id, async (tx, row) => {
      if (!row.staged_at) return conflict('Move this template to staging before asking for sign-off.');
      if (row.review_requested_at) return conflict('This template is already waiting for sign-off.');
      const [updated] = await tx
        .update(mails)
        .set({ ...NO_REVIEW, review_requested_at: workflowStamp(row), review_requested_by: userId })
        .where(eq(mails.id, row.id))
        .returning();
      return updated;
    });
  })

  // Signs the candidate off: it, not the draft, goes live and takes the
  // version number. The author may have kept editing since staging, which is
  // why the draft is compared rather than assumed to match.
  .post('/api/v1/templates/:id/approve', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    if (!isAdmin(ctx)) return askAnAdmin('approve templates');
    const orgId = ctx.orgId;
    const keep = await versionsKept(ctx.db, orgId);
    return underLock(ctx.db, orgId, ctx.params.id, async (tx, row) => {
      const candidate = stagedCopy(row);
      if (!row.review_requested_at || !candidate) return conflict('This template is not waiting for sign-off.');
      if (ctx.body?.stagedAt !== undefined && ctx.body.stagedAt !== row.staged_at) return conflict('The staged copy changed. Reload it before signing off.');
      const [updated] = await tx
        .update(mails)
        .set({ ...goLivePatch(row, candidate, workflowStamp(row)), ...NO_CANDIDATE })
        .where(eq(mails.id, row.id))
        .returning();
      await snapshotVersion(tx, { ...row, ...candidate }, keep);
      return updated;
    });
  }, { body: t.Optional(t.Object({ stagedAt: t.Optional(t.String()) })) })

  // The candidate stays staged, so its author can fix the draft and stage it
  // again, or ask again as it is.
  .post('/api/v1/templates/:id/send-back', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    if (!isAdmin(ctx)) return askAnAdmin('send templates back');
    const userId = ctx.userId;
    const note = ctx.body?.note?.trim() || null;
    return underLock(ctx.db, ctx.orgId, ctx.params.id, async (tx, row) => {
      if (!row.review_requested_at) return conflict('This template is not waiting for sign-off.');
      if (ctx.body?.stagedAt !== undefined && ctx.body.stagedAt !== row.staged_at) return conflict('The staged copy changed. Reload it before signing off.');
      const [updated] = await tx
        .update(mails)
        .set({
          review_requested_at: null,
          review_requested_by: null,
          returned_at: workflowStamp(row),
          returned_by: userId,
          return_note: note,
        })
        .where(eq(mails.id, row.id))
        .returning();
      return updated;
    });
  }, { body: t.Optional(t.Object({ note: t.Optional(t.String({ maxLength: 500 })), stagedAt: t.Optional(t.String()) })) })

  // Puts the version before the live one back on the API. The draft is not
  // touched and a candidate stays where it was; the rolled-back copy is
  // snapshotted like anything else that goes live, so the history still
  // reads as what was served, in order.
  .post('/api/v1/templates/:id/rollback', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    if (!isAdmin(ctx)) return askAnAdmin('roll templates back');
    const orgId = ctx.orgId;
    const keep = await versionsKept(ctx.db, orgId);
    return underLock(ctx.db, orgId, ctx.params.id, async (tx, row) => {
      if (ctx.body?.publishedAt !== undefined && ctx.body.publishedAt !== row.published_at) return conflict('The live copy changed. Reload it before rolling back.');
      const [earlier] = await tx
        .select()
        .from(templateVersions)
        .where(eq(templateVersions.template_id, row.id))
        .orderBy(desc(templateVersions.version_number))
        .limit(1)
        .offset(1);
      if (!earlier) return badRequest('There is no earlier version to roll back to.');
      // A null version theme means "snapshotted before themes were captured"
      // (unknown, not absent), so it must not wipe the theme that is live.
      const copy = { content: earlier.content, theme: earlier.theme ?? row.published_theme, preview_text: earlier.preview_text };
      const [updated] = await tx
        .update(mails)
        .set(goLivePatch(row, copy, workflowStamp(row)))
        .where(eq(mails.id, row.id))
        .returning();
      await snapshotVersion(tx, { ...row, ...copy, title: earlier.title }, keep);
      return updated;
    });
  }, { body: t.Optional(t.Object({ publishedAt: t.Optional(t.String()) })) })

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
    return json({ template: await present(ctx.db, restored) });
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
    return json({ template: await present(ctx.db, duplicated) });
  })

  .get('/api/v1/templates/:id/versions', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const versions = await ctx.db.select({ id: templateVersions.id, version_number: templateVersions.version_number, title: templateVersions.title, created_at: templateVersions.created_at }).from(templateVersions).where(and(eq(templateVersions.template_id, ctx.params.id), eq(templateVersions.org_id, ctx.orgId))).orderBy(desc(templateVersions.version_number));
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
    const orgId = ctx.orgId;
    const restored = await ctx.db.transaction(async (tx) => {
      // The version existing says nothing about the template: it can have
      // been deleted since the version was read.
      const row = await lockOwnRow(tx, orgId, ctx.params.id);
      if (!row) return undefined;
      // A null version theme means "snapshotted before themes were captured"
      // (unknown, not absent), so it must not wipe the template's theme.
      const restorePatch: Record<string, unknown> = {
        title: version.title,
        preview_text: version.preview_text,
        content: version.content,
        updated_at: stampAfter(row.updated_at, row.published_at),
      };
      if (version.theme !== null) restorePatch.theme = version.theme;
      const [updated] = await tx.update(mails).set(restorePatch).where(eq(mails.id, row.id)).returning();
      return updated;
    });
    if (!restored) return notFound('Template not found');
    // The restored row goes back with the response: the editor that asked
    // for the restore is holding the document this just replaced, and
    // without the new one on hand it would have to be reloaded to show it.
    return json({ template: await present(ctx.db, restored) });
  });
