/**
 * The product's own addresses, read once from the environment, so the web
 * host, the API base and every mail address have one home. The client's
 * copy of this module is inlined by Next at build time, which is why every
 * read is a literal `process.env.NAME` rather than a lookup by key.
 *
 * Nothing here falls back to a domain the product does not own. An address
 * left unset is derived from the site's own host, so a missing variable
 * shows up as `hello@localhost` in development rather than as mail from a
 * stranger's domain. The one named host is the canonical one, which search
 * engines and share cards print whatever host a preview is served from.
 */
export const PRODUCT_NAME = 'Temply';

const LOCAL_SITE_URL = 'http://localhost:9000';
const production = process.env.NODE_ENV === 'production';

const trimSlash = (url: string) => url.replace(/\/$/, '');

/** Canonical links always name the public host, including on previews. */
export const PRODUCTION_SITE_URL = trimSlash(process.env.NEXT_PUBLIC_SITE_URL || 'https://temply.tacklabs.co.uk');

/** Where the app is served from: links, webhooks, API examples and the
 *  legal pages all print it. A public dev preview points it at a tunnel. */
export const SITE_URL = trimSlash(
  process.env.NEXT_PUBLIC_APP_URL || (production ? PRODUCTION_SITE_URL : LOCAL_SITE_URL),
);

/** Hostname alone, for places that show an address rather than link it. */
export const SITE_HOST = new URL(SITE_URL).host;

/** The domain mail is addressed at: the host without its port. Mail need
 *  not be on the web host, which is what the variables below are for. */
const MAIL_DOMAIN = new URL(SITE_URL).hostname;

/** Where integrators call the public API — the same host, under /api. */
export const PUBLIC_API_URL = `${SITE_URL}/api/public/v1`;

/** The addresses the pages print. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || `hello@${MAIL_DOMAIN}`;
export const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || `sales@${MAIL_DOMAIN}`;

/** Server only: the verified sender test sends and contact mail go out
 *  from, and the label a sender's own name is shown "via". */
export const SENDING_FROM_ADDRESS = process.env.SENDING_FROM_ADDRESS || `send@${MAIL_DOMAIN}`;
export const SENDING_FROM_LABEL = process.env.SENDING_FROM_LABEL || PRODUCT_NAME;
export const CONTACT_FROM_ADDRESS = process.env.CONTACT_FROM_EMAIL || SENDING_FROM_ADDRESS;

/*
 * The same values read at call time, for the API. The constants above are
 * fixed when the module loads, which is what the client needs (Next inlines
 * them at build) but not what a server test does: it sets the environment
 * after the routes are imported, and a route that read a constant would
 * answer with the value from before.
 */
export function siteUrl(): string {
  return trimSlash(process.env.NEXT_PUBLIC_APP_URL || (production ? PRODUCTION_SITE_URL : LOCAL_SITE_URL));
}
const mailDomain = () => new URL(siteUrl()).hostname;
export const sendingFrom = () => process.env.SENDING_FROM_ADDRESS || `send@${mailDomain()}`;
export const sendingLabel = () => process.env.SENDING_FROM_LABEL || PRODUCT_NAME;
export const contactFrom = () => process.env.CONTACT_FROM_EMAIL || sendingFrom();
