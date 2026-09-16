import type { Received } from './index';

/** Just enough of Stripe for the app's three calls. A checkout session's
 *  URL points straight at the app's success page, so a test that presses
 *  Upgrade lands where a real customer would after paying. */
export function stripeRoutes(appUrl: string, record: (r: Received) => void) {
  return async (req: Request, path: string): Promise<Response | null> => {
    const body = req.method === 'POST' ? Object.fromEntries(new URLSearchParams(await req.text())) : {};
    record({ method: req.method, path, body });
    if (req.method === 'POST' && path === '/v1/checkout/sessions') {
      return Response.json({ id: `cs_test_${Date.now()}`, object: 'checkout.session', url: `${appUrl}/dashboard/settings/plan?success=true`, metadata: pick(body, 'metadata') });
    }
    if (req.method === 'POST' && path === '/v1/billing_portal/sessions') {
      return Response.json({ id: `bps_test_${Date.now()}`, object: 'billing_portal.session', url: `${appUrl}/dashboard/settings/plan?portal=fake` });
    }
    if (req.method === 'POST' && path === '/v1/customers') {
      return Response.json({ id: `cus_test_${Date.now()}`, object: 'customer', email: body.email ?? null });
    }
    return null;
  };
}

/** Stripe posts nested fields as `metadata[orgId]`; hand them back nested. */
function pick(body: Record<string, string>, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    const m = k.match(new RegExp(`^${prefix}\\[(.+)\\]$`));
    if (m) out[m[1]] = v;
  }
  return out;
}
