import * as React from 'react';
import { cn } from '~/lib/classname';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * What a one-line field and a text box share, so the two cannot drift apart.
 * The border is `line-strong`, not `line`: on a white field the lighter one is
 * close to invisible. It and the base layer's focus border both set
 * border-color, and a utility beats the base layer, so the focus colour is
 * stated here or it never shows. The text is 16px, not the 15px of the rest of
 * the UI, so iOS Safari does not zoom the page when a field takes focus.
 * Disabled it is a filled field in the disabled ink with its border colour
 * cleared, never the live one at half strength.
 */
export const fieldClass =
  'flex w-full rounded-field border-[1.5px] border-line-strong bg-raised px-4 text-lg placeholder:text-muted focus-visible:border-accent disabled:cursor-not-allowed disabled:border-transparent disabled:bg-track disabled:text-disabled disabled:placeholder:text-disabled';

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        className={cn(fieldClass, 'h-12 py-2 file:border-0 file:bg-transparent file:text-lg file:font-medium', className)}
        ref={ref}
        type={type}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
