import { FAKES_URL, RUN_ID, STRIPE, STRIPE_URL } from '../env';
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

  // The Stripe fake answers on its own origin at the paths the SDK requests,
  // returns what Stripe's side was given, and checks the key as Stripe does.
  const id = `sub_stack_${RUN_ID}`;
  await fakes.putStripeSubscription({
    id,
    object: 'subscription',
    customer: `cus_stack_${RUN_ID}`,
    status: 'active',
    metadata: {},
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    items: { object: 'list', data: [] },
  });
  const stripeRes = await fetch(`${STRIPE_URL}/v1/subscriptions/${id}`, { headers: { authorization: `Bearer ${STRIPE.secretKey}` } });
  expect(stripeRes.status).toBe(200);
  expect(((await stripeRes.json()) as { id: string }).id).toBe(id);
  const recorded = (await fakes.requests('stripe')).find((r) => r.path === `/v1/subscriptions/${id}`);
  expect(recorded, 'the Stripe fake recorded the request').toMatchObject({ method: 'GET' });
  const unkeyed = await fetch(`${STRIPE_URL}/v1/subscriptions/${id}`);
  expect(unkeyed.status, 'the Stripe fake refuses a request without the key').toBe(401);
});
