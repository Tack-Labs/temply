/**
 * The dev servers behind a public address, in one command.
 *
 *   bun run dev:public              # new cloudflared quick tunnel, then `bun run dev`
 *   bun run dev:public --url <url>  # reuse an address (a tunnel already up, or a named one)
 *   bun run dev:public --no-dev     # configure only; the dev servers are already running
 *   bun run dev:public --keep-webhooks  # leave the Lemon Squeezy and Clerk endpoints where they are
 *
 * A quick tunnel's address is random and changes every time, and three
 * things have to follow it: NEXT_PUBLIC_APP_URL in both env files (every
 * printed URL and the dev-origin allow-list derive from it), the Lemon
 * Squeezy webhook (re-pointed here through the API), and the Clerk
 * endpoint, which only the dashboard can change — the URL to paste is
 * printed. The dev servers start after the envs are written, since neither
 * re-reads .env while running. Ctrl+C stops everything.
 *
 * --keep-webhooks is for a tunnel that only exists to look at the work from
 * a phone while the webhooks belong to the Railway deployment: the envs
 * still follow the tunnel, but Lemon Squeezy is not touched and nothing
 * asks for the Clerk endpoint to move.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const ENV_FILES = ['client/.env', 'server/.env'];
const LEMONSQUEEZY_API = 'https://api.lemonsqueezy.com/v1';
const LEMONSQUEEZY_EVENTS = ['subscription_created', 'subscription_updated', 'subscription_expired'];

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
 * Lemon Squeezy never hands a webhook's secret back. A webhook that exists
 * keeps its secret, which server/.env must already hold: the staging stack
 * can share the store's test mode, and moving the URL back must be all it
 * takes to restore it. A new webhook, or a server/.env with no secret at
 * all, gets a fresh one, written there once the webhook has it.
 */
async function repointLemonSqueezy(url: string) {
  const key = readEnv('server/.env', 'LEMONSQUEEZY_API_KEY');
  const store = readEnv('server/.env', 'LEMONSQUEEZY_STORE_ID');
  if (!key || !store) { console.log('Lemon Squeezy: LEMONSQUEEZY_API_KEY or LEMONSQUEEZY_STORE_ID not set, skipping'); return; }
  const headers = { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', Authorization: `Bearer ${key}` };
  const target = `${url}/api/webhooks/lemonsqueezy`;
  type Reply = { data?: unknown; errors?: Array<{ detail?: string; title?: string }> };
  const why = (res: Response, body: Reply) => body.errors?.[0]?.detail ?? body.errors?.[0]?.title ?? `HTTP ${res.status}`;

  // A failed listing must not read as "no webhook yet": creating one then
  // would leave the store posting every event twice.
  const listRes = await fetch(`${LEMONSQUEEZY_API}/webhooks?filter[store_id]=${encodeURIComponent(store)}&page[size]=100`, { headers });
  const list = (await listRes.json().catch(() => ({}))) as Reply & { data?: Array<{ id: string; attributes: { url: string } }> };
  if (!listRes.ok || !list.data) { console.log(`Lemon Squeezy: could not list webhooks — ${why(listRes, list)}`); return; }
  const ours = list.data.find((w) => w.attributes.url.endsWith('/api/webhooks/lemonsqueezy'));

  const existing = readEnv('server/.env', 'LEMONSQUEEZY_WEBHOOK_SECRET');
  const secret = ours && existing ? undefined : existing ?? randomBytes(16).toString('hex');
  const attributes = { url: target, events: LEMONSQUEEZY_EVENTS, ...(secret ? { secret } : {}) };
  const data = ours
    ? { type: 'webhooks', id: ours.id, attributes }
    : { type: 'webhooks', attributes, relationships: { store: { data: { type: 'stores', id: store } } } };
  const res = await fetch(ours ? `${LEMONSQUEEZY_API}/webhooks/${ours.id}` : `${LEMONSQUEEZY_API}/webhooks`, {
    method: ours ? 'PATCH' : 'POST',
    headers,
    body: JSON.stringify({ data }),
  });
  const saved = (await res.json().catch(() => ({}))) as Reply & { data?: { id: string } };
  if (!res.ok || !saved.data) { console.log(`Lemon Squeezy: could not ${ours ? 'update' : 'create'} the webhook — ${why(res, saved)}`); return; }
  console.log(`Lemon Squeezy: webhook ${saved.data.id} → ${target}`);
  if (secret && !existing) { writeEnv('server/.env', 'LEMONSQUEEZY_WEBHOOK_SECRET', secret); console.log('Lemon Squeezy: new signing secret written to server/.env'); }
}

const url = argUrl ?? (await startTunnel());
console.log(`\nPublic address: ${url}\n`);

for (const file of ENV_FILES) writeEnv(file, 'NEXT_PUBLIC_APP_URL', url);
console.log(`NEXT_PUBLIC_APP_URL written to ${ENV_FILES.join(' and ')}`);

if (keepWebhooks) {
  console.log('Webhooks left alone (--keep-webhooks): billing and account events keep going to wherever they point now.\n');
} else {
  await repointLemonSqueezy(url);
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
