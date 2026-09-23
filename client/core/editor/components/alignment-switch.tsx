import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { BubbleMenuButton } from './bubble-menu-button';
import { AllowedLogoAlignment, allowedLogoAlignment } from '../nodes/logo/logo';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../utils/classname';
import { TooltipLabel } from './ui/tooltip';
import { ALIGN_LABEL } from '../commands/text';

type AlignmentSwitchProps = {
  alignment: AllowedLogoAlignment;
  onAlignmentChange: (alignment: AllowedLogoAlignment) => void;
};

export function AlignmentSwitch(props: AlignmentSwitchProps) {
  const { alignment: rawAlignment, onAlignmentChange } = props;
  const alignment = allowedLogoAlignment.includes(
    rawAlignment as AllowedLogoAlignment
  )
    ? rawAlignment
    : 'left';

  const alignments = {
    left: {
      icon: AlignLeft,
      tooltip: ALIGN_LABEL.left,
      onClick: () => {
        onAlignmentChange('left');
      },
    },
    center: {
      icon: AlignCenter,
      tooltip: ALIGN_LABEL.center,
      onClick: () => {
        onAlignmentChange('center');
      },
    },
    right: {
      icon: AlignRight,
      tooltip: ALIGN_LABEL.right,
      onClick: () => {
        onAlignmentChange('right');
      },
    },
  };

  const activeAlignment = alignments[alignment];

  return (
    <Popover>
      <TooltipLabel label="Alignment">
        <PopoverTrigger
          className={cn(
            'mly:flex mly:size-7 mly:items-center mly:justify-center mly:gap-1 mly:rounded-md mly:px-1.5 mly:text-sm mly:data-[state=open]:bg-soft-gray mly:transition-colors mly:hover:bg-soft-gray mly:focus-visible:relative mly:focus-visible:z-10 '
          )}
        >
          <activeAlignment.icon className="mly:h-3 mly:w-3 mly:stroke-[2.5]" />
        </PopoverTrigger>
      </TooltipLabel>
      <PopoverContent
        aria-label="Alignment"
        className="mly:flex mly:w-max mly:gap-0.5 mly:rounded-lg mly:p-0.5!"
        side="top"
        sideOffset={8}
        align="center"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        {Object.entries(alignments).map(([key, value]) => {
          return (
            <BubbleMenuButton
              key={key}
              icon={value.icon}
              tooltip={value.tooltip}
              command={value.onClick}
              isActive={() => key === alignment}
            />
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
