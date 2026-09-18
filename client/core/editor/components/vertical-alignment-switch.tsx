import {
  AlignVerticalDistributeCenter,
  AlignVerticalDistributeEnd,
  AlignVerticalDistributeStart,
} from 'lucide-react';
import { BubbleMenuButton } from './bubble-menu-button';
import { AllowedColumnVerticalAlign } from '../nodes/columns/column';

type VerticalAlignmentSwitchProps = {
  alignment: AllowedColumnVerticalAlign;
  onAlignmentChange: (alignment: AllowedColumnVerticalAlign) => void;
};

export function VerticalAlignmentSwitch(props: VerticalAlignmentSwitchProps) {
  const { alignment = 'top', onAlignmentChange } = props;

  const activeAlignment = {
    top: {
      icon: AlignVerticalDistributeStart,
      tooltip: 'Align top',
      onClick: () => {
        onAlignmentChange('middle');
      },
    },
    middle: {
      icon: AlignVerticalDistributeCenter,
      tooltip: 'Align centre',
      onClick: () => {
        onAlignmentChange('bottom');
      },
    },
    bottom: {
      icon: AlignVerticalDistributeEnd,
      tooltip: 'Align bottom',
      onClick: () => {
        onAlignmentChange('top');
      },
    },
  }[alignment];

  return (
    <BubbleMenuButton
      icon={activeAlignment.icon}
      tooltip={activeAlignment.tooltip}
      command={activeAlignment.onClick}
    />
  );
}
