'use client';

import { MenuIcon, XIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '~/components/brand-mark';
import { container } from '~/components/marketing/container';
import { ThemeToggle } from '~/components/theme-toggle';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/classname';
import { SIGNED_IN_HOME } from '~/lib/routes';
import { useHydrated } from '~/hooks/use-hydrated';

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

// The bar's call to action, a 46px pill from `sm`: a size class on a button
// only sets it for a fine pointer, and md has no coarse step, so this holds
// on a tablet as well. Below `sm` each call site brings its own. No glow: the
// bar is 72px tall and the shadow `md` carries would spill onto the page.
const cta = 'shadow-sm sm:h-11.5 sm:px-4 sm:text-ui lg:px-5';

// Both icons occupy one cell and cross over, so the button turns into its own
// close mark rather than swapping glyphs.
const iconMotion = 'transition-[opacity,rotate,scale] duration-base ease-out motion-reduce:transition-none';

export function Header() {
  const hydrated = useHydrated();
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
      {/* The shared column, so the bar's edges are the page's. At 320px a
          signed-in visitor's wordmark and three 44px targets fill the 280px
          inside its gutter to within a few pixels: below `sm` the gap between
          them is 6px and the wordmark is one step smaller. At `md` the four
          pills, the wordmark and the buttons' reserved room share 704px with
          about 19px to spare, so the pills and both buttons take a step less
          padding until `lg`. */}
      <div className={cn(container, 'flex h-full items-center justify-between gap-1.5 sm:gap-2 lg:gap-3')}>
        {/* The wordmark is the one item that gives way, so a bar never runs
            past the screen: the buttons keep their 44px, and a width too
            narrow for all of it clips the name instead. */}
        <Link href="/" className="-mx-1 flex min-h-11 min-w-0 items-center gap-2 rounded-md px-1 min-[24rem]:gap-2.5">
          <BrandMark className="size-5.5 shrink-0 text-accent min-[24rem]:size-6.5" />
          <span className="min-w-0 truncate font-display text-xl font-bold tracking-display text-ink min-[24rem]:text-2xl">
            Temply
          </span>
        </Link>

        <nav aria-label="Page sections" className="hidden md:block">
          <ul className="flex items-center gap-0.5 lg:gap-1">
            {sections.map((section) => {
              const current = onLanding && active === section.hash;
              return (
                <li key={section.hash}>
                  <SectionLink
                    section={section}
                    onLanding={onLanding}
                    current={current}
                    // One weight for every state: a heavier active link would
                    // be wider and nudge its neighbours along.
                    className={cn(
                      'flex min-h-11 items-center rounded-full px-2.5 text-ui font-medium transition-colors duration-fast ease-out motion-reduce:transition-none lg:px-4 lg:text-lg',
                      current ? 'bg-accent-wash text-accent-ink' : 'text-muted hover:bg-hover hover:text-ink',
                    )}
                  />
                </li>
              );
            })}
          </ul>
        </nav>

        {/* The page is static, so the first paint is every visitor's signed-out
            bar and the cookie is read after hydration: Dashboard then takes the
            place of Sign in and the pill, and the sections between the wordmark
            and this group would slide across the page by half of what it gave
            up. From `sm` it is held to the widest state, signed out, which is
            wider than a signed-in one with Clerk's 40px avatar in it, and the
            slack gathers beside the sections because the group is right-aligned.
            The classes are what the signed-out group measures at each step, in
            the bar's own faces, plus 2px for a face that sets a hair wider:
            310px with the menu button at `sm`, 258px from `md` and 274px from
            `lg`, where the buttons take more padding. Below `sm` it is
            Dashboard that is the wider of the two, by 24px, and that is left
            to move the toggle: held to it, a 320px bar would clip the
            wordmark of everyone signed out. */}
        <div className="flex items-center justify-end gap-1.5 sm:min-w-78 sm:gap-2 md:min-w-65 lg:min-w-69">
          {/* A fine pointer gets the 44px too: this is the one control in the
              bar that is not a link, and at 320px a smaller one would sit
              beside two that are not. */}
          <div className="[&>button]:size-11">
            <ThemeToggle />
          </div>

          {isSignedIn ? (
            <>
              {/* A plain anchor, not a Link, because this page loads no Clerk:
                  nothing renews the session cookie, which lasts about a
                  minute, so by the click it has usually expired. Clerk's
                  middleware renews it with a handshake only a full page
                  request can follow; a Link's fetch is read as signed out and
                  sent to the login page. A Link would also prefetch that
                  redirect and keep it. */}
              <Button asChild variant="primary" size="md" className={cn(cta, 'h-11 px-3 text-sm')}>
                <a href={SIGNED_IN_HOME}>Dashboard</a>
              </Button>
              <div className="hidden sm:block">
                <HeaderUserMenu onSignedOut={() => setSignedIn(false)} />
              </div>
            </>
          ) : (
            <>
              {/* Quiet, so the pill after it is the one thing in the bar that
                  asks for a click. Kept at every width: it is how someone who
                  already has an account gets in. */}
              <Button asChild variant="ghost" size="compact" className="h-11 px-3 font-semibold text-ink sm:text-ui lg:px-4">
                <Link href="/login">Sign in</Link>
              </Button>
              {/* Below `sm` there is no room for it: at 320px the wordmark, the
                  toggle, Sign in and the menu button already fill the bar. */}
              <Button asChild variant="primary" size="md" className={cn(cta, 'hidden sm:inline-flex')}>
                <Link href="/sign-up">Start free trial</Link>
              </Button>
            </>
          )}

          {/* Named for what it controls, not for the action it is about to take,
              so the name is true in both states and aria-expanded says which:
              "Open menu" would be wrong the moment the panel was open, and a
              name that flipped as well would be a second state signal, heard
              twice by a screen reader. */}
          <Button
            ref={menuButton}
            size="icon"
            className="size-11 md:hidden"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls={MENU_ID}
            disabled={!hydrated}
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
