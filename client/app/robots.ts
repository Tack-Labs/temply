import type { MetadataRoute } from 'next';
import { SITE_URL } from '~/lib/site';

/** Crawlers may index the marketing pages and nothing behind sign-in. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: ['/dashboard', '/templates', '/onboarding', '/p/', '/api/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
