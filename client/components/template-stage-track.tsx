import { STAGE_ORDER, type TemplateStage } from '@temply/shared/stage';
import { STAGE_LABEL } from '~/lib/template-stage';
import { cn } from '~/lib/classname';

const fill = { draft: 'bg-line-strong', staging: 'bg-accent', waiting: 'bg-warn', live: 'bg-success-ink' };

/** `compact` puts each step's version beside its name, one line a step, for the
 *  editor's docked bar; the default stacks it under the name. */
export function TemplateStageTrack({ stage, liveVersion, compact = false, className }: {
  stage: TemplateStage; liveVersion?: number | null; compact?: boolean; className?: string;
}) {
  const current = STAGE_ORDER.indexOf(stage);
  return (
    <div className={cn('space-y-3', className)}>
      <ol aria-label="Template stages" className={cn('grid grid-cols-4', compact ? 'gap-1.5' : 'gap-2')}>
        {STAGE_ORDER.map((step, index) => (
          <li key={step} aria-current={stage === step ? 'step' : undefined} className="min-w-0">
            <div aria-hidden className={cn('h-1 rounded-full transition-colors duration-base motion-reduce:transition-none', index <= current ? fill[stage] : 'bg-line')} />
            <span className={cn(compact ? 'mt-1.5 flex items-baseline gap-1 whitespace-nowrap' : 'mt-2 block', 'text-xs', stage === step ? 'font-medium text-ink' : 'text-muted')}>
              {STAGE_LABEL[step]}
              {liveVersion != null ? <span className={cn('text-2xs font-normal tabular-nums text-muted', !compact && 'mt-0.5 block')}>v{step === 'live' ? liveVersion : liveVersion + 1}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
