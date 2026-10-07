import { Skeleton, SkeletonList } from '~/components/ui/skeleton';
import { Card } from '~/components/ui/surfaces';

/** A line of text as tall as the line it stands for, so a bar drawn shorter than its line does not shrink the block. */
function Line({ height, className }: { height: string; className: string }) {
  return (
    <div className={`flex items-center ${height}`}>
      <Skeleton className={className} />
    </div>
  );
}

/**
 * The dashboard home while its server fetches run, in the page's own shape so
 * nothing jumps when the content replaces it: the heading block and the
 * action, the starter chips, recent-template cards, then usage tiles. The
 * geometry mirrors StarterChips, RecentCard in recent-templates.tsx and Meter
 * in usage-section.tsx, and they change together.
 *
 * Things here the skeleton cannot know, so the real page holds its end of
 * them. The header rows of recent and usage are 44px whether or not their
 * link is drawn: a member has no "Manage plan", and an account with no
 * templates has no "View all". The next-step banner is not drawn, since most
 * visits have none, and when there is one it grows in under the heading. Every
 * plan has the first three tiles but only Team has Members, and a plan with no
 * limit has no bar, so its tiles run shorter than these. There is no heading
 * here: "Welcome back" is the sign the sign-in specs wait for, and it belongs
 * to the page that has the name to put in it.
 *
 * This is also the fallback for every dashboard route without a loading.tsx
 * of its own, so a route that wants a different shape has to add one.
 */
export default function DashboardLoading() {
  return (
    <SkeletonList label="Loading dashboard">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Skeleton className="h-9.25 w-56 max-w-full sm:h-12" />
          <Skeleton className="mt-1.5 h-7 w-80 max-w-full" />
        </div>
        <Skeleton className="h-12 w-44 rounded-full" />
      </div>

      <div className="space-y-9 pt-9">
        <div className="space-y-3.5">
          <Line height="h-8" className="h-6 w-44" />
          <div aria-hidden className="flex flex-wrap gap-2.5">
            {['w-28', 'w-32', 'w-36', 'w-40', 'w-32', 'w-28', 'w-36'].map((width, index) => (
              <Skeleton key={index} className={`h-11 rounded-full ${width}`} />
            ))}
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div aria-hidden className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4.5">
            {Array.from({ length: 5 }, (_, index) => (
              <Card key={index} className="flex flex-col gap-3.5 p-3 pb-4.5">
                <Skeleton className="h-35 rounded-xl" />
                <div className="flex flex-col gap-2 px-1.5">
                  <div>
                    <Line height="h-7" className="h-5 w-3/5" />
                    <Line height="h-5.5" className="h-4 w-4/5" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="flex min-h-11 items-center gap-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div aria-hidden className="grid grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] gap-4.5">
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index}>
                <Line height="h-5.5" className="h-4 w-32" />
                <Skeleton className="mt-2.5 h-9.25 w-28" />
                <Skeleton className="mt-2.5 h-2.5 w-full rounded-full" />
                <Line height="h-5.5" className="mt-2 h-4 w-16" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </SkeletonList>
  );
}
