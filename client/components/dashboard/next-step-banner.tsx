'use client';

import { FlaskConicalIcon, PencilLineIcon, ShieldCheckIcon, Undo2Icon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Reveal } from '~/components/ui/surfaces';
import { useHydrated } from '~/hooks/use-hydrated';
import { nextStepCopy, type NextStepKind } from '~/lib/next-step';
import { exactTime, relativeTime } from '~/lib/relative-time';
import type { TemplateListItem } from '~/lib/template-search';

const ICON: Record<NextStepKind, LucideIcon> = {
  waiting: ShieldCheckIcon,
  staging: FlaskConicalIcon,
  returned: Undo2Icon,
  draft: PencilLineIcon,
};

/**
 * One card that says what to do next: the template that most needs a look
 * (`pickNextStep` chooses it), and a button to the page where it gets one. The
 * button only opens that page. Nothing is on the page when every template is
 * live or the account has none.
 *
 * It is always mounted and grows from nothing, because a retried templates
 * fetch can turn a pick up after the page is already drawn. When the pick goes
 * the card closes on what it last said, since an empty box cannot shrink.
 */
export function NextStepBanner({
  template,
  isAdmin,
}: {
  template: TemplateListItem | null;
  isAdmin: boolean;
}) {
  const [held, setHeld] = useState(template);
  if (template && template !== held) setHeld(template);
  const shown = template ?? held;

  return (
    <Reveal open={template !== null}>
      {/* Spacing inside the child, not on the Reveal, so it closes with it. */}
      <div className="pt-9">{shown ? <Banner template={shown} isAdmin={isAdmin} /> : null}</div>
    </Reveal>
  );
}

function Banner({ template, isAdmin }: { template: TemplateListItem; isAdmin: boolean }) {
  // The phrase reads the reader's clock, so it waits for hydration: the
  // server's "2 hours ago" is the server's, not theirs.
  const hydrated = useHydrated();
  const copy = nextStepCopy(template, isAdmin);
  const Icon = ICON[copy.kind];
  const when = hydrated ? relativeTime(copy.stamp, new Date()) : null;

  return (
    <section
      aria-label="Next step"
      className="flex flex-wrap items-center gap-5 rounded-card bg-accent-wash px-7 py-6"
    >
      <span aria-hidden="true" className="grid size-14 flex-none place-items-center rounded-2xl bg-raised text-accent-ink">
        <Icon className="size-6" />
      </span>
      <div className="min-w-60 flex-1">
        {/* The section's name already says it. */}
        <p aria-hidden="true" className="text-sm font-bold tracking-widest text-accent-ink uppercase">Next step</p>
        {/* A title is customer text, up to 200 characters and no spaces if they
            pasted one, and the column cannot shrink past a word. */}
        <p className="mt-0.5 break-words font-display text-2xl font-bold tracking-display text-ink">{copy.title}</p>
        <p className="mt-0.5 break-words text-ui text-ink-soft">
          {copy.lead}
          {when && copy.stamp ? (
            <>
              {' '}
              <time
                dateTime={copy.stamp}
                title={exactTime(copy.stamp) ?? undefined}
                className="fade-in-mount motion-reduce:transition-none"
              >
                {when}
              </time>
            </>
          ) : null}
          {copy.tail ? `. ${copy.tail}` : '.'}
        </p>
      </div>
      <Button asChild variant="primary" size="md">
        <Link href={copy.href}>{copy.button}</Link>
      </Button>
    </section>
  );
}
