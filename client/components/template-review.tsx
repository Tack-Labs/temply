'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckIcon, Loader2Icon, LockIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { templateStage } from '@temply/shared/stage';
import { candidateFindings, changesForReview } from '~/lib/template-review';
import { httpGet, httpPost } from '~/lib/http';
import type { WorkflowTemplate } from '~/lib/template-stage';
import { TemplateStageTrack } from './template-stage-track';
import { TemplateCopyPreview, useTemplateCopy } from './template-copy-preview';
import { Button } from './ui/button';
import { ConfirmDialog } from './ui/confirm-dialog';
import { Card, EmptyState, ErrorState, PageHeader, Reveal } from './ui/surfaces';
import { ReadOnlyNotice } from './dashboard/billing-banner';
import { StagedTestSend } from './staged-test-send';

type Decision = 'approve' | 'send-back' | 'rollback';

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

export function TemplateReview({ template: initialTemplate, isAdmin, userId, readOnly }: {
  template: WorkflowTemplate; isAdmin: boolean; userId: string; readOnly: boolean;
}) {
  const router = useRouter();
  const [template, setTemplate] = useState(initialTemplate);
  const [reviewed, setReviewed] = useState(false);
  const [note, setNote] = useState('');
  const [sendingBack, setSendingBack] = useState(false);
  const [comparing, setComparing] = useState(false);
  // The dialog's wording follows `decision`, which stays set after the dialog
  // closes so the copy does not change while it fades out.
  const [decision, setDecision] = useState<Decision>('approve');
  const [asking, setAsking] = useState(false);
  const decisionTrigger = useRef<HTMLButtonElement | null>(null);
  const draftLink = useRef<HTMLAnchorElement | null>(null);
  const confirmDecision = (action: Decision, trigger: HTMLButtonElement) => {
    decisionTrigger.current = trigger;
    setDecision(action);
    setAsking(true);
  };
  const candidate = useTemplateCopy(template, 'staged');
  const history = useQuery({
    queryKey: ['template-versions', template.org_id, template.id, template.published_at],
    queryFn: () => httpGet<{ versions: { version_number: number }[] }>(`/api/v1/templates/${template.id}/versions`),
    enabled: isAdmin && Boolean(template.published_at),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (action: Decision) => httpPost<{ template: WorkflowTemplate }>(`/api/v1/templates/${template.id}/${action}`,
      action === 'rollback' ? { publishedAt: template.published_at } : { stagedAt: template.staged_at, ...(action === 'send-back' ? { note } : {}) }),
    onSuccess: (result, action) => {
      setTemplate(result.template);
      setReviewed(false);
      setSendingBack(false);
      toast.success(action === 'approve' ? 'Approved and live' : action === 'send-back' ? 'Sent back' : 'Rolled back');
      router.refresh();
    },
    onError: (error) => toast.error(error.message || 'Could not update this template. Reload it and try again.'),
  });
  const stage = templateStage(template);
  const waiting = stage === 'waiting';
  const html = candidate.data?.html;
  const issues = useMemo(() => candidateFindings(template, html), [template, html]);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warn');
  const ready = waiting && Boolean(candidate.data) && !candidate.isError && !candidate.isFetching && errors.length === 0 && (warnings.length === 0 || reviewed);
  const busy = mutation.isPending || readOnly;
  const live = template.live_version != null ? `v${template.live_version}` : 'Current copy';
  const next = template.live_version != null ? `v${template.live_version + 1}` : 'Staged copy';
  const earlier = history.data?.versions[1]?.version_number;
  const description = waiting ? 'Review the staged copy, then approve it or send it back for changes.'
    : template.returned_at ? 'The candidate was sent back. Update the draft or ask for sign-off again.'
    : stage === 'live' ? 'The approved copy is live. Customers receive it on their next render.'
    : 'This template is not waiting for sign-off.';

  return (
    <div className="space-y-5 break-words p-3 sm:p-0">
      <nav aria-label="Template breadcrumb" className="flex flex-wrap gap-1 text-xs text-muted">
        <Link href="/dashboard/templates" className="text-accent-ink hover:underline">Templates</Link> /
        <Link href={`/templates/${template.id}`} className="min-w-0 break-words text-accent-ink hover:underline">{template.title}</Link> / Sign-off
      </nav>
      <PageHeader title="Review and sign off" description={template.title}
        actions={<Button asChild variant="secondary"><Link ref={draftLink} href={`/templates/${template.id}`}>Go to draft</Link></Button>} />
      {readOnly ? <ReadOnlyNotice /> : null}
      <Card className="space-y-4">
        <TemplateStageTrack stage={stage} liveVersion={template.live_version} />
        <div className={waiting ? 'rounded-lg bg-warn-wash p-3' : 'rounded-lg bg-hover p-3'}>
          <p className={waiting ? 'text-sm font-medium text-warn-ink' : 'text-sm font-medium text-ink'}>{waiting ? 'Waiting for sign-off' : template.returned_at ? 'Sent back for changes' : stage === 'live' ? 'Approved and live' : 'No sign-off requested'}</p>
          <p className="mt-1 text-xs text-muted">{description}</p>
          {template.review_requested_by ? <p className="mt-2 text-xs text-muted">Asked by {template.review_requested_by === userId ? 'you' : 'a teammate'}. Customers keep the live version until this copy is approved.</p> : null}
          {template.return_note ? <p className="mt-2 break-words whitespace-pre-wrap text-sm text-ink">{template.return_note}</p> : null}
        </div>
      </Card>

      {template.staged_at ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-5">
            <Card>
              <h2 className="text-sm font-medium text-ink">What changes</h2>
              <p className="mt-1 text-xs text-muted">{live} stays live until {next.toLowerCase()} is approved.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted"><tr className="border-b border-line"><th className="pb-2 pr-3 font-medium">What</th><th className="pb-2 pr-3 font-medium">Live now</th><th className="pb-2 pr-3 font-medium">Proposed</th><th className="pb-2 font-medium">Change</th></tr></thead>
                  <tbody>{changesForReview(template).map((change) => <tr key={change.label} className="border-b border-line last:border-0">
                    <th scope="row" className="py-3 pr-3 font-medium text-ink">{change.label}</th>
                    <td className="max-w-40 py-3 pr-3 text-muted">{change.live ?? (template.published_at ? live : 'Not live yet')}</td>
                    <td className="max-w-40 py-3 pr-3 text-muted">{change.proposed ?? next}</td>
                    <td className={change.changed ? 'py-3 text-accent-ink' : 'py-3 text-muted'}>{change.changed ? 'Changed' : 'Same'}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </Card>
            <Card className="space-y-3">
              <h2 className="text-sm font-medium text-ink">Staged preview</h2>
              <p className="flex items-center gap-1.5 text-xs text-muted"><LockIcon aria-hidden className="size-3.5" />This snapshot stays unchanged while the draft is edited.</p>
              <TemplateCopyPreview template={template} copy="staged" />
              <StagedTestSend key={template.staged_at} template={template} />
            </Card>
            {template.published_at ? <Card>
              <Button variant="ghost" size="sm" aria-expanded={comparing} onClick={() => setComparing((value) => !value)}>Compare with the live copy</Button>
              <Reveal open={comparing}>{comparing ? <div className="mt-3"><TemplateCopyPreview template={template} copy="live" /></div> : null}</Reveal>
            </Card> : null}
          </div>
          <div className="space-y-5">
            <Card className="space-y-3">
              <h2 className="text-sm font-medium text-ink">Checks</h2>
              {candidate.isError ? <ErrorState description="The staged preview could not be loaded. Approval is paused until it loads." onRetry={() => void candidate.refetch()} />
                : !candidate.data ? <p role="status" className="text-xs text-muted">Checking the staged copy…</p>
                : issues.length === 0 ? <p className="flex items-center gap-2 text-sm text-success-ink"><CheckIcon aria-hidden className="size-4" />No issues found</p>
                : <><p className="text-xs text-muted">{count(errors.length, 'error')}, {count(warnings.length, 'warning')}</p><ul className="space-y-3">{issues.map((issue) => <li key={issue.id} className={issue.severity === 'error' ? 'text-xs text-danger-ink' : 'text-xs text-warn-ink'}>{issue.message}</li>)}</ul></>}
              {warnings.length > 0 && isAdmin && waiting ? <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1 accent-accent" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />Mark as reviewed</label> : null}
              {errors.length > 0 ? <p className="text-xs text-muted">Send this copy back so the errors can be fixed before it goes live.</p> : null}
            </Card>
            <Card className="space-y-3">
              <h2 className="text-sm font-medium text-ink">{!waiting ? 'Not waiting for sign-off' : isAdmin ? 'Your decision' : 'Waiting for an admin'}</h2>
              <p className="text-xs text-muted">{!waiting ? 'Nobody has asked for sign-off on this copy yet. Ask from the template when it is ready.'
                : isAdmin ? 'Approving puts this staged copy live straight away.' : 'An admin can approve this copy or send it back. You can keep editing the draft.'}</p>
              {isAdmin && waiting ? <>
                <Button className="w-full" disabled={busy || !ready} aria-busy={mutation.isPending} onClick={(event) => confirmDecision('approve', event.currentTarget)}>
                  {mutation.isPending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}Approve and go live
                </Button>
                <Button variant="secondary" className="w-full" disabled={busy} aria-expanded={sendingBack} onClick={() => setSendingBack((value) => !value)}>{sendingBack ? 'Cancel' : 'Send back'}</Button>
                <Reveal open={sendingBack}><div className="space-y-2 pt-2">
                  <label htmlFor="return-note" className="text-xs font-medium text-ink">Note for the author (optional)</label>
                  <textarea id="return-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className="min-h-24 w-full rounded-md border border-line bg-surface p-2 text-sm text-ink" />
                  <p className="text-right text-2xs text-muted">{note.length} / 500</p>
                  <Button variant="secondary" className="w-full" disabled={busy} onClick={(event) => confirmDecision('send-back', event.currentTarget)}>Send back</Button>
                </div></Reveal>
              </> : null}
            </Card>
          </div>
        </div>
      ) : <EmptyState icon={CheckIcon} title={stage === 'live' ? 'This copy is live' : 'Nothing to sign off'}
        description={stage === 'live' ? 'Return to the draft when you are ready to make your next change.' : 'Move the draft to staging, then ask for sign-off.'}
        action={<Button asChild variant="secondary"><Link href={`/templates/${template.id}`}>Go to draft</Link></Button>} />}

      {isAdmin && earlier != null ? <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-sm font-medium text-ink">Roll back the live copy</h2><p className="mt-1 text-xs text-muted">Put v{earlier} back live as {template.live_version != null ? `v${template.live_version + 1}` : 'a new version'}, so the history stays in order. The draft and staged copy stay where they are.</p></div>
        <Button variant="secondary" disabled={busy} onClick={(event) => confirmDecision('rollback', event.currentTarget)}>Roll back to v{earlier}</Button>
      </Card> : null}
      {isAdmin && history.isError ? <ErrorState description="Version history could not be loaded, so rollback is unavailable." onRetry={() => void history.refetch()} /> : null}

      <ConfirmDialog open={asking} onOpenChange={(open) => { if (!open) setAsking(false); }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const trigger = decisionTrigger.current;
          if (trigger?.isConnected && !trigger.disabled) trigger.focus();
          else draftLink.current?.focus();
        }}
        title={decision === 'approve' ? 'Approve and go live?' : decision === 'rollback' ? `Roll back to v${earlier}?` : 'Send this copy back?'}
        description={decision === 'approve' ? 'Customers receive this copy straight away. The draft stays as it is.' : decision === 'rollback' ? 'Customers receive the earlier copy straight away. Your draft is kept.' : 'The author can update the draft and stage it again. The live copy stays as it is.'}
        confirmLabel={decision === 'approve' ? 'Approve' : decision === 'rollback' ? 'Roll back' : 'Send back'}
        confirmVariant={decision === 'approve' ? 'primary' : 'danger'}
        onConfirm={() => mutation.mutate(decision)} />
    </div>
  );
}
