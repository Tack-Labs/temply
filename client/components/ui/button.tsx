import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/classname';

// Buttons opt out of the global outline for the same soft ring text fields
// use — ring composes with each variant's shadow, a hard outline does not.
// Exported for button-shaped controls (option chips) built outside Button.
// `scale` is its own property in Tailwind v4, so it is listed beside
// transform or the press would snap instead of settling.
export const pressable =
  'transition-[background-color,box-shadow,border-color,color,transform,translate,scale] duration-fast ease-out active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-accent/25 focus-visible:outline-none motion-reduce:transition-none motion-reduce:active:scale-100';

const buttonVariants = cva(
  `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0 ${pressable}`,
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white shadow-sm hover:bg-accent-hover',
        secondary: 'border border-line bg-raised text-ink shadow-xs hover:bg-hover hover:border-line-strong',
        ghost: 'text-muted hover:bg-hover hover:text-ink',
        danger: 'bg-danger text-white shadow-sm hover:opacity-90',
        'danger-quiet': 'text-danger-ink hover:bg-danger-wash',
        link: 'text-accent-ink underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-7 px-2 text-xs [&_svg]:size-3.5',
        md: 'h-8 px-3 text-sm [&_svg]:size-4',
        lg: 'h-10 px-4 text-base [&_svg]:size-4',
        icon: 'size-8 [&_svg]:size-4',
        'icon-sm': 'size-7 [&_svg]:size-3.5',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        // A bare <button> inside a form defaults to submit; opt in explicitly.
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
