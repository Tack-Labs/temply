import Link from 'next/link';
import { container } from '~/components/marketing/container';
import { cn } from '~/lib/classname';

const links = [
  { href: '/docs', label: 'Docs' },
  { href: '/playground', label: 'Try the editor' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#contact', label: 'Contact' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      {/* The links come first in the source, so they are first for a screen
          reader and in the tab order. Both layouts reverse that: the
          copyright sits above them on a phone and on the left edge from md,
          with the links on the right. */}
      <div
        className={cn(
          container,
          'flex flex-col-reverse gap-3 pt-6 pb-10 text-ui text-muted md:flex-row-reverse md:items-center md:justify-between md:gap-5',
        )}
      >
        {/* The pills are 12px wider than their words on each side; on a phone
            the first word is pulled back onto the gutter, where the copyright
            above it starts. */}
        <nav aria-label="Site links" className="-ml-3 flex flex-wrap items-center gap-x-1 md:ml-0 md:gap-x-1.5">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center rounded-full px-3 transition-colors duration-fast ease-out hover:bg-hover hover:text-ink motion-reduce:transition-none"
            >
              {label}
            </Link>
          ))}
        </nav>
        <p>&copy; {new Date().getFullYear()} Temply</p>
      </div>
    </footer>
  );
}
