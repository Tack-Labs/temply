import type { Editor } from '@tiptap/core';
import type { LucideIcon } from 'lucide-react';

export type EditorCommand = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Shown as pressed. */
  isActive?: (editor: Editor) => boolean;
  /** Greyed out; the bar still shows it so the row does not jump. */
  isEnabled?: (editor: Editor) => boolean;
  run: (editor: Editor, options?: RunOptions) => void;
};

/** `focus: false` applies the command without giving the editor focus back.
 *  The desktop bubble menus always refocus — the caret has to survive the
 *  click — but the phone's Aa panel opens by blurring the editor so the
 *  keyboard drops, and a command that refocused from there would throw the
 *  keyboard back up over the panel. The selection stays drawn while
 *  unfocused, so the command still lands on it. */
export type RunOptions = { focus?: boolean };
