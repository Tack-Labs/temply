import { TEMPLATE_CONTENT_MAX_LENGTH } from '@temply/shared/plans';
import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { brands, mails, orgPrefs, subscriptions, templateVersions } from '@temply/shared/schema';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';
import { createTestApp, createTestDb, del, get, givePlan, lapse, post, type TestDb } from '../test/helpers';
import { templatesRoutes } from './templates';

let db: TestDb;
let app: any;

const OWNER = 'user_owner';
const OTHER = 'user_other';

beforeEach(async () => {
  db = await createTestDb();
  app = createTestApp(db, templatesRoutes);
});

async function createTemplate(userId: string, title = 'My template') {
  const res = await post(app, '/api/v1/templates', { title, content: '{"type":"doc"}' }, userId);
  const body = await res.json();
  return body.template;
}

describe('authentication', () => {
  it('rejects every template route when the request has no user', async () => {
    const responses = await Promise.all([
      get(app, '/api/v1/templates'),
      get(app, '/api/v1/templates/some-id'),
      post(app, '/api/v1/templates', { title: 'Hello', content: '{}' }),
      del(app, '/api/v1/templates/some-id'),
    ]);

    for (const res of responses) expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/templates', () => {
  it('stores the template and returns it with a generated short code', async () => {
    const template = await createTemplate(OWNER, 'Welcome email');

    expect(template.title).toBe('Welcome email');
    expect(template.user_id).toBe(OWNER);
    expect(template.short_code).toMatch(/^tpl_[0-9A-Za-z]{8}$/);
  });

  it('stamps created_at and updated_at on insert', async () => {
    // Guards the schema-level defaults: Drizzle sends explicit NULLs for
    // omitted columns, so the DDL defaults alone never fire.
    const template = await createTemplate(OWNER, 'Dated template');
    expect(template.created_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(template.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('rejects a title shorter than 3 characters', async () => {
    const res = await post(app, '/api/v1/templates', { title: 'ab', content: '{}' }, OWNER);
    expect(res.status).toBe(400);
  });

  it('refuses a document or a theme past the content ceiling', async () => {
    const heavy = 'x'.repeat(TEMPLATE_CONTENT_MAX_LENGTH + 1);
    expect((await post(app, '/api/v1/templates', { title: 'Heavy', content: heavy }, OWNER)).status).toBe(400);
    expect((await post(app, '/api/v1/templates', { title: 'Heavy', content: '{}', theme: heavy }, OWNER)).status).toBe(400);
    const { id } = await createTemplate(OWNER);
    expect((await post(app, `/api/v1/templates/${id}`, { title: 'Heavy', content: heavy }, OWNER)).status).toBe(400);
  });

  it('returns 402 once a trial has made its ten templates, and says what lifts it', async () => {
    for (let i = 0; i < 10; i++) await createTemplate(OWNER, `Template ${i}`);

    const res = await post(app, '/api/v1/templates', { title: 'One too many', content: '{}' }, OWNER);
    expect(res.status).toBe(402);
    expect((await res.json()).message).toBe("You've used all 10 templates in the trial. Subscribe, then add a template pack for 10 more.");
  });

  it('makes nothing for a read-only workspace', async () => {
    await lapse(db, OWNER);
    const res = await post(app, '/api/v1/templates', { title: 'Welcome', content: '{}' }, OWNER);
    expect(res.status).toBe(402);
    expect(await db.select().from(mails)).toEqual([]);
  });

  // The default brand is a workspace preference, so the brands routes are not
  // needed to choose one: the preference row and the brand row are written
  // as those routes would leave them.
  describe('a template made without a theme', () => {
    const warm = BRAND_PRESETS.find((p) => p.id === 'warm')!;
    const stored = async (id: string) => (await db.select().from(mails).where(eq(mails.id, id)))[0];

    it('starts on the first preset when no default was ever chosen', async () => {
      const template = await createTemplate(OWNER);
      expect(JSON.parse(template.theme)).toEqual(BRAND_PRESETS[0].theme);
    });

    it('starts on a preset the workspace chose as its default', async () => {
      await db.insert(orgPrefs).values({ org_id: OWNER, default_brand_id: 'warm' });
      const template = await createTemplate(OWNER);
      expect(JSON.parse(template.theme)).toEqual(warm.theme);
      // Published in the same request, so the API renders the brand at once.
      expect((await stored(template.id)).published_theme).toBe(template.theme);
    });

    it('starts on the workspace’s own default brand', async () => {
      const theme = '{"button":{"backgroundColor":"#123456"}}';
      await db.insert(brands).values({ id: 'brand_1', user_id: OWNER, org_id: OWNER, name: 'Ours', theme, is_default: 0 });
      await db.insert(orgPrefs).values({ org_id: OWNER, default_brand_id: 'brand_1' });
      const template = await createTemplate(OWNER);
      expect(template.theme).toBe(theme);
    });

    it('never reaches into another workspace’s brand', async () => {
      const theme = '{"button":{"backgroundColor":"#123456"}}';
      await db.insert(brands).values({ id: 'brand_2', user_id: OTHER, org_id: OTHER, name: 'Theirs', theme, is_default: 0 });
      await db.insert(orgPrefs).values({ org_id: OWNER, default_brand_id: 'brand_2' });
      const template = await createTemplate(OWNER);
      expect(JSON.parse(template.theme)).toEqual(BRAND_PRESETS[0].theme);
    });
  });

  it('keeps a theme the request brings', async () => {
    await db.insert(orgPrefs).values({ org_id: OWNER, default_brand_id: 'warm' });
    const theme = '{"link":{"color":"#000000"}}';
    const res = await post(app, '/api/v1/templates', { title: 'Themed', content: '{}', theme }, OWNER);
    expect((await res.json()).template.theme).toBe(theme);
  });
});

describe('GET /api/v1/templates', () => {
  it('lists only the requesting user’s templates', async () => {
    await createTemplate(OWNER, 'Mine');
    await createTemplate(OTHER, 'Theirs');

    const { templates } = await (await get(app, '/api/v1/templates', OWNER)).json();
    expect(templates).toHaveLength(1);
    expect(templates[0].title).toBe('Mine');
  });

  it('carries what the dashboard shows and not the document', async () => {
    const { id } = await createTemplate(OWNER, 'Light');
    await post(app, `/api/v1/templates/${id}/publish`, {}, OWNER);
    const { templates } = await (await get(app, '/api/v1/templates', OWNER)).json();
    expect(Object.keys(templates[0]).sort()).toEqual(
      [
        'created_at', 'has_unpublished_changes', 'id', 'live_version', 'preview_text', 'published_at', 'returned_at',
        'review_requested_at', 'review_requested_by', 'short_code', 'stage', 'staged_at', 'title', 'updated_at',
      ],
    );
    expect(templates[0].has_unpublished_changes).toBe(false);
    await post(app, `/api/v1/templates/${id}`, { title: 'Light again', content: '{"type":"doc"}' }, OWNER);
    const after = await (await get(app, '/api/v1/templates', OWNER)).json();
    expect(after.templates[0].has_unpublished_changes).toBe(true);
  });

  it('hides another user’s template behind a 404', async () => {
    const template = await createTemplate(OWNER);
    const res = await get(app, `/api/v1/templates/${template.id}`, OTHER);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/templates/:id/preview', () => {
  const doc = JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello thumbnail' }] }],
  });

  async function createPreviewTemplate(extra: Record<string, string> = {}) {
    const res = await post(app, '/api/v1/templates', { title: 'Thumbnail source', content: doc, ...extra }, OWNER);
    return (await res.json()).template;
  }

  it('rejects a request with no user', async () => {
    const res = await get(app, '/api/v1/templates/some-id/preview');
    expect(res.status).toBe(401);
  });

  it('hides another user’s template behind a 404', async () => {
    const template = await createPreviewTemplate();
    const res = await get(app, `/api/v1/templates/${template.id}/preview`, OTHER);
    expect(res.status).toBe(404);
  });

  it('renders the owner’s template as a full HTML document', async () => {
    const template = await createPreviewTemplate();
    const res = await get(app, `/api/v1/templates/${template.id}/preview`, OWNER);

    expect(res.status).toBe(200);
    const { html } = await res.json();
    expect(html).toContain('Hello thumbnail');
    expect(html).toContain('<html');
  });

  it('draws a pill as its fallback, and a pill with none as its placeholder', async () => {
    const content = JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hi ' },
          { type: 'variable', attrs: { id: 'firstName', fallback: 'there', required: false } },
          { type: 'text', text: ' from ' },
          { type: 'variable', attrs: { id: 'company', required: false } },
        ],
      }],
    });
    const res = await post(app, '/api/v1/templates', { title: 'Hello', content }, OWNER);
    const { template } = await res.json();

    const { html } = await (await get(app, `/api/v1/templates/${template.id}/preview`, OWNER)).json();
    // React leaves `<!-- -->` between adjacent text nodes.
    const text = html.replace(/<!--.*?-->/g, '');
    expect(text).toContain('Hi there from {{company}}');
    expect(text).not.toContain('firstName');
  });

  it('500s when the stored content is corrupt', async () => {
    const template = await createPreviewTemplate();
    await db.update(mails).set({ content: 'not json' }).where(eq(mails.id, template.id));

    const res = await get(app, `/api/v1/templates/${template.id}/preview`, OWNER);
    expect(res.status).toBe(500);
    expect((await res.json()).message).toBe('Template content is corrupt');
  });

  it('still renders when only the theme is corrupt', async () => {
    const template = await createPreviewTemplate({ theme: '{nope' });
    const res = await get(app, `/api/v1/templates/${template.id}/preview`, OWNER);

    expect(res.status).toBe(200);
    expect((await res.json()).html).toContain('Hello thumbnail');
  });

  it('is immutable-cacheable only when ?v matches the current updated_at', async () => {
    const template = await createPreviewTemplate();
    // Drizzle writes NULL for omitted columns, so a fresh insert has no
    // updated_at; give it one so there is a version for ?v to match.
    const updatedAt = '2026-08-29 10:00:00';
    await db.update(mails).set({ updated_at: updatedAt }).where(eq(mails.id, template.id));

    const versioned = await get(
      app,
      `/api/v1/templates/${template.id}/preview?v=${encodeURIComponent(updatedAt)}`,
      OWNER,
    );
    expect(versioned.headers.get('cache-control')).toContain('immutable');

    const unversioned = await get(app, `/api/v1/templates/${template.id}/preview`, OWNER);
    expect(unversioned.headers.get('cache-control')).toBe('no-store');

    // A stale ?v must NOT pin a year of cache — only an exact match may.
    const mismatched = await get(
      app,
      `/api/v1/templates/${template.id}/preview?v=${encodeURIComponent('2020-01-01 00:00:00')}`,
      OWNER,
    );
    expect(mismatched.headers.get('cache-control')).toBe('no-store');
  });
});

describe('POST /api/v1/templates/:id', () => {
  it('updates the template in place', async () => {
    const template = await createTemplate(OWNER, 'Before');

    await post(app, `/api/v1/templates/${template.id}`, { title: 'After', content: '{"v":2}' }, OWNER);

    const { template: updated } = await (await get(app, `/api/v1/templates/${template.id}`, OWNER)).json();
    expect(updated.title).toBe('After');
    expect(updated.content).toBe('{"v":2}');
  });

  it('bumps updated_at on save', async () => {
    const template = await createTemplate(OWNER, 'Before');
    // Pin a past value so the bump is observable regardless of clock granularity.
    await db.update(mails).set({ updated_at: '2020-01-01 00:00:00' }).where(eq(mails.id, template.id));

    await post(app, `/api/v1/templates/${template.id}`, { title: 'After', content: '{}' }, OWNER);

    const [row] = await db.select().from(mails).where(eq(mails.id, template.id));
    expect(row.updated_at! > '2020-01-01 00:00:00').toBe(true);
  });

  it('never snapshots a version — saving is the draft, history is what was published', async () => {
    await givePlan(db, OWNER, 'team');
    const template = await createTemplate(OWNER, 'Before');
    await post(app, `/api/v1/templates/${template.id}`, { title: 'After', content: '{"v":2}' }, OWNER);

    const versions = await db.select().from(templateVersions).where(eq(templateVersions.template_id, template.id));
    expect(versions).toHaveLength(0);
  });

  it('leaves the published copy alone and flags unpublished changes', async () => {
    const template = await createTemplate(OWNER, 'Before');
    expect(template.has_unpublished_changes).toBe(false);

    await post(app, `/api/v1/templates/${template.id}`, { title: 'After', content: '{"v":2}' }, OWNER);

    const { template: row } = await (await get(app, `/api/v1/templates/${template.id}`, OWNER)).json();
    expect(row.content).toBe('{"v":2}');
    expect(row.published_content).toBe('{"type":"doc"}');
    expect(row.has_unpublished_changes).toBe(true);
  });

  it('will not let one user overwrite another user’s template', async () => {
    const template = await createTemplate(OWNER, 'Mine');

    await post(app, `/api/v1/templates/${template.id}`, { title: 'Hijacked', content: '{}' }, OTHER);

    const [row] = await db.select().from(mails).where(eq(mails.id, template.id));
    expect(row.title).toBe('Mine');
  });
});

describe('DELETE /api/v1/templates/:id', () => {
  it('deletes the caller’s own template', async () => {
    const template = await createTemplate(OWNER);
    await del(app, `/api/v1/templates/${template.id}`, OWNER);

    const rows = await db.select().from(mails).where(eq(mails.id, template.id));
    expect(rows).toHaveLength(0);
  });

  it('leaves another user’s template alone', async () => {
    const template = await createTemplate(OWNER);
    await del(app, `/api/v1/templates/${template.id}`, OTHER);

    const rows = await db.select().from(mails).where(eq(mails.id, template.id));
    expect(rows).toHaveLength(1);
  });
});

describe('POST /api/v1/templates/:id/duplicate', () => {
  it('copies the content under a new id and short code', async () => {
    await givePlan(db, OWNER, 'team');
    const template = await createTemplate(OWNER, 'Original');

    const res = await post(app, `/api/v1/templates/${template.id}/duplicate`, {}, OWNER);
    const { template: copy } = await res.json();

    expect(copy.title).toBe('[DUPLICATE] Original');
    expect(copy.content).toBe(template.content);
    expect(copy.id).not.toBe(template.id);
    expect(copy.short_code).not.toBe(template.short_code);
  });

  it('copies the theme along with the content', async () => {
    await givePlan(db, OWNER, 'team');
    const template = await createTemplate(OWNER, 'Branded');
    const theme = '{"container":{"backgroundColor":"#123456"}}';
    await db.update(mails).set({ theme }).where(eq(mails.id, template.id));

    const res = await post(app, `/api/v1/templates/${template.id}/duplicate`, {}, OWNER);
    const { template: copy } = await res.json();

    expect(copy.theme).toBe(theme);
  });

  it('404s when the template belongs to someone else', async () => {
    const template = await createTemplate(OWNER);
    const res = await post(app, `/api/v1/templates/${template.id}/duplicate`, {}, OTHER);
    expect(res.status).toBe(404);
  });

  it('returns 402 when a trial is already at its ten templates', async () => {
    const first = await createTemplate(OWNER, 'Template 0');
    for (let i = 1; i < 10; i++) await createTemplate(OWNER, `Template ${i}`);

    const res = await post(app, `/api/v1/templates/${first.id}/duplicate`, {}, OWNER);
    expect(res.status).toBe(402);
  });
});

describe('POST /api/v1/templates/:id/publish', () => {
  it('copies the draft over the published copy and clears the flag', async () => {
    const template = await createTemplate(OWNER, 'Welcome');
    await post(app, `/api/v1/templates/${template.id}`, { title: 'Welcome', previewText: 'Hi', content: '{"v":2}', theme: '{"x":1}' }, OWNER);

    const res = await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
    expect(res.status).toBe(200);
    const { template: published } = await res.json();
    expect(published.published_content).toBe('{"v":2}');
    expect(published.published_theme).toBe('{"x":1}');
    expect(published.published_preview_text).toBe('Hi');
    expect(published.published_at).toBe(published.updated_at);
    expect(published.has_unpublished_changes).toBe(false);
  });

  it('keeps history on a trial too', async () => {
    const template = await createTemplate(OWNER, 'Welcome');
    await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);

    const versions = await db.select().from(templateVersions).where(eq(templateVersions.template_id, template.id));
    expect(versions).toHaveLength(1);
  });

  it('refuses a read-only workspace, and leaves the live copy as it was', async () => {
    const template = await createTemplate(OWNER, 'Welcome');
    await post(app, `/api/v1/templates/${template.id}`, { title: 'Welcome', content: '{"v":2}' }, OWNER);
    await lapse(db, OWNER);
    const res = await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
    expect(res.status).toBe(402);
    const [row] = await db.select().from(mails).where(eq(mails.id, template.id));
    expect(row.published_content).toBe(template.published_content);
  });

  it('snapshots the published copy for a paid user', async () => {
    await givePlan(db, OWNER, 'team');
    const template = await createTemplate(OWNER, 'Welcome');
    await post(app, `/api/v1/templates/${template.id}`, { title: 'Welcome v2', content: '{"v":2}' }, OWNER);

    await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);

    const versions = await db.select().from(templateVersions).where(eq(templateVersions.template_id, template.id));
    expect(versions).toHaveLength(1);
    expect(versions[0].title).toBe('Welcome v2');
    expect(versions[0].content).toBe('{"v":2}');
    expect(versions[0].version_number).toBe(1);
  });

  it('404s for another user’s template', async () => {
    const template = await createTemplate(OWNER, 'Mine');
    const res = await post(app, `/api/v1/templates/${template.id}/publish`, {}, OTHER);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/templates/:id/discard', () => {
  it('puts the published copy back into the draft and clears the flag', async () => {
    const template = await createTemplate(OWNER, 'Welcome');
    await post(app, `/api/v1/templates/${template.id}`, { title: 'Welcome', content: '{"v":2}' }, OWNER);

    const res = await post(app, `/api/v1/templates/${template.id}/discard`, {}, OWNER);
    expect(res.status).toBe(200);
    const { template: row } = await res.json();
    expect(row.content).toBe('{"type":"doc"}');
    expect(row.has_unpublished_changes).toBe(false);
  });

  it('400s when the template was never published', async () => {
    const template = await createTemplate(OWNER, 'Welcome');
    await db.update(mails).set({ published_at: null, published_content: null }).where(eq(mails.id, template.id));

    const res = await post(app, `/api/v1/templates/${template.id}/discard`, {}, OWNER);
    expect(res.status).toBe(400);
  });
});

describe('share links', () => {
  it('mints a token once and hands the same one back', async () => {
    const template = await createTemplate(OWNER, 'Welcome');
    const first = await (await post(app, `/api/v1/templates/${template.id}/share`, {}, OWNER)).json();
    const second = await (await post(app, `/api/v1/templates/${template.id}/share`, {}, OWNER)).json();
    expect(first.token).toMatch(/^[0-9A-Za-z]{24}$/);
    expect(second.token).toBe(first.token);

    const { template: row } = await (await get(app, `/api/v1/templates/${template.id}`, OWNER)).json();
    expect(row.share_token).toBe(first.token);
  });

  it('turning the link off clears the token, and a new link is a new secret', async () => {
    const template = await createTemplate(OWNER, 'Welcome');
    const { token } = await (await post(app, `/api/v1/templates/${template.id}/share`, {}, OWNER)).json();

    expect((await del(app, `/api/v1/templates/${template.id}/share`, OWNER)).status).toBe(200);
    const [row] = await db.select().from(mails).where(eq(mails.id, template.id));
    expect(row.share_token).toBeNull();

    const { token: next } = await (await post(app, `/api/v1/templates/${template.id}/share`, {}, OWNER)).json();
    expect(next).not.toBe(token);
  });

  it('404s for another user’s template', async () => {
    const template = await createTemplate(OWNER, 'Mine');
    expect((await post(app, `/api/v1/templates/${template.id}/share`, {}, OTHER)).status).toBe(404);
    expect((await del(app, `/api/v1/templates/${template.id}/share`, OTHER)).status).toBe(404);
  });
});

describe('a row another instance published', () => {
  // Every instance keeps its own clock, and rows copied from SQLite carry
  // its stamp format. A save that followed a publish must still stamp later,
  // or the draft could share the published stamp and read as published.
  it('saves with a later stamp even when that clock ran ahead of this one', async () => {
    const ahead = new Date(Date.now() + 2_000).toISOString().replace('T', ' ').slice(0, 19);
    const id = crypto.randomUUID();
    await db.insert(mails).values({ id, user_id: OWNER, org_id: OWNER, title: 'Ahead', content: '{}', short_code: 'tpl_ahead000', updated_at: ahead, published_at: ahead, published_content: '{}' });

    await post(app, `/api/v1/templates/${id}`, { title: 'Ahead', content: '{"v":2}' }, OWNER);

    const { template } = await (await get(app, `/api/v1/templates/${id}`, OWNER)).json();
    expect(Date.parse(template.updated_at)).toBeGreaterThan(Date.parse(`${ahead.replace(' ', 'T')}Z`));
    expect(template.has_unpublished_changes).toBe(true);
  });
});

describe('a row whose published stamp leads its draft stamp', () => {
  // Approving a candidate the draft has moved past, and rolling back, leave
  // published_at later than updated_at. A save or a publish after that must
  // clear both, or it could land on the published stamp and read as in sync.
  it('saves, publishes and restores later than both stamps', async () => {
    const stamp = (offset: number) => new Date(Date.now() + offset).toISOString();
    const id = crypto.randomUUID();
    await db.insert(mails).values({ id, user_id: OWNER, org_id: OWNER, title: 'Leading', content: '{}', short_code: 'tpl_lead0000', updated_at: stamp(-5_000), published_at: stamp(2_000), published_content: '{}' });

    await post(app, `/api/v1/templates/${id}`, { title: 'Leading', content: '{"v":2}' }, OWNER);
    const saved = (await db.select().from(mails).where(eq(mails.id, id)))[0];
    expect(Date.parse(saved.updated_at!)).toBeGreaterThan(Date.parse(saved.published_at!));

    await post(app, `/api/v1/templates/${id}/publish`, {}, OWNER);
    const published = (await db.select().from(mails).where(eq(mails.id, id)))[0];
    expect(Date.parse(published.published_at!)).toBeGreaterThan(Date.parse(saved.published_at!));
    expect(published.published_at).toBe(published.updated_at);

    const [version] = await db.select().from(templateVersions).where(eq(templateVersions.template_id, id));
    const leading = Date.parse(published.published_at!) + 10_000;
    await db.update(mails).set({ updated_at: new Date(leading - 1).toISOString(), published_at: new Date(leading).toISOString() }).where(eq(mails.id, id));
    const response = await post(app, `/api/v1/templates/${id}/versions/${version!.id}/restore`, {}, OWNER);
    const { template: restored } = await response.json();
    expect(Date.parse(restored.updated_at)).toBeGreaterThan(leading);
    expect(restored.has_unpublished_changes).toBe(true);
  });
});

describe('version history', () => {
  /** Publish twice so there is a version to go back to. */
  async function publishedTwice(first: string, second: string, theme?: string) {
    await givePlan(db, OWNER, 'team');
    const template = await createTemplate(OWNER, first);
    await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
    await post(app, `/api/v1/templates/${template.id}`, { title: second, content: '{"v":2}', theme }, OWNER);
    await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
    const { versions } = await (await get(app, `/api/v1/templates/${template.id}/versions`, OWNER)).json();
    return { template, versions };
  }

  it('saves, lists and clears a tag without changing the published snapshot', async () => {
    const { template, versions } = await publishedTwice('First email', 'Second email');
    const id = versions[1].id;
    const before = (await get(app, `/api/v1/templates/${template.id}/versions/${id}`, OWNER)).json();
    const tagged = await post(app, `/api/v1/templates/${template.id}/versions/${id}/tag`, { tag: '  Approved copy  ' }, OWNER);
    expect(tagged.status).toBe(200);
    const { versions: listed } = await (await get(app, `/api/v1/templates/${template.id}/versions`, OWNER)).json();
    expect(listed.find((version: { id: string }) => version.id === id).tag).toBe('Approved copy');
    const { version: original } = await before;
    const { version: after } = await (await get(app, `/api/v1/templates/${template.id}/versions/${id}`, OWNER)).json();
    expect({ ...after, tag: null }).toEqual(original);
    await post(app, `/api/v1/templates/${template.id}/versions/${id}/tag`, { tag: '' }, OWNER);
    const { version: cleared } = await (await get(app, `/api/v1/templates/${template.id}/versions/${id}`, OWNER)).json();
    expect(cleared.tag).toBeNull();
  });

  it('allows only an active workspace admin to tag its own versions', async () => {
    const { template, versions } = await publishedTwice('First email', 'Second email');
    const path = `/api/v1/templates/${template.id}/versions/${versions[0].id}/tag`;
    expect((await post(app, path, { tag: 'Wrong workspace' }, OTHER)).status).toBe(404);
    expect((await post(app, path, { tag: 'Member edit' }, OWNER, { 'x-org-role': 'member' })).status).toBe(403);
    expect((await post(app, path, { tag: 'x'.repeat(49) }, OWNER)).status).toBe(400);
    expect((await post(app, path, { tag: 'Signed out' })).status).toBe(401);
    await db.update(subscriptions).set({ status: 'canceled' }).where(eq(subscriptions.org_id, OWNER));
    expect((await post(app, path, { tag: 'Read only' }, OWNER)).status).toBe(402);
  });

  it('previews the saved email and theme after the draft has changed, scoped to its workspace', async () => {
    const content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved email words' }] }] });
    const template = await createTemplate(OWNER, 'Preview test');
    await post(app, `/api/v1/templates/${template.id}`, { title: 'Preview test', content, theme: '{"container":{"backgroundColor":"#ffeedd"}}' }, OWNER);
    await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
    const { versions } = await (await get(app, `/api/v1/templates/${template.id}/versions`, OWNER)).json();
    await post(app, `/api/v1/templates/${template.id}`, { title: 'Changed draft', content: '{"type":"doc"}', theme: '{}' }, OWNER);
    const path = `/api/v1/templates/${template.id}/versions/${versions[0].id}/preview`;
    const response = await get(app, path, OWNER);
    expect(response.status).toBe(200);
    const { html } = await response.json();
    expect(html).toContain('Saved email words');
    expect(html).toContain('#ffeedd');
    expect((await get(app, path, OTHER)).status).toBe(404);
    expect((await get(app, path)).status).toBe(401);
    await db.update(templateVersions).set({ content: 'broken' }).where(eq(templateVersions.id, versions[0].id));
    expect((await get(app, path, OWNER)).status).toBe(400);
  });

  it('numbers each publish and lists the newest ten, newest first, however fast they land', async () => {
    await givePlan(db, OWNER, 'team');
    const template = await createTemplate(OWNER, 'Rapid');
    for (let i = 0; i < 12; i++) await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
    const { versions } = await (await get(app, `/api/v1/templates/${template.id}/versions`, OWNER)).json();
    expect(versions.map((v: { version_number: number }) => v.version_number)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  });

  it('keeps fifty with a template pack', async () => {
    await givePlan(db, OWNER, 'team', 'active', { templatePacks: 1 });
    const template = await createTemplate(OWNER, 'Rapid');
    for (let i = 0; i < 12; i++) await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
    const stored = await db.select().from(templateVersions).where(eq(templateVersions.template_id, template.id));
    expect(stored).toHaveLength(12);
  });

  describe('a version an app pins', () => {
    const dayMs = 86_400_000;
    const daysAgo = (days: number) => new Date(Date.now() - days * dayMs).toISOString();

    /** v1 and v2 are published, then pinned as given; ten more publishes push both out of the newest ten. */
    async function publishPastPinned(pinned: { v1: string | null; v2: string | null }) {
      await givePlan(db, OWNER, 'team');
      const template = await createTemplate(OWNER, 'Pinned');
      for (let i = 0; i < 2; i++) await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
      await db.update(templateVersions).set({ pinned_at: pinned.v1 }).where(eq(templateVersions.version_number, 1));
      await db.update(templateVersions).set({ pinned_at: pinned.v2 }).where(eq(templateVersions.version_number, 2));
      for (let i = 0; i < 10; i++) await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
      const stored = await db.select().from(templateVersions).where(eq(templateVersions.template_id, template.id));
      return stored.map((v) => v.version_number).sort((a, b) => a - b);
    }

    it('outlives the plan’s limit while it is in use, and goes once it has not been pinned for the window', async () => {
      const kept = await publishPastPinned({ v1: daysAgo(5), v2: daysAgo(40) });
      expect(kept).toEqual([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('is pruned like any other when nothing ever pinned it', async () => {
      const kept = await publishPastPinned({ v1: null, v2: null });
      expect(kept).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('does not move what a rollback goes back to', async () => {
      await givePlan(db, OWNER, 'team');
      const template = await createTemplate(OWNER, 'Rolled');
      for (let i = 0; i < 3; i++) await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
      await db.update(templateVersions).set({ pinned_at: daysAgo(1) }).where(eq(templateVersions.version_number, 1));

      expect((await post(app, `/api/v1/templates/${template.id}/rollback`, {}, OWNER)).status).toBe(200);
      const { template: after } = await (await get(app, `/api/v1/templates/${template.id}`, OWNER)).json();
      expect(after.live_version).toBe(4);
    });
  });

  it('restores an earlier version into the draft without snapshotting or publishing', async () => {
    const { template, versions } = await publishedTwice('Version one', 'Version two');
    expect(versions).toHaveLength(2);
    const older = versions.find((v: { title: string }) => v.title === 'Version one');

    await post(app, `/api/v1/templates/${template.id}/versions/${older.id}/restore`, {}, OWNER);

    const { template: restored } = await (await get(app, `/api/v1/templates/${template.id}`, OWNER)).json();
    expect(restored.title).toBe('Version one');
    expect(restored.published_content).toBe('{"v":2}');
    expect(restored.has_unpublished_changes).toBe(true);

    const all = await db.select().from(templateVersions).where(eq(templateVersions.template_id, template.id));
    expect(all).toHaveLength(2);
  });

  it('hands the restored template back in the response', async () => {
    // The editor that asked for the restore is holding the document this
    // just replaced, and it repaints from this body rather than reloading.
    const { template, versions } = await publishedTwice('Version one', 'Version two');
    const older = versions.find((v: { title: string }) => v.title === 'Version one');

    const res = await post(app, `/api/v1/templates/${template.id}/versions/${older.id}/restore`, {}, OWNER);
    expect(res.status).toBe(200);
    const { template: restored } = await res.json();
    expect(restored.id).toBe(template.id);
    expect(restored.title).toBe('Version one');
    expect(restored.content).toBe('{"type":"doc"}');
    expect(restored.published_content).toBe('{"v":2}');
    expect(restored.has_unpublished_changes).toBe(true);
  });

  it('snapshots the theme and restores it with the content', async () => {
    const blue = '{"container":{"backgroundColor":"#0000ff"}}';
    const red = '{"container":{"backgroundColor":"#ff0000"}}';
    await givePlan(db, OWNER, 'team');
    const template = await createTemplate(OWNER, 'Branded v1');
    await post(app, `/api/v1/templates/${template.id}`, { title: 'Branded v1', content: '{}', theme: blue }, OWNER);
    await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
    await post(app, `/api/v1/templates/${template.id}`, { title: 'Branded v2', content: '{}', theme: red }, OWNER);
    await post(app, `/api/v1/templates/${template.id}/publish`, {}, OWNER);
    const { versions } = await (await get(app, `/api/v1/templates/${template.id}/versions`, OWNER)).json();
    const blueVersion = versions.find((v: { title: string }) => v.title === 'Branded v1');

    await post(app, `/api/v1/templates/${template.id}/versions/${blueVersion.id}/restore`, {}, OWNER);
    const { template: restored } = await (await get(app, `/api/v1/templates/${template.id}`, OWNER)).json();
    expect(restored.theme).toBe(blue);
  });

  it('a pre-theme snapshot leaves the current theme alone on restore', async () => {
    const red = '{"container":{"backgroundColor":"#ff0000"}}';
    const { template, versions } = await publishedTwice('Legacy v1', 'Legacy v2', red);
    const older = versions.find((v: { title: string }) => v.title === 'Legacy v1');

    // Erase the snapshot's theme, as any version from before the column did.
    await db.update(templateVersions).set({ theme: null }).where(eq(templateVersions.id, older.id));

    await post(app, `/api/v1/templates/${template.id}/versions/${older.id}/restore`, {}, OWNER);
    const { template: restored } = await (await get(app, `/api/v1/templates/${template.id}`, OWNER)).json();
    expect(restored.title).toBe('Legacy v1');
    expect(restored.theme).toBe(red);
  });

  it('404s when restoring a version owned by another user', async () => {
    const { template, versions } = await publishedTwice('Version one', 'Version two');

    const res = await post(app, `/api/v1/templates/${template.id}/versions/${versions[0].id}/restore`, {}, OTHER);
    expect(res.status).toBe(404);
  });

  it('lists nothing for a template in another workspace', async () => {
    const { template } = await publishedTwice('Version one', 'Version two');

    const { versions } = await (await get(app, `/api/v1/templates/${template.id}/versions`, OTHER)).json();
    expect(versions).toEqual([]);
  });
});

// The pipeline: a member stages the draft and asks, an admin approves or
// sends it back. MEMBER sits in OWNER's workspace without its admin role;
// OTHER is an admin of a workspace of their own.
describe('staging and sign-off', () => {
  const MEMBER = 'user_member';
  const asMember = { 'x-org-id': OWNER, 'x-org-role': 'member' };
  const CANDIDATE = [
    'staged_content', 'staged_theme', 'staged_preview_text', 'staged_at', 'staged_by',
    'review_requested_at', 'review_requested_by', 'returned_at', 'returned_by', 'return_note',
  ] as const;
  const ADMIN_ONLY = ['approve', 'send-back', 'rollback', 'publish'] as const;
  const ALL_ACTIONS = ['stage', 'unstage', 'request-signoff', 'approve', 'send-back', 'rollback'] as const;

  const act = (id: string, action: string, body: unknown = {}, userId = OWNER, headers: Record<string, string> = {}) =>
    post(app, `/api/v1/templates/${id}/${action}`, body, userId, headers);
  const asAdmin = (id: string, action: string, body: unknown = {}) => act(id, action, body, OWNER);
  const byMember = (id: string, action: string, body: unknown = {}) => act(id, action, body, MEMBER, asMember);
  const saveDraft = (id: string, fields: { content?: string; theme?: string; previewText?: string } = {}) =>
    post(app, `/api/v1/templates/${id}`, { title: 'Welcome', content: '{"v":2}', ...fields }, MEMBER, asMember);
  const stored = async (id: string) => (await db.select().from(mails).where(eq(mails.id, id)))[0];
  const versionsOf = (id: string) => db.select().from(templateVersions).where(eq(templateVersions.template_id, id));
  const candidateOf = (row: Record<string, unknown>) => Object.fromEntries(CANDIDATE.map((key) => [key, row[key]]));
  const noCandidate = Object.fromEntries(CANDIDATE.map((key) => [key, null]));
  const message = async (res: Response) => (await res.json()).message as string;

  /** A published template whose draft has moved off what is live. */
  async function edited(fields: { content?: string; theme?: string; previewText?: string } = {}) {
    const template = await createTemplate(OWNER, 'Welcome');
    await saveDraft(template.id, { previewText: 'Hi', theme: '{"x":1}', ...fields });
    return template.id as string;
  }
  async function staged(fields: { content?: string; theme?: string; previewText?: string } = {}) {
    const id = await edited(fields);
    expect((await byMember(id, 'stage')).status).toBe(200);
    return id;
  }
  async function waiting(fields: { content?: string; theme?: string; previewText?: string } = {}) {
    const id = await staged(fields);
    expect((await byMember(id, 'request-signoff')).status).toBe(200);
    return id;
  }
  /** v1 is the first publish, v2 the second; the draft ends level with v2. */
  async function publishedTwice() {
    const template = await createTemplate(OWNER, 'Welcome');
    await asAdmin(template.id, 'publish');
    await saveDraft(template.id, { content: '{"v":2}' });
    await asAdmin(template.id, 'publish');
    return template.id as string;
  }

  describe('POST /api/v1/templates/:id/stage', () => {
    it('snapshots the draft into the candidate and leaves what is live alone', async () => {
      const id = await edited();
      const res = await byMember(id, 'stage');

      expect(res.status).toBe(200);
      const { template } = await res.json();
      expect(template.stage).toBe('staging');
      expect(template.staged_content).toBe('{"v":2}');
      expect(template.staged_theme).toBe('{"x":1}');
      expect(template.staged_preview_text).toBe('Hi');
      expect(template.staged_by).toBe(MEMBER);
      expect(template.staged_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(template.review_requested_at).toBeNull();
      expect(template.published_content).toBe('{"type":"doc"}');
      expect(template.has_unpublished_changes).toBe(true);
      expect(await versionsOf(id)).toHaveLength(0);
    });

    it('keeps the candidate as it was when the draft moves on', async () => {
      const id = await staged();
      await saveDraft(id, { content: '{"v":3}' });
      const row = await stored(id);
      expect(row.content).toBe('{"v":3}');
      expect(row.staged_content).toBe('{"v":2}');
    });

    it('stages a template that was never published', async () => {
      const template = await createTemplate(OWNER, 'Welcome');
      await db.update(mails).set({ published_at: null, published_content: null }).where(eq(mails.id, template.id));
      const res = await byMember(template.id, 'stage');
      expect(res.status).toBe(200);
      expect((await res.json()).template.stage).toBe('staging');
    });

    it('replaces the candidate when staged again, and clears a send-back', async () => {
      const id = await staged();
      const first = await stored(id);
      await byMember(id, 'request-signoff');
      await asAdmin(id, 'send-back', { note: 'Fix the footer' });
      await saveDraft(id, { content: '{"v":3}' });

      const res = await byMember(id, 'stage');
      expect(res.status).toBe(200);
      const row = await stored(id);
      expect(row.staged_content).toBe('{"v":3}');
      expect(row.staged_at! > first.staged_at!).toBe(true);
      expect(row.review_requested_at).toBeNull();
      expect(row.review_requested_by).toBeNull();
      expect(row.returned_at).toBeNull();
      expect(row.returned_by).toBeNull();
      expect(row.return_note).toBeNull();
      expect((await res.json()).template.stage).toBe('staging');
    });

    it('refuses while an admin is looking at it, and keeps the candidate', async () => {
      const id = await waiting();
      await saveDraft(id, { content: '{"v":3}' });
      const before = candidateOf(await stored(id));

      const res = await byMember(id, 'stage');
      expect(res.status).toBe(409);
      expect(await message(res)).toBe('This template is waiting for sign-off. Ask an admin to send it back, or remove the staged copy first.');
      expect(candidateOf(await stored(id))).toEqual(before);
    });

    it('refuses when the draft is what is live', async () => {
      const template = await createTemplate(OWNER, 'Welcome');
      const res = await byMember(template.id, 'stage');
      expect(res.status).toBe(400);
      expect(await message(res)).toBe('There is nothing to stage. The draft matches what is live.');
      expect(candidateOf(await stored(template.id))).toEqual(noCandidate);
    });
  });

  describe('POST /api/v1/templates/:id/unstage', () => {
    it('takes the candidate back and leaves the draft and what is live as they were', async () => {
      const id = await staged();
      const before = await stored(id);

      const res = await byMember(id, 'unstage');
      expect(res.status).toBe(200);
      const { template } = await res.json();
      expect(candidateOf(template)).toEqual(noCandidate);
      expect(template.stage).toBe('draft');

      const row = await stored(id);
      expect(candidateOf(row)).toEqual(noCandidate);
      expect(row.content).toBe(before.content);
      expect(row.updated_at).toBe(before.updated_at);
      expect(row.published_content).toBe(before.published_content);
      expect(row.published_at).toBe(before.published_at);
      expect(await versionsOf(id)).toHaveLength(0);
    });

    it('lets the member who asked for sign-off withdraw the request, without an admin', async () => {
      const id = await waiting();
      const res = await byMember(id, 'unstage');
      expect(res.status).toBe(200);
      expect(candidateOf(await stored(id))).toEqual(noCandidate);
    });

    it('drops a send-back with the candidate it was about', async () => {
      const id = await waiting();
      await asAdmin(id, 'send-back', { note: 'Not yet' });
      expect((await byMember(id, 'unstage')).status).toBe(200);
      expect(candidateOf(await stored(id))).toEqual(noCandidate);
    });

    it('returns a template with nothing unpublished to live', async () => {
      const id = await staged();
      await asAdmin(id, 'discard');
      const { template } = await (await byMember(id, 'unstage')).json();
      expect(template.stage).toBe('live');
    });

    it('refuses when nothing is staged', async () => {
      const id = await edited();
      const res = await byMember(id, 'unstage');
      expect(res.status).toBe(409);
      expect(await message(res)).toBe('There is no staged copy to remove.');
    });

    it('lets the draft be staged again, with a stamp later than the one it took back', async () => {
      const id = await staged();
      const first = (await stored(id)).staged_at!;
      await byMember(id, 'unstage');
      await saveDraft(id, { content: '{"v":3}' });

      expect((await byMember(id, 'stage')).status).toBe(200);
      const row = await stored(id);
      expect(row.staged_content).toBe('{"v":3}');
      expect(row.staged_at! > first).toBe(true);
    });
  });

  describe('POST /api/v1/templates/:id/request-signoff', () => {
    it('asks an admin to look, and records who asked', async () => {
      const id = await staged();
      const candidate = (await stored(id)).staged_content;
      const res = await byMember(id, 'request-signoff');

      expect(res.status).toBe(200);
      const { template } = await res.json();
      expect(template.stage).toBe('waiting');
      expect(template.review_requested_by).toBe(MEMBER);
      expect(template.review_requested_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(template.staged_content).toBe(candidate);
    });

    it('asks again after a send-back, and clears what the admin said', async () => {
      const id = await waiting();
      await asAdmin(id, 'send-back', { note: 'Shorter subject' });
      const res = await byMember(id, 'request-signoff');

      expect(res.status).toBe(200);
      const { template } = await res.json();
      expect(template.stage).toBe('waiting');
      expect(template.returned_at).toBeNull();
      expect(template.returned_by).toBeNull();
      expect(template.return_note).toBeNull();
    });

    it('refuses when nothing is staged', async () => {
      const id = await edited();
      const res = await byMember(id, 'request-signoff');
      expect(res.status).toBe(409);
      expect(await message(res)).toBe('Move this template to staging before asking for sign-off.');
      expect((await stored(id)).review_requested_at).toBeNull();
    });

    it('refuses when it is already waiting, and keeps the first request', async () => {
      const id = await waiting();
      const before = await stored(id);
      const res = await act(id, 'request-signoff', {}, OWNER);
      expect(res.status).toBe(409);
      expect(await message(res)).toBe('This template is already waiting for sign-off.');
      const after = await stored(id);
      expect(after.review_requested_at).toBe(before.review_requested_at);
      expect(after.review_requested_by).toBe(MEMBER);
    });
  });

  describe('POST /api/v1/templates/:id/approve', () => {
    it('fences off a cleared candidate cache key from an instance whose clock was ahead', async () => {
      for (const action of ['approve', 'publish']) {
        const id = await waiting();
        const future = new Date(Math.max(Date.now(), Date.parse((await stored(id)).updated_at)) + 60_000).toISOString();
        await db.update(mails).set({ staged_at: future, review_requested_at: future }).where(eq(mails.id, id));
        const { template: live } = await (await asAdmin(id, action)).json();
        expect(Date.parse(live.published_at)).toBeGreaterThan(Date.parse(future));
        await saveDraft(id, { content: '{"v":3}' });
        const { template: candidate } = await (await byMember(id, 'stage')).json();
        expect(Date.parse(candidate.staged_at)).toBeGreaterThan(Date.parse(live.published_at));
      }
    });
    it('refuses a stale review after the candidate was replaced and asked for again', async () => {
      const id = await waiting();
      const original = await stored(id);
      await asAdmin(id, 'send-back');
      await byMember(id, 'stage');
      await byMember(id, 'request-signoff');
      const before = await stored(id);
      expect((await asAdmin(id, 'approve', { stagedAt: original.staged_at })).status).toBe(409);
      expect((await asAdmin(id, 'send-back', { stagedAt: original.staged_at, note: 'Old review' })).status).toBe(409);
      expect(await stored(id)).toEqual(before);
      expect((await asAdmin(id, 'approve', { stagedAt: before.staged_at })).status).toBe(200);
    });
    it('publishes the candidate, snapshots it once and clears the candidate', async () => {
      const id = await waiting();
      const res = await asAdmin(id, 'approve');

      expect(res.status).toBe(200);
      const { template } = await res.json();
      expect(template.published_content).toBe('{"v":2}');
      expect(template.published_theme).toBe('{"x":1}');
      expect(template.published_preview_text).toBe('Hi');
      expect(template.stage).toBe('live');
      expect(template.live_version).toBe(1);
      expect(template.has_unpublished_changes).toBe(false);
      expect(template.published_at).toBe(template.updated_at);
      expect(candidateOf(template)).toEqual(noCandidate);

      const versions = await versionsOf(id);
      expect(versions).toHaveLength(1);
      expect(versions[0].version_number).toBe(1);
      expect(versions[0].content).toBe('{"v":2}');
      expect(versions[0].theme).toBe('{"x":1}');
      expect(versions[0].preview_text).toBe('Hi');
    });

    it('ships the candidate, not a draft that moved after it, and reads as unpublished changes', async () => {
      const id = await waiting();
      await saveDraft(id, { content: '{"v":3}', theme: '{"x":1}', previewText: 'Hi' });

      const { template } = await (await asAdmin(id, 'approve')).json();
      expect(template.published_content).toBe('{"v":2}');
      expect(template.content).toBe('{"v":3}');
      expect(template.has_unpublished_changes).toBe(true);
      expect(template.stage).toBe('draft');
      expect(Date.parse(template.published_at)).toBeGreaterThan(Date.parse(template.updated_at));
      expect((await versionsOf(id))[0].content).toBe('{"v":2}');
    });

    it('reads as unpublished changes when only the theme or the preview text moved', async () => {
      const themed = await waiting();
      await saveDraft(themed, { content: '{"v":2}', theme: '{"x":2}', previewText: 'Hi' });
      expect((await (await asAdmin(themed, 'approve')).json()).template.has_unpublished_changes).toBe(true);

      const previewed = await waiting();
      await saveDraft(previewed, { content: '{"v":2}', theme: '{"x":1}', previewText: 'Changed' });
      expect((await (await asAdmin(previewed, 'approve')).json()).template.has_unpublished_changes).toBe(true);
    });

    it('reads as in sync when a draft with no theme or preview text has not moved', async () => {
      const template = await createTemplate(OWNER, 'Plain');
      await post(app, `/api/v1/templates/${template.id}`, { title: 'Plain', content: '{"v":2}' }, MEMBER, asMember);
      await byMember(template.id, 'stage');
      await byMember(template.id, 'request-signoff');
      const { template: approved } = await (await asAdmin(template.id, 'approve')).json();
      expect(approved.has_unpublished_changes).toBe(false);
      expect(approved.stage).toBe('live');
    });

    it('is for admins: a member is told who can, and nothing changes', async () => {
      const id = await waiting();
      const before = await stored(id);
      const res = await byMember(id, 'approve');

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('admin-only');
      expect(body.message).toBe('Only an admin can approve templates. Ask an admin on your team.');
      expect(await stored(id)).toEqual(before);
      expect(await versionsOf(id)).toHaveLength(0);
    });

    it('refuses a template that is not waiting', async () => {
      const id = await staged();
      const res = await asAdmin(id, 'approve');
      expect(res.status).toBe(409);
      expect(await message(res)).toBe('This template is not waiting for sign-off.');
      expect((await stored(id)).published_content).toBe('{"type":"doc"}');

      const live = await createTemplate(OWNER, 'Live');
      expect((await asAdmin(live.id, 'approve')).status).toBe(409);
      expect(await versionsOf(live.id)).toHaveLength(0);
    });
  });

  describe('POST /api/v1/templates/:id/send-back', () => {
    it('returns the candidate to staging with the note, and leaves what is live alone', async () => {
      const id = await waiting();
      const before = await stored(id);
      const res = await asAdmin(id, 'send-back', { note: '  Check the footer links  ' });

      expect(res.status).toBe(200);
      const { template } = await res.json();
      expect(template.stage).toBe('staging');
      expect(template.returned_by).toBe(OWNER);
      expect(template.returned_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(template.return_note).toBe('Check the footer links');
      expect(template.review_requested_at).toBeNull();
      expect(template.review_requested_by).toBeNull();
      expect(template.staged_content).toBe(before.staged_content);
      expect(template.staged_at).toBe(before.staged_at);
      expect(template.staged_by).toBe(MEMBER);
      expect(template.published_content).toBe('{"type":"doc"}');
      expect(await versionsOf(id)).toHaveLength(0);
    });

    it('takes no note, or a blank one', async () => {
      const bare = await waiting();
      expect((await (await asAdmin(bare, 'send-back', {})).json()).template.return_note).toBeNull();

      const blank = await waiting();
      expect((await (await asAdmin(blank, 'send-back', { note: '   ' })).json()).template.return_note).toBeNull();
    });

    it('takes a request with no body at all', async () => {
      const id = await waiting();
      const res = await app.handle(
        new Request(`http://localhost/api/v1/templates/${id}/send-back`, {
          method: 'POST',
          headers: { 'x-user-id': OWNER, 'x-org-id': OWNER, 'x-org-role': 'admin' },
        }),
      );
      expect(res.status).toBe(200);
    });

    it('refuses a note past 500 characters', async () => {
      const id = await waiting();
      expect((await asAdmin(id, 'send-back', { note: 'x'.repeat(500) })).status).toBe(200);
      const again = await waiting();
      expect((await asAdmin(again, 'send-back', { note: 'x'.repeat(501) })).status).toBe(400);
      expect((await stored(again)).returned_at).toBeNull();
    });

    it('is for admins: a member is told who can, and the review stays open', async () => {
      const id = await waiting();
      const res = await byMember(id, 'send-back', { note: 'No' });
      expect(res.status).toBe(403);
      expect((await res.json()).message).toBe('Only an admin can send templates back. Ask an admin on your team.');
      expect((await stored(id)).review_requested_at).not.toBeNull();
      expect((await stored(id)).returned_at).toBeNull();
    });

    it('refuses a template that is not waiting', async () => {
      const id = await staged();
      const res = await asAdmin(id, 'send-back', { note: 'Why' });
      expect(res.status).toBe(409);
      expect(await message(res)).toBe('This template is not waiting for sign-off.');
      expect((await stored(id)).returned_at).toBeNull();
    });
  });

  describe('POST /api/v1/templates/:id/rollback', () => {
    it('refuses to roll back a live copy that changed since the page loaded', async () => {
      const id = await publishedTwice();
      const original = await stored(id);
      await asAdmin(id, 'publish');
      const before = await stored(id);
      expect((await asAdmin(id, 'rollback', { publishedAt: original.published_at })).status).toBe(409);
      expect(await stored(id)).toEqual(before);
      expect((await asAdmin(id, 'rollback', { publishedAt: before.published_at })).status).toBe(200);
    });
    it('puts the version before the live one back on the API, and leaves the draft', async () => {
      const id = await publishedTwice();
      await saveDraft(id, { content: '{"v":3}' });
      const res = await asAdmin(id, 'rollback');

      expect(res.status).toBe(200);
      const { template } = await res.json();
      expect(template.published_content).toBe('{"type":"doc"}');
      expect(template.content).toBe('{"v":3}');
      expect(template.has_unpublished_changes).toBe(true);
      expect(template.stage).toBe('draft');
      expect(Date.parse(template.published_at)).toBeGreaterThan(Date.parse(template.updated_at));
    });

    it('snapshots what it put live as a new version', async () => {
      const id = await publishedTwice();
      const { template } = await (await asAdmin(id, 'rollback')).json();

      const versions = (await versionsOf(id)).sort((a, b) => a.version_number - b.version_number);
      expect(versions.map((v) => v.version_number)).toEqual([1, 2, 3]);
      expect(versions[2].content).toBe('{"type":"doc"}');
      expect(versions[2].content).toBe(versions[0].content);
      expect(template.live_version).toBe(3);
    });

    it('reads as in sync when the draft already is what it put live', async () => {
      const id = await publishedTwice();
      await saveDraft(id, { content: '{"type":"doc"}' });

      const { template } = await (await asAdmin(id, 'rollback')).json();
      expect(template.has_unpublished_changes).toBe(false);
      expect(template.stage).toBe('live');
    });

    it('leaves a pending candidate where it was', async () => {
      const id = await publishedTwice();
      await saveDraft(id, { content: '{"v":3}' });
      await byMember(id, 'stage');
      await byMember(id, 'request-signoff');
      const before = candidateOf(await stored(id));

      const { template } = await (await asAdmin(id, 'rollback')).json();
      expect(candidateOf(template)).toEqual(before);
      expect(template.stage).toBe('waiting');
    });

    it('keeps the live theme when the earlier version predates themes', async () => {
      const id = await publishedTwice();
      const live = (await stored(id)).published_theme;
      await db.update(templateVersions).set({ theme: null }).where(eq(templateVersions.template_id, id));

      const { template } = await (await asAdmin(id, 'rollback')).json();
      expect(template.published_theme).toBe(live);
      expect(template.published_content).toBe('{"type":"doc"}');
    });

    it('refuses with a plain message when there is no earlier version', async () => {
      const none = await createTemplate(OWNER, 'Never published by hand');
      const res = await asAdmin(none.id, 'rollback');
      expect(res.status).toBe(400);
      expect(await message(res)).toBe('There is no earlier version to roll back to.');

      const one = await createTemplate(OWNER, 'Published once');
      await asAdmin(one.id, 'publish');
      expect((await asAdmin(one.id, 'rollback')).status).toBe(400);
      expect(await versionsOf(one.id)).toHaveLength(1);
      expect((await stored(one.id)).published_content).toBe('{"type":"doc"}');
    });

    it('is for admins: a member is told who can, and nothing changes', async () => {
      const id = await publishedTwice();
      const before = await stored(id);
      const res = await byMember(id, 'rollback');
      expect(res.status).toBe(403);
      expect((await res.json()).message).toBe('Only an admin can roll templates back. Ask an admin on your team.');
      expect(await stored(id)).toEqual(before);
      expect(await versionsOf(id)).toHaveLength(2);
    });
  });

  describe('POST /api/v1/templates/:id/publish', () => {
    it('is for admins: a member is told who can, and what is live stays', async () => {
      const id = await edited();
      const res = await byMember(id, 'publish');
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('admin-only');
      expect(body.message).toBe('Only an admin can publish templates. Ask an admin on your team.');
      expect((await stored(id)).published_content).toBe('{"type":"doc"}');
      expect(await versionsOf(id)).toHaveLength(0);
    });

    it('clears a candidate that was staged or waiting', async () => {
      for (const ask of [false, true]) {
        const id = ask ? await waiting() : await staged();
        await saveDraft(id, { content: '{"v":3}' });
        const { template } = await (await asAdmin(id, 'publish')).json();

        expect(candidateOf(template)).toEqual(noCandidate);
        expect(template.stage).toBe('live');
        expect(template.published_content).toBe('{"v":3}');
        expect(template.live_version).toBe(1);
      }
    });

    it('clears a send-back too', async () => {
      const id = await waiting();
      await asAdmin(id, 'send-back', { note: 'Not yet' });
      const { template } = await (await asAdmin(id, 'publish')).json();
      expect(candidateOf(template)).toEqual(noCandidate);
    });
  });

  describe('what a template says about itself', () => {
    it('carries its stage and live version on every response that returns it', async () => {
      const created = await createTemplate(OWNER, 'Welcome');
      expect(created.stage).toBe('live');
      expect(created.live_version).toBeNull();

      const fetched = (await (await get(app, `/api/v1/templates/${created.id}`, OWNER)).json()).template;
      expect(fetched.stage).toBe('live');
      expect(fetched.live_version).toBeNull();

      await saveDraft(created.id);
      const discarded = (await (await asAdmin(created.id, 'discard')).json()).template;
      expect(discarded.stage).toBe('live');

      const duplicated = (await (await asAdmin(created.id, 'duplicate')).json()).template;
      expect(duplicated.stage).toBe('live');
      expect(duplicated.live_version).toBeNull();

      const id = await publishedTwice();
      const { versions } = await (await get(app, `/api/v1/templates/${id}/versions`, OWNER)).json();
      const restored = (await (await act(id, `versions/${versions[1].id}/restore`)).json()).template;
      expect(restored.stage).toBe('draft');
      expect(restored.live_version).toBe(2);
    });

    it('moves through the stages as the pipeline does', async () => {
      const id = await edited();
      const stageOf = async () => (await (await get(app, `/api/v1/templates/${id}`, OWNER)).json()).template.stage;
      expect(await stageOf()).toBe('draft');
      await byMember(id, 'stage');
      expect(await stageOf()).toBe('staging');
      await byMember(id, 'request-signoff');
      expect(await stageOf()).toBe('waiting');
      await asAdmin(id, 'send-back');
      expect(await stageOf()).toBe('staging');
      await byMember(id, 'request-signoff');
      await asAdmin(id, 'approve');
      expect(await stageOf()).toBe('live');
    });

    it('lists each row with its stage, live version and review stamps, and still no document', async () => {
      const live = await createTemplate(OWNER, 'Live');
      await asAdmin(live.id, 'publish');
      const draft = await createTemplate(OWNER, 'Draft');
      await saveDraft(draft.id);
      const inStaging = await staged();
      const inReview = await waiting();
      await asAdmin(inReview, 'send-back', { note: 'Again' });
      await byMember(inReview, 'request-signoff');

      const { templates } = await (await get(app, '/api/v1/templates', OWNER)).json();
      const byId = (id: string) => templates.find((t: { id: string }) => t.id === id);
      expect(byId(live.id)).toMatchObject({ stage: 'live', live_version: 1, staged_at: null, review_requested_at: null, returned_at: null });
      expect(byId(draft.id)).toMatchObject({ stage: 'draft', live_version: null });
      expect(byId(inStaging)).toMatchObject({ stage: 'staging', live_version: null, review_requested_at: null });
      expect(byId(inStaging).staged_at).not.toBeNull();
      expect(byId(inReview)).toMatchObject({ stage: 'waiting', review_requested_by: MEMBER, returned_at: null });
      expect(byId(inReview).review_requested_at).not.toBeNull();

      for (const row of templates) {
        for (const heavy of ['content', 'theme', 'published_content', 'staged_content', 'staged_theme', 'return_note', 'share_token']) {
          expect(row).not.toHaveProperty(heavy);
        }
      }
    });

    it('lists the newest version number as the live version', async () => {
      const id = await publishedTwice();
      await asAdmin(id, 'rollback');
      const { templates } = await (await get(app, '/api/v1/templates', OWNER)).json();
      expect(templates.find((t: { id: string }) => t.id === id).live_version).toBe(3);
    });
  });

  describe('GET /api/v1/templates/:id/preview?copy=', () => {
    const docOf = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    const previewOf = (id: string, query: string, userId = OWNER) => get(app, `/api/v1/templates/${id}/preview${query}`, userId);

    /** Live says "Live words", the candidate "Staged words", the draft "Draft words". */
    async function threeCopies() {
      const res = await post(app, '/api/v1/templates', { title: 'Welcome', content: docOf('Live words') }, OWNER);
      const id = (await res.json()).template.id as string;
      await saveDraft(id, { content: docOf('Staged words') });
      await byMember(id, 'stage');
      await saveDraft(id, { content: docOf('Draft words') });
      return id;
    }

    it('renders the draft by default and when asked for it', async () => {
      const id = await threeCopies();
      expect((await (await previewOf(id, '')).json()).html).toContain('Draft words');
      expect((await (await previewOf(id, '?copy=draft')).json()).html).toContain('Draft words');
    });

    it('renders the candidate for staged and what is live for live', async () => {
      const id = await threeCopies();
      const staged = await (await previewOf(id, '?copy=staged')).json();
      expect(staged.html).toContain('Staged words');
      expect(staged.html).not.toContain('Draft words');
      const live = await (await previewOf(id, '?copy=live')).json();
      expect(live.html).toContain('Live words');
      expect(live.html).not.toContain('Staged words');
    });

    it('answers 404 with a plain message when there is nothing staged', async () => {
      const template = await createTemplate(OWNER, 'Welcome');
      const res = await previewOf(template.id, '?copy=staged');
      expect(res.status).toBe(404);
      expect(await message(res)).toBe('Nothing is staged for this template.');
    });

    it('answers 404 with a plain message when it was never published', async () => {
      const template = await createTemplate(OWNER, 'Welcome');
      await db.update(mails).set({ published_at: null, published_content: null }).where(eq(mails.id, template.id));
      const res = await previewOf(template.id, '?copy=live');
      expect(res.status).toBe(404);
      expect(await message(res)).toBe('This template has not been published.');
      expect((await previewOf(template.id, '?copy=draft')).status).toBe(200);
    });

    it('refuses a copy it does not know', async () => {
      const template = await createTemplate(OWNER, 'Welcome');
      expect((await previewOf(template.id, '?copy=archive')).status).toBe(400);
    });

    it('keys the cache on the stamp that copy changes with', async () => {
      const id = await threeCopies();
      const row = await stored(id);
      const key = (stamp: string | null) => `&v=${encodeURIComponent(stamp!)}`;
      const cacheOf = async (copy: string, stamp: string | null) => (await previewOf(id, `?copy=${copy}${key(stamp)}`)).headers.get('cache-control');

      expect(await cacheOf('staged', row.staged_at)).toContain('immutable');
      expect(await cacheOf('staged', row.updated_at)).toBe('no-store');
      expect(await cacheOf('live', row.published_at)).toContain('immutable');
      expect(await cacheOf('live', row.updated_at)).toBe('no-store');
      expect(await cacheOf('draft', row.updated_at)).toContain('immutable');
      expect(await cacheOf('draft', row.staged_at)).toBe('no-store');
      expect(await cacheOf('draft', row.published_at)).toBe('no-store');
    });

    it('answers with the stamp of the copy it rendered', async () => {
      const id = await threeCopies();
      const row = await stored(id);
      expect((await (await previewOf(id, '?copy=staged')).json()).updatedAt).toBe(row.staged_at);
      expect((await (await previewOf(id, '?copy=live')).json()).updatedAt).toBe(row.published_at);
      expect((await (await previewOf(id, '?copy=draft')).json()).updatedAt).toBe(row.updated_at);
    });

    it('stops honouring the old key once the copy changes', async () => {
      const id = await threeCopies();
      const oldStaged = (await stored(id)).staged_at;
      await byMember(id, 'stage');
      const res = await previewOf(id, `?copy=staged&v=${encodeURIComponent(oldStaged!)}`);
      expect(res.headers.get('cache-control')).toBe('no-store');

      const oldLive = (await stored(id)).published_at;
      await asAdmin(id, 'publish');
      const live = await previewOf(id, `?copy=live&v=${encodeURIComponent(oldLive!)}`);
      expect(live.headers.get('cache-control')).toBe('no-store');
    });

    it('hides another workspace’s copies behind a 404', async () => {
      const id = await threeCopies();
      for (const copy of ['draft', 'staged', 'live']) expect((await previewOf(id, `?copy=${copy}`, OTHER)).status).toBe(404);
    });
  });

  describe('who may do what', () => {
    it('answers every new route with 401 when there is no user', async () => {
      const id = await waiting();
      for (const action of ALL_ACTIONS) {
        const res = await post(app, `/api/v1/templates/${id}/${action}`, {});
        expect(res.status).toBe(401);
      }
    });

    it('lets a member stage and ask, and refuses them every admin route', async () => {
      const id = await edited();
      expect((await byMember(id, 'stage')).status).toBe(200);
      expect((await byMember(id, 'request-signoff')).status).toBe(200);
      const before = await stored(id);
      for (const action of ADMIN_ONLY) {
        const res = await byMember(id, action);
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBe('admin-only');
      }
      expect(await stored(id)).toEqual(before);
    });

    it('refuses a member before it looks for the template', async () => {
      for (const action of ADMIN_ONLY) {
        expect((await byMember('no-such-template', action)).status).toBe(403);
      }
    });

    it('answers 404 to another workspace’s admin on every new route, and changes nothing', async () => {
      const id = await waiting();
      const before = await stored(id);
      for (const action of ALL_ACTIONS) {
        expect((await act(id, action, {}, OTHER)).status).toBe(404);
      }
      expect((await act(id, 'publish', {}, OTHER)).status).toBe(404);
      expect(await stored(id)).toEqual(before);
      expect(await versionsOf(id)).toHaveLength(0);
    });

    it('answers 404 for a template that does not exist', async () => {
      for (const action of ALL_ACTIONS) {
        expect((await asAdmin('no-such-template', action)).status).toBe(404);
      }
    });
  });

  describe('a read-only workspace', () => {
    it('refuses every new route and leaves the template as it was', async () => {
      const id = await waiting();
      const before = await stored(id);
      await lapse(db, OWNER);

      for (const action of ALL_ACTIONS) {
        expect((await asAdmin(id, action)).status).toBe(402);
        expect((await byMember(id, action)).status).toBe(402);
      }
      expect(await stored(id)).toEqual(before);
      expect(await versionsOf(id)).toHaveLength(0);
    });
  });
});
