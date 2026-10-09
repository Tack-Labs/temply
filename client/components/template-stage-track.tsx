import { STAGE_ORDER, type TemplateStage } from '@temply/shared/stage';
import { STAGE_LABEL } from '~/lib/template-stage';
import { cn } from '~/lib/classname';

const fill = { draft: 'bg-line-strong', staging: 'bg-accent', waiting: 'bg-warn', live: 'bg-success-ink' };

/** The four stages as a track, each step's version stacked under its name. */
export function TemplateStageTrack({ stage, liveVersion, className }: {
  stage: TemplateStage; liveVersion?: number | null; className?: string;
}) {
  const current = STAGE_ORDER.indexOf(stage);
  return (
    <div className={cn('space-y-3', className)}>
      <ol aria-label="Template stages" className="grid grid-cols-4 gap-2">
        {STAGE_ORDER.map((step, index) => (
          <li key={step} aria-current={stage === step ? 'step' : undefined} className="min-w-0">
            <div aria-hidden className={cn('h-1 rounded-full transition-colors duration-base motion-reduce:transition-none', index <= current ? fill[stage] : 'bg-line')} />
            <span className={cn('mt-2 block text-sm', stage === step ? 'font-bold text-ink' : 'text-muted')}>
              {STAGE_LABEL[step]}
              {liveVersion != null ? <span className="mt-0.5 block text-xs font-normal tabular-nums text-muted">v{step === 'live' ? liveVersion : liveVersion + 1}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
