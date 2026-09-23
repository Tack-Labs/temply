export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function unauthorized(message = 'Unauthorized') {
  return new Response(JSON.stringify({ status: 401, message, errors: [message] }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function notFound(message = 'Not found') {
  return new Response(JSON.stringify({ status: 404, message, errors: [message] }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function badRequest(message: string) {
  return new Response(JSON.stringify({ status: 400, message, errors: [message] }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The request was well-formed but the data cannot be used as sent. */
export function unprocessable(message: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ status: 422, message, errors: [message], ...extra }), {
    status: 422,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function paymentRequired(message: string) {
  return new Response(JSON.stringify({ status: 402, message, errors: [message] }), {
    status: 402,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Maps an Elysia error code onto the JSON error envelope. A routing miss, a
 * schema failure, or a body that won't parse is the client's error, not a
 * server fault — everything else stays a 500.
 */
export function errorResponse(code: string | number, error: unknown): Response {
  // A ValidationError's .message is its whole diagnostic JSON; the `summary`
  // field inside is the one human sentence, which is what a toast should show.
  let message = error instanceof Error ? error.message : 'Internal Server Error';
  if (code === 'VALIDATION' && message.startsWith('{')) {
    try {
      const parsed = JSON.parse(message) as { summary?: unknown };
      if (typeof parsed.summary === 'string') message = parsed.summary;
    } catch {
      // Not the JSON shape we expected — the raw message is still truthful.
    }
  }
  const status =
    code === 'NOT_FOUND' ? 404 : code === 'VALIDATION' || code === 'PARSE' ? 400 : 500;
  return json({ status, message, errors: [message] }, status);
}

/**
 * A limit that clears by itself. Retry-After is what a well-behaved client
 * sleeps on; the body says which limit so the integrator knows whether to
 * back off or upgrade.
 */
export function tooManyRequests(message: string, retryAfterSeconds: number) {
  return new Response(JSON.stringify({ status: 429, message, errors: [message] }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSeconds) },
  });
}
