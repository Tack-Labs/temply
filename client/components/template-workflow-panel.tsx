'use client';

import { useState } from 'react';
import Link from 'next/link';
import { templateStage } from '@temply/shared/stage';
import { copyOf, nextStep, type TemplateCopy, type WorkflowTemplate } from '~/lib/template-stage';
import { cn } from '~/lib/classname';
import type { TemplateEditorModel } from './editor/use-template-editor';
import { TemplateStageTrack } from './template-stage-track';
import { TemplateUnstageAction, TemplateWorkflowAction } from './template-workflow-action';
import { TemplateCopyPreview } from './template-copy-preview';
import { Button } from './ui/button';
import { Card, Reveal } from './ui/surfaces';
import { SegmentedControl } from './ui/segmented-control';
import { StagedTestSend } from './staged-test-send';

/** templateStage compares the draft's stamp with the published one, and the
 *  editor already knows whether they differ: a stand-in for the draft's stamp
 *  keeps that answer without reading a stamp that autosave is still moving. */
export function editorStage(model: TemplateEditorModel) {
  return templateStage({ updated_at: model.unpublished ? 'draft-changed' : model.publishedAt,
    published_at: model.publishedAt, staged_at: model.template?.staged_at ?? null,
    review_requested_at: model.template?.review_requested_at ?? null });
}

/** The copy to show: the one asked for, or the draft when that copy has gone. */
export function visibleCopy(row: WorkflowTemplate, copy: TemplateCopy): TemplateCopy {
  return copyOf(row, copy) ? copy : 'draft';
}

/** Where the template is in staging and sign-off, and what to do next. Shared
 *  by the desktop bar and the phone's bottom sheet. `compact` is the bar's
 *  layout: the track, the copy switch and the actions share a row, and the
 *  status is a line under them instead of a tinted box. */
export function TemplateWorkflowControls({ model, copy, onCopy, compact = false }: {
  model: TemplateEditorModel; copy: TemplateCopy; onCopy: (copy: TemplateCopy) => void; compact?: boolean;
}) {
  const row = model.template;
  if (!row) return null;
  const stage = editorStage(model);
  const waiting = stage === 'waiting';
  const step = nextStep(stage, model.isAdmin);
  const message = waiting ? 'Waiting for sign-off' : row.returned_at ? 'Sent back for changes' : stage === 'staging' ? 'Ready to check in staging' : stage === 'live' ? 'This template is live' : 'Your changes are in the draft';
  const detail = waiting ? 'The staged copy is locked while an admin reviews it. You can keep editing the draft.'
    : row.returned_at ? row.return_note || 'Update the draft, then move it to staging again.'
    : stage === 'staging' ? 'Check the staged copy before asking an admin to sign it off.'
    : stage === 'live' ? 'Customers receive this copy. Edit the draft to start your next change.'
    : 'Customers keep receiving the live copy until the next change is approved or published.';
  const tint = waiting ? 'bg-warn-wash' : stage === 'live' ? 'bg-success-wash' : stage === 'staging' ? 'bg-accent-wash' : 'bg-hover';
  const ink = waiting ? 'text-warn-ink' : stage === 'live' ? 'text-success-ink' : 'text-ink';

  const track = <TemplateStageTrack stage={stage} liveVersion={row.live_version} compact={compact} className={compact ? 'w-72 max-w-full' : undefined} />;
  const switcher = (
    <SegmentedControl label="Template copy" value={copy} onValueChange={onCopy} size={compact ? 'sm' : 'md'} options={[
      { value: 'draft', label: 'Draft' },
      { value: 'staged', label: 'Staged copy', disabled: !row.staged_at },
      { value: 'live', label: 'Live copy', disabled: !row.published_at },
    ]} />
  );
  const actions = (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {step.action === 'edit' ? null : <span className="text-xs text-muted">Next step</span>}
      <TemplateWorkflowAction id={row.id} stage={stage} isAdmin={model.isAdmin} disabled={model.readOnly}
        beforeStage={model.beforeStage} onChanged={model.onWorkflowChanged} inEditor />
      {stage === 'staging' && model.unpublished ? <TemplateWorkflowAction id={row.id} stage="draft" isAdmin={model.isAdmin}
        disabled={model.readOnly} beforeStage={model.beforeStage} onChanged={model.onWorkflowChanged} label="Update staged copy" variant="secondary" /> : null}
      {row.staged_at ? <TemplateUnstageAction id={row.id} waiting={waiting} disabled={model.readOnly} onChanged={model.onWorkflowChanged} /> : null}
      {model.isAdmin && !waiting && (row.live_version ?? 0) >= 2 ? <Button asChild variant="ghost" size="sm">
        <Link href={`/templates/${row.id}/review`}>Review and rollback</Link>
      </Button> : null}
    </div>
  );

  if (compact) {
    // The note a reviewer sent back is the detail, so it wraps rather than
    // truncating: a long one makes the bar taller, which beats cutting it off.
    return (
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">{track}{switcher}{actions}</div>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', tint, ink)}>{message}</span>
          <span className="min-w-0 break-words text-xs text-muted">{detail}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {track}
      <div className={cn('rounded-lg p-3', tint)}>
        <p className={cn('text-sm font-medium', ink)}>{message}</p>
        <p className="mt-1 break-words text-xs text-muted">{detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{switcher}{actions}</div>
    </div>
  );
}

/** The staged or live copy, as it would be sent. */
export function TemplateCopyView({ row, copy }: { row: WorkflowTemplate; copy: 'staged' | 'live' }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{copy === 'staged' ? 'This staged copy is a snapshot. Changes to the draft leave it unchanged.' : 'This is the copy customers receive.'}</p>
      <TemplateCopyPreview template={row} copy={copy} />
      {copy === 'staged' ? <StagedTestSend key={row.staged_at} template={row} /> : null}
    </div>
  );
}

export function TemplateWorkflowPanel({ model, children }: { model: TemplateEditorModel; children: React.ReactNode }) {
  const [copy, setCopy] = useState<TemplateCopy>('draft');
  // The copy the collapsing panel last showed. It stays mounted while the
  // panel folds away, so the height eases down instead of snapping shut.
  const [lastSide, setLastSide] = useState<'staged' | 'live'>('staged');
  const row = model.template;
  if (!row) return children;
  const shown = visibleCopy(row, copy);
  const choose = (next: TemplateCopy) => {
    setCopy(next);
    if (next !== 'draft') setLastSide(next);
  };
  const side = shown === 'draft' ? lastSide : shown;

  // From `lg` the bar is docked under the tabs and the draft takes the rest
  // of the frame, so the editor, not this panel, owns the scrolling. Below it
  // the bar is a card and the page scrolls as one.
  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      {/* Below `sm` the editor is a fixed frame over the page, so a bar here
          would sit underneath it: the phone reaches this from the ⋯ menu. */}
      <div className="mx-4 mt-4 mb-4 rounded-card bg-raised p-4 shadow-sm max-sm:hidden lg:m-0 lg:shrink-0 lg:rounded-none lg:border-b-[1.5px] lg:border-line lg:px-6 lg:py-3 lg:shadow-none">
        <TemplateWorkflowControls model={model} copy={shown} onCopy={choose} compact />
      </div>
      <div hidden={shown !== 'draft'} className="flex flex-1 flex-col lg:min-h-0">{children}</div>
      <Reveal open={shown !== 'draft'} className="max-sm:hidden lg:min-h-0">
        <div className="lg:max-h-full lg:overflow-y-auto">
          {copyOf(row, side) ? (
            <Card className="mx-4 mb-4 space-y-3 lg:mx-7 lg:mt-6">
              <TemplateCopyView row={row} copy={side} />
              <Button size="sm" variant="link" onClick={() => choose('draft')}>Go to draft</Button>
            </Card>
          ) : null}
        </div>
      </Reveal>
    </div>
  );
}
