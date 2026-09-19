import { Elysia } from 'elysia';
import { json } from '../lib/errors';
import { checkPerMinute, clientAddress } from '../lib/rate-limit';

/** Reports one address may send in a minute. A page that trips the policy
 *  on load can send a dozen at once; past that it is a loop or a flood. */
export const REPORTS_PER_MINUTE = 20;

/**
 * Where the browser sends what the Content-Security-Policy would have
 * blocked. The policy is report-only until a week of these says it blocks
 * nothing a customer needs, so the reports have to land somewhere that is
 * read — and the log is what is read. Each one is a line: the directive,
 * what it was refusing, and the page, which is all a policy needs to be
 * corrected. Nothing is stored and nobody is identified.
 */
export const cspReportRoutes = new Elysia().post(
  '/api/csp-report',
  async ({ request, server }) => {
    const fuse = checkPerMinute(`address:${clientAddress(request, server)}`, REPORTS_PER_MINUTE);
    if (!fuse.allowed) return json({ status: 'ok' });

    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return json({ status: 'ok' });
    }
    // The older shape wraps one report in `csp-report`; the Reporting API
    // sends an array of `{ body }`. Both are read.
    const reports = Array.isArray(body)
      ? body.map((entry) => (entry as { body?: unknown }).body)
      : [(body as { 'csp-report'?: unknown })['csp-report'] ?? body];
    for (const report of reports) {
      const r = (report ?? {}) as Record<string, unknown>;
      const directive = r['effective-directive'] ?? r.effectiveDirective ?? r['violated-directive'];
      const blocked = r['blocked-uri'] ?? r.blockedURL;
      const page = r['document-uri'] ?? r.documentURL;
      console.warn(`[csp] ${String(directive)} refused ${String(blocked)} on ${String(page)}`);
    }
    return json({ status: 'ok' });
  },
  // The browser posts application/csp-report or application/reports+json;
  // neither is a type Elysia parses on its own.
  { parse: 'none' },
);
