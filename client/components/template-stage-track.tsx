import { STAGE_ORDER, type TemplateStage } from '@temply/shared/stage';
import { STAGE_LABEL } from '~/lib/template-stage';
import { cn } from '~/lib/classname';

const fill = { draft: 'bg-line-strong', staging: 'bg-accent', waiting: 'bg-warn', live: 'bg-success-ink' };

export function TemplateStageTrack({ stage, liveVersion }: { stage: TemplateStage; liveVersion?: number | null }) {
  const current = STAGE_ORDER.indexOf(stage);
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
