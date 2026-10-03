import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/classname';

// The press and focus treatment for an <a> or <button> that acts like a
// button. Focus is a solid 2px accent-ink outline held 2px off the edge, so
// it is drawn on the surface behind the control rather than on the control's
// own fill: 4.6:1 or better on every app surface in both themes and 3.1:1 on
// the rail, where the soft 25% ring it replaces measured 1.4:1 and 1.3:1. An
// outline takes no part in box-shadow, so it composes with each variant's
// shadow. On an <a> or <button> the global :focus-visible rule in globals.css
// draws the same outline; it is repeated here so this file states and tests
// the treatment itself, and a change to the base layer cannot quietly change
// every button. Not for other elements: the focus fade needs the resting
// transparent outline that the base layer sets only on a, button, summary and
// [tabindex], and the press scale and the translate and filter transitions
// assume something that takes :active.
// Exported for button-shaped controls (option chips) built outside Button.
// `scale` is its own property in Tailwind v4, so it is listed beside
// transform or the press would snap instead of settling; `outline-color`
// and `filter` are listed so the focus fade and the danger hover settle too.
export const pressable =
  'transition-[background-color,box-shadow,border-color,color,transform,translate,scale,outline-color,filter] duration-fast ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink motion-reduce:transition-none motion-reduce:active:scale-100';

const buttonVariants = cva(
  `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0 ${pressable}`,
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white shadow-sm hover:bg-accent-hover',
        secondary: 'border border-line bg-raised text-ink shadow-xs hover:bg-hover hover:border-line-strong',
        ghost: 'text-muted hover:bg-hover hover:text-ink',
        danger: 'bg-danger text-white shadow-sm hover:brightness-95',
        'danger-quiet': 'text-danger-ink hover:bg-danger-wash',
        link: 'text-accent-ink underline-offset-4 hover:underline',
      },
      // A fine pointer keeps the dense sizes; a coarse one gets a 44px target.
      size: {
        sm: 'h-7 px-2 text-xs [&_svg]:size-3.5',
        md: 'h-8 px-3 text-sm pointer-coarse:h-11 [&_svg]:size-4',
        lg: 'h-10 px-4 text-base pointer-coarse:h-11 [&_svg]:size-4',
        icon: 'size-8 pointer-coarse:size-11 [&_svg]:size-4',
        'icon-sm': 'size-7 [&_svg]:size-3.5',
      },
      // sm and icon-sm stay dense under a coarse pointer unless a call site
      // opts in. They sit in toolbars, input adornments and row-action
      // clusters with a fixed height or a shrink-0 width, where 44px would
      // overflow or squeeze their neighbours; `touch` is for the ones that
      // sit in a wrapping or vertical container.
      touch: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      { size: 'sm', touch: true, className: 'pointer-coarse:h-11' },
      { size: 'icon-sm', touch: true, className: 'pointer-coarse:size-11' },
    ],
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
      touch: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, 'touch'> {
  asChild?: boolean;
  /**
   * Opts `size="sm"` and `size="icon-sm"` into the 44px target a coarse
   * pointer gets; md, lg and icon always have it. Those two small sizes stay
   * dense by default because they sit in toolbars, input adornments and
   * row-action clusters with a fixed height or a shrink-0 width that 44px
   * would overflow. Set it where the button sits in a wrapping or vertical
   * container. It does nothing on a mouse. DropdownSelect and
   * ColorPickerPopover have a `touch` prop of their own that means something
   * else: always 44px, whatever the pointer.
   */
  touch?: boolean;
  /**
   * A size class here sets the size for a fine pointer only. The coarse size
   * of md, lg and icon is a different variant group, so tailwind-merge keeps
   * it and it wins on touch: `size-7` on an icon button is 44px on a phone.
   * To pin a size there too, repeat it with the variant
   * (`size-7 pointer-coarse:size-7`). For a dense button that should still
   * grow on touch, use `icon-sm` or `sm` with `touch` instead of overriding
   * the md or icon size.
   */
  className?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, touch, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        // A bare <button> inside a form defaults to submit; opt in explicitly.
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size, touch }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
