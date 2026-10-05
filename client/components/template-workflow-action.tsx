'use client';

import { useMutation } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type { TemplateStage } from '@temply/shared/stage';
import { nextStep, type WorkflowTemplate } from '~/lib/template-stage';
import { httpPost } from '~/lib/http';
import { Button } from './ui/button';
import { ConfirmDialog } from './ui/confirm-dialog';

export function TemplateWorkflowAction({ id, stage, isAdmin, disabled = false, beforeStage, onChanged, title, label, size = 'sm', variant = 'primary', inEditor = false }: {
  id: string; stage: TemplateStage; isAdmin: boolean; disabled?: boolean; title?: string; label?: string;
  beforeStage?: () => Promise<boolean>; onChanged?: (row: WorkflowTemplate) => void; size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary';
  /** On the template's own page the draft is already in front of the reader, so
   *  "Edit draft" has nowhere to go and is left out. */
  inEditor?: boolean;
}) {
  const router = useRouter();
  const step = nextStep(stage, isAdmin);
  const caption = label ?? step.label;
  const mutation = useMutation({
    mutationFn: async () => {
      if (step.action === 'stage' && beforeStage && !(await beforeStage())) return null;
      return httpPost<{ template: WorkflowTemplate }>(`/api/v1/templates/${id}/${step.action}`, {});
    },
    onSuccess: (result) => {
      if (!result) return;
      onChanged?.(result.template);
      toast.success(step.action === 'stage' ? 'Moved to staging' : 'Sign-off requested');
      router.refresh();
    },
    onError: (error) => toast.error(error.message || 'Could not update the template.'),
  });
  if (step.action === 'edit' || step.action === 'review') {
    if (inEditor && step.action === 'edit') return null;
    return (
      <Button asChild variant="secondary" size={size} aria-label={title ? `${step.label} “${title}”` : undefined}>
        <Link href={`/templates/${id}${step.action === 'review' ? '/review' : ''}`}>{step.label}</Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} size={size} disabled={disabled || mutation.isPending} aria-busy={mutation.isPending}
      aria-label={title ? `${caption} “${title}”` : undefined} onClick={() => mutation.mutate()}>
      {mutation.isPending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}{caption}
    </Button>
  );
}

/** Takes the staged copy back, which also ends a request for sign-off on it. Any
 *  member can: a copy staged by mistake should not need an admin to undo. */
export function TemplateUnstageAction({ id, waiting, disabled = false, onChanged }: {
  id: string; waiting: boolean; disabled?: boolean; onChanged?: (row: WorkflowTemplate) => void;
}) {
  const router = useRouter();
  // The wording is read when the dialog opens: the row changes underneath it
  // the moment the request lands, while the dialog is still fading out.
  const [ask, setAsk] = useState({ open: false, waiting });
  const mutation = useMutation({
    mutationFn: () => httpPost<{ template: WorkflowTemplate }>(`/api/v1/templates/${id}/unstage`, {}),
    onSuccess: (result) => {
      onChanged?.(result.template);
      toast.success('Staged copy removed');
      router.refresh();
    },
    onError: (error) => toast.error(error.message || 'Could not update the template.'),
  });
  return (
    <ConfirmDialog
      open={ask.open}
      onOpenChange={(open) => setAsk((current) => (open ? { open, waiting } : { ...current, open }))}
      title="Remove the staged copy?"
      description={ask.waiting
        ? 'This also ends the request for sign-off. The draft and the live copy stay as they are.'
        : 'The draft and the live copy stay as they are. You can stage the draft again later.'}
      confirmLabel="Remove"
      onConfirm={() => mutation.mutate()}
    >
      <Button variant="ghost" size="sm" disabled={disabled || mutation.isPending} aria-busy={mutation.isPending}>
        Remove staged copy
      </Button>
    </ConfirmDialog>
  );
}
