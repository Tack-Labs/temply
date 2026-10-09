/**
 * A workspace as a box with what it holds, and the two roles under it with
 * what each may do. Two columns rather than a matrix: the member's list is
 * the product and the admin's is the account, and that split is the whole
 * model. `aria-hidden`; the prose carries the same lists.
 */
import { docsPanel, docsPanelRows } from '~/components/docs/panel';
import { cn } from '~/lib/classname';

const HOLDS = ['Templates', 'Brands', 'Images', 'API keys', 'Plan'];
const MEMBER = ['Build, edit and publish emails', 'Save brands, upload images', 'Share review links, send tests'];
const ADMIN = ['Everything a member does', 'Plan and billing', 'API keys', 'Who is on the team'];

function Role({ name, items, accent }: { name: string; items: string[]; accent?: boolean }) {
  return (
    <div className={cn(docsPanel, 'min-w-0 p-4')}>
      <p className="text-2xs font-semibold tracking-wide text-muted uppercase">{name}</p>
      <ul className="mt-2 space-y-1 text-base text-muted">
        {items.map((item, index) => (
          <li key={item} className={accent && index > 0 ? 'text-ink' : undefined}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FigureWorkspace() {
  return (
    <figure className="mt-8 max-w-2xl">
      <div aria-hidden>
        <div className={docsPanelRows}>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <span className="flex size-6 items-center justify-center rounded-sm bg-accent-wash text-xs font-semibold text-accent-ink">A</span>
            <span className="text-xs font-semibold text-ink">Acme</span>
            <span className="text-xs text-muted">workspace</span>
          </div>
          <div className="flex flex-wrap gap-1.5 p-3">
            {HOLDS.map((item) => (
              <span key={item} className="rounded-full bg-sunken px-2.5 py-0.5 text-sm text-ink">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          <Role name="Member" items={MEMBER} />
          <Role name="Admin" items={ADMIN} accent />
        </div>
      </div>
      <figcaption className="mt-4 max-w-xl text-base text-pretty text-muted">
        A member makes the emails; an admin manages the account. There are no
        other roles.
      </figcaption>
    </figure>
  );
}
