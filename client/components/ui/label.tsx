import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/classname';

// The label the redesigned forms wear (the editor's Email settings rail set
// it): a bold line a step under the field's own text, so a form reads as
// label, field, label, field rather than as captions. A disabled field's
// label takes the disabled ink, never the live one faded.
const labelVariants = cva(
  'block text-base font-bold leading-none text-ink peer-disabled:cursor-not-allowed peer-disabled:text-disabled'
);

const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    className={cn(labelVariants(), className)}
    ref={ref}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
