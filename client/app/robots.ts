import type { MetadataRoute } from 'next';
import { PRODUCTION_SITE_URL } from '~/lib/site';

/** Private pages allow crawling so their noindex headers can be read. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${PRODUCTION_SITE_URL}/sitemap.xml`,
  };
}
