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
  // The headers every response carries. No Content-Security-Policy yet:
  // Clerk, ImageKit and the editor's inline styles each need an allow-list
  // that has to be written against the real hosts, and a wrong one takes
  // sign-in down; the rest costs nothing and closes the common holes.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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
