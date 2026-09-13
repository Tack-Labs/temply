'use client';

import { MinusIcon, PlusIcon } from 'lucide-react';
import { LIST_ITEMS_DEFAULT, LIST_ITEMS_MAX, type TemplateDataKeys } from '@temply/shared/template-data';
import { Button } from '~/components/ui/button';

/**
 * The data a preview should render with.
 *
 * Conditions are booleans keyed by "Show if" name; variables are the text a
 * `{{pill}}` resolves to. A variable left empty is omitted from the payload
 * entirely, so it keeps passing through as `{{name}}` the way an unrendered
 * template does.
 */
export type PreviewData = {
  conditions: Record<string, boolean>;
  variables: Record<string, string>;
  /** How many items each list renders with. The items themselves are empty:
   *  a pill inside falls back to the top-level value, so every row shows the
   *  same sample words — the preview is for the shape of N rows, not their
   *  contents. */
  lists: Record<string, number>;
};


/** A destination with no placeholder of its own gets an obvious stand-in,
 *  so a test send has somewhere to point and nobody is asked to invent a
 *  URL for a button that already says what it is. */
export function standInUrl(name: string): string {
  return `https://example.com/${name}`;
}

/** Every condition starts on, so the first preview is the complete email;
 *  every pill starts on its placeholder and every destination on a stand-in
 *  URL, so the first test send has words and working links. */
export function initialPreviewData(keys: TemplateDataKeys): PreviewData {
  const urls = new Set(keys.urlVariables ?? []);
  return {
    conditions: Object.fromEntries(keys.conditions.map((key) => [key, true])),
    variables: Object.fromEntries(
      keys.variables.map((key) => [key, keys.placeholders?.[key] ?? (urls.has(key) ? standInUrl(key) : '')]),
    ),
    lists: Object.fromEntries(keys.lists.map((key) => [key, LIST_ITEMS_DEFAULT])),
  };
}

/** Flattens the panel state into the payload the renderer reads. */
export function toPayload(data: PreviewData): Record<string, unknown> {
  const filledVariables = Object.entries(data.variables).filter(([, value]) => value !== '');
  const lists = Object.entries(data.lists).map(([key, count]) => [key, Array.from({ length: count }, () => ({}))]);
  return { ...data.conditions, ...Object.fromEntries(filledVariables), ...Object.fromEntries(lists) };
}

/** Whether there is anything to type: the panel and the sheets that hold it
 *  read the same answer. */
export function hasPreviewKeys(keys: TemplateDataKeys): boolean {
  return keys.conditions.length > 0 || keys.variables.length > 0 || keys.lists.length > 0;
}

export function PreviewDataPanel({
  keys,
  data,
  onChange,
}: {
  keys: TemplateDataKeys;
  data: PreviewData;
  onChange: (next: PreviewData) => void;
}) {
  if (!hasPreviewKeys(keys)) return null;
  // Pills read inside a Repeat are shown under their list, so it is plain
  // which values every row will repeat.
  const topLevel = keys.variables.filter((key) => !keys.inList[key]);
  const perList = keys.lists.map((list) => ({ list, variables: keys.variables.filter((key) => keys.inList[key] === list) }));
  const variableRow = (key: string) => (
    <label key={key} className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate font-mono text-xs text-muted">{key}</span>
      <input
        type="text"
        value={data.variables[key] ?? ''}
        placeholder={`{{${key}}}`}
        onChange={(event) =>
          onChange({
            ...data,
            variables: { ...data.variables, [key]: event.target.value },
          })
        }
        className="h-7 min-w-0 flex-1 rounded-xs border border-line bg-raised px-2 text-sm text-ink placeholder:text-faint"
      />
    </label>
  );
  const setCount = (list: string, count: number) =>
    onChange({ ...data, lists: { ...data.lists, [list]: Math.min(LIST_ITEMS_MAX, Math.max(0, count)) } });

  return (
    // No card of its own: this is popover content, and a bordered box inside a
    // bordered popover reads as two panels with mismatched corners.
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-ink">Preview data</p>
        <p className="text-xs text-muted">
          The values your app would send. Nothing here is saved with the template.
        </p>
      </div>

      {keys.conditions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-2xs font-medium tracking-wide text-faint uppercase">Conditions</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {keys.conditions.map((key) => (
              <label key={key} className="flex items-center gap-1.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={data.conditions[key] ?? true}
                  onChange={(event) =>
                    onChange({
                      ...data,
                      conditions: { ...data.conditions, [key]: event.target.checked },
                    })
                  }
                  className="size-3.5 accent-accent"
                />
                <span className="font-mono text-xs">{key}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {topLevel.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-2xs font-medium tracking-wide text-faint uppercase">Variables</p>
          <div className="grid gap-2 sm:grid-cols-2">{topLevel.map(variableRow)}</div>
        </div>
      )}

      {perList.map(({ list, variables }) => {
        const count = data.lists[list] ?? LIST_ITEMS_DEFAULT;
        return (
          <div key={list} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xs font-medium tracking-wide text-faint uppercase">
                Repeat over <span className="font-mono normal-case tracking-normal">{list}</span>
              </p>
              {/* A count, not a list editor: the rows share one set of sample
                  words, and what the preview answers is how N of them sit. */}
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Fewer ${list}`} disabled={count <= 0} onClick={() => setCount(list, count - 1)}>
                  <MinusIcon />
                </Button>
                <span className="min-w-14 text-center text-xs text-ink tabular-nums" aria-live="polite">
                  {count === 1 ? '1 item' : `${count} items`}
                </span>
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`More ${list}`} disabled={count >= LIST_ITEMS_MAX} onClick={() => setCount(list, count + 1)}>
                  <PlusIcon />
                </Button>
              </div>
            </div>
            {variables.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">{variables.map(variableRow)}</div>
            ) : (
              <p className="text-xs text-muted">No variables inside it yet, so every item reads the same.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
