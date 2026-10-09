import { BrandLogo } from '~/components/brand-logo';

/** One thing on the page: the step in front of the new user. No sidebar,
 *  no header — there is no workspace to navigate yet. The frame is the
 *  sign-in page's, so the two steps after it read as the same door. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface px-4 py-10">
      <BrandLogo className="h-8.75 w-auto" />
      <div className="w-full max-w-[26rem]">{children}</div>
    </div>
  );
}
