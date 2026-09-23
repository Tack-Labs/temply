import { describe, expect, it } from 'bun:test';
import { Elysia, t } from 'elysia';
import { errorResponse } from '../lib/errors';

// The same onError wiring index.ts uses, on an app small enough to test —
// index.ts itself binds a port on import, so it cannot be imported here.
const app = new Elysia()
  .onError(({ error, code }) => errorResponse(code, error))
  .post('/api/v1/echo', ({ body }) => body, {
    body: t.Object({ name: t.String({ minLength: 1 }) }),
  });

describe('onError mapping', () => {
  it('answers an unknown route with 404, not 500', async () => {
    const res = await app.handle(new Request('http://localhost/api/v1/no-such-route'));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.status).toBe(404);
    expect(body.message).toBe('NOT_FOUND');
  });

  it('answers a validation failure with 400 and the validation message', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe(400);
    expect(body.message).toContain('name');
  });

  it('keeps everything else a 500', async () => {
    const throwing = new Elysia()
      .onError(({ error, code }) => errorResponse(code, error))
      .get('/boom', () => {
        throw new Error('kaput');
      });

    const res = await throwing.handle(new Request('http://localhost/boom'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe(500);
    expect(body.message).toBe('kaput');
  });
});
