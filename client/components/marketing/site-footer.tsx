import Link from 'next/link';

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
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-5 px-5 py-6 text-sm text-muted">
        <p>&copy; {new Date().getFullYear()} Temply</p>
        <nav aria-label="Site links" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-ink hover:underline">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
