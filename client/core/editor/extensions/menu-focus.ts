import { Extension } from '@tiptap/core';

/**
 * The keyboard's way into the menu that is up, and back out again.
 *
 * Every bubble menu is appended outside the editor — the text menu to
 * `document.body`, the rest into the Content card — so none of them is next
 * to the canvas in source order and Tab does not lead to any of them. tippy
 * gives each one `tabIndex = 0` and nothing has ever focused it, so a
 * customer who selects text with the keyboard has no route at all to the
 * buttons that act on that selection.
 *
 * One gesture serves all of them because a menu is identified by its role
 * rather than by which component drew it: `Mod-Shift-F` moves focus to the
 * first control of the nearest open menu, and Escape inside a menu hands it
 * back to the canvas with the selection intact. Not `Mod-Shift-M`: Chrome
 * binds Ctrl+Shift+M to the profile switcher on Windows and Linux, so half
 * the readers of the cheatsheet would never reach the editor with it.
 */
export const MENU_FOCUS_SHORTCUT = 'Mod-Shift-f';

/** Whether an element is on screen rather than merely in the document. */
function onScreen(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  return getComputedStyle(element).visibility !== 'hidden';
}

/** The centre of the selection, as the menus are anchored to it. */
function selectionCentre(view: { coordsAtPos: (pos: number) => { top: number; bottom: number; left: number; right: number } }, pos: number) {
  const coords = view.coordsAtPos(pos);
  return { x: (coords.left + coords.right) / 2, y: (coords.top + coords.bottom) / 2 };
}

/**
 * The menu to move into. Two can be up at once — a Section holding a Repeat
 * keeps both, deliberately — so the one nearest the caret is the one the
 * customer is looking at.
 */
export function openMenuNearest(
  view: Parameters<typeof selectionCentre>[0],
  pos: number,
  root: Document = document
): HTMLElement | null {
  const menus = Array.from(root.querySelectorAll<HTMLElement>('[role="toolbar"]')).filter(onScreen);
  if (menus.length === 0) return null;

  const caret = selectionCentre(view, pos);
  return menus.reduce((nearest, menu) => {
    const box = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return Math.hypot(rect.left + rect.width / 2 - caret.x, rect.top + rect.height / 2 - caret.y);
    };
    return box(menu) < box(nearest) ? menu : nearest;
  });
}

/** The first control a customer can act on, skipping anything disabled. */
export function firstControl(menu: HTMLElement): HTMLElement | null {
  const controls = menu.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  for (const control of controls) {
    if (onScreen(control)) return control;
  }
  return null;
}

export const MenuFocus = Extension.create({
  name: 'menuFocus',

  addKeyboardShortcuts() {
    return {
      [MENU_FOCUS_SHORTCUT]: () => {
        const { view, state } = this.editor;
        const menu = openMenuNearest(view, state.selection.head);
        const control = menu && firstControl(menu);
        if (!control) return false;
        // The selection stays drawn while the editor is unfocused, and tiptap
        // keeps the menu up because the focus landed inside it — so the
        // buttons act on exactly what was selected.
        control.focus();
        return true;
      },
    };
  },
});
