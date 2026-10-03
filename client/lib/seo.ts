import type { Metadata } from 'next';
import { PRODUCTION_SITE_URL } from './site';

export const IS_PREVIEW = Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production');
export const SITE_NOINDEX = process.env.SITE_NOINDEX === '1' || IS_PREVIEW;

export const PUBLIC_PAGES = {
  '/': {
    title: 'Visual email editor and template API',
    description: 'Build transactional email templates with a visual block editor. Preview responsive HTML and render it from your app with the Temply API.',
    sources: ['app/(marketing)/page.tsx', 'app/(marketing)/home-client.tsx', 'components/marketing'],
  },
  '/playground': {
    title: 'Email editor playground',
    description: 'Try the Temply email editor without an account. Arrange blocks, add your brand and preview the responsive HTML for your email template.',
    sources: ['app/(marketing)/playground', 'components/email-editor-sandbox.tsx', 'core/editor'],
  },
  '/docs': {
    title: 'Email template API documentation',
    description: 'Learn how to create email templates, manage brands and render HTML with the Temply API. Includes code examples, variables and team permissions.',
    sources: ['app/(marketing)/docs', 'components/docs'],
  },
  '/terms': {
    title: 'Terms of service',
    description: 'Read the terms for using Temply, including accounts, email templates, API access, billing, cancellation and ownership of your content.',
    sources: ['app/(marketing)/terms', 'lib/legal.ts'],
  },
  '/privacy': {
    title: 'Privacy policy',
    description: 'Learn what personal data Temply collects, how it is used and stored, which providers process it, and how to request access or deletion.',
    sources: ['app/(marketing)/privacy', 'lib/legal.ts'],
  },
} as const;

export type PublicPath = keyof typeof PUBLIC_PAGES;

export function publicPageMetadata(path: PublicPath): Metadata {
  const page = PUBLIC_PAGES[path];
  const title = `${page.title} | Temply`;
  const url = `${PRODUCTION_SITE_URL}${path === '/' ? '' : path}`;
  const image = {
    url: '/temply-email-editor.png',
    width: 1200,
    height: 630,
    alt: 'Temply visual email editor. Write the email. We handle the HTML.',
  };
  return {
    title: { absolute: title },
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'en_GB',
      siteName: 'Temply',
      url,
      title,
      description: page.description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description: page.description, images: [image] },
    robots: { index: !SITE_NOINDEX, follow: !SITE_NOINDEX },
  };
}

export function publicPageSchema(path: PublicPath) {
  const page = PUBLIC_PAGES[path];
  const url = `${PRODUCTION_SITE_URL}${path === '/' ? '' : path}`;
  const graph: Record<string, unknown>[] = [{
    '@type': 'WebPage',
    name: page.title,
    headline: page.title,
    description: page.description,
    url,
    inLanguage: 'en-GB',
  }];
  return { '@context': 'https://schema.org', '@graph': graph };
}
