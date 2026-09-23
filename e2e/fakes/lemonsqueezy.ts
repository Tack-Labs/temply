import type { Received } from './index';

/** Just enough of Lemon Squeezy for the app's three calls. A checkout's URL
 *  points straight at the app's success page, so a test that presses Upgrade
 *  lands where a real customer would after paying; the portal lands on the
 *  plan page with a marker a test can see. */
export function lemonSqueezyRoutes(appUrl: string, record: (r: Received) => void) {
  return async (req: Request, path: string): Promise<Response | null> => {
    const text = req.method === 'POST' ? await req.text() : '';
    const body: unknown = text ? JSON.parse(text) : {};
    record({ method: req.method, path, body });
    if (req.method === 'POST' && path === '/v1/checkouts') {
      return Response.json(
        { data: { type: 'checkouts', id: `chk_${Date.now()}`, attributes: { url: `${appUrl}/dashboard/settings/plan?success=true` } } },
        { status: 201 },
      );
    }
    const subscription = path.match(/^\/v1\/subscriptions\/([^/]+)$/);
    if (req.method === 'GET' && subscription) {
      return Response.json({
        data: { type: 'subscriptions', id: subscription[1], attributes: { status: 'active', urls: { customer_portal: `${appUrl}/dashboard/settings/plan?portal=fake` } } },
      });
    }
    if (req.method === 'DELETE' && subscription) {
      return Response.json({ data: { type: 'subscriptions', id: subscription[1], attributes: { status: 'cancelled' } } });
    }
    return null;
  };
}
