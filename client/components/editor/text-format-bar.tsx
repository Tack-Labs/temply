'use client';

import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { BracesIcon, LinkIcon, TypeIcon, Link2OffIcon } from 'lucide-react';
import { useState } from 'react';
import { alignCommands, currentTextColor, PRIMARY_TEXT_COMMANDS, setTextColor, textCommands } from '~/core/editor/commands/text';
import type { EditorCommand } from '~/core/editor/commands/types';
import { LinkInputPopover } from '~/core/editor/components/ui/link-input-popover';
import { useInputDock } from '~/core/editor/components/ui/input-dock';
import { DEFAULT_VARIABLE_TRIGGER_CHAR } from '~/core/editor/nodes/variable/variable';
import { useVariableOptions } from '~/core/editor/utils/node-options';
import { knownNames } from '~/core/editor/utils/variable';
import { useTextMenuState } from '~/core/editor/components/text-menu/use-text-menu-state';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

// These are written into the email document by setTextColor, so they are
// content, not app chrome — an email in someone else's inbox must render the
// same colour regardless of the reader's app theme. The app's `--ds-*`
// tokens follow app dark mode, so they cannot stand in here; raw hex is the
// correct fixed value, not a shortcut around one.
const SWATCHES = [
  { hex: '#111827', name: 'Black' },
  { hex: '#374151', name: 'Slate' },
  { hex: '#4f46e5', name: 'Indigo' },
  { hex: '#dc2626', name: 'Red' },
  { hex: '#059669', name: 'Green' },
  { hex: '#d97706', name: 'Amber' },
  { hex: '#ffffff', name: 'White' },
];

// Same trick the desktop bubble menu uses: a mousedown on a button would
// otherwise steal focus from the ProseMirror before onClick runs. For Bold
// and its neighbours that just drops the caret and the keyboard; for Aa,
// Link and the header's Done (in mobile-layout.tsx) —
// which mean to blur, deliberately, from inside their own handler — an
// unprevented mousedown blurs a tick earlier than that, which flips
// bottomBarState off 'text' before the click fires and can make the tap
// land on nothing. Either way the fix is the same: keep focus here, and let
// the click handler be the only thing that ever moves it.
export const keepFocus = (e: React.SyntheticEvent) => e.preventDefault();

/**
 * A draft committed in the surface. The name field accepts a bare name or the
 * same `@name` the desktop list is typed as, so both spellings mean the
 * variable; an empty name is a dismissed field and inserts nothing. The
 * trailing space is what picking from the desktop list leaves too, so the
 * caret carries on after the pill instead of inside it.
 */
export function insertVariable(editor: Editor, rawName: string, rawFallback: string, char: string): boolean {
  const trimmed = rawName.trim();
  const name = (trimmed.startsWith(char) ? trimmed.slice(char.length) : trimmed).trim();
  if (!name) return false;
  const fallback = rawFallback.trim() || null;
  editor
    .chain()
    .insertContent([{ type: 'variable', attrs: { id: name, fallback } }, { type: 'text', text: ' ' }])
    .run();
  return true;
}

function Toggle({ editor, command, focus = true }: { editor: Editor; command: EditorCommand; focus?: boolean }) {
  const active = useEditorState({ editor, selector: ({ editor }) => (command.isActive ? command.isActive(editor) : false) });
  return (
    <button
      type="button"
      aria-label={command.label}
      aria-pressed={active}
      title={command.label}
      onMouseDown={keepFocus}
      onPointerDown={keepFocus}
      onClick={() => command.run(editor, { focus })}
      className={cn('flex h-11 min-w-11 flex-1 items-center justify-center rounded-md hover:bg-hover', active ? 'bg-accent-wash text-accent-ink' : 'text-ink', pressable)}
    >
      <command.icon className="size-5" />
    </button>
  );
}

/**
 * The row above the keyboard: the three the thumb reaches for, link, a
 * variable, and Aa. Aa swaps the keyboard for the panel below (the row
 * stays), which is where colour, size, alignment and lists live — they
 * need room a single row cannot give. Done is not here: the top bar owns
 * it, and a second copy both duplicated the action and cost this row the
 * ~62px it needs to fit a 375px phone.
 */
export function TextFormatBar({
  editor,
  panelOpen,
  onTogglePanel,
}: {
  editor: Editor;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  const color = useEditorState({ editor, selector: ({ editor }) => currentTextColor(editor) });
  const { linkUrl, isUrlVariable } = useTextMenuState(editor);
  const [linkOpen, setLinkOpen] = useState(false);
  const dock = useInputDock();
  const variableOptions = useVariableOptions(editor);
  const variableChar = variableOptions?.suggestion?.char ?? DEFAULT_VARIABLE_TRIGGER_CHAR;

  /** The same surface the pill opens, so inserting a variable and giving it a
   *  placeholder is one edit rather than an insert followed by a hunt. */
  const openVariable = () => {
    // Same source the pill's own Name field reads, so a name used once is
    // offered from both places after. Snapshotting here, at open, is what
    // keeps every keystroke in the field from re-serialising the document.
    const search = knownNames(editor, 'variables', variableOptions?.variables, 'content-variable');
    // The trigger character is not part of a name, so it is dropped from the
    // query — the field takes it, but never searches for it.
    const variableNames = (draft: string) => search(draft.split(variableChar).join(''));
    dock?.open({
      title: 'Variable',
      fields: [
        { key: 'name', label: 'Name', value: '', placeholder: 'first_name', hint: 'The name your data uses', options: variableNames },
        { key: 'placeholder', label: 'Placeholder', value: '', placeholder: 'there', hint: 'Shown when the data has no value' },
      ],
      onCommit: (values) => void insertVariable(editor, values.name, values.placeholder, variableChar),
    });
  };

  /** The same set the desktop bubble menu applies, minus the focus call: the
   *  destination is typed in the panel, and pulling focus back to the canvas
   *  there would throw the keyboard up over the answer. */
  const applyLink = (value: string, isVariable?: boolean) => {
    if (!value) {
      editor.chain().extendMarkRange('link').unsetLink().unsetUnderline().run();
      return;
    }
    editor
      .chain()
      .extendMarkRange('link')
      .setLink({ href: value })
      .setIsUrlVariable(isVariable ?? false)
      .setUnderline()
      .run();
  };

  // The link key opens the field surface directly; the Aa panel is not on the
  // path. Routing through the panel expands seven swatches, Align and More
  // behind a surface that covers them, and puts the word Link on screen twice.
  const openLink = () => setLinkOpen(true);

  return (
    <div>
      <div className="flex h-14 items-center gap-1 px-2">
        {PRIMARY_TEXT_COMMANDS.map((c) => (
          <Toggle key={c.id} editor={editor} command={c} />
        ))}
        <button
          type="button"
          aria-label="Link"
          // Not a disclosure: this opens the shared field surface, not a
          // dialog owned by this button, and linkOpen flips back to false the
          // instant that surface opens — an aria-expanded here would announce
          // "collapsed" while the field is on screen.
          onMouseDown={keepFocus}
          onPointerDown={keepFocus}
          onClick={openLink}
          className={cn('flex h-11 min-w-11 flex-1 items-center justify-center rounded-md hover:bg-hover', linkUrl ? 'bg-accent-wash text-accent-ink' : 'text-ink', pressable)}
        >
          <LinkIcon className="size-5" />
        </button>
        <button type="button" aria-label="Insert variable" onMouseDown={keepFocus} onPointerDown={keepFocus} onClick={openVariable} className={cn('flex h-11 min-w-11 flex-1 items-center justify-center rounded-md text-ink hover:bg-hover', pressable)}>
          <BracesIcon className="size-5" />
        </button>
        <Toggle editor={editor} command={textCommands.lineBreak} />
        <button
          type="button"
          aria-label="More formatting"
          aria-expanded={panelOpen}
          // The panel opens by blurring the editor deliberately (see
          // onTogglePanel) — but that has to be the ONLY blur in play.
          // Without this, the browser's own mousedown default focuses this
          // button first, blurring the editor a tick before onClick runs;
          // bottomBarState then drops to 'idle' between the two, the text
          // face (this button included) goes pointer-events-none, and the
          // tap's click can land on nothing. Keeping focus here just defers
          // the blur to togglePanel's own call, in the same turn as
          // `panelOpen` flips.
          onMouseDown={keepFocus}
          onPointerDown={keepFocus}
          onClick={onTogglePanel}
          className={cn('flex h-11 min-w-14 items-center justify-center gap-1 rounded-md border border-line text-sm font-medium', panelOpen ? 'bg-accent-wash text-accent-ink' : 'text-ink', pressable)}
        >
          <TypeIcon className="size-4" />
          Aa
        </button>
      </div>
      {/* The panel replaces the keyboard: the editor is blurred when it opens,
          so the keyboard goes and this takes the space. Every command in here
          runs with focus: false for the same reason — refocusing would raise
          the keyboard over the panel it was opened to replace. */}
      <div className={cn('grid transition-[grid-template-rows] duration-base ease-out motion-reduce:transition-none', panelOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')} inert={!panelOpen}>
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-line px-3 py-3">
            {/* Labels sit above their rows, not beside them: seven 44px
                swatches and their gaps need 332px, which a 390px phone has
                only when the label is not taking 72 of them. Beside the row
                the last swatch wrapped onto a line of its own. */}
            <div className="space-y-1">
              <span className="block text-xs text-muted">Colour</span>
              <div className="flex flex-wrap gap-1">
                {SWATCHES.map(({ hex, name }) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={name}
                    aria-pressed={color.toLowerCase() === hex}
                    onMouseDown={keepFocus}
                    onPointerDown={keepFocus}
                    onClick={() => setTextColor(editor, hex, { focus: false })}
                    className={cn('flex h-11 min-w-11 items-center justify-center rounded-md hover:bg-hover', pressable)}
                  >
                    <span
                      aria-hidden
                      className={cn('size-8 rounded-full border border-line', color.toLowerCase() === hex && 'ring-[3px] ring-accent/40')}
                      style={{ background: hex }}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-muted">Link</span>
              {/* The editor's own link popover, so the destination can be a
                  {{variable}} here exactly as it can in the desktop bubble
                  menu — one field, one set of rules. */}
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <LinkInputPopover
                  editor={editor}
                  defaultValue={linkUrl ?? ''}
                  isVariable={isUrlVariable}
                  open={linkOpen}
                  onOpenChange={setLinkOpen}
                  onValueChange={applyLink}
                  triggerProps={{ 'aria-label': 'Link address', className: 'mly:h-11! mly:w-11!' }}
                />
                <span className={cn('min-w-0 flex-1 truncate text-xs', linkUrl ? 'text-ink' : 'text-faint')}>
                  {linkUrl ? (isUrlVariable ? `{{${linkUrl}}}` : linkUrl) : 'No link'}
                </span>
                {linkUrl ? (
                  <button
                    type="button"
                    aria-label="Remove link"
                    onClick={() => applyLink('')}
                    className={cn('flex h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink', pressable)}
                  >
                    <Link2OffIcon className="size-5" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-muted">Align</span>
              <div className="flex flex-1 gap-1">
                {alignCommands.map((c) => (
                  <Toggle key={c.id} editor={editor} command={c} focus={false} />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-muted">More</span>
              <div className="flex flex-1 gap-1">
                <Toggle editor={editor} command={textCommands.strike} focus={false} />
                <Toggle editor={editor} command={textCommands.code} focus={false} />
                <Toggle editor={editor} command={textCommands.bulletList} focus={false} />
                <Toggle editor={editor} command={textCommands.orderedList} focus={false} />
                <Toggle editor={editor} command={textCommands.clearFormatting} focus={false} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
