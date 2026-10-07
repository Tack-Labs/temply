import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { PageLoading } from '~/components/ui/page-loading';
import { Skeleton } from '~/components/ui/skeleton';

/**
 * The frame while the template is fetched on the server: the header and the
 * tab row at the heights the real ones will have, so nothing moves when they
 * arrive, with the way back already live and the mark holding the body. The
 * title and the tabs are not known yet, so they are blocks rather than words.
 */
export default function TemplateLoading() {
  return (
    <>
      <header className="flex shrink-0 items-center gap-4 border-b-[1.5px] border-line bg-raised px-4 py-3.5 sm:px-7">
        <Button asChild variant="secondary" size="icon" className="size-11">
          <Link href="/dashboard/templates" aria-label="Back to templates">
            <ArrowLeftIcon aria-hidden="true" className="size-5" />
          </Link>
        </Button>
        <Skeleton className="h-8 w-56 max-w-full" />
      </header>
      <div aria-hidden className="flex h-[54px] shrink-0 items-center gap-6 border-b-[1.5px] border-line bg-raised px-4 sm:px-7">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-28 max-sm:hidden" />
        <Skeleton className="h-5 w-32 max-sm:hidden" />
      </div>
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
        <PageLoading label="Loading the template…" />
      </main>
    </>
  );
}
