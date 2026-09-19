import type { Metadata } from 'next';
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google';
import { GoogleAnalytics } from '~/components/google-analytics';
import { Providers } from './providers';
import { SITE_URL } from '~/lib/site';
import '../core/styles/index.css';
import './globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-geist-mono',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  // Every relative URL below — the OG image, canonical links — resolves
  // against this, so the domain lives in one environment variable.
  metadataBase: new URL(SITE_URL),
  title: 'Temply — write the email, we handle the HTML',
  description:
    'A block editor for transactional email. Build it without code, send it from your own app.',
  twitter: {
    card: 'summary_large_image',
    title: 'Temply — write the email, we handle the HTML',
    description:
      'A block editor for transactional email. Build it without code, send it from your own app.',
    images: ['/og-image.png'],
  },
  openGraph: {
    siteName: 'Temply',
    title: 'Temply — write the email, we handle the HTML',
    description:
      'A block editor for transactional email. Build it without code, send it from your own app.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/brand/logo.svg',
  },
  robots: 'index, follow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* The font variables go on <body>, not <html>. Giving <html> a
          className hands it to React, which then reconciles it on hydration and
          strips the `dark` class the blocking script below just added — so a
          full page load would drop the user's chosen theme. */}
      <html lang="en" suppressHydrationWarning>
        <head>
          <GoogleAnalytics />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var theme = localStorage.getItem('theme');
                    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                      document.documentElement.classList.add('dark');
                    }
                  } catch(e) {}
                })();
              `,
            }}
          />
        </head>
        <body className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable}`}>
          {/* First focusable element on the page. Lets a keyboard user jump the
              header and sidebar straight to the content. */}
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Providers>{children}</Providers>
        </body>
      </html>
    </>
  );
}
