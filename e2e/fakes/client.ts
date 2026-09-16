import { createHmac } from 'node:crypto';
import { FAKES_URL } from '../env';
import type { Recorded } from './index';

export const fakes = {
  async requests(service: 'stripe' | 'imagekit' | 'resend'): Promise<Recorded[]> {
    return (await fetch(`${FAKES_URL}/__requests?service=${service}`)).json() as Promise<Recorded[]>;
  },
  async reset(): Promise<void> {
    await fetch(`${FAKES_URL}/__reset`, { method: 'POST' });
  },
  /** A webhook body signed the way Stripe signs, so the app's verification
   *  runs for real. `secret` is the STRIPE_WEBHOOK_SECRET the stack started with. */
  signStripeEvent(event: object, secret: string): { body: string; signature: string } {
    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    return { body, signature: `t=${timestamp},v1=${digest}` };
  },
};
