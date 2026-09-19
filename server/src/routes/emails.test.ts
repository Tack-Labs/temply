import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { TestDb } from '../test/helpers';

process.env.RESEND_API_KEY = 're_test_key';

// Stop the real Resend SDK from making a network call; capture the payload.
const sent: any[] = [];
mock.module('resend', () => ({
  Resend: class {
    emails = {
      send: async (payload: any) => {
        sent.push(payload);
        return { data: { id: 'email_1' }, error: null };
      },
    };
  },
}));

const { emailsRoutes } = await import('./emails');
const { createTestApp, createTestDb, givePlan, post } = await import('../test/helpers');
const { ANONYMOUS_RENDERS_PER_MINUTE, resetBurstWindows } = await import('../lib/rate-limit');
const { TEMPLATE_CONTENT_MAX_BYTES } = await import('@temply/shared/plans');

let db: TestDb;
let app: any;
const USER = 'user_send';

beforeEach(() => {
  db = createTestDb();
  app = createTestApp(db, emailsRoutes);
  sent.length = 0;
  resetBurstWindows();
});

describe('POST /api/v1/emails/preview', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] };
  const from = (address: string) => ({ 'x-forwarded-for': address });

  it('renders for a caller with no account, which is what the playground is', async () => {
    const res = await post(app, '/api/v1/emails/preview', { content: doc }, null);
    expect(res.status).toBe(200);
    expect((await res.json()).html).toContain('Hello');
  });

  it('fuses by address once a minute of renders is spent, and one address does not spend another\'s', async () => {
    for (let i = 0; i < ANONYMOUS_RENDERS_PER_MINUTE; i++) {
      expect((await post(app, '/api/v1/emails/preview', { content: doc }, null, from('203.0.113.7'))).status).toBe(200);
    }
    const refused = await post(app, '/api/v1/emails/preview', { content: doc }, null, from('203.0.113.7'));
    expect(refused.status).toBe(429);
    expect(refused.headers.get('Retry-After')).toMatch(/^[0-9]+$/);
    expect((await refused.json()).message).toContain(`${ANONYMOUS_RENDERS_PER_MINUTE} a minute`);
    expect((await post(app, '/api/v1/emails/preview', { content: doc }, null, from('203.0.113.8'))).status).toBe(200);
  });

  it('does not count a signed-in editor by address, since a workspace can share one', async () => {
    for (let i = 0; i < ANONYMOUS_RENDERS_PER_MINUTE; i++) {
      await post(app, '/api/v1/emails/preview', { content: doc }, null, from('203.0.113.7'));
    }
    expect((await post(app, '/api/v1/emails/preview', { content: doc }, null, from('203.0.113.7'))).status).toBe(429);
    expect((await post(app, '/api/v1/emails/preview', { content: doc }, USER, from('203.0.113.7'))).status).toBe(200);
  });

  it('refuses a document past the content ceiling before rendering it', async () => {
    const text = 'x'.repeat(TEMPLATE_CONTENT_MAX_BYTES);
    const oversized = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
    const res = await post(app, '/api/v1/emails/preview', { content: oversized }, null);
    expect(res.status).toBe(413);
    expect((await res.json()).message).toContain('too large');
    const asString = await post(app, '/api/v1/emails/preview', { content: JSON.stringify(oversized) }, null);
    expect(asString.status).toBe(413);
  });
});

const body = (over: Record<string, unknown> = {}) => ({
  subject: 'Hi',
  to: 'a@example.com',
  content: '{"type":"doc","content":[]}',
  ...over,
});

describe('POST /api/v1/emails/send', () => {
  it('rejects a request with no user', async () => {
    const res = await post(app, '/api/v1/emails/send', body());
    expect(res.status).toBe(401);
  });

  it('sends from the Temply address with the display name', async () => {
    const res = await post(app, '/api/v1/emails/send', body({ fromName: 'Acme', replyTo: 'me@acme.com' }), USER);
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].from).toBe('Acme via Temply <send@temply.app>');
    expect(sent[0].replyTo).toBe('me@acme.com');
    expect(sent[0].to).toEqual(['a@example.com']);
  });

  it('takes a handful of recipients and refuses a list, a malformed address and a bad reply-to', async () => {
    const five = Array.from({ length: 5 }, (_, i) => `p${i}@example.com`).join(', ');
    expect((await post(app, '/api/v1/emails/send', body({ to: five }), USER)).status).toBe(200);
    expect(sent[0].to).toHaveLength(5);

    const six = `${five}, p6@example.com`;
    const tooMany = await post(app, '/api/v1/emails/send', body({ to: six }), USER);
    expect(tooMany.status).toBe(400);
    expect((await tooMany.json()).message).toContain('at most 5');

    const malformed = await post(app, '/api/v1/emails/send', body({ to: 'a@example.com, not-an-address' }), USER);
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).message).toContain('"not-an-address"');

    const badReply = await post(app, '/api/v1/emails/send', body({ replyTo: 'nope' }), USER);
    expect(badReply.status).toBe(400);
    // An empty reply-to is the form's default and means none.
    expect((await post(app, '/api/v1/emails/send', body({ replyTo: '' }), USER)).status).toBe(200);
    expect(sent).toHaveLength(2);
    expect(sent[1].replyTo).toBeUndefined();
  });

  it('bounds the headers a test send can carry', async () => {
    expect((await post(app, '/api/v1/emails/send', body({ subject: 's'.repeat(256) }), USER)).status).toBe(400);
    expect((await post(app, '/api/v1/emails/send', body({ fromName: 'n'.repeat(101) }), USER)).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('sanitizes a hostile display name before it reaches the From header', async () => {
    const res = await post(
      app,
      '/api/v1/emails/send',
      body({ fromName: 'Acme <evil@x.com>\r\nBcc: victim@x.com' }),
      USER,
    );
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].from).toBe('Acme evil@x.comBcc: victim@x.com via Temply <send@temply.app>');
    expect(sent[0].from).not.toContain('\r');
    expect(sent[0].from).not.toContain('\n');
    expect(sent[0].from.split(' via Temply <')[0]).not.toContain('<');
  });

  const variableContent = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hi ' },
          { type: 'variable', attrs: { id: 'firstName' } },
        ],
      },
    ],
  });

  it('resolves variables from the payload, and leaves placeholders without one', async () => {
    const content = variableContent;

    const withPayload = await post(
      app,
      '/api/v1/emails/send',
      body({ content, payload: { firstName: 'Ada' } }),
      USER,
    );
    expect(withPayload.status).toBe(200);
    expect(sent[0].html).toContain('Ada');
    expect(sent[0].html).not.toContain('{{firstName}}');
    // The text alternative is the same render, so it resolves too.
    expect(sent[0].text).toContain('Ada');

    const withoutPayload = await post(app, '/api/v1/emails/send', body({ content }), USER);
    expect(withoutPayload.status).toBe(200);
    expect(sent[1].html).toContain('{{firstName}}');
  });

  it('ignores a payload that is not an object', async () => {
    const res = await post(
      app,
      '/api/v1/emails/send',
      body({ content: variableContent, payload: 'junk' }),
      USER,
    );
    expect(res.status).toBe(200);
    // Composing behaviour: the placeholder passes through untouched instead
    // of the string's characters becoming variable values.
    expect(sent[0].html).toContain('{{firstName}}');
  });

  it('rate-limits after 20 sends in the hour', async () => {
    // Use a dedicated user so this test's exact 20/21 counts aren't skewed by
    // the sends the other tests above already made for USER in this file's
    // shared, module-level rate limiter.
    const rateLimitUser = 'user_ratelimit';
    for (let i = 0; i < 20; i++) {
      expect((await post(app, '/api/v1/emails/send', body(), rateLimitUser)).status).toBe(200);
    }
    expect((await post(app, '/api/v1/emails/send', body(), rateLimitUser)).status).toBe(429);
  });
});
