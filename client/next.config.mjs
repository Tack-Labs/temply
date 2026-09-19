import { withSentryConfig } from '@sentry/nextjs/config';

/** The host of NEXT_PUBLIC_APP_URL when it is not localhost, else nothing. */
function devOriginFromEnv() {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_APP_URL ?? '').host;
    return host && !host.startsWith('localhost') ? [host] : [];
  } catch {
    return [];
  }
}

/**
 * The host Clerk's client talks to, read off the publishable key the way
 * Clerk's own SDK reads it: the part after the prefix is that host in
 * base64, with a `$` on the end. The dev instance lives under
 * clerk.accounts.dev and the production one under a subdomain of ours, so
 * the policy cannot name it ahead of time.
 */
function clerkHostFromKey() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const encoded = key.replace(/^pk_(test|live)_/, '');
  try {
    const host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : '';
  } catch {
    return '';
  }
}

/** Sentry's ingest host, from the DSN, when there is one. */
function sentryHostFromDsn() {
  try {
    return process.env.NEXT_PUBLIC_SENTRY_DSN ? `https://${new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).host}` : '';
  } catch {
    return '';
  }
}

/**
 * The Content-Security-Policy, reported and not yet enforced. Every host
 * here is one the app actually reaches: Clerk (its script, its frames and
 * Cloudflare's bot check), Sentry's ingest, and Google Fonts inside the
 * preview frame. Uploads go to our own API, which talks to ImageKit; the
 * browser only ever loads the images back, under img-src. Images are wide open on purpose —
 * an email carries images from wherever its author put them, and the
 * previews show the email. Scripts still allow inline: Next's hydration
 * script and the theme script are inline, and moving them behind a nonce
 * means rendering every page dynamically, a separate decision. Report-only
 * first; enforced once a week of reports at /api/csp-report says it would
 * block nothing a customer needs.
 */
function contentSecurityPolicy() {
  const clerk = clerkHostFromKey();
  const sentry = sentryHostFromDsn();
  const dev = process.env.NODE_ENV === 'development';
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", dev && "'unsafe-eval'", clerk, 'https://challenges.cloudflare.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'],
    'connect-src': ["'self'", clerk, sentry, 'https://clerk-telemetry.com'],
    'frame-src': ["'self'", clerk, 'https://challenges.cloudflare.com'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'report-uri': ['/api/csp-report'],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.filter(Boolean).join(' ')}`)
    .join('; ');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The e2e stack builds and serves the client while `next dev` is running
  // from `.next` on 9000; a build into the same directory knocks that dev
  // server over. Both `next build` and `next start` read this config, so
  // one variable steers the pair into a directory of their own.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // A phone on the Wi-Fi or a tunnel reaches the dev server at an address
  // that is not localhost; without this Next refuses their requests for
  // /_next assets as cross-origin. The tunnel host comes from the same
  // variable the rest of the site reads. Ignored outside development.
  allowedDevOrigins: ['192.168.1.192', ...devOriginFromEnv()],
  // The dev indicator sits bottom-right, exactly where the phone shell keeps
  // its + button, and the app is tested on a phone in development. Off,
  // rather than moved: every other corner holds a control on a 390px screen.
  devIndicators: false,
  webpack: (config) => {
    config.resolve.alias['~'] = process.cwd();
    config.resolve.alias['@'] = process.cwd() + '/core';
    return config;
  },
  // The headers every response carries. The Content-Security-Policy is
  // report-only: a wrong allow-list takes sign-in down, so it is watched
  // before it is enforced (see contentSecurityPolicy above).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy() },
          // Only meaningful over HTTPS, and browsers ignore it otherwise, so
          // the LAN dev origin is unaffected.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Nothing here is meant to be framed; the review page is a link,
          // not an embed.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
  // Billing and API keys moved under Settings. These catch bookmarks and Stripe
  // checkout sessions already in flight, whose return URLs were baked at
  // creation.
  async redirects() {
    return [
      { source: '/dashboard/billing', destination: '/dashboard/settings/plan', permanent: false },
      {
        source: '/dashboard/api-keys',
        destination: '/dashboard/settings/api-keys',
        permanent: false,
      },
    ];
  },
};

// Sentry wraps the build to upload source maps when SENTRY_AUTH_TOKEN is
// present (CI and the deploy), and otherwise stays out of the way: a local
// build must not need a Sentry account. Errors are reported by the runtime
// configs regardless of whether maps were uploaded.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
  webpack: { treeshake: { removeDebugLogging: true } },
});
