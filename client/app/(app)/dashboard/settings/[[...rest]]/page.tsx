'use client';

import { UserProfile } from '@clerk/nextjs';
import { useTheme } from '~/components/theme-provider';

export default function SettingsPage() {
  // Clerk renders its own DOM and cannot read our CSS variables, so the theme
  // has to be handed to it. Without this the account panel stayed light while
  // the rest of the app went dark — a white card floating on a dark page.
  const { clerkAppearance } = useTheme();

  return (
    <div className="space-y-5">
      {/* Clerk's own navbar stays visible: hiding it forced the mobile menu
          row (a separate element) to act as the only navigation at every
          width. With it restored, desktop gets the two-pane layout and narrow
          widths use Clerk's native mobile behaviour. */}
      {/* Clerk routes its own tabs — Security, and the pages a deletion or a
          password change walk through — as sub-paths of this page, so the
          page is a catch-all and Clerk is told exactly which path it owns.
          Without that, Security landed on a 404. */}
      <UserProfile
        routing="path"
        path="/dashboard/settings"
        appearance={{
          ...clerkAppearance,
          elements: {
            ...(clerkAppearance.elements as Record<string, string>),
            rootBox: 'w-full',
            cardBox: 'w-full shadow-none border border-line rounded-lg',
            card: 'w-full shadow-none',
          },
        }}
      />
    </div>
  );
}
