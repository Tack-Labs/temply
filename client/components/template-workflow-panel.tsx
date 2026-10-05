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
 *  by the desktop card and the phone's bottom sheet. */
export function TemplateWorkflowControls({ model, copy, onCopy }: {
  model: TemplateEditorModel; copy: TemplateCopy; onCopy: (copy: TemplateCopy) => void;
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

  return (
    <div className="space-y-4">
      <TemplateStageTrack stage={stage} liveVersion={row.live_version} />
      <div className={cn('rounded-lg p-3', waiting ? 'bg-warn-wash' : stage === 'live' ? 'bg-success-wash' : stage === 'staging' ? 'bg-accent-wash' : 'bg-hover')}>
        <p className={cn('text-sm font-medium', waiting ? 'text-warn-ink' : stage === 'live' ? 'text-success-ink' : 'text-ink')}>{message}</p>
        <p className="mt-1 break-words text-xs text-muted">{detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl label="Template copy" value={copy} onValueChange={onCopy} options={[
          { value: 'draft', label: 'Draft' },
          { value: 'staged', label: 'Staged copy', disabled: !row.staged_at },
          { value: 'live', label: 'Live copy', disabled: !row.published_at },
        ]} />
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
      </div>
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

  return (
    <div className="space-y-4">
      {/* Below `sm` the editor is a fixed frame over the page, so a card here
          would sit underneath it: the phone reaches this from the ⋯ menu. */}
      <Card className="space-y-4 max-sm:hidden">
        <TemplateWorkflowControls model={model} copy={shown} onCopy={choose} />
      </Card>
      <div hidden={shown !== 'draft'}>{children}</div>
      <Reveal open={shown !== 'draft'} className="max-sm:hidden">
        {copyOf(row, side) ? (
          <Card className="space-y-3">
            <TemplateCopyView row={row} copy={side} />
            <Button size="sm" variant="link" onClick={() => choose('draft')}>Go to draft</Button>
          </Card>
        ) : null}
      </Reveal>
    </div>
  );
}
