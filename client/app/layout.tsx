import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from 'next/font/google';
import { GoogleAnalytics } from '~/components/google-analytics';
import { Providers } from './providers';
import { PRODUCTION_SITE_URL } from '~/lib/site';
import { PUBLIC_PAGES, publicPageMetadata } from '~/lib/seo';
import '../core/styles/index.css';
import './globals.css';

// Both proportional faces are variable: Google serves one file covering the
// whole weight range, and next/font cannot narrow it, so the 400-700 the UI
// uses costs the same as the full axis. Bricolage's optical-size axis is
// what lets the same file draw a 12px label and a 52px hero differently;
// browsers drive it from font-size.
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-bricolage',
  display: 'swap',
});

// Code is a minority of the text, so the file is fetched when something first
// uses it rather than preloaded. That means a small mono label near the top
// of a page (the eyebrows on /docs and the legal pages) can paint in the
// fallback and swap when the face arrives. Weight is left off, as for
// Figtree: a variable file covers the whole axis, and a listed weight only
// adds a rule per value and leaves anything heavier as faux bold.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: false,
});

const homeMetadata = publicPageMetadata('/');

export const metadata = {
  ...homeMetadata,
  metadataBase: new URL(PRODUCTION_SITE_URL),
  title: { default: `${PUBLIC_PAGES['/'].title} | Temply`, template: '%s | Temply' },
  alternates: {},
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
      <html lang="en-GB" suppressHydrationWarning>
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
        <body className={`${figtree.variable} ${bricolage.variable} ${jetbrainsMono.variable}`}>
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
