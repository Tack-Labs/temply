import { FAKES_URL, STRIPE_URL, RUN_ID } from '../env';
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

  // The Stripe fake lives on its own port (no basePath in stripe-node's
  // config to route it under a prefix here) and answers at the same paths
  // the real SDK requests.
  const customer = `stack-${RUN_ID}-customer@example.com`;
  const stripeRes = await fetch(`${STRIPE_URL}/v1/customers`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: customer }).toString(),
  });
  expect(stripeRes.status).toBe(200);
  const body = (await stripeRes.json()) as { id: string };
  expect(body.id).toMatch(/^cus_/);
  const recorded = (await fakes.requests('stripe')).find((r) => (r.body as { email?: string }).email === customer);
  expect(recorded, 'the Stripe fake recorded the customer').toMatchObject({ method: 'POST', path: '/v1/customers' });
});
