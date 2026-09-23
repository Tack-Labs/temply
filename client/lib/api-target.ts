/**
 * Where the Next.js side reaches the API. Server-only: the proxy route and
 * serverFetch read it, the browser never does. Unset in development, where
 * the API binds to IPv4 loopback only — it is addressed explicitly rather
 * than via `localhost`, which resolves to ::1 first on macOS.
 */
export const API_TARGET = (process.env.API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
