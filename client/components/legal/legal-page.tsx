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
        <p className="font-mono text-2xs tracking-wide text-accent-ink uppercase">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-4 text-lg text-pretty text-muted">{intro}</p>
        <p className="mt-3 text-sm text-faint">
          Last updated {updated} ·{' '}
          <Link href={sibling.href} className="text-accent-ink underline-offset-4 hover:underline">
            {sibling.label}
          </Link>
        </p>
      </header>
      <div className="mt-12 space-y-10">{children}</div>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-ink">{children}</strong>;
}
