import { createContext } from 'react';

/** The phone shell's frame element, for anything that has to be positioned
 *  inside it rather than on the page: the frame is sized to the visual
 *  viewport, so a layer inside it sits above the keyboard for free. Null
 *  outside the phone shell. */
export const ShellFrameContext = createContext<HTMLElement | null>(null);
