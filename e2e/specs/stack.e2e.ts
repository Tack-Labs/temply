import { FAKES_URL, RUN_ID } from '../env';
import { test, expect } from '../fixtures/test';

// Runs on the desktop project only (see playwright.config): the fakes are one
// process shared by every worker, and what this test posts is found again by
// the value it sent, not by counting what the fakes hold.
test('the stack is wired: the fakes answer and record', async ({ fakes }) => {
  const to = `stack-${RUN_ID}@example.com`;
  const res = await fetch(`${FAKES_URL}/resend/emails`, { method: 'POST', body: JSON.stringify({ to }), headers: { 'content-type': 'application/json' } });
  expect(res.status).toBe(200);
  const email = (await fakes.requests('resend')).find((r) => (r.body as { to?: string }).to === to);
  expect(email, 'the Resend fake recorded the email').toBeDefined();

  // The Lemon Squeezy fake answers at the paths the API requests, under its
  // prefix on the same port.
  const subscription = `sub_stack_${RUN_ID}`;
  const lsRes = await fetch(`${FAKES_URL}/lemonsqueezy/v1/subscriptions/${subscription}`, { headers: { accept: 'application/vnd.api+json' } });
  expect(lsRes.status).toBe(200);
  const body = (await lsRes.json()) as { data: { id: string; attributes: { urls: { customer_portal: string } } } };
  expect(body.data.id).toBe(subscription);
  expect(body.data.attributes.urls.customer_portal).toMatch(/portal=fake/);
  const recorded = (await fakes.requests('lemonsqueezy')).find((r) => r.path === `/v1/subscriptions/${subscription}`);
  expect(recorded, 'the Lemon Squeezy fake recorded the request').toMatchObject({ method: 'GET' });
});
