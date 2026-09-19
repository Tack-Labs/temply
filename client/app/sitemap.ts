import { execFileSync } from 'node:child_process';
import type { MetadataRoute } from 'next';
import { SITE_URL } from '~/lib/site';

/** The public pages, each with the sources whose last change dates it. Paths
 *  are relative to the client package, which is where `next build` runs. */
const PAGES: Array<{ path: string; sources: string[] }> = [
  { path: '', sources: ['app/(marketing)/page.tsx', 'components/marketing'] },
  { path: '/playground', sources: ['app/(marketing)/playground', 'components/email-editor-sandbox.tsx', 'core/editor'] },
  { path: '/docs', sources: ['app/(marketing)/docs', 'components/docs'] },
  { path: '/terms', sources: ['app/(marketing)/terms', 'lib/legal.ts'] },
  { path: '/privacy', sources: ['app/(marketing)/privacy', 'lib/legal.ts'] },
];

/** This route is static, so the module runs once, at build. */
const BUILT_AT = new Date();

/**
 * When a page last changed: the last commit that touched what it is made of.
 * The stamp used to be "now", which on a static route meant every deploy,
 * and a crawler that is told everything changed learns nothing from it. A
 * build without git — a tarball, a container — falls back to its own time,
 * which is at least not later than the truth.
 */
function lastModified(sources: string[]): Date {
  try {
    const stamp = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...sources], { encoding: 'utf8' }).trim();
    if (stamp) return new Date(stamp);
  } catch {
    // No git on this machine, or not a checkout.
  }
  return BUILT_AT;
}

/** Served at /sitemap.xml by Next, built from the configured site URL so it
 *  cannot name a domain the site is not on. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, sources }) => ({ url: `${SITE_URL}${path}`, lastModified: lastModified(sources) }));
}
