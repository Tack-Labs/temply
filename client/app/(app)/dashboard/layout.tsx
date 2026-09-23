import { SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { MobileNav } from '~/components/dashboard/mobile-nav';
import { Sidebar } from '~/components/dashboard/sidebar';
import { ThemeToggle } from '~/components/theme-toggle';
import { Button } from '~/components/ui/button';
import { serverFetch } from '~/lib/server-fetch';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Rows made before organizations are claimed by the active one on every
  // visit. Idempotent and a handful of empty updates once done; a failure
  // here must not take the dashboard down, so it is swallowed.
  await serverFetch('/api/v1/workspace/adopt', { method: 'POST', body: '{}' }).catch(() => undefined);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <div className="hidden w-56 shrink-0 md:block">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Carries the drawer trigger on narrow viewports; on wide ones the
            sidebar owns navigation and this bar only holds the account
            shortcuts. The gutter matches the main column below so the
            trigger glyph lines up with the page title. */}
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-4 md:justify-end">
          <MobileNav />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon" asChild>
              <Link href="/dashboard/settings" aria-label="Settings" title="Settings">
                <SettingsIcon />
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
