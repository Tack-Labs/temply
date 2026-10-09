'use client';

import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Loader2Icon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';
import { collectDataKeys } from '@temply/shared/template-data';
import { storedDocument } from '~/core/editor/utils/replace-deprecated';
import { candidateFindings } from '~/lib/template-review';
import type { WorkflowTemplate } from '~/lib/template-stage';
import { copyOf } from '~/lib/template-stage';
import { httpPost } from '~/lib/http';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Reveal } from './ui/surfaces';
import { hasPreviewKeys, initialPreviewData, PreviewDataPanel, toPayload } from './preview-data-panel';

/** The staged copy owns the send body, even if the draft has since changed. */
export function StagedTestSend({ template }: { template: WorkflowTemplate }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const candidate = copyOf(template, 'staged');
  const keys = useMemo(() => {
    try { return candidate ? collectDataKeys(storedDocument(candidate.content)) : null; }
    catch { return null; }
  }, [candidate?.content]);
  const [data, setData] = useState(() => keys ? initialPreviewData(keys) : { variables: {}, conditions: {}, lists: {} });
  const errors = candidateFindings(template).filter((issue) => issue.severity === 'error');
  const mutation = useMutation({
    mutationFn: () => {
      if (!candidate) throw new Error('Nothing is staged for this template.');
      return httpPost('/api/v1/emails/send', {
        to: to.trim(), subject: template.title, content: candidate.content,
        previewText: candidate.preview_text ?? '', theme: candidate.theme ? JSON.parse(candidate.theme) : undefined,
        payload: keys && hasPreviewKeys(keys) ? toPayload(data) : undefined,
      });
    },
    onSuccess: () => toast.success('Test email sent'),
  });
  return (
    <div>
      <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}><SendIcon />Send a test</Button>
      <Reveal open={open}>
        <form className="space-y-3 pt-3" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          <p className="text-sm text-muted">Send this staged copy to check it in your inbox. Sample values apply only to this test.</p>
          <Label className="space-y-2 leading-normal">Test recipients<Input value={to} onChange={(event) => setTo(event.target.value)} required placeholder="you@example.com" disabled={mutation.isPending} className="font-normal" /></Label>
          {keys ? <PreviewDataPanel keys={keys} data={data} onChange={setData} /> : null}
          {errors.length > 0 ? <p className="text-sm text-danger-ink">Fix the errors in this staged copy before sending a test.</p> : null}
          {mutation.isError ? <p role="alert" className="text-sm text-danger-ink">{mutation.error.message || 'Could not send this test.'}</p> : null}
          <Button type="submit" size="sm" disabled={!candidate || !to.trim() || errors.length > 0 || mutation.isPending} aria-busy={mutation.isPending}>
            {mutation.isPending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : <SendIcon />}Send staged test
          </Button>
        </form>
      </Reveal>
    </div>
  );
}
