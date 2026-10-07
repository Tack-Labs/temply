import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { BrandMark } from '~/components/brand-mark';
import { BillingBanner } from '~/components/dashboard/billing-banner';
import { MobileNav } from '~/components/dashboard/mobile-nav';
import { Sidebar } from '~/components/dashboard/sidebar';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';
import { serverFetch } from '~/lib/server-fetch';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Rows made before organizations are claimed by the active one on every
  // visit. Idempotent and a handful of empty updates once done; a failure
  // here must not take the dashboard down, so it is swallowed.
  const { orgRole } = await auth();
  const [, platformAdmin] = await Promise.all([
    serverFetch('/api/v1/workspace/adopt', { method: 'POST', body: '{}' }).catch(() => undefined),
    orgRole === 'org:admin'
      ? serverFetch('/api/v1/admin/access', { cache: 'no-store' })
          .then(async (response) => response.ok && (await response.json()).allowed === true)
          .catch(() => false)
      : Promise.resolve(false),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <div className="hidden w-62 shrink-0 md:block">
        <Sidebar platformAdmin={platformAdmin} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Only where the sidebar is not: it carries the drawer trigger and the
            brand, and the theme toggle and Settings are in the drawer's copy
            of the sidebar. The bar is 56px so the 44px trigger keeps room for
            its focus ring, which stands 5px off the control. The trigger's
            box is pulled back (see MobileNav) so its glyph lines up with the
            page's gutter below. */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b-[1.5px] border-line bg-raised px-4 md:hidden">
          <MobileNav platformAdmin={platformAdmin} />
          <Link
            href="/dashboard"
            className={cn(
              'flex h-11 items-center gap-2.5 rounded-field px-2 font-display text-xl font-bold tracking-display text-ink',
              pressable,
            )}
          >
            <BrandMark className="size-5.5 shrink-0 text-accent" />
            Temply
          </Link>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-8 lg:px-13 lg:py-11">
          <div className="mx-auto max-w-6xl">
            <BillingBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
