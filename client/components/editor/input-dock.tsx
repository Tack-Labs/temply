'use client';

import { CheckIcon, CircleXIcon, XIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { InputDockSpec, InputField } from '~/core/editor/components/ui/input-dock';
import { Button, pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';
import { keepFocus } from './text-format-bar';

/** Every field's committed value, coerced to a controlled draft. A nullish
 *  value would hand the input back to the DOM, which then keeps whatever the
 *  previous field left in it and answers every keystroke twice. The coercion
 *  belongs here rather than at a call site, where one spec forgetting it is
 *  enough. */
export function seedDrafts(fields: InputField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, field.value ?? '']));
}

/**
 * The field(s) a Link, Show-if, Alt-text or Variable control opens on the
 * phone: one or more inputs, which the keyboard pushes up, with any variable
 * suggestions as chips above each input. The sheet that held the control has
 * been closed by the shell so the keyboard has nothing to cover; it comes
 * back when this closes. Rendered as the bar's own field face — the grid
 * cell it sits in positions it, and the face that hosts this component (see
 * `bottom-bar.tsx`) owns the fade and the closed-state height alike. Stays
 * mounted, keeping its last spec through the exit, which is exactly why it
 * cannot size itself: whatever renders it must give the closed state no
 * height, or the tallest spec this ever showed becomes the floor forever.
 */
export function InputDock({ spec, onClose }: { spec: InputDockSpec | null; onClose: () => void }) {
  const [shown, setShown] = useState<InputDockSpec | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // A layout effect, not a passive one: reseeding after paint would let the
  // browser show one frame pairing the new spec's fields with the previous
  // surface's drafts.
  useLayoutEffect(() => {
    if (!spec) return;
    setShown(spec);
    setDrafts(seedDrafts(spec.fields));
  }, [spec]);

  useEffect(() => {
    if (!spec) return;
    // After the sheet's close has let go of focus, and after this has painted:
    // focusing an input that is still translated off its place makes iOS
    // scroll to where it was.
    const id = requestAnimationFrame(() => {
      const input = inputRefs.current[0];
      input?.focus();
      // The seed is whatever is already there — usually the value being
      // replaced — so selecting it lets the first keystroke overwrite it
      // instead of landing in the middle of it.
      input?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [spec]);

  const view = spec ?? shown;
  const commit = () => {
    view?.onCommit(drafts);
    onClose();
  };
  const setDraft = (key: string, value: string) =>
    setDrafts((current) => ({ ...current, [key]: value }));

  return (
    // Not dead: this is the handle the browser verification and the bar's
    // height measurements query. Visibility and the closed-state height are
    // the field face's job (bottom-bar.tsx), not this component's — driving
    // the same fade from both places would square the eased curve.
    <div data-editor-input-dock>
      {view ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
          className="px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          aria-label={view.title}
        >
          {/* ✕ lives with the title, the way a sheet's Close does: beside a
              field it reads as that field's clear, and cancelling the whole
              surface is not a field's job. Negative margins let the 44px
              target overlap the padding so the row stays the title's height. */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{view.title}</p>
            <Button type="button" variant="ghost" size="icon" className="-my-2 -mr-2 size-11" aria-label="Cancel" onMouseDown={keepFocus} onPointerDown={keepFocus} onClick={onClose}>
              <XIcon />
            </Button>
          </div>
          {view.fields.map((field, index) => (
            <FieldRow
              key={field.key}
              field={field}
              index={index}
              draft={drafts[field.key] ?? ''}
              onDraft={(value) => setDraft(field.key, value)}
              inputRef={(el) => {
                inputRefs.current[index] = el;
              }}
              last={index === view.fields.length - 1}
              onNext={() => inputRefs.current[index + 1]?.focus()}
              // A field labelled exactly like the surface would say the same
              // word twice, the title and the label one under the other.
              hideLabel={field.label === view.title}
            />
          ))}
        </form>
      ) : null}
    </div>
  );
}

/**
 * One labelled field. Chips sit under the label and above the input: what can
 * be picked is worth seeing before deciding whether to type.
 *
 * A chip fills its own field and stops there: one ✓ finishes the whole edit,
 * the rule the four controls share. A chip that committed on the spot would
 * take a two-field surface with it before the second field was touched.
 */
function FieldRow({
  field, index, draft, onDraft, inputRef, last, onNext, hideLabel,
}: {
  field: InputField;
  index: number;
  draft: string;
  onDraft: (value: string) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  last: boolean;
  onNext: () => void;
  hideLabel: boolean;
}) {
  const id = `editor-input-dock-${field.key}`;
  const trigger = field.triggerChar ?? '';
  const chips = field.options && (draft === '' || draft.startsWith(trigger)) ? field.options(draft).slice(0, 8) : [];
  return (
    <div className={cn(index > 0 && 'mt-3')}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={cn('text-xs font-medium text-ink', hideLabel && 'sr-only')}>
          {field.label}
        </label>
        {field.hint ? <span className="truncate text-2xs text-muted">{field.hint}</span> : null}
      </div>
      {/* Nothing to offer, no row: a band held open for chips that are not
          coming makes a one-field surface as tall as a two-field one, and for
          a Link that is every ordinary URL. It collapses rather than
          vanishing, because the input below it would otherwise jump by the
          band's height as the draft crosses the trigger character. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-base motion-reduce:transition-none',
          chips.length ? 'grid-rows-[1fr] ease-out' : 'grid-rows-[0fr] ease-in',
        )}
        inert={chips.length === 0}
      >
        <div className="overflow-hidden">
          <div className="mt-1 flex h-9 items-center gap-1 overflow-x-auto">
            {chips.map((name) => (
              <button
                key={name}
                type="button"
                onMouseDown={keepFocus}
                onPointerDown={keepFocus}
                onClick={() => onDraft(`${trigger}${name}`)}
                className={cn('h-8 shrink-0 rounded-full border border-line bg-surface px-3 font-mono text-xs text-ink hover:bg-hover', pressable)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          {/* 16px text: anything smaller makes iOS zoom the page on focus. */}
          <input
            id={id}
            ref={inputRef}
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || last) return;
              // enterKeyHint says "next", but Enter inside a form still
              // submits by default — moving between fields must commit
              // nothing and close nothing, so this both stops the implicit
              // submit and does the moving itself.
              event.preventDefault();
              onNext();
            }}
            placeholder={field.placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint={last ? 'done' : 'next'}
            className="h-11 w-full rounded-md border border-line bg-surface pr-11 pl-3 text-lg text-ink placeholder:text-faint"
          />
          {/* Emptying the field is how a link, a condition or an alt text is
              removed: Done with nothing in it commits "none". The button fades
              rather than appears, so the field's edge is steady while typing. */}
          <button
            type="button"
            aria-label={`Clear ${field.label} value`}
            onMouseDown={keepFocus}
            onPointerDown={keepFocus}
            onClick={() => onDraft('')}
            className={cn(
              'absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition-opacity duration-fast ease-out hover:text-ink motion-reduce:transition-none',
              draft ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            inert={!draft}
          >
            <CircleXIcon className="size-5" />
          </button>
        </div>
        {/* The slot is held on every row so the inputs line up; only the
            first row fills it, and one ✓ finishes the whole surface. */}
        <span className="size-11 shrink-0">
          {index === 0 ? (
            <Button type="submit" variant="primary" size="icon" className="size-11" aria-label="Done" onMouseDown={keepFocus} onPointerDown={keepFocus}>
              <CheckIcon />
            </Button>
          ) : null}
        </span>
      </div>
    </div>
  );
}
