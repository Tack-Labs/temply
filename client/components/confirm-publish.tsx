'use client';

import { useState, type ReactElement } from 'react';
import type { TemplateEditorModel } from './editor/use-template-editor';
import { ConfirmDialog } from './ui/confirm-dialog';

/**
 * Publishing the draft overrules a staged copy, and a request for sign-off
 * with it: the server drops both. An admin who did not know one was there
 * would close someone else's review without being told, so with a candidate
 * in place the click asks first. `children` is handed the publish handler, or
 * nothing when the dialog owns the click.
 */
export function ConfirmPublish({ model, children }: {
  model: TemplateEditorModel;
  children: (publish: (() => void) | undefined) => ReactElement;
}) {
  const waiting = Boolean(model.template?.review_requested_at);
  // The wording is read when the dialog opens: publishing clears the request,
  // and the dialog would otherwise change its mind while fading out.
  const [ask, setAsk] = useState({ open: false, waiting });
  if (!model.template?.staged_at) return children(() => void model.handlePublish());
  return (
    <ConfirmDialog
      open={ask.open}
      onOpenChange={(open) => setAsk((current) => (open ? { open, waiting } : { ...current, open }))}
      title="Publish the draft?"
      description={ask.waiting
        ? 'A copy is waiting for sign-off. Publishing the draft puts it live and ends that request.'
        : 'A copy is staged. Publishing the draft puts it live and removes the staged copy.'}
      confirmLabel="Publish"
      confirmVariant="primary"
      onConfirm={() => void model.handlePublish()}
    >
      {children(undefined)}
    </ConfirmDialog>
  );
}
