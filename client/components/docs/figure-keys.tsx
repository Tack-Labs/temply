/**
 * Which copy of a template each kind of key reads. Two copies on the left —
 * the draft being edited, the copy last published — and the two keys on the
 * right, each joined to the copy it serves. `aria-hidden`; the Keys prose
 * says the same in words.
 */
const ROWS: Array<{ copy: string; when: string; key: string; reads: string }> = [
  { copy: 'Draft', when: 'what you are editing now', key: 'tply_test_…', reads: 'reads the draft, published or not' },
  { copy: 'Published', when: 'what you last pressed Publish on', key: 'tply_live_…', reads: 'reads the published copy' },
];

export function FigureKeys() {
  return (
    <figure className="mt-8 max-w-2xl">
      <div className="overflow-hidden rounded-md border border-line bg-raised" aria-hidden>
        <div className="grid grid-cols-[1fr_1.5rem_1fr] border-b border-line text-2xs font-medium tracking-wide text-faint uppercase">
          <div className="px-3 py-1.5">Your template</div>
          <div />
          <div className="px-3 py-1.5">Your keys</div>
        </div>
        {ROWS.map((row, index) => (
          <div key={row.copy} className="relative grid grid-cols-[1fr_1.5rem_1fr] items-center border-b border-line text-sm last:border-b-0">
            <div className="min-w-0 px-3 py-2.5">
              <p className="font-medium text-ink">{row.copy}</p>
              <p className="text-xs text-muted">{row.when}</p>
            </div>
            <div className="flex items-center justify-center">
              <span className="h-px w-4 bg-line" />
            </div>
            <div className="min-w-0 px-3 py-2.5">
              <code className="rounded-xs bg-accent-wash px-1 font-mono text-xs text-accent-ink">{row.key}</code>
              <p className="mt-0.5 text-xs text-muted">{row.reads}</p>
            </div>
            {/* Publish is the one move between the two copies: a small arrow
                on the divider, pointing from the draft row to the published one. */}
            {index === 0 ? (
              <span className="absolute -bottom-2.5 left-3 z-10 rounded-full border border-line bg-raised px-1.5 text-2xs font-medium text-muted">
                Publish ↓
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <figcaption className="mt-4 max-w-xl text-sm text-pretty text-muted">
        Keep editing and a live key sees nothing new until you publish again; a
        test key always sees the latest.
      </figcaption>
    </figure>
  );
}
