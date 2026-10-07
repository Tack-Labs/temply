'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HistoryIcon, RotateCcwIcon, TagIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { TemplatePageRow } from '~/lib/template-page';
import { httpGet, httpPost } from '~/lib/http';
import { useBilling } from '~/lib/billing';
import { parseStamp } from '~/lib/stamp';
import { TemplateVersionPreview } from './template-version-preview';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge, Card, EmptyState, ErrorState, PageHeader } from './ui/surfaces';
import { ConfirmDialog } from './ui/confirm-dialog';
import { PageLoading } from './ui/page-loading';

export type SavedVersion = { id: string; version_number: number; title: string; tag: string | null; created_at: string | null };

function VersionTag({ templateId, version, disabled }: { templateId: string; version: SavedVersion; disabled: boolean }) {
  const [tag, setTag] = useState(version.tag ?? '');
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => httpPost(`/api/v1/templates/${templateId}/versions/${version.id}/tag`, { tag }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['versions', templateId] }); toast.success('Version tag saved'); },
    onError: (error) => toast.error(error.message),
  });
  return <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
    <label className="min-w-0 flex-1 text-sm text-ink">Version tag
      <Input className="mt-1" value={tag}
        maxLength={48} disabled={disabled} placeholder="e.g. Autumn launch or Approved copy" onChange={(event) => setTag(event.target.value)} />
    </label>
    <Button size="md" type="submit" disabled={disabled || save.isPending || tag === (version.tag ?? '')}><TagIcon />Save tag</Button>
  </form>;
}

export function TemplateVersions({ template, readOnly, isAdmin }: { template: TemplatePageRow; readOnly: boolean; isAdmin: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();
  const billing = useBilling();
  const versions = useQuery({ queryKey: ['versions', template.id], queryFn: ({ signal }) => httpGet<{ versions: SavedVersion[] }>(`/api/v1/templates/${template.id}/versions`, {}, { signal }) });
  const restore = useMutation({
    mutationFn: (id: string) => httpPost(`/api/v1/templates/${template.id}/versions/${id}/restore`, {}),
    onSuccess: () => { toast.success('Version restored to your draft'); router.push(`/templates/${template.id}`); router.refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const rows = versions.data?.versions ?? [];
  const shown = rows.find((version) => version.id === selected) ?? rows[0];
  return <div className="mx-auto max-w-6xl space-y-6">
    <PageHeader title="A history you can come back to" description="Every publish saves a copy of your email. Give it a tag so it’s easy to recognise later." />
    <div className="rounded-xl bg-accent-wash p-4 text-sm leading-relaxed text-accent-ink">Restoring a version replaces your draft. Your customers keep getting the live email until you publish again.
      {billing.data ? <span className="mt-1 block">Your plan keeps the latest {billing.data.limits.maxVersions} versions, plus recently pinned versions. Tags are labels and do not extend retention.</span> : null}
    </div>
    {versions.isError ? <ErrorState description={versions.error.message} onRetry={() => void versions.refetch()} /> : versions.isPending ? <PageLoading label="Loading your versions…" /> : !shown ?
      <EmptyState icon={HistoryIcon} title="Your first version starts with a publish" description="Edit your email, then publish it. Each future publish will appear here." action={<Button size="compact" asChild><Link href={`/templates/${template.id}`}>Edit email</Link></Button>} /> :
      <div className="grid items-start gap-5 md:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="space-y-2" aria-label="Saved versions">
          {rows.map((version) => <button type="button" key={version.id} aria-pressed={shown.id === version.id} onClick={() => setSelected(version.id)}
            className={`block w-full rounded-lg p-3 text-left ${shown.id === version.id ? 'bg-accent-wash text-accent-ink' : 'text-ink hover:bg-hover'}`}>
            <span className="flex flex-wrap items-center gap-2 font-medium">Version {version.version_number}{version.version_number === template.live_version ? <Badge tone="success">Live</Badge> : null}</span>
            {version.tag ? <span className="mt-1 block break-words text-sm">{version.tag}</span> : null}
            <span className="mt-1 block text-xs text-muted">{version.created_at ? parseStamp(version.created_at).toLocaleString() : 'Date unavailable'}</span>
          </button>)}
        </Card>
        <Card className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-display text-lg font-semibold text-ink">Version {shown.version_number}</h2><p className="mt-1 text-sm text-muted">{shown.title}</p></div>
            <ConfirmDialog title={`Restore version ${shown.version_number} to your draft?`} description="This replaces any changes in your current draft. The live email stays as it is." confirmLabel="Restore to draft" onConfirm={() => restore.mutate(shown.id)}>
              <Button size="compact" disabled={readOnly || restore.isPending}><RotateCcwIcon />Restore to draft</Button>
            </ConfirmDialog>
          </div>
          <VersionTag key={shown.id + (shown.tag ?? '')} templateId={template.id} version={shown} disabled={readOnly || !isAdmin} />
          {!isAdmin ? <p className="text-xs text-muted">Ask a workspace admin to add or change a version tag.</p> : null}
          <TemplateVersionPreview templateId={template.id} versionId={shown.id} />
        </Card>
      </div>}
  </div>;
}
