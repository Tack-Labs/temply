/**
 * The dev servers behind a public address, in one command.
 *
 *   bun run dev:public              # new cloudflared quick tunnel, then `bun run dev`
 *   bun run dev:public --url <url>  # reuse an address (a tunnel already up, or a named one)
 *   bun run dev:public --no-dev     # configure only; the dev servers are already running
 *   bun run dev:public --keep-webhooks  # leave the Stripe and Clerk endpoints where they are
 *
 * A quick tunnel's address is random and changes every time, and three
 * things have to follow it: NEXT_PUBLIC_APP_URL in both env files (every
 * printed URL and the dev-origin allow-list derive from it), the Stripe
 * webhook endpoint (re-pointed here through the API), and the Clerk
 * endpoint, which only the dashboard can change — the URL to paste is
 * printed. The dev servers start after the envs are written, since neither
 * re-reads .env while running. Ctrl+C stops everything.
 *
 * --keep-webhooks is for a tunnel that only exists to look at the work from
 * a phone while the webhooks belong to the Railway deployment: the envs
 * still follow the tunnel, but Stripe is not touched and nothing
 * asks for the Clerk endpoint to move.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENV_FILES = ['client/.env', 'server/.env'];
const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_EVENTS = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];

const noDev = process.argv.includes('--no-dev');
const keepWebhooks = process.argv.includes('--keep-webhooks');
const argUrl = (() => {
  const i = process.argv.indexOf('--url');
  return i >= 0 ? process.argv[i + 1] : undefined;
})();

const children: ChildProcess[] = [];
const stopAll = () => {
  for (const child of children) child.kill('SIGTERM');
};
process.on('SIGINT', () => { stopAll(); process.exit(0); });
process.on('SIGTERM', () => { stopAll(); process.exit(0); });

function readEnv(file: string, key: string): string | undefined {
  const match = readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match?.[1].trim() || undefined;
}

function writeEnv(file: string, key: string, value: string) {
  const text = readFileSync(file, 'utf8');
  const line = `${key}=${value}`;
  const next = new RegExp(`^${key}=.*$`, 'm').test(text)
    ? text.replace(new RegExp(`^${key}=.*$`, 'm'), line)
    : `${text.replace(/\n?$/, '\n')}${line}\n`;
  writeFileSync(file, next);
}

/** Starts a quick tunnel and resolves with the address cloudflared prints. */
function startTunnel(): Promise<string> {
  return new Promise((resolve, reject) => {
    const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:9000'], { stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(tunnel);
    let seen = '';
    const watch = (chunk: Buffer) => {
      seen += chunk.toString();
      const found = seen.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (found) resolve(found[0]);
    };
    tunnel.stdout.on('data', watch);
    tunnel.stderr.on('data', watch);
    tunnel.on('exit', (code) => reject(new Error(`cloudflared exited with ${code} before printing an address — is it installed?`)));
    setTimeout(() => reject(new Error('cloudflared printed no address in 30s')), 30_000);
  });
}

/**
 * Stripe returns an endpoint's signing secret only in the reply that creates
 * it. Re-pointing the endpoint that exists keeps that secret, so the one in
 * server/.env stays valid; a new endpoint's secret is written there straight
 * from the reply, since there is no second chance to read it through the API.
 */
async function repointStripe(url: string) {
  const key = readEnv('server/.env', 'STRIPE_SECRET_KEY');
  if (!key) { console.log('Stripe: STRIPE_SECRET_KEY not set, skipping'); return; }
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  const target = `${url}/api/webhooks/stripe`;
  type Reply = { error?: { message?: string } };
  const why = (res: Response, body: Reply) => body.error?.message ?? `HTTP ${res.status}`;

  // A failed listing must not read as "no endpoint yet": creating one then
  // would leave Stripe posting every event twice.
  const listRes = await fetch(`${STRIPE_API}/webhook_endpoints?limit=100`, { headers });
  const list = (await listRes.json().catch(() => ({}))) as Reply & { data?: Array<{ id: string; url: string }> };
  if (!listRes.ok || !list.data) { console.log(`Stripe: could not list webhook endpoints — ${why(listRes, list)}`); return; }
  const ours = list.data.find((endpoint) => endpoint.url.endsWith('/api/webhooks/stripe'));

  const body = new URLSearchParams({ url: target });
  for (const event of STRIPE_EVENTS) body.append('enabled_events[]', event);
  const res = await fetch(ours ? `${STRIPE_API}/webhook_endpoints/${ours.id}` : `${STRIPE_API}/webhook_endpoints`, {
    method: 'POST',
    headers,
    body,
  });
  const saved = (await res.json().catch(() => ({}))) as Reply & { id?: string; secret?: string };
  if (!res.ok || !saved.id) { console.log(`Stripe: could not ${ours ? 'update' : 'create'} the webhook endpoint — ${why(res, saved)}`); return; }
  console.log(`Stripe: webhook endpoint ${saved.id} → ${target}`);
  if (saved.secret) {
    writeEnv('server/.env', 'STRIPE_WEBHOOK_SECRET', saved.secret);
    console.log('Stripe: new signing secret written to server/.env');
  } else if (!readEnv('server/.env', 'STRIPE_WEBHOOK_SECRET')) {
    console.log(`Stripe: server/.env has no STRIPE_WEBHOOK_SECRET. Copy the signing secret of ${saved.id} from the Stripe dashboard (Developers → Webhooks).`);
  }
}

const url = argUrl ?? (await startTunnel());
console.log(`\nPublic address: ${url}\n`);

for (const file of ENV_FILES) writeEnv(file, 'NEXT_PUBLIC_APP_URL', url);
console.log(`NEXT_PUBLIC_APP_URL written to ${ENV_FILES.join(' and ')}`);

if (keepWebhooks) {
  console.log('Webhooks left alone (--keep-webhooks): billing and account events keep going to wherever they point now.\n');
} else {
  await repointStripe(url);
  console.log(`Clerk: set the endpoint in the dashboard to ${url}/api/webhooks/clerk (it cannot be changed through the API)\n`);
}

if (noDev) {
  console.log('Restart the dev servers to pick up the new env (bun --watch and next dev do not re-read .env).');
  if (!argUrl) console.log('The tunnel stays up until this process is stopped.');
  else process.exit(0);
} else {
  const dev = spawn('bun', ['run', 'dev'], { stdio: 'inherit' });
  children.push(dev);
  dev.on('exit', (code) => { stopAll(); process.exit(code ?? 0); });
}
