import type { ReactNode } from 'react';
import Link from 'next/link';
import { LEGAL } from '~/lib/legal';

/** The frame a legal document sits in: a title, the date it was last
 *  changed, a measure that reads, and a cross-link to its sibling. */
export function LegalPage({
  title,
  intro,
  sibling,
  children,
}: {
  title: string;
  intro: string;
  sibling: { href: string; label: string };
  children: ReactNode;
}) {
  const updated = new Date(LEGAL.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="mx-auto max-w-2xl px-5 pt-16 pb-24 sm:pt-20">
      <header>
        <p className="font-mono text-2xs tracking-[0.16em] text-accent-ink uppercase">Legal</p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-display text-balance text-ink lg:text-4xl">{title}</h1>
        <p className="mt-4 max-w-xl text-lg text-pretty text-muted">{intro}</p>
        <p className="mt-4 text-base text-muted">
          Last updated {updated} ·{' '}
          <A href={sibling.href}>{sibling.label}</A>
        </p>
      </header>
      <div className="mt-14 space-y-12">{children}</div>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-[calc(var(--header-h)+1.5rem)]">
      <h2 className="font-display text-2xl font-semibold tracking-display text-balance text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-lg leading-relaxed text-pretty text-muted">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6 marker:text-muted">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

/** A link in the running text: an in-app route or an outside address alike. */
export function A({ href, children, rel }: { href: string; children: ReactNode; rel?: string }) {
  const className =
    'text-accent-ink underline-offset-4 transition-colors duration-fast ease-out hover:underline motion-reduce:transition-none';
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} rel={rel}>
      {children}
    </a>
  );
}
