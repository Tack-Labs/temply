import { Skeleton, SkeletonList } from '~/components/ui/skeleton';
import { PageHeader } from '~/components/ui/surfaces';

/**
 * The templates page while its server fetch runs: the real heading, then a
 * toolbar and rows shaped like the ones that replace them, so nothing jumps
 * when the list arrives. The row geometry mirrors TemplateRow in
 * template-list.tsx — a 56 by 64 thumbnail, two lines of text, a status pill,
 * the action and the menu, which stack in two lines on a narrow list and run
 * as fixed columns on a wide one — and the two have to change together. So
 * does the toolbar: the filter is 52px tall under a coarse pointer (a 44px
 * option in 4px of padding), which sets the toolbar's height when the row is
 * wide, and the count line is there because a narrow list stacks it as a
 * third row.
 */
export default function TemplatesLoading() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Templates"
        description="Every email you have built here."
        actions={<Skeleton className="h-12 w-44 rounded-full" />}
      />

      <SkeletonList label="Loading templates">
        <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:flex-wrap sm:items-center">
          <Skeleton className="h-12 rounded-full sm:max-w-105 sm:flex-1 sm:basis-70" />
          <Skeleton className="h-12 w-60 rounded-full pointer-coarse:h-13 max-sm:max-w-full max-sm:self-start sm:ml-auto" />
          <Skeleton className="h-5.5 w-20" />
        </div>

        <div aria-hidden className="@container divide-y divide-line overflow-hidden rounded-card border border-line bg-raised shadow-sm">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="grid grid-cols-1 items-center @4xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex min-w-0 items-center gap-5 px-4 pt-4 pb-2 @4xl:py-4 @4xl:pr-5 @4xl:pl-6">
                <Skeleton className="h-16 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pr-4 pb-4 pl-4 @lg:pl-23 @4xl:flex-nowrap @4xl:gap-5 @4xl:pr-6 @4xl:pb-0 @4xl:pl-0">
                <div className="@4xl:w-47.5">
                  <Skeleton className="h-7 w-28 rounded-full" />
                </div>
                <div className="ml-auto flex items-center gap-1 @4xl:contents">
                  <Skeleton className="h-11 w-28 rounded-full @4xl:w-42" />
                  <Skeleton className="size-11 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-5.5 w-72 max-w-full" />
      </SkeletonList>
    </div>
  );
}
