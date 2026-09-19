'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandMark } from '~/components/brand-mark';
import { ThemeToggle } from '~/components/theme-toggle';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/classname';

// The landing page sections these point at. Smooth scrolling and the offset that
// keeps a heading clear of this sticky bar are both handled in globals.css.
const sections = [
  { label: 'Features', hash: '#features' },
  { label: 'Blocks', hash: '#blocks' },
  { label: 'Contact', hash: '#contact' },
];

/** Which section the viewport is currently in. The rule is positional, not
 *  intersection-based: the active section is the last one whose top has passed
 *  a line 35% down the viewport. Deterministic at every scroll position, and
 *  cheap enough to run on a throttled scroll listener. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setActive(null);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.35;
      let current: string | null = null;
      for (const { hash } of sections) {
        const el = document.getElementById(hash.slice(1));
        if (el && el.getBoundingClientRect().top <= line) current = hash;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return active;
}

// Fetched only for a signed-in visitor: it brings Clerk with it, and a
// visitor who is not signed in has no use for either.
const HeaderUserMenu = dynamic(() => import('~/components/header-user-menu'), { ssr: false });

/**
 * Whether anyone is signed in, read the way Clerk's own client reads it
 * before it has loaded: `__client_uat` is the cookie Clerk keeps for
 * exactly this, the time of the last sign-in or 0 for nobody. It is the
 * hint and not the session — the session is httpOnly and verified where
 * it matters — but a hint is all a header needs to choose its button. Read
 * after mount: the page is prerendered and has no cookie at build time.
 */
function useSignedInHint(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const uat = document.cookie.split('; ').find((c) => c.startsWith('__client_uat='))?.split('=')[1];
    setSignedIn(!!uat && uat !== '0');
  }, []);
  return signedIn;
}

export function Header() {
  const isSignedIn = useSignedInHint();
  const pathname = usePathname();
  // This header is shared with the playground, where those sections do not
  // exist — from anywhere but the landing page the links have to route home
  // first rather than scroll to nothing.
  const onLanding = pathname === '/';
  const active = useActiveSection(onLanding);
  // The playground's phone shell brings its own sticky top bar at z-40, and
  // this one is z-50 on the same edge — so once the page scrolled it painted
  // over the editor's subject, preview and Publish. Above `sm` the editor
  // sits inside the marketing page as usual and the header stays.
  const onEditor = pathname === '/playground';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-md',
        onEditor && 'hidden sm:block',
      )}
    >
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-5">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark className="size-4.5 text-accent" />
            <span className="font-display text-base font-semibold tracking-tight text-ink">Temply</span>
          </Link>

          <nav aria-label="Page sections" className="hidden items-center gap-6 md:flex">
            {sections.map((section) => {
              const isActive = onLanding && active === section.hash;
              const className = `text-sm transition-colors ${
                isActive ? 'font-medium text-accent-ink' : 'text-muted hover:text-ink'
              }`;
              return onLanding ? (
                <a
                  key={section.hash}
                  href={section.hash}
                  aria-current={isActive ? 'true' : undefined}
                  className={className}
                >
                  {section.label}
                </a>
              ) : (
                <Link key={section.hash} href={`/${section.hash}`} className={className}>
                  {section.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {isSignedIn ? (
            <>
              <Button asChild>
                <Link href="/dashboard/templates">Dashboard</Link>
              </Button>
              <div className="hidden sm:block">
                <HeaderUserMenu />
              </div>
            </>
          ) : (
            <Button asChild variant="primary">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
