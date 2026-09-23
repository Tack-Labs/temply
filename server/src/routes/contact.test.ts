import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { contactMessages } from '@temply/shared/schema';
import { createTestApp, createTestDb, post, type TestDb } from '../test/helpers';

// Stop the real Resend SDK from making a network call; capture the payload.
const sent: any[] = [];
mock.module('resend', () => ({
  Resend: class {
    emails = {
      send: async (payload: any) => {
        sent.push(payload);
        return { error: null };
      },
    };
  },
}));

import { contactRoutes } from './contact';
import { CONTACT_MESSAGES_PER_MINUTE } from '../lib/rate-limit';

let db: TestDb;
let app: any;

beforeEach(() => {
  db = createTestDb();
  app = createTestApp(db, contactRoutes);
  sent.length = 0;
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.CONTACT_EMAIL = 'team@example.com';
  delete process.env.CONTACT_FROM_EMAIL;
});

const submit = (body: unknown) => post(app, '/api/v1/contact', body, null);

describe('POST /api/v1/contact', () => {
  it('400s on a missing name and an oversized message', async () => {
    expect((await submit({ email: 'a@b.co', message: 'hi' })).status).toBe(400);
    expect(
      (await submit({ name: 'A', email: 'a@b.co', message: 'x'.repeat(5001) })).status,
    ).toBe(400);
  });

  it('stores the message and delivers it with replyTo the submitter', async () => {
    const res = await submit({ name: 'Sam', email: 'sam@acme.co', message: 'Hello there' });
    expect(res.status).toBe(200);

    const rows = await db.select().from(contactMessages);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('sam@acme.co');

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('team@example.com');
    expect(sent[0].replyTo).toBe('sam@acme.co');
    expect(sent[0].from).toBe('onboarding@resend.dev');
  });

  it('still succeeds and stores when sending is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    const res = await submit({ name: 'Sam', email: 'sam@acme.co', message: 'Hello' });
    expect(res.status).toBe(200);
    expect(await db.select().from(contactMessages)).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });

  it('fuses an address after a minute of messages, and stores none past it', async () => {
    const from = { 'x-forwarded-for': '203.0.113.9' };
    const message = { name: 'A', email: 'a@b.co', message: 'hi' };
    for (let i = 0; i < CONTACT_MESSAGES_PER_MINUTE; i++) {
      expect((await post(app, '/api/v1/contact', message, null, from)).status).toBe(200);
    }
    const refused = await post(app, '/api/v1/contact', message, null, from);
    expect(refused.status).toBe(429);
    expect(refused.headers.get('Retry-After')).toMatch(/^[0-9]+$/);
    expect(await db.select().from(contactMessages)).toHaveLength(CONTACT_MESSAGES_PER_MINUTE);
    expect((await post(app, '/api/v1/contact', message, null, { 'x-forwarded-for': '203.0.113.10' })).status).toBe(200);
  });

  it('accepts but discards a honeypot submission', async () => {
    const res = await submit({ name: 'Bot', email: 'b@b.co', message: 'spam', company: 'Bots Inc' });
    expect(res.status).toBe(200);
    expect(await db.select().from(contactMessages)).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });
});
