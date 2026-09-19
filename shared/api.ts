/**
 * The public API's paths, in one place, so the server's routes, the docs and
 * the snippets on the keys page cannot drift from each other. The docs test
 * checks every snippet against these.
 */
export const PUBLIC_API_PREFIX = '/api/public/v1';

/** Every template the key can reach, for an app to discover them by. */
export const PUBLIC_TEMPLATES_ROUTE = `${PUBLIC_API_PREFIX}/templates`;

/** Route pattern for the server (":shortCode" stays a parameter). */
export const PUBLIC_TEMPLATE_ROUTE = `${PUBLIC_API_PREFIX}/templates/:shortCode`;
export const PUBLIC_RENDER_ROUTE = `${PUBLIC_TEMPLATE_ROUTE}/render`;

/** The signed-out review page's data: a share token, no key, the draft. */
export const PUBLIC_PREVIEW_ROUTE = `${PUBLIC_API_PREFIX}/preview/:token`;

export function publicPreviewPath(token: string): string {
  return `${PUBLIC_API_PREFIX}/preview/${token}`;
}

export function publicTemplatesPath(): string {
  return PUBLIC_TEMPLATES_ROUTE;
}

export function publicTemplatePath(shortCode: string): string {
  return `${PUBLIC_API_PREFIX}/templates/${shortCode}`;
}

export function publicRenderPath(shortCode: string): string {
  return `${publicTemplatePath(shortCode)}/render`;
}
