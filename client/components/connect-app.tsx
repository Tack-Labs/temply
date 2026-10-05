'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2Icon, CopyIcon, KeyRoundIcon, PlayIcon } from 'lucide-react';
import { collectDataKeys } from '@temply/shared/template-data';
import { publicRenderPath } from '@temply/shared/api';
import { toast } from 'sonner';
import type { TemplatePageRow } from '~/lib/template-page';
import { connectionSnippet, type ConnectionLanguage } from '~/lib/connect-app';
import { SITE_URL } from '~/lib/site';
import { httpGet, httpPost } from '~/lib/http';
import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';
import { useHydrated } from '~/hooks/use-hydrated';
import { storedDocument } from '~/core/editor/utils/replace-deprecated';
import { initialPreviewData, PreviewDataPanel, toPayload, type PreviewData } from './preview-data-panel';
import type { SavedVersion } from './template-versions';
import { Button } from './ui/button';
import { Badge, Card, PageHeader } from './ui/surfaces';
import { SegmentedControl } from './ui/segmented-control';

type RenderResult = { html: string; text: string; version: number | null; mode: 'test' | 'live' };

function ConnectionStep({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return <Card className="min-w-0 p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-wash text-sm font-semibold text-accent-ink">{number}</span><h2 className="font-display text-lg font-semibold text-ink">{title}</h2></div>{children}</Card>;
}

export function ConnectApp({ template }: { template: TemplatePageRow }) {
  const [language, setLanguage] = useState<ConnectionLanguage>('curl');
  const [version, setVersion] = useState('latest');
  const [mode, setMode] = useState<'test' | 'live'>('test');
  const [key, setKey] = useState('');
  const [, copy] = useCopyToClipboard();
  const hydrated = useHydrated();
  const versions = useQuery({ queryKey: ['versions', template.id], queryFn: () => httpGet<{ versions: SavedVersion[] }>(`/api/v1/templates/${template.id}/versions`, {}) });
  const origin = hydrated ? window.location.origin : SITE_URL;
  const pin = version === 'latest' ? undefined : Number(version);
  const selectedVersion = versions.data?.versions.find((row) => row.version_number === pin);
  const detail = useQuery({
    queryKey: ['version-detail', template.id, selectedVersion?.id],
    queryFn: ({ signal }) => httpGet<{ version: { content: string } }>(`/api/v1/templates/${template.id}/versions/${selectedVersion?.id}`, {}, { signal }),
    enabled: Boolean(selectedVersion),
    staleTime: Infinity,
  });
  const content = pin ? detail.data?.version.content : mode === 'live' ? template.published_content : template.content;
  const keys = useMemo(() => collectDataKeys(content ? storedDocument(content) : null), [content]);
  const [examples, setExamples] = useState<{ content: string | null | undefined; data: PreviewData }>(() => ({ content, data: initialPreviewData(keys) }));
  const data = examples.content === content ? examples.data : initialPreviewData(keys);
  const setData = (next: PreviewData) => setExamples({ content, data: next });
  const ready = Boolean(content) && (!pin || Boolean(selectedVersion && detail.data));
  const payload = toPayload(data);
  const snippet = connectionSnippet({ origin, shortCode: template.short_code ?? '', data: payload, version: pin, language });
  const test = useMutation({
    mutationFn: async () => {
      if (!ready) throw new Error('Choose an available email version before checking the connection.');
      const trimmed = key.trim();
      if (!trimmed.startsWith(mode === 'test' ? 'tply_test_' : 'tply_live_')) throw new Error(`Use a ${mode} key, or change the key type in step 2.`);
      return httpPost<RenderResult>(publicRenderPath(template.short_code ?? ''), { ...(pin ? { version: pin } : {}), data: payload }, { headers: { Authorization: `Bearer ${trimmed}` } });
    },
    onSettled: () => setKey(''),
  });
  const copyText = async (text: string) => {
    if (await copy(text)) toast.success('Copied');
    else toast.error('Could not copy. Select the request and copy it manually.');
  };
  const reset = () => test.reset();
  return <div className="mx-auto max-w-5xl space-y-5">
    <PageHeader title="Put this email to work in your app" description="Follow these four steps, or copy the setup notes for the person who builds your app. Temply prepares the email; your app sends it." />
    <div className="rounded-xl bg-accent-wash p-4 text-sm text-accent-ink">You can do the design yourself. A developer can help with the connection. These steps are already filled in for your template.</div>
    <ConnectionStep number={1} title="Choose the email">
      <p className="font-medium text-ink">{template.title}</p><p className="mt-1 text-sm text-muted">Template ID: <code className="break-all">{template.short_code}</code></p>
      <Button asChild variant="link" size="sm" className="mt-2 px-0"><Link href="/dashboard/connect">Choose a different template</Link></Button>
    </ConnectionStep>
    <ConnectionStep number={2} title="Choose a key and an email version">
      <p className="mb-4 text-sm text-muted">A key is a password that lets your app ask Temply for an email. Start with a test key while you’re setting things up.</p>
      <SegmentedControl label="Key type" value={mode} onValueChange={(next) => { setMode(next); setKey(''); reset(); }} options={[{ value: 'test', label: 'Test key' }, { value: 'live', label: 'Live key' }]} />
      <p className="mt-3 text-sm text-muted">{mode === 'test' ? 'A test key uses your draft and its own test allowance.' : 'A live key uses the published email and your live allowance.'} Choosing a saved version uses that exact copy with either key.</p>
      <Button asChild variant="secondary" className="mt-4"><Link href="/dashboard/settings/api-keys"><KeyRoundIcon />Create or manage keys</Link></Button>
      <p className="mt-3 text-xs text-muted">Your developer should store the key on the server as TEMPLY_KEY. The request below uses this name so the secret is never included in copied setup notes.</p>
      <label className="mt-5 block text-sm font-medium text-ink">Which email should the app use?
        <select value={version} onChange={(event) => { setVersion(event.target.value); reset(); }} className="mt-2 block h-11 w-full rounded-lg border border-line bg-raised px-3 font-normal">
          <option value="latest">{mode === 'test' ? 'Latest draft — for testing' : 'Latest published email — follows your releases'}</option>
          {(versions.data?.versions ?? []).map((row) => <option key={row.id} value={row.version_number}>Version {row.version_number}{row.tag ? ` — ${row.tag}` : ''}</option>)}
        </select>
      </label>
      {versions.isError ? <p className="mt-2 text-sm text-danger-ink">Saved versions could not be loaded. <Button variant="link" size="sm" onClick={() => void versions.refetch()}>Try again</Button></p> : null}
      {pin ? <p className="mt-2 text-xs text-muted">Pinned to version {pin}. Future publishes won’t change this request. Version retention still follows your plan.</p> : null}
      {mode === 'live' && !template.published_at && !pin ? <p className="mt-3 text-sm text-warn-ink">Publish this email before using a live key.</p> : null}
    </ConnectionStep>
    <ConnectionStep number={3} title="Give your app the request">
      <details className="mb-5 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-medium text-ink">Example details for this email</summary><div className="mt-4 max-w-lg"><PreviewDataPanel keys={keys} data={data} onChange={(next) => { setData(next); reset(); }} /></div></details>
      <div className="flex flex-wrap items-center justify-between gap-3"><SegmentedControl label="Request language" value={language} onValueChange={setLanguage} options={[{ value: 'curl', label: 'Command line' }, { value: 'javascript', label: 'JavaScript' }, { value: 'python', label: 'Python' }]} /><Button size="sm" disabled={!ready} onClick={() => void copyText(snippet)}><CopyIcon />Copy request</Button></div>
      <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-rail-bg p-4 font-mono text-xs leading-relaxed text-rail-ink">{ready ? snippet : detail.isError ? 'This version could not be loaded. Choose another version or try again.' : 'Choose an available email version to prepare its request.'}</pre>
      <p className="mt-3 text-sm text-muted">Replace the example details with each customer’s details. The response contains HTML and plain text for your email provider.</p>
    </ConnectionStep>
    <ConnectionStep number={4} title="Check the connection">
      <p className="text-sm text-muted">Paste your key to try the same request here. It prepares an email without sending it and uses one {mode} API call. The key is cleared after the check.</p>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); test.mutate(); }}>
        <label className="min-w-0 flex-1 text-sm font-medium text-ink">Your {mode} key<input type="password" autoComplete="off" value={key} onChange={(event) => { setKey(event.target.value); reset(); }} placeholder={`Paste your ${mode} key`} className="mt-2 block h-11 w-full rounded-lg border border-line bg-raised px-3" /></label>
        <Button type="submit" variant="primary" disabled={!ready || !key.trim() || test.isPending}><PlayIcon />{test.isPending ? 'Checking…' : 'Check connection'}</Button>
      </form>
      {test.isError ? <div role="alert" className="mt-4 rounded-lg bg-danger-wash p-4 text-sm text-danger-ink">{test.error.message}</div> : null}
      {test.data ? <div role="status" className="mt-4 rounded-lg bg-success-wash p-4 text-sm text-success-ink"><p className="flex items-center gap-2 font-medium"><CheckCircle2Icon className="size-4" />Connection checked — email prepared</p><p className="mt-2">Temply returned HTML and plain text using {test.data.version ? `version ${test.data.version}` : 'the draft'} with a {test.data.mode} key. Nothing was sent.</p></div> : null}
    </ConnectionStep>
    <Card className="flex flex-wrap items-center justify-between gap-4 bg-accent-wash p-5"><div><h2 className="font-display text-lg font-semibold text-ink">Hand this step to your developer</h2><p className="mt-1 text-sm text-muted">Copy the instructions and request together. Your key stays private.</p></div><Button disabled={!ready} onClick={() => void copyText(`Connect our Temply email: ${template.title}\nTemplate ID: ${template.short_code}\nUse a ${mode} key stored on the server as TEMPLY_KEY.\n${pin ? `Pin requests to version ${pin}.` : mode === 'test' ? 'Test keys use the draft.' : 'Live keys use the published email.'}\nReplace example data with real customer details. Pass the returned html and text to our email provider.\n\n${snippet}\n\nDocumentation: ${origin}/docs`)}><CopyIcon />Copy setup notes</Button></Card>
    <div className="flex flex-wrap gap-2"><Badge>401: check the key</Badge><Badge>404: check the template and publish</Badge><Badge>422: add missing details</Badge><Badge>429: check limits and retry</Badge></div>
  </div>;
}
