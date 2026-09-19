import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { apiKeysTable, orgUsage, mails } from '@temply/shared/schema';
import { generateApiKey, generateShortCode } from '../lib/codes';
import { resetBurstWindows } from '../lib/rate-limit';
import { API_BURST_PER_MINUTE } from '@temply/shared/plans';
import { createTestApp, createTestDb, get, givePlan, type TestDb } from '../test/helpers';
import { publicRoutes } from './public';

let db: TestDb;
let app: any;

const OWNER = 'user_owner';

beforeEach(() => {
  db = createTestDb();
  app = createTestApp(db, publicRoutes);
  resetBurstWindows();
});

async function seedKey(userId: string, { revoked = false, mode = 'live' as 'live' | 'test' } = {}) {
  const { fullKey, prefix, hash } = generateApiKey(mode);
  const id = crypto.randomUUID();
  await db.insert(apiKeysTable).values({
    id,
    user_id: userId, org_id: userId,
    name: mode === 'test' ? 'Staging' : 'Production',
    key_prefix: prefix,
    key_hash: hash,
    mode,
    revoked_at: revoked ? new Date().toISOString() : null,
  });
  return { id, fullKey };
}

async function seedTemplate(userId: string, content = '{"type":"doc"}', { published = true } = {}) {
  const shortCode = generateShortCode();
  const stamp = '2026-01-01T00:00:00.000Z';
  await db.insert(mails).values({
    id: crypto.randomUUID(),
    user_id: userId, org_id: userId,
    title: 'Welcome email',
    preview_text: 'Hello there',
    content,
    short_code: shortCode,
    updated_at: stamp,
    // The API serves the published copy; a never-published row has none.
    ...(published
      ? { published_content: content, published_preview_text: 'Hello there', published_at: stamp }
      : {}),
  });
  return shortCode;
}

/** A document whose one paragraph is gated on `isMember`. */
const CONDITIONAL_DOC = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { showIfKey: 'isMember' },
      content: [{ type: 'text', text: 'Members only' }],
    },
  ],
});

function renderTemplate(shortCode: string, apiKey?: string, data?: unknown) {
  return app.handle(
    new Request(`http://localhost/api/public/v1/templates/${shortCode}/render`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(data === undefined ? {} : { data }),
    }),
  );
}

function fetchTemplate(shortCode: string, apiKey?: string) {
  return app.handle(
    new Request(`http://localhost/api/public/v1/templates/${shortCode}`, {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    }),
  );
}

describe('GET /api/public/v1/preview/:token', () => {
  const DRAFT = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft words"}]}]}';

  it('renders the draft for a valid token, with no key and no quota', async () => {
    const shortCode = await seedTemplate(OWNER, '{"type":"doc"}');
    await db.update(mails).set({ content: DRAFT, share_token: 'abcdefghijklmnopqrstuvwx' }).where(eq(mails.short_code, shortCode));

    const res = await get(app, '/api/public/v1/preview/abcdefghijklmnopqrstuvwx');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Welcome email');
    expect(body.html).toContain('Draft words');

    const { getApiUsage } = await import('../lib/api-quota');
    expect(await getApiUsage(db, OWNER)).toBe(0);
  });

  it('404s for an unknown or switched-off link', async () => {
    const res = await get(app, '/api/public/v1/preview/nothingherexxxxxxxxxxxxx');
    expect(res.status).toBe(404);
  });
});

function listTemplates(apiKey?: string) {
  return app.handle(
    new Request('http://localhost/api/public/v1/templates', {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    }),
  );
}

describe('GET /api/public/v1/templates', () => {
  it('401s without a key, and lists only what the key\'s workspace made', async () => {
    expect((await listTemplates()).status).toBe(401);
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const mine = await seedTemplate(OWNER);
    await seedTemplate('someone_else');
    const res = await listTemplates(fullKey);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('live');
    expect(body.templates.map((t: { shortCode: string }) => t.shortCode)).toEqual([mine]);
    expect(Object.keys(body.templates[0]).sort()).toEqual(['id', 'previewText', 'publishedAt', 'shortCode', 'title', 'updatedAt']);
    expect(body.templates[0].updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('a live key lists what is published; a test key lists the drafts too', async () => {
    await givePlan(db, OWNER, 'pro');
    const live = await seedKey(OWNER);
    const test = await seedKey(OWNER, { mode: 'test' });
    const published = await seedTemplate(OWNER);
    const draft = await seedTemplate(OWNER, undefined, { published: false });
    const seen = async (key: string) => ((await (await listTemplates(key)).json()).templates as { shortCode: string }[]).map((t) => t.shortCode).sort();
    expect(await seen(live.fullKey)).toEqual([published]);
    expect(await seen(test.fullKey)).toEqual([draft, published].sort());
  });

  it('counts as a call', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    await listTemplates(fullKey);
    const [usage] = await db.select().from(orgUsage);
    expect(usage.count).toBe(1);
  });
});

describe('GET /api/public/v1/templates/:shortCode', () => {
  it('401s without an Authorization header', async () => {
    const shortCode = await seedTemplate(OWNER);
    const res = await fetchTemplate(shortCode);
    expect(res.status).toBe(401);
    expect((await res.json()).message).toContain('Authorization');
  });

  it('401s when the bearer token is not a known key', async () => {
    const shortCode = await seedTemplate(OWNER);
    const res = await fetchTemplate(shortCode, 'tply_live_notarealkey');
    expect(res.status).toBe(401);
  });

  it('401s for a revoked key', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER, { revoked: true });
    const shortCode = await seedTemplate(OWNER);

    const res = await fetchTemplate(shortCode, fullKey);
    expect(res.status).toBe(401);
  });

  it('allows a free user and increments usage', async () => {
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER);

    const res = await fetchTemplate(shortCode, fullKey);
    expect(res.status).toBe(200);

    const { getApiUsage } = await import('../lib/api-quota');
    expect(await getApiUsage(db, OWNER)).toBe(1);
  });

  it('returns 429 when the monthly limit is reached and does not serve', async () => {
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER);
    const { ukMonthString } = await import('../lib/api-quota');
    await db.insert(orgUsage).values({ org_id: OWNER, period: ukMonthString(), count: 10_000 });

    const res = await fetchTemplate(shortCode, fullKey);
    expect(res.status).toBe(429);
  });

  it('returns 429 with Retry-After once a key passes its per-minute burst, and stops counting', async () => {
    const { fullKey } = await seedKey(OWNER, { mode: 'test' });
    const shortCode = await seedTemplate(OWNER, undefined, { published: false });
    const limit = API_BURST_PER_MINUTE.test;

    for (let i = 0; i < limit; i++) {
      expect((await fetchTemplate(shortCode, fullKey)).status).toBe(200);
    }
    const res = await fetchTemplate(shortCode, fullKey);
    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get('retry-after'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    // The message names the limit and the wait: without the numbers a
    // caller reading it learns nothing they can act on.
    expect((await res.json()).message).toBe(`This key may make ${limit} calls a minute. Try again in ${retryAfter}s.`);

    // A refused call is not a call: the month's counter stops at the fuse.
    const { getApiUsage } = await import('../lib/api-quota');
    expect(await getApiUsage(db, OWNER, new Date(), 'test')).toBe(limit);
  });

  it('keeps burst windows per key', async () => {
    const first = await seedKey(OWNER, { mode: 'test' });
    const second = await seedKey(OWNER, { mode: 'test' });
    const shortCode = await seedTemplate(OWNER, undefined, { published: false });
    for (let i = 0; i < API_BURST_PER_MINUTE.test; i++) await fetchTemplate(shortCode, first.fullKey);
    expect((await fetchTemplate(shortCode, first.fullKey)).status).toBe(429);
    expect((await fetchTemplate(shortCode, second.fullKey)).status).toBe(200);
  });

  it('404s for an unknown short code', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);

    const res = await fetchTemplate('tpl_00000000', fullKey);
    expect(res.status).toBe(404);
  });

  it('returns the template metadata for a paid key, without the content', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER);

    const res = await fetchTemplate(shortCode, fullKey);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.shortCode).toBe(shortCode);
    expect(body.title).toBe('Welcome email');
    expect(body.previewText).toBe('Hello there');
    expect(body.content).toBeUndefined();
  });

  it('404s for a template belonging to another account', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const someoneElses = await seedTemplate('user_stranger');

    const res = await fetchTemplate(someoneElses, fullKey);
    expect(res.status).toBe(404);
  });

  it('404s for a template that has never been published', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER, '{"type":"doc"}', { published: false });

    const res = await fetchTemplate(shortCode, fullKey);
    expect(res.status).toBe(404);
    expect((await res.json()).message).toContain('not been published');
  });

  it('reports the publish time as updatedAt, not the draft’s', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER);
    await db.update(mails).set({ updated_at: '2026-06-01T00:00:00.000Z', preview_text: 'Draft words' }).where(eq(mails.short_code, shortCode));

    const body = await (await fetchTemplate(shortCode, fullKey)).json();
    expect(body.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(body.publishedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(body.previewText).toBe('Hello there');
  });

  it('stamps last_used_at on a successful call', async () => {
    await givePlan(db, OWNER, 'pro');
    const { id, fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER);

    const [before] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id));
    expect(before.last_used_at).toBeNull();

    await fetchTemplate(shortCode, fullKey);

    const [after] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id));
    expect(after.last_used_at).not.toBeNull();
  });

  it('rewrites last_used_at once a minute, not once a call', async () => {
    await givePlan(db, OWNER, 'pro');
    const { id, fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER);
    const stamp = (agoMs: number) => new Date(Date.now() - agoMs).toISOString();

    const recent = stamp(30_000);
    await db.update(apiKeysTable).set({ last_used_at: recent }).where(eq(apiKeysTable.id, id));
    await fetchTemplate(shortCode, fullKey);
    expect((await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id)))[0].last_used_at).toBe(recent);

    const stale = stamp(120_000);
    await db.update(apiKeysTable).set({ last_used_at: stale }).where(eq(apiKeysTable.id, id));
    await fetchTemplate(shortCode, fullKey);
    expect((await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id)))[0].last_used_at).not.toBe(stale);
  });
});

describe('POST /api/public/v1/templates/:shortCode/render', () => {
  it('401s without a key', async () => {
    const shortCode = await seedTemplate(OWNER);
    expect((await renderTemplate(shortCode)).status).toBe(401);
  });

  it('404s for a template belonging to another account', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const someoneElses = await seedTemplate('user_stranger');

    expect((await renderTemplate(someoneElses, fullKey)).status).toBe(404);
  });

  it('returns the rendered HTML', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER, CONDITIONAL_DOC);

    const res = await renderTemplate(shortCode, fullKey);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.shortCode).toBe(shortCode);
    expect(body.html).toContain('<html');
  });

  it('404s before the template is published', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER, CONDITIONAL_DOC, { published: false });

    const res = await renderTemplate(shortCode, fullKey);
    expect(res.status).toBe(404);
  });

  it('renders the published copy while the draft has moved on', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER, '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Published words"}]}]}');
    await db.update(mails).set({ content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft words"}]}]}' }).where(eq(mails.short_code, shortCode));

    const body = await (await renderTemplate(shortCode, fullKey)).json();
    expect(body.html).toContain('Published words');
    expect(body.html).not.toContain('Draft words');
  });

  describe('with a test key', () => {
    const DRAFT = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft words"}]}]}';
    const LIVE = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Published words"}]}]}';

    it('renders the draft, not the published copy', async () => {
      const { fullKey } = await seedKey(OWNER, { mode: 'test' });
      const shortCode = await seedTemplate(OWNER, LIVE);
      await db.update(mails).set({ content: DRAFT, updated_at: '2026-06-01T00:00:00.000Z' }).where(eq(mails.short_code, shortCode));

      const body = await (await renderTemplate(shortCode, fullKey)).json();
      expect(body.html).toContain('Draft words');
      expect(body.html).not.toContain('Published words');
      expect(body.mode).toBe('test');
      expect(body.updatedAt).toBe('2026-06-01T00:00:00.000Z');
    });

    it('serves a template that has never been published', async () => {
      const { fullKey } = await seedKey(OWNER, { mode: 'test' });
      const shortCode = await seedTemplate(OWNER, DRAFT, { published: false });

      expect((await renderTemplate(shortCode, fullKey)).status).toBe(200);
      const meta = await (await fetchTemplate(shortCode, fullKey)).json();
      expect(meta.mode).toBe('test');
      expect(meta.publishedAt).toBeNull();
    });

    it('works on the free plan and leaves the live quota alone', async () => {
      const { fullKey } = await seedKey(OWNER, { mode: 'test' });
      const shortCode = await seedTemplate(OWNER);

      expect((await renderTemplate(shortCode, fullKey)).status).toBe(200);

      const { getApiUsage } = await import('../lib/api-quota');
      expect(await getApiUsage(db, OWNER)).toBe(0);
      expect(await getApiUsage(db, OWNER, new Date(), 'test')).toBe(1);
    });

    it('stops at its own monthly cap', async () => {
      const { fullKey } = await seedKey(OWNER, { mode: 'test' });
      const shortCode = await seedTemplate(OWNER);
      const { ukMonthString } = await import('../lib/api-quota');
      const { TEST_API_CALLS_PER_MONTH } = await import('@temply/shared/plans');
      await db.insert(orgUsage).values({ org_id: OWNER, period: `${ukMonthString()}#test`, count: TEST_API_CALLS_PER_MONTH });

      const res = await renderTemplate(shortCode, fullKey);
      expect(res.status).toBe(429);
      expect((await res.json()).message).toContain('Test keys');
    });
  });

  describe('missing data', () => {
    const PILLS = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hi "},{"type":"variable","attrs":{"id":"firstName","fallback":"there"}},{"type":"text","text":", order "},{"type":"variable","attrs":{"id":"orderNumber","fallback":"#1001","required":false}}]}]}';

    it('422s with the names when data is sent but a required value is not', async () => {
      await givePlan(db, OWNER, 'pro');
      const { fullKey } = await seedKey(OWNER);
      const shortCode = await seedTemplate(OWNER, PILLS);

      const res = await renderTemplate(shortCode, fullKey, { orderNumber: '#2002' });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.missing).toEqual(['firstName']);
      expect(body.message).toContain('firstName');
    });

    it('422s naming the key when a Repeat is sent something other than a list', async () => {
      await givePlan(db, OWNER, 'pro');
      const { fullKey } = await seedKey(OWNER);
      const REPEAT = '{"type":"doc","content":[{"type":"repeat","attrs":{"each":"items"},"content":[{"type":"paragraph","content":[{"type":"variable","attrs":{"id":"name","fallback":"item"}}]}]}]}';
      const shortCode = await seedTemplate(OWNER, REPEAT);

      const res = await renderTemplate(shortCode, fullKey, { items: 'Notebook' });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.message).toContain('items');
      expect(body.message).toContain('list');
    });

    it('never mails the placeholder: an optional pill renders as nothing', async () => {
      await givePlan(db, OWNER, 'pro');
      const { fullKey } = await seedKey(OWNER);
      const shortCode = await seedTemplate(OWNER, PILLS);

      const { html } = await (await renderTemplate(shortCode, fullKey, { firstName: 'Ada' })).json();
      const text = html.replace(/<!--.*?-->/g, '');
      expect(text).toContain('Hi Ada, order </p>');
      expect(text).not.toContain('#1001');
      expect(text).not.toContain('Hi there');
    });

    it('shows placeholders when no data is sent at all', async () => {
      await givePlan(db, OWNER, 'pro');
      const { fullKey } = await seedKey(OWNER);
      const shortCode = await seedTemplate(OWNER, PILLS);

      const { html } = await (await renderTemplate(shortCode, fullKey)).json();
      expect(html).toContain('{{firstName,fallback=there}}');
    });
  });

  it('returns a text alternative beside the HTML', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER, CONDITIONAL_DOC);

    const { html, text } = await (await renderTemplate(shortCode, fullKey)).json();
    expect(text).toContain('Members only');
    // The point of the alternative: no markup for a client that cannot show it.
    expect(text).not.toContain('<table');
    expect(text.length).toBeLessThan(html.length);
  });

  it('shows a conditional block when no data is sent', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER, CONDITIONAL_DOC);

    const { html } = await (await renderTemplate(shortCode, fullKey)).json();
    expect(html).toContain('Members only');
  });

  it('drops a conditional block when the data says so', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER, CONDITIONAL_DOC);

    const { html } = await (await renderTemplate(shortCode, fullKey, { isMember: false })).json();
    expect(html).not.toContain('Members only');
  });

  it('keeps a conditional block when the data allows it', async () => {
    await givePlan(db, OWNER, 'pro');
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER, CONDITIONAL_DOC);

    const { html } = await (await renderTemplate(shortCode, fullKey, { isMember: true })).json();
    expect(html).toContain('Members only');
  });

  it('counts against the monthly quota', async () => {
    const { fullKey } = await seedKey(OWNER);
    const shortCode = await seedTemplate(OWNER);

    await renderTemplate(shortCode, fullKey);

    const { getApiUsage } = await import('../lib/api-quota');
    expect(await getApiUsage(db, OWNER)).toBe(1);
  });
});
