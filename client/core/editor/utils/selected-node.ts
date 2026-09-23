import type { Node } from '@tiptap/pm/model';
import { NodeSelection, type EditorState } from '@tiptap/pm/state';

/**
 * The node the selection *is*, when that is a `name` — not one it sits
 * inside. Touch produces no other shape for a wrapper: a tap walks to the
 * innermost textblock or atom, never into a wrapper, so a tap on one selects
 * it outright and leaves no caret in it. A node is not among its own
 * ancestors, so anything that walks parents has to try this first or it finds
 * nothing on the phone at all.
 */
export function selectedNodeOfType(state: EditorState, name: string): Node | null {
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type.name === name ? selection.node : null;
}
