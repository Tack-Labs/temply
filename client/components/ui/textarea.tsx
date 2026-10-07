import * as React from 'react';
import { fieldClass } from '~/components/ui/input';
import { cn } from '~/lib/classname';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/** `Input` for more than one line: the same tokens on a taller box that the
 *  reader can pull taller still. */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea className={cn(fieldClass, 'min-h-32 resize-y py-3', className)} ref={ref} {...props} />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
