import { BrandMark } from '~/components/brand-mark';

/** One thing on the page: the step in front of the new user. No sidebar,
 *  no header — there is no workspace to navigate yet. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-surface px-4 py-12">
      <BrandMark className="size-6 text-accent" />
      <div className="mt-8 w-full max-w-md">{children}</div>
    </div>
  );
}
