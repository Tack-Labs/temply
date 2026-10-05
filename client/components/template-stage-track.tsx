import { STAGE_ORDER, type TemplateStage } from '@temply/shared/stage';
import { STAGE_LABEL, STAGE_TONE } from '~/lib/template-stage';
import { cn } from '~/lib/classname';
import { Badge } from './ui/surfaces';

const fill = { draft: 'bg-line-strong', staging: 'bg-accent', waiting: 'bg-warn', live: 'bg-success-ink' };

export function TemplateStageTrack({ stage, returned = false, compact = false, liveVersion }: {
  stage: TemplateStage; returned?: boolean; compact?: boolean; liveVersion?: number | null;
}) {
  const current = STAGE_ORDER.indexOf(stage);
  if (compact) return (
    <div className="w-32 space-y-1.5">
      <Badge tone={returned ? 'neutral' : STAGE_TONE[stage]}>{returned ? 'Sent back' : STAGE_LABEL[stage]}</Badge>
      <div role="img" aria-label={`Draft, Staging, Sign-off, Live. Current step: ${STAGE_LABEL[stage]}.`} className="grid grid-cols-4 gap-2">
        {STAGE_ORDER.map((step, index) => <span key={step} className={cn('h-1 rounded-full transition-colors duration-base motion-reduce:transition-none', index <= current ? fill[stage] : 'bg-line')} />)}
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <ol aria-label="Template stages" className="grid grid-cols-4 gap-2">
        {STAGE_ORDER.map((step, index) => (
          <li key={step} aria-current={stage === step ? 'step' : undefined} className="min-w-0">
            <div aria-hidden className={cn('h-1 rounded-full transition-colors duration-base motion-reduce:transition-none', index <= current ? fill[stage] : 'bg-line')} />
            <span className={cn('mt-2 block text-xs', stage === step ? 'font-medium text-ink' : 'text-muted')}>
              {STAGE_LABEL[step]}
              {liveVersion != null ? <span className="mt-0.5 block text-2xs font-normal tabular-nums text-muted">v{step === 'live' ? liveVersion : liveVersion + 1}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
