/** Canonical links always name the public host, including on previews. */
export const PRODUCTION_SITE_URL = 'https://temply.tacklabs.co.uk';

/** Local API examples and legal links follow the configured app address. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : 'http://localhost:9000')
).replace(/\/$/, '');

/** Hostname alone, for places that show an address rather than link it. */
export const SITE_HOST = new URL(SITE_URL).host;

/** Where integrators call the public API — the same host, under /api. */
export const PUBLIC_API_URL = `${SITE_URL}/api/public/v1`;

/** Addresses. Kept beside the URL because a domain move changes them too,
 *  but separate from it: mail need not be on the web host. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@temply.app';
export const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || 'sales@temply.app';
