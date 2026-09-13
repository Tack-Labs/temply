/**
 * The template on the left, the data on the right, one row per kind of
 * thing that reads a key: a pill, a Show if, a Repeat. The connector is a
 * drawn line rather than a leader over a picture, so it survives the column
 * narrowing to a phone. `aria-hidden`: the prose above says the same.
 */
const ROWS: Array<{ what: string; key: string; json: string }> = [
  { what: 'A pill', key: 'firstName', json: '"firstName": "Ada"' },
  { what: 'A Show if', key: 'isMember', json: '"isMember": true' },
  { what: 'A Repeat over', key: 'items', json: '"items": [ … ]' },
];

export function FigureDataMap() {
  return (
    <figure className="mt-8 max-w-2xl">
      <div className="overflow-hidden rounded-md border border-line bg-raised" aria-hidden>
        <div className="grid grid-cols-[1fr_1.5rem_1fr] border-b border-line text-2xs font-medium tracking-wide text-faint uppercase">
          <div className="px-3 py-1.5">In the template</div>
          <div />
          <div className="px-3 py-1.5">In data</div>
        </div>
        {ROWS.map((row) => (
          <div key={row.key} className="grid grid-cols-[1fr_1.5rem_1fr] items-center border-b border-line text-sm last:border-b-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 px-3 py-2">
              <span className="text-muted">{row.what}</span>
              <code className="rounded-xs bg-accent-wash px-1 font-mono text-xs text-accent-ink">{row.key}</code>
            </div>
            <div className="flex items-center justify-center">
              <span className="h-px w-4 bg-line" />
            </div>
            <code className="min-w-0 truncate px-3 py-2 font-mono text-xs text-ink">{row.json}</code>
          </div>
        ))}
      </div>
      <figcaption className="mt-4 max-w-xl text-sm text-pretty text-muted">
        Three kinds of key, one object: text for a pill, a boolean for a Show
        if, a list for a Repeat.
      </figcaption>
    </figure>
  );
}
