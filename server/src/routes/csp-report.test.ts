import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { createTestApp, createTestDb } from '../test/helpers';
import { REPORTS_PER_MINUTE, cspReportRoutes } from './csp-report';

let app: ReturnType<typeof createTestApp>;

const send = (body: unknown, type: string, address = '203.0.113.5') =>
  app.handle(
    new Request('http://localhost/api/csp-report', {
      method: 'POST',
      headers: { 'Content-Type': type, 'x-forwarded-for': address },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

let warnings: string[];
let warn: ReturnType<typeof spyOn>;

beforeEach(() => {
  app = createTestApp(createTestDb(), cspReportRoutes);
  warnings = [];
  warn = spyOn(console, 'warn').mockImplementation((line: string) => {
    warnings.push(line);
  });
});
afterEach(() => warn.mockRestore());

describe('POST /api/csp-report', () => {
  it('logs the directive, what was refused and the page, from either report shape', async () => {
    const legacy = {
      'csp-report': { 'effective-directive': 'script-src', 'blocked-uri': 'https://evil.example', 'document-uri': 'https://temply.app/' },
    };
    expect((await send(legacy, 'application/csp-report')).status).toBe(200);
    const modern = [{ body: { effectiveDirective: 'img-src', blockedURL: 'http://cdn.example/a.png', documentURL: 'https://temply.app/p/x' } }];
    expect((await send(modern, 'application/reports+json')).status).toBe(200);
    expect(warnings).toEqual([
      '[csp] script-src refused https://evil.example on https://temply.app/',
      '[csp] img-src refused http://cdn.example/a.png on https://temply.app/p/x',
    ]);
  });

  it('answers a body it cannot read without a word, and fuses a flood by address', async () => {
    expect((await send('not json', 'application/csp-report')).status).toBe(200);
    expect(warnings).toHaveLength(0);
    const report = { 'csp-report': { 'effective-directive': 'style-src', 'blocked-uri': 'inline', 'document-uri': 'https://temply.app/' } };
    // The unreadable one above spent a slot: the fuse counts requests, not
    // lines, so a flood of garbage is fused the same as a flood of reports.
    for (let i = 0; i < 40; i++) await send(report, 'application/csp-report');
    expect(warnings).toHaveLength(REPORTS_PER_MINUTE - 1);
    await send(report, 'application/csp-report', '203.0.113.6');
    expect(warnings).toHaveLength(REPORTS_PER_MINUTE);
  });
});
