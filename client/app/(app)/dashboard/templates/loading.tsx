import { Skeleton, SkeletonList } from '~/components/ui/skeleton';
import { PageHeader } from '~/components/ui/surfaces';

/**
 * The templates page while its server fetch runs: the real heading, then a
 * toolbar and rows shaped like the ones that replace them, so nothing jumps
 * when the list arrives. The row geometry mirrors TemplateRow in
 * template-list.tsx — the thumbnail at 64px and 80px, two lines of text,
 * a badge and a date that sit under the name on a narrow list and trail it
 * on a wide one — and the two have to change together. So does the toolbar:
 * the count line is there because a narrow list stacks it as a third row,
 * and the filter is 54px tall under a coarse pointer (a 44px button in 5px of
 * padding and border), which sets the toolbar's height when the row is wide.
 */
export default function TemplatesLoading() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Templates"
        description="Every email you have built here."
        actions={<Skeleton className="h-8 w-32 pointer-coarse:h-11" />}
      />

      <SkeletonList label="Loading templates" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Skeleton className="h-9 sm:w-72" />
          <Skeleton className="h-9.5 w-60 rounded-lg pointer-coarse:h-13.5 max-sm:max-w-full max-sm:self-start" />
          <Skeleton className="h-4 w-20 sm:ml-auto" />
        </div>

        <div aria-hidden className="@container divide-y divide-line overflow-hidden rounded-xl border border-line bg-raised shadow-sm">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 @2xl:flex-nowrap">
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
              <div className="flex shrink-0 items-center gap-0.5 pr-2">
                <Skeleton className="size-7 pointer-coarse:size-11" />
                <Skeleton className="size-7 pointer-coarse:size-11" />
              </div>
            </div>
          ))}
        </div>
      </SkeletonList>
    </div>
  );
}
