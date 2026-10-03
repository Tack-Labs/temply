import { execFileSync } from 'node:child_process';
import type { MetadataRoute } from 'next';
import { PRODUCTION_SITE_URL } from '~/lib/site';
import { PUBLIC_PAGES } from '~/lib/seo';

/** This route is static, so the module runs once, at build. */
const BUILT_AT = new Date();

/**
 * When a page last changed: the last commit that touched what it is made of.
 * The stamp used to be "now", which on a static route meant every deploy,
 * and a crawler that is told everything changed learns nothing from it. A
 * build without git — a tarball, a container — falls back to its own time,
 * which is what every page said before; a shallow clone dates every page at
 * its one commit, so CI fetches the history.
 */
function lastModified(sources: readonly string[]): Date {
  try {
    const stamp = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...sources], { encoding: 'utf8' }).trim();
    if (stamp) return new Date(stamp);
  } catch {
    // No git on this machine, or not a checkout.
  }
  return BUILT_AT;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.entries(PUBLIC_PAGES).map(([path, { sources }]) => ({
    url: `${PRODUCTION_SITE_URL}${path === '/' ? '' : path}`,
    lastModified: lastModified(sources),
  }));
}
