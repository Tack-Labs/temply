import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/classname';

// The press and focus treatment for an <a> or <button> that acts like a
// button. Focus is a solid 3px outline in the `focus` token, held 2px off the
// edge, so it is drawn on the surface behind the control rather than on the
// control's own fill; the token clears 3:1 on every surface, wash and track
// in both themes, which the contrast gate holds it to. An outline takes no
// part in box-shadow, so it composes with each variant's shadow. On an <a> or
// <button> the global :focus-visible rule in globals.css draws the same
// outline; it is repeated here so this file states and tests the treatment
// itself, and a change to the base layer cannot quietly change every button.
// Not for other elements: the focus fade needs the resting transparent
// outline that the base layer sets only on a, button, summary and
// [tabindex], and the press scale and the translate and filter transitions
// assume something that takes :active.
// Exported for button-shaped controls (option chips) built outside Button.
// `scale` is its own property in Tailwind v4, so it is listed beside
// transform or the press would snap instead of settling; `outline-color`
// and `filter` are listed so the focus fade and the danger hover settle too.
export const pressable =
  'transition-[background-color,box-shadow,border-color,color,transform,translate,scale,outline-color,filter] duration-fast ease-out active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none motion-reduce:active:scale-100';

// The same disabled look for a button that stays focusable, marked
// aria-disabled instead of disabled so the keyboard is not dropped when it
// turns inactive (a stepper at its bound, a form that is sending). The call
// site adds the cursor that says why; the hover fill is restated because the
// variant's own hover would otherwise win over the track.
export const ariaDisabled =
  'aria-disabled:border-transparent aria-disabled:bg-track aria-disabled:text-disabled aria-disabled:shadow-none aria-disabled:hover:bg-track aria-disabled:active:scale-100';

const buttonVariants = cva(
  // A disabled button is a filled pill in the disabled ink, never the live
  // one at half strength: a faded violet still looks like something to press.
  // pointer-events-none is what keeps hover and the press scale off it, which
  // is why it carries no not-allowed cursor: the cursor would never show.
  `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap disabled:pointer-events-none disabled:bg-track disabled:text-disabled disabled:shadow-none [&_svg]:shrink-0 ${pressable}`,
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white shadow-sm hover:bg-accent-hover',
        // The border keeps its width when disabled and only loses its colour,
        // so the label does not move.
        secondary: 'border-[1.5px] border-line-strong bg-raised text-ink hover:bg-hover disabled:border-transparent',
        ghost: 'text-ink-soft hover:bg-hover hover:text-ink',
        danger: 'bg-danger text-white shadow-sm hover:brightness-95',
        'danger-quiet': 'text-danger-ink hover:bg-danger-wash',
        // Text in a sentence, so disabled it stays unfilled.
        link: 'text-accent-ink underline-offset-4 hover:underline disabled:bg-transparent',
      },
      // md and lg are the page-level sizes: 48px and 56px for a fine pointer
      // too, because a button a customer is meant to find is not a dense one,
      // and both are past the 44px a thumb needs, so neither has a coarse
      // step. compact is the old default, for the editor's chrome and every
      // other place that holds a row of controls at 32px: it keeps that height
      // for a fine pointer and gets the 44px target on a coarse one.
      size: {
        sm: 'h-7 px-2 text-xs [&_svg]:size-3.5',
        compact: 'h-8 px-3 text-sm pointer-coarse:h-11 [&_svg]:size-4',
        md: 'h-12 px-6 gap-2 text-lg font-semibold [&_svg]:size-[18px]',
        lg: 'h-14 px-7 gap-2 text-lg font-semibold [&_svg]:size-5',
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
      // The glow belongs to a call to action at page size. On a 28 or 32px
      // toolbar button it would spill over its neighbours.
      { variant: 'primary', size: ['md', 'lg'], className: 'shadow-cta' },
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
   * pointer gets; md and lg are always at least that, and compact and icon
   * grow to it on their own. Those two small sizes stay
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
   * of compact and icon is a different variant group, so tailwind-merge keeps
   * it and it wins on touch: `size-7` on an icon button is 44px on a phone.
   * To pin a size there too, repeat it with the variant
   * (`size-7 pointer-coarse:size-7`). For a dense button that should still
   * grow on touch, use `icon-sm` or `sm` with `touch` instead of overriding
   * the compact or icon size. md and lg have no coarse step, so a height
   * class here replaces theirs outright, on touch as well.
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
