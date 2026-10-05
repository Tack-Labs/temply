'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { BracesIcon, EyeIcon } from 'lucide-react';
import { collectDataKeys } from '@temply/shared/template-data';
import type { TemplatePageRow } from '~/lib/template-page';
import { httpPost } from '~/lib/http';
import { storedDocument } from '~/core/editor/utils/replace-deprecated';
import { initialPreviewData, PreviewDataPanel, toPayload } from './preview-data-panel';
import { EmailPreviewIFrame } from './email-preview-iframe';
import { Button } from './ui/button';
import { Badge, Card, EmptyState, ErrorState, PageHeader } from './ui/surfaces';

export function TemplateVariables({ template }: { template: TemplatePageRow }) {
  const document = useMemo(() => storedDocument(template.content), [template.content]);
  const keys = useMemo(() => collectDataKeys(document), [document]);
  const [data, setData] = useState(() => initialPreviewData(keys));
  const preview = useMutation({
    mutationFn: async () => {
      let theme: unknown;
      try { theme = template.theme ? JSON.parse(template.theme) : undefined; } catch { theme = undefined; }
      const request = { content: document, theme, previewText: template.preview_text ?? '', payload: toPayload(data) };
      const [html, text] = await Promise.all([
        httpPost<{ html: string }>('/api/v1/emails/preview', request),
        httpPost<{ html: string }>('/api/v1/emails/preview', { ...request, plainText: true }),
      ]);
      return { html: html.html, text: text.html };
    },
  });
  const count = keys.variables.length + keys.conditions.length + keys.lists.length;
  return <div className="mx-auto max-w-6xl space-y-6">
    <PageHeader title="The details that change for each person" description="A variable is a space for a name, an order total or another detail your app fills in when it uses this email."
      actions={<Button asChild variant="secondary"><Link href={`/templates/${template.id}`}>Edit variables in the email</Link></Button>} />
    {!count ? <EmptyState icon={BracesIcon} title="Make one email feel personal" description="In the editor, type @ where a name or another changing detail should go. Your variables will appear here automatically."
      action={<Button asChild variant="primary"><Link href={`/templates/${template.id}`}>Add your first variable</Link></Button>} /> : <>
      <Card>
        <div className="flex items-center gap-2"><h2 className="font-display text-lg font-semibold text-ink">What your app needs to provide</h2><Badge>{count} details</Badge></div>
        <p className="mt-2 text-sm text-muted">This list comes from your draft. To add, rename or remove a variable, edit it in the email.</p>
        <div className="mt-5 divide-y divide-line">
          {keys.variables.map((key) => <div key={`variable-${key}`} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div><code className="break-all rounded-md bg-accent-wash px-2 py-1 text-sm text-accent-ink">{`{{${key}}}`}</code>
              <p className="mt-2 text-xs text-muted">{keys.inList[key] ? `A value for each item in ${keys.inList[key]}` : keys.urlVariables.includes(key) ? 'A link or image address' : 'A word, name or number'}</p>
            </div>
            <div className="text-sm text-muted"><p>{keys.where[key]?.text || 'Used in this email'}</p><p className="mt-1 text-xs">{keys.placeholders[key] ? `Preview example: ${keys.placeholders[key]}` : 'No preview example set'}</p></div>
          </div>)}
          {keys.conditions.map((key) => <div key={`condition-${key}`} className="py-4"><code className="break-all text-sm text-accent-ink">{key}</code><p className="mt-1 text-sm text-muted">Show this section when your app sends true. Hide it when it sends false.</p></div>)}
          {keys.lists.map((key) => <div key={`list-${key}`} className="py-4"><code className="break-all text-sm text-accent-ink">{key}</code><p className="mt-1 text-sm text-muted">Repeat a block for each item, such as the products in an order.</p></div>)}
        </div>
      </Card>
      <div className="grid items-start gap-5 md:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-ink">Try some example details</h2>
          <PreviewDataPanel keys={keys} data={data} onChange={(next) => { setData(next); preview.reset(); }} />
          <Button variant="primary" disabled={preview.isPending} onClick={() => preview.mutate()}><EyeIcon />Preview these details</Button>
          <p className="text-xs leading-relaxed text-muted">Examples are only for this preview. Your app supplies the real values. An example in the editor is not a fallback: live requests with missing required values are refused and name what is missing.</p>
        </Card>
        <Card className="min-w-0 space-y-4">
          <h2 className="font-display text-lg font-semibold text-ink">What the email looks like</h2>
          {preview.isError ? <ErrorState description={preview.error.message} onRetry={() => preview.mutate()} /> : preview.data ? <>
            <EmailPreviewIFrame title="Email with example details" innerHTML={preview.data.html} className="h-[30rem] w-full rounded-lg border border-line bg-canvas" />
            <details className="rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-medium text-ink">Plain text version</summary><pre className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">{preview.data.text}</pre></details>
          </> : <p className="py-12 text-center text-sm text-muted">Fill in some example details, then select “Preview these details”.</p>}
        </Card>
      </div>
    </>}
  </div>;
}
