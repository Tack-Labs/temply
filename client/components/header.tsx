'use client';

import { MenuIcon, XIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '~/components/brand-mark';
import { ThemeToggle } from '~/components/theme-toggle';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/classname';
import { SIGNED_IN_HOME } from '~/lib/routes';

// The landing page sections these point at. Smooth scrolling and the offset that
// keeps a heading clear of this sticky bar (`--header-h`) are both handled in
// globals.css.
const sections = [
  { label: 'Features', hash: '#features' },
  { label: 'Blocks', hash: '#blocks' },
  { label: 'Pricing', hash: '#pricing' },
  { label: 'Contact', hash: '#contact' },
];

type Section = (typeof sections)[number];

const MENU_ID = 'site-menu';

// Tailwind's `md` (48rem): from here the sections sit inline in the bar and
// the menu button is gone, so an open menu has nothing left to belong to.
const WIDE = '(min-width: 48rem)';

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
// visitor who is not signed in has no use for either. The placeholder holds
// the trigger's 40px (a 28px avatar in 6px of padding) so the toggle beside it
// does not slide left when Clerk arrives.
const HeaderUserMenu = dynamic(() => import('~/components/header-user-menu'), {
  ssr: false,
  loading: () => (
    <div className="p-1.5">
      <Skeleton className="size-7 rounded-full" />
    </div>
  ),
});

/**
 * Whether anyone is signed in, read the way Clerk's own client reads it
 * before it has loaded: `__client_uat` is the cookie Clerk keeps for
 * exactly this, the time of the last sign-in or 0 for nobody. It is the
 * hint and not the session — the session is httpOnly and verified where
 * it matters — but a hint is all a header needs to choose its button. Read
 * after mount: the page is prerendered and has no cookie at build time.
 */
function useSignedInHint(): [boolean, (signedIn: boolean) => void] {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const uat = document.cookie.split('; ').find((c) => c.startsWith('__client_uat='))?.split('=')[1];
    setSignedIn(!!uat && uat !== '0');
  }, []);
  return [signedIn, setSignedIn];
}

/** One section link. On the landing page it scrolls; anywhere else it routes
 *  home first, because the section it names is not on this page. */
function SectionLink({
  section,
  onLanding,
  current,
  className,
  onNavigate,
}: {
  section: Section;
  onLanding: boolean;
  current: boolean;
  className: string;
  onNavigate?: () => void;
}) {
  const props = {
    className,
    onClick: onNavigate,
    'aria-current': current ? ('true' as const) : undefined,
  };
  return onLanding ? (
    <a href={section.hash} {...props}>
      {section.label}
    </a>
  ) : (
    <Link href={`/${section.hash}`} {...props}>
      {section.label}
    </Link>
  );
}

// Both icons occupy one cell and cross over, so the button turns into its own
// close mark rather than swapping glyphs.
const iconMotion = 'transition-[opacity,rotate,scale] duration-base ease-out motion-reduce:transition-none';

export function Header() {
  // A hint can be stale: a session that expired without a sign-out leaves
  // the stamp behind. The menu it summons brings Clerk, and Clerk's answer
  // corrects the header.
  const [isSignedIn, setSignedIn] = useSignedInHint();
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

  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setMenuOpen(false);

  // A link that routes closes the menu with the page it was opened on.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // While open, the menu answers to the ways out that a click on one of its
  // own links does not cover. Escape hands focus back to the button: the
  // panel is about to be hidden, and focus left inside it would fall to the
  // top of the page. The panel is not modal, so a Tab can leave it, and a
  // keyboard user who has gone on into the page has nothing left that would
  // close it: focus arriving anywhere outside the bar closes it, and stays
  // where it went. The event's `relatedTarget` is null when focus goes to the
  // browser's own chrome or the window loses it, and neither is leaving the
  // bar for the page, so a null is not a way out. Escape is the menu's only
  // when nothing else has claimed it: not once something has prevented the
  // event (Radix does, for the user menu it closes) and not while focus sits
  // outside the bar. Focus on the body counts as nobody's, since Safari does
  // not focus a button that was clicked and the menu would otherwise have no
  // Escape for a mouse user.
  useEffect(() => {
    if (!menuOpen) return;
    const header = headerRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const focus = document.activeElement;
      if (focus && focus !== document.body && !header?.contains(focus)) return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Element && !header?.contains(next)) setMenuOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!header?.contains(event.target as Node)) setMenuOpen(false);
    };
    const wide = window.matchMedia(WIDE);
    const onWiden = () => {
      if (wide.matches) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    header?.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onPointerDown);
    wide.addEventListener('change', onWiden);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      header?.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('pointerdown', onPointerDown);
      wide.removeEventListener('change', onWiden);
    };
  }, [menuOpen]);

  return (
    // The height is fixed at `--header-h` (globals.css) and every offset that
    // clears this bar reads the same variable. The menu panel is absolutely
    // positioned below the bar, so opening it overlays the page and never
    // moves it.
    <header
      ref={headerRef}
      className={cn(
        'sticky top-0 z-50 h-(--header-h) border-b border-line backdrop-blur-md transition-colors duration-base ease-out motion-reduce:transition-none',
        // The bar is translucent over the page; with the panel hanging from
        // it the two have to read as one opaque surface.
        menuOpen ? 'bg-surface' : 'bg-surface/85',
        onEditor && 'hidden sm:block',
      )}
    >
      {/* The gutter stays 20px so the bar's edges line up with the page below.
          At 320px a signed-in visitor's wordmark and three 44px targets overrun
          the 280px inside it by 2px at a 12px gap between the groups, so below
          `sm` the gap is 6px. */}
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-1.5 px-5 sm:gap-3">
        <div className="flex items-center gap-10">
          <Link href="/" className="-mx-1 flex min-h-11 items-center gap-2.5 rounded-md px-1">
            <BrandMark className="size-5.5 text-accent" />
            <span className="font-display text-xl font-bold tracking-display text-ink">Temply</span>
          </Link>

          <nav aria-label="Page sections" className="hidden md:block">
            <ul className="flex items-center gap-7">
              {sections.map((section) => {
                const current = onLanding && active === section.hash;
                return (
                  <li key={section.hash}>
                    <SectionLink
                      section={section}
                      onLanding={onLanding}
                      current={current}
                      // One weight for every state: a heavier active link
                      // would be wider and nudge its neighbours along.
                      className={cn(
                        'block rounded-sm py-2 text-sm font-medium transition-colors duration-fast ease-out motion-reduce:transition-none',
                        current ? 'text-accent-ink' : 'text-muted hover:text-ink',
                      )}
                    />
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          {isSignedIn ? (
            <>
              {/* Both buttons share a minimum width, so the one swapped for
                  the other once the cookie is read takes the same room. */}
              {/* A plain anchor, not a Link, because this page loads no Clerk:
                  nothing renews the session cookie, which lasts about a
                  minute, so by the click it has usually expired. Clerk's
                  middleware renews it with a handshake only a full page
                  request can follow; a Link's fetch is read as signed out and
                  sent to the login page. A Link would also prefetch that
                  redirect and keep it. */}
              <Button asChild className="sm:min-w-24">
                <a href={SIGNED_IN_HOME}>Dashboard</a>
              </Button>
              <div className="hidden sm:block">
                <HeaderUserMenu onSignedOut={() => setSignedIn(false)} />
              </div>
            </>
          ) : (
            <Button asChild variant="primary" className="sm:min-w-24">
              <Link href="/login">Sign in</Link>
            </Button>
          )}

          {/* The name stays put and aria-expanded says which way it will go: a
              name that flipped as well would be a second state signal, heard
              twice by a screen reader. */}
          <Button
            ref={menuButton}
            size="icon"
            className="md:hidden"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls={MENU_ID}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="grid place-items-center *:col-start-1 *:row-start-1">
              <MenuIcon className={cn(iconMotion, menuOpen && 'scale-50 rotate-90 opacity-0')} />
              <XIcon className={cn(iconMotion, !menuOpen && 'scale-50 -rotate-90 opacity-0')} />
            </span>
          </Button>
        </div>
      </div>

      {/* The same sections as the bar's own nav, for a screen too narrow to
          hold them. The two are never both on screen or in the accessibility
          tree: the bar's is display:none below `md`, this one is display:none
          from it, and closed it is `visibility: hidden` — which, unlike
          aria-hidden and inert, lifts by itself at a width where it no longer
          applies, and is what keeps the links out of the tab order and out of
          a screen reader's list while the panel is collapsed. It follows the
          menu button in the source so Tab from the button lands on the first
          link. The border on each link is the divider under the bar. */}
      <div
        id={MENU_ID}
        className={cn(
          'absolute inset-x-0 top-full grid border-b border-line bg-surface shadow-lg md:hidden',
          'transition-[grid-template-rows,visibility] duration-base ease-out motion-reduce:transition-none',
          menuOpen ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
        )}
      >
        <nav aria-label="Page sections" className="min-h-0 overflow-hidden">
          <ul className="px-5 pb-2">
            {sections.map((section) => {
              const current = onLanding && active === section.hash;
              return (
                <li key={section.hash}>
                  <SectionLink
                    section={section}
                    onLanding={onLanding}
                    current={current}
                    onNavigate={closeMenu}
                    className={cn(
                      'flex min-h-13 items-center border-t border-line text-lg font-semibold transition-colors duration-fast ease-out motion-reduce:transition-none',
                      current ? 'text-accent-ink' : 'text-ink hover:text-accent-ink',
                    )}
                  />
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
