import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { LucideIcon } from 'lucide-react';
import { SVGIcon } from '../icons/grid-lines';
import { DropdownSelect } from '~/components/ui/dropdown-select';

type SelectProps = {
  label: string;
  options: {
    value: string;
    label: string;
  }[];

  value: string;
  onValueChange: (value: string) => void;

  tooltip?: string;
  className?: string;

  icon?: LucideIcon | SVGIcon;
  iconClassName?: string;

  placeholder?: string;
};

/**
 * The editor's dropdowns, on the app's custom control.
 *
 * These used to be native <select>s, which paint their popup with OS chrome:
 * on a dark bubble menu the list opened as a white OS panel. The API is
 * unchanged so all twelve call sites keep working.
 */
export function Select(props: SelectProps) {
  const {
    label,
    options,
    value,
    onValueChange,
    tooltip,
    className,
    icon,
    iconClassName,
    placeholder,
  } = props;

  const content = (
    <DropdownSelect
      label={label}
      options={options}
      value={value}
      onValueChange={onValueChange}
      size="sm"
      variant="plain"
      placeholder={placeholder}
      icon={icon as LucideIcon | undefined}
      iconClassName={iconClassName}
      className={className}
      keepFocus
    />
  );

  if (!tooltip) {
    return content;
  }

  // The trigger is a Radix Root, not a DOM node, so the tooltip needs a real
  // element of its own to anchor to.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="mly:inline-flex">{content}</span>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
