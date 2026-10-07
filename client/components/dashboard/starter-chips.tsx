'use client';

import { Loader2Icon, PlusIcon } from 'lucide-react';
import { SectionHeading } from '~/components/dashboard/section-heading';
import { Button } from '~/components/ui/button';
import { useCreateFromStarter } from '~/hooks/use-create-from-starter';

/**
 * The first-run path and the shortcut after it: each chip makes a template
 * from that starter and opens it, the way the New template gallery does. They
 * need no list, so they stay when the templates fetch fails.
 *
 * `disabled` is the template limit or a read-only workspace. The billing
 * banner already says why, so the chips do not repeat it.
 */
export function StarterChips({ disabled = false }: { disabled?: boolean }) {
  const { starters, create, busy, pickedId } = useCreateFromStarter();

  return (
    <section aria-labelledby="starters-heading" className="space-y-3.5">
      <SectionHeading id="starters-heading">Start from a starter</SectionHeading>
      <ul className="flex flex-wrap gap-2.5" aria-busy={busy || undefined}>
        {starters.map((starter) => {
          const working = pickedId === starter.id;
          return (
            <li key={starter.id}>
              <Button
                // The working chip stays lit and takes no second click (the
                // hook refuses it); the others go quiet until the page moves on.
                disabled={disabled || (busy && !working)}
                aria-busy={working || undefined}
                onClick={() => create(starter)}
                className="group h-11 pr-4.5 pl-3.5 text-ui"
              >
                {working ? (
                  <Loader2Icon aria-hidden="true" className="animate-spin text-accent-ink motion-reduce:animate-none" />
                ) : (
                  <PlusIcon aria-hidden="true" className="text-accent-ink group-disabled:text-disabled" />
                )}
                {starter.name}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
