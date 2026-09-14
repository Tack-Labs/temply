import { test, expect } from '@playwright/test';
import { FAKES_URL, STRIPE_URL } from '../env';
import { fakes } from '../fakes/client';

test('the stack is wired: the fakes answer and reset', async () => {
  await fakes.reset();
  expect(await fakes.requests('stripe')).toEqual([]);

  const res = await fetch(`${FAKES_URL}/resend/emails`, { method: 'POST', body: JSON.stringify({ to: 'x' }), headers: { 'content-type': 'application/json' } });
  expect(res.status).toBe(200);
  expect(await fakes.requests('resend')).toHaveLength(1);

  // The Stripe fake lives on its own port (no basePath in stripe-node's
  // config to route it under a prefix here) and answers at the same paths
  // the real SDK requests.
  const stripeRes = await fetch(`${STRIPE_URL}/v1/customers`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'email=test%40example.com',
  });
  expect(stripeRes.status).toBe(200);
  const body = await stripeRes.json();
  expect(body.id).toMatch(/^cus_/);
  expect(await fakes.requests('stripe')).toHaveLength(1);
});
