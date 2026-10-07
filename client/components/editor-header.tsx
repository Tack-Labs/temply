'use client';

import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { useGuardedLink } from '~/hooks/use-guarded-link';

const LIST_HREF = '/dashboard/templates';

/**
 * The header of a template's workspace: the way back to the list, the
 * template's name, and two slots the page fills. `status` sits beside the name
 * and says where the template stands; `actions` is the right-hand end, and
 * only the editor route puts anything there, so Variables, Versions, Review
 * and Connect share this header without growing Publish or Delete buttons.
 *
 * The name is the page's one h1, and the template is renamed through the
 * Subject field of the editor's Email settings rail rather than here, so the
 * header only reflects it. The phone's
 * editor has a frame of its own (`MobileEditorLayout`) and never mounts this;
 * every other page does, at every width. From `lg` the name and its status
 * stay on one line and the name gives way, truncated, because a long name
 * that pushed its status onto a second row would make the header's height
 * depend on what the customer called the template; below it, the status wraps
 * under the name rather than squeeze it to nothing.
 */
export function EditorHeader({
  title,
  status,
  actions,
  beforeNavigate,
}: {
  title: string;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  /** Lets the editor flush an unsaved draft before the back link leaves. */
  beforeNavigate?: () => Promise<boolean>;
}) {
  const guarded = useGuardedLink(beforeNavigate);
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b-[1.5px] border-line bg-raised px-4 py-3.5 sm:px-7">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 lg:flex-nowrap">
        <div className="flex min-w-0 items-center gap-4">
          {/* 44px at every pointer: the header has the room, and it is the one
              way out of a page with no sidebar. */}
          <Button asChild variant="secondary" size="icon" className="size-11">
            <Link href={LIST_HREF} aria-label="Back to templates" onClick={guarded(LIST_HREF)}>
              <ArrowLeftIcon aria-hidden="true" className="size-5" />
            </Link>
          </Button>
          <h1 className="min-w-0 truncate font-display text-xl font-bold tracking-display text-ink sm:text-26">
            {title || 'Untitled'}
          </h1>
        </div>
        {status ? <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">{status}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
