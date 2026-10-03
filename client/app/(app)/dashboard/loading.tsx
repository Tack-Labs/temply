import { Skeleton, SkeletonList } from '~/components/ui/skeleton';
import { Card } from '~/components/ui/surfaces';

/**
 * The dashboard home while its server fetches run, in the page's own shape so
 * nothing jumps when the content replaces it: the heading block and the
 * action, two usage tiles, then recent-template rows. The geometry mirrors
 * Meter in usage-section.tsx and RecentRow in recent-templates.tsx, and the
 * three change together.
 *
 * Two things here the skeleton cannot know, so the real page holds its end of
 * them. The section header rows are as tall as they are with their link in
 * them (28px, 44px on a coarse pointer), and the real rows keep that with a
 * minimum height whether or not the link is drawn: a member has no "Manage
 * plan", and an account with no templates has no "View all". A plan with no
 * limit has no bar to draw, so its tiles run shorter than these. There is no
 * heading here: "Welcome back" is the sign the sign-in specs wait for, and it
 * belongs to the page that has the name to put in it.
 *
 * This is also the fallback for every dashboard route without a loading.tsx
 * of its own, so a route that wants a different shape has to add one.
 */
export default function DashboardLoading() {
  return (
    <SkeletonList label="Loading dashboard" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="mt-0.5 h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-8 w-36 pointer-coarse:h-11" />
      </div>

      <div className="space-y-2.5">
        <div className="flex h-7 items-center pointer-coarse:h-11">
          <Skeleton className="h-5 w-14" />
        </div>
        <div aria-hidden className="grid grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Card key={index} className="p-3.5">
              <Skeleton className="h-4.5 w-32" />
              <Skeleton className="mt-1 h-8 w-28" />
              <Skeleton className="mt-2.5 h-1.5 w-full rounded-full" />
              <div className="mt-2 flex items-center justify-between gap-2">
                <Skeleton className="h-4.5 w-16" />
                <Skeleton className="h-4.5 w-20" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex h-7 items-center justify-between gap-3 pointer-coarse:h-11">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-14" />
        </div>
        <div aria-hidden className="@container divide-y divide-line overflow-hidden rounded-xl border border-line bg-raised shadow-sm">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 @2xl:flex-nowrap">
              <Skeleton className="aspect-[8/5] w-16 shrink-0 @2xl:w-20" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <div className="flex w-full items-center gap-2 pl-19 @2xl:w-auto @2xl:gap-3 @2xl:pl-0">
                <div className="flex shrink-0 @2xl:w-36">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="flex @2xl:w-32 @2xl:shrink-0 @2xl:justify-end">
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonList>
  );
}
