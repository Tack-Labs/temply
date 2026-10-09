'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon, WorkflowIcon } from 'lucide-react';
import { templateStage } from '@temply/shared/stage';
import { copyOf, nextStep, type TemplateCopy, type WorkflowTemplate } from '~/lib/template-stage';
import { cn } from '~/lib/classname';
import type { TemplateEditorModel } from './editor/use-template-editor';
import { TemplateStageTrack } from './template-stage-track';
import { TemplateUnstageAction, TemplateWorkflowAction } from './template-workflow-action';
import { TemplateCopyPreview } from './template-copy-preview';
import { Button } from './ui/button';
import { Card, Reveal } from './ui/surfaces';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
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
 *  by the desktop header's popover and the phone's bottom sheet. */
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
  const tint = waiting ? 'bg-warn-wash' : stage === 'live' ? 'bg-success-wash' : stage === 'staging' ? 'bg-accent-wash' : 'bg-hover';
  const ink = waiting ? 'text-warn-ink' : stage === 'live' ? 'text-success-ink' : 'text-ink';

  const track = <TemplateStageTrack stage={stage} liveVersion={row.live_version} />;
  const switcher = (
    <SegmentedControl label="Template copy" value={copy} onValueChange={onCopy} options={[
      { value: 'draft', label: 'Draft' },
      { value: 'staged', label: 'Staged copy', disabled: !row.staged_at },
      { value: 'live', label: 'Live copy', disabled: !row.published_at },
    ]} />
  );
  const actions = (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {step.action === 'edit' ? null : <span className="text-sm text-muted">Next step</span>}
      <TemplateWorkflowAction id={row.id} stage={stage} isAdmin={model.isAdmin} disabled={model.readOnly} size="compact"
        beforeStage={model.beforeStage} onChanged={model.onWorkflowChanged} inEditor />
      {stage === 'staging' && model.unpublished ? <TemplateWorkflowAction id={row.id} stage="draft" isAdmin={model.isAdmin} size="compact"
        disabled={model.readOnly} beforeStage={model.beforeStage} onChanged={model.onWorkflowChanged} label="Update staged copy" variant="secondary" /> : null}
      {row.staged_at ? <TemplateUnstageAction id={row.id} waiting={waiting} disabled={model.readOnly} onChanged={model.onWorkflowChanged} /> : null}
      {model.isAdmin && !waiting && (row.live_version ?? 0) >= 2 ? <Button asChild variant="ghost" size="compact">
        <Link href={`/templates/${row.id}/review`}>Review and rollback</Link>
      </Button> : null}
    </div>
  );

  return (
    <div className="space-y-4">
      {track}
      <div className={cn('rounded-xl p-4', tint)}>
        <p className={cn('text-base font-bold', ink)}>{message}</p>
        <p className="mt-1 break-words text-sm text-muted">{detail}</p>
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

/**
 * The way into staging and sign-off from the editor's header: a quiet button
 * that names the feature, opening a panel with the stage track, where the
 * template stands, the copy switch and the next step. A panel and not a third
 * bar under the header and the tab row: the controls are wanted a few times in
 * a template's life, and a bar that is always there reads as a feature to
 * learn before the email can be touched. The panel stays open while the copy
 * switch is used, as the phone's sheet does, so a reader can step through
 * staging without reopening it; Escape or a click outside puts it away.
 */
export function TemplateWorkflowPopover({ model, copy, onCopy }: {
  model: TemplateEditorModel; copy: TemplateCopy; onCopy: (copy: TemplateCopy) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!model.template) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="compact" aria-expanded={open} className="pointer-coarse:h-11">
          <WorkflowIcon aria-hidden="true" />
          Staging &amp; sign-off
          <ChevronDownIcon
            aria-hidden="true"
            className={cn('transition-transform duration-base ease-out motion-reduce:transition-none', open && 'rotate-180')}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Staging and sign-off" className="w-[27rem] max-w-[calc(100vw-2rem)]">
        <p className="font-display text-xl font-bold tracking-display text-ink">Staging and sign-off</p>
        <p className="mt-1.5 text-sm text-muted">
          Move the draft to staging to check it, ask an admin to sign it off, and see which copy customers receive.
        </p>
        <div className="mt-5">
          <TemplateWorkflowControls model={model} copy={copy} onCopy={onCopy} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Shows the draft, or the staged or live copy the header's popover chose in
 * its place. `copy` is the header's: the two are far apart in the tree and the
 * sandbox between them holds the choice.
 */
export function TemplateWorkflowPanel({ model, copy, onCopy, children }: {
  model: TemplateEditorModel; copy: TemplateCopy; onCopy: (copy: TemplateCopy) => void; children: React.ReactNode;
}) {
  // The copy the collapsing panel last showed. It stays mounted while the
  // panel folds away, so the height eases down instead of snapping shut.
  const [lastSide, setLastSide] = useState<'staged' | 'live'>('staged');
  const row = model.template;
  if (!row) return children;
  const shown = visibleCopy(row, copy);
  if (shown !== 'draft' && shown !== lastSide) setLastSide(shown);
  const side = shown === 'draft' ? lastSide : shown;

  // From `lg` the draft takes the rest of the frame and the editor, not this
  // panel, owns the scrolling. Below it the page scrolls as one.
  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      <div hidden={shown !== 'draft'} className="flex flex-1 flex-col lg:min-h-0">{children}</div>
      <Reveal open={shown !== 'draft'} className="max-sm:hidden lg:min-h-0">
        <div className="lg:max-h-full lg:overflow-y-auto">
          {copyOf(row, side) ? (
            <Card className="mx-4 my-4 space-y-3 lg:mx-7 lg:mt-6">
              <TemplateCopyView row={row} copy={side} />
              <Button size="sm" variant="link" onClick={() => onCopy('draft')}>Go to draft</Button>
            </Card>
          ) : null}
        </div>
      </Reveal>
    </div>
  );
}
