import { createContext, useContext } from 'react';

export type InputField = {
  /** How the committed draft is named back to the control. Chosen by the
   *  control and fixed: a label is copy and can be reworded, a position moves
   *  the moment a field is added or left out. */
  key: string;
  label: string;
  value: string;
  placeholder?: string;
  /** One short line beside the label: what the value is for. */
  hint?: string;
  /** Suggestions for the draft as typed; shown as chips under the label. */
  options?: (draft: string) => string[];
  /** The character a draft starts with to mean a variable, when the field
   *  takes one. Empty means every draft is a plain key and the chips always
   *  show. */
  triggerChar?: string;
};

/**
 * A small form the shell docks above the keyboard, in place of the popover a
 * control would otherwise open. The phone provides it; the desktop never does,
 * and the controls keep their popovers there.
 *
 * The title names the surface, not the first field — "Variable", above a Name
 * and a Placeholder. One ✓ commits every field, because a control's values are
 * one edit and asking for them one surface at a time is what this replaced.
 */
export type InputDockSpec = {
  title: string;
  fields: InputField[];
  /** Every field's committed draft, under the field's own key. A key a spec
   *  left out is absent, which is how a control tells "empty" from "not
   *  asked for". */
  onCommit: (values: Record<string, string>) => void;
};

export type InputDock = { open: (spec: InputDockSpec) => void };

export const InputDockContext = createContext<InputDock | null>(null);

/** The dock when a shell provides one, else null — the cue to keep the popover. */
export function useInputDock(): InputDock | null {
  return useContext(InputDockContext);
}
