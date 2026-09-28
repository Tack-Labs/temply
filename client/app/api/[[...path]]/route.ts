import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { IMAGE_TOO_LARGE, MAX_REQUEST_BYTES } from '@temply/shared/plans';
import { callApi } from '~/lib/call-api';

// The API runs in this function, so it needs Node, and a render is the
// slowest thing it does.
export const runtime = 'nodejs';
export const maxDuration = 60;

async function handleRequest(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';
  const search = request.nextUrl.search;

  const { userId, orgId, orgRole } = await auth();
  const apiPath = pathStr ? `/api/${pathStr}${search}` : `/api${search}`;

  // Forward all relevant headers
  const headers: Record<string, string> = {
    'Content-Type': request.headers.get('Content-Type') || 'application/json',
    'Cookie': request.headers.get('Cookie') || '',
    'Authorization': request.headers.get('Authorization') || '',
    'x-user-id': userId || '',
    // The active organization and the caller's role in it — the API scopes
    // every row by the former and gates account actions on the latter.
    'x-org-id': orgId || '',
    'x-org-role': orgRole || '',
    // Proves to the API that these forwarded ids came from our own proxy.
    'x-internal-token': process.env.INTERNAL_API_SECRET || '',
  };
  // Webhook signatures ride on their own headers. Stripe and Clerk post to
  // this host, and without these the API sees an unsigned body and refuses
  // every event. Nothing else in the app sends them, so forwarding them is
  // safe: a forged one is still verified against the secret downstream.
  for (const name of ['stripe-signature', 'svix-id', 'svix-timestamp', 'svix-signature']) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  // The API's per-address limits read the client off this header, last hop
  // first. Vercel's edge replaces whatever the client sent with the address
  // it saw, and a request that arrived without one is coming from this
  // machine.
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;

  // On Vercel a body this size never gets here. Refusing it locally too
  // keeps a run on this machine failing where production would.
  if (request.method !== 'GET' && request.method !== 'HEAD' && Number(request.headers.get('Content-Length') || 0) > MAX_REQUEST_BYTES) {
    return NextResponse.json({ status: 413, message: IMAGE_TOO_LARGE, errors: [IMAGE_TOO_LARGE] }, { status: 413 });
  }

  // Read bytes, not text: a multipart image upload passes through here and
  // decoding it as UTF-8 would corrupt every byte above 0x7f.
  const body = request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined;

  const res = await callApi(apiPath, { method: request.method, headers, body });

  const data = await res.text();
  const response = new NextResponse(data, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    },
  });

  // The API decides what may be cached (template previews send immutable
  // versioned responses); without forwarding, the browser treats every proxied
  // response as uncacheable and refetches thumbnails on each visit.
  const cacheControl = res.headers.get('Cache-Control');
  if (cacheControl) response.headers.set('Cache-Control', cacheControl);

  // An integrator's retry waits on this; the docs tell them to read it rather
  // than guess a backoff.
  const retryAfter = res.headers.get('Retry-After');
  if (retryAfter) response.headers.set('Retry-After', retryAfter);

  // Forward any Set-Cookie the API returns so cookie-setting routes work through
  // the proxy; getSetCookie keeps multiple cookies intact.
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie') as string]
        : [];
  for (const cookie of setCookies) {
    response.headers.append('set-cookie', cookie);
  }

  return response;
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
