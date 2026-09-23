import { describe, expect, it } from 'bun:test';
import { createTestApp, createTestDb, get } from '../test/helpers';
import { healthRoutes } from './health';

describe('GET /api/health', () => {
  it('answers 200 with the database reachable', async () => {
    const app = createTestApp(createTestDb(), healthRoutes);
    const res = await get(app, '/api/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; db: string; uptimeSeconds: number };
    expect(body.ok).toBe(true);
    expect(body.db).toBe('ok');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('needs no session', async () => {
    const app = createTestApp(createTestDb(), healthRoutes);
    expect((await get(app, '/api/health', null)).status).toBe(200);
  });
});
