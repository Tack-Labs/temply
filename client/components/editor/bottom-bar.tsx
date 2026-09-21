'use client';

import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { CheckCircle2Icon, LayoutTemplateIcon, MailIcon, PaletteIcon, PlusIcon, SlidersHorizontalIcon } from 'lucide-react';
import { Button, pressable } from '~/components/ui/button';
import type { InputDockSpec } from '~/core/editor/components/ui/input-dock';
import { isEditingText } from '~/core/editor/plugins/block-selection';
import { cn } from '~/lib/classname';
import { BlockActionBar } from './block-action-bar';
import { InputDock } from './input-dock';
import { TextFormatBar } from './text-format-bar';

export type BottomBarState = 'idle' | 'block' | 'text' | 'field';
export type IdleTab = 'details' | 'brand' | 'data' | 'checks';

// Focus, not just selection shape, decides the text face: a NodeSelection
// left over from a block tap should not flash 'text' before the keyboard
// has actually come up. Opening the Aa panel blurs the editor on purpose
// (the keyboard drops), so `panelOpen` keeps the text face up on its own —
// the panel's commands still apply to the selection the SelectionExtension
// keeps drawn.
//
// The field face is not decided here: it is the shell's call, made in
// `mobile-layout.tsx`, because opening a field spec dispatches nothing to
// the editor for `useEditorState` to see this function react to.
export function bottomBarState(editor: Editor | null, panelOpen: boolean): Exclude<BottomBarState, 'field'> {
  if (!editor) return 'idle';
  if (isEditingText(editor) && (editor.isFocused || panelOpen)) return 'text';
  if (editor.state.selection instanceof NodeSelection) return 'block';
  return 'idle';
}

const TABS: Array<{ id: IdleTab; label: string; icon: typeof MailIcon }> = [
  { id: 'details', label: 'Details', icon: MailIcon },
  { id: 'brand', label: 'Brand', icon: PaletteIcon },
  { id: 'data', label: 'Data', icon: SlidersHorizontalIcon },
  { id: 'checks', label: 'Checks', icon: CheckCircle2Icon },
];

/**
 * One bar, four faces. The faces swap by opacity inside a shared grid row
 * so switching between idle/block/closed-text never jumps the canvas above;
 * that row only grows when the Aa panel or the field surface opens. The bar
 * is a child of the shell's frame, which is sized to the visual viewport —
 * so the keyboard shrinks the frame and the bar sits on the keys without
 * measuring them.
 * The + button rides above the bar in idle and block states and hides while
 * typing, where it would sit on the keys.
 */
export function EditorBottomBar({
  editor, state, checksCount, panelOpen, onTogglePanel, openTab, onOpenTab, addOpen, onAdd, styleOpen, onStyle, dock, onCloseDock,
}: {
  editor: Editor | null;
  state: BottomBarState;
  checksCount: { errors: number; warnings: number };
  // Lifted to the layout: `bottomBarState` there needs to know the panel is
  // open before the header face (Done vs. Publish) can agree with the bar's.
  panelOpen: boolean;
  onTogglePanel: () => void;
  // Which sheet each trigger has open. Every one of them is a disclosure, and
  // a disclosure that never says it is expanded reads as a plain button to a
  // screen reader.
  openTab: IdleTab | null;
  onOpenTab: (tab: IdleTab) => void;
  addOpen: boolean;
  onAdd: () => void;
  styleOpen: boolean;
  onStyle: () => void;
  dock: InputDockSpec | null;
  onCloseDock: () => void;
}) {
  const badge = checksCount.errors > 0 ? { n: checksCount.errors, tone: 'danger' as const } : checksCount.warnings > 0 ? { n: checksCount.warnings, tone: 'warn' as const } : null;

  return (
    <div className="relative z-40 shrink-0">
      <div
        className={cn(
          'absolute right-4 transition-[opacity,transform] duration-base ease-out motion-reduce:transition-none',
          state === 'text' || state === 'field' ? 'pointer-events-none translate-y-2 opacity-0' : 'pointer-events-auto opacity-100',
        )}
        style={{ bottom: `calc(100% + 0.75rem)` }}
        // The faces and the FAB all stay mounted and swap by opacity, so
        // without this the invisible ones keep their place in the tab order
        // and their buttons answer the keyboard. `inert` takes them out of
        // focus and out of a real browser's accessibility tree; `aria-hidden`
        // rides beside it because Playwright's role locators — used by name
        // alone, with nothing to scope them to the visible face — go by the
        // DOM's own `aria-hidden`/`display: none`, not by `inert`.
        aria-hidden={state === 'text' || state === 'field'}
        inert={state === 'text' || state === 'field'}
      >
        <Button
          variant="primary"
          size="icon"
          aria-label="Add block"
          aria-haspopup="dialog"
          aria-expanded={addOpen}
          className="size-12 rounded-full shadow-lg"
          onClick={onAdd}
        >
          <PlusIcon />
        </Button>
      </div>

      <div data-editor-bottom-bar className="border-t border-line bg-raised pb-[env(safe-area-inset-bottom)]">
        {/* A floor, not a fixed height: idle/block/text agree on 56px when
            the text face is just its top row, but the Aa panel grows that
            face taller, and the row this shares has to grow with it or the
            panel paints past the bar's own box. */}
        <div className="grid min-h-14 [&>*]:col-start-1 [&>*]:row-start-1">
          {/* idle */}
          <nav
            aria-label="Editor sections"
            className={cn('flex items-stretch justify-around transition-opacity duration-base ease-out motion-reduce:transition-none', state === 'idle' ? 'opacity-100' : 'pointer-events-none opacity-0')}
            aria-hidden={state !== 'idle'}
            inert={state !== 'idle'}
          >
            <span className="flex min-w-16 flex-col items-center justify-center gap-0.5 text-2xs font-medium text-accent-ink">
              <LayoutTemplateIcon className="size-5" />
              Content
            </span>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                // Without this the badge's bare number joins the label and
                // the tab is announced as "Checks1".
                aria-label={tab.id === 'checks' && badge ? `${tab.label}, ${badge.n} ${badge.tone === 'danger' ? (badge.n === 1 ? 'error' : 'errors') : badge.n === 1 ? 'warning' : 'warnings'}` : undefined}
                aria-haspopup="dialog"
                aria-expanded={openTab === tab.id}
                onClick={() => onOpenTab(tab.id)}
                className={cn('relative flex min-w-16 flex-col items-center justify-center gap-0.5 text-2xs text-muted hover:text-ink', pressable)}
              >
                <tab.icon className="size-5" />
                {tab.label}
                {tab.id === 'checks' && badge ? (
                  <span className={cn('absolute top-1.5 right-3 min-w-4 rounded-full px-1 text-center text-2xs font-semibold text-white', badge.tone === 'danger' ? 'bg-danger' : 'bg-warn')}>
                    {badge.n}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          {/* block */}
          <div
            className={cn('transition-opacity duration-base ease-out motion-reduce:transition-none', state === 'block' ? 'opacity-100' : 'pointer-events-none opacity-0')}
            aria-hidden={state !== 'block'}
            inert={state !== 'block'}
          >
            {editor ? <BlockActionBar editor={editor} styleOpen={styleOpen} onStyle={onStyle} /> : null}
          </div>
          {/* text */}
          <div
            className={cn('transition-opacity duration-base ease-out motion-reduce:transition-none', state === 'text' ? 'opacity-100' : 'pointer-events-none opacity-0')}
            aria-hidden={state !== 'text'}
            inert={state !== 'text'}
          >
            {editor ? <TextFormatBar editor={editor} panelOpen={panelOpen} onTogglePanel={onTogglePanel} /> : null}
          </div>
          {/* field */}
          {/* Unlike the other three faces, this one's content is much taller
              than the row the rest agree on, and InputDock keeps its last
              spec mounted to animate its own exit — so a plain opacity swap
              would leave that tall, invisible content sizing the shared grid
              row forever. The 0fr→1fr collapse (see desktop-layout.tsx's save
              status row, the same combined grid-template-rows/opacity
              transition) makes the closed face contribute no height at all,
              on top of the same opacity fade the other faces use. This face
              also owns InputDock's visibility outright — InputDock itself
              renders no opacity or inert of its own — so the fade is driven
              from exactly one place. */}
          <div
            className={cn(
              'grid transition-[grid-template-rows,opacity] duration-base motion-reduce:transition-none',
              state === 'field' ? 'grid-rows-[1fr] opacity-100 ease-out' : 'pointer-events-none grid-rows-[0fr] opacity-0 ease-in',
            )}
            aria-hidden={state !== 'field'}
            inert={state !== 'field'}
          >
            <div className="overflow-hidden">
              <InputDock spec={dock} onClose={onCloseDock} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
