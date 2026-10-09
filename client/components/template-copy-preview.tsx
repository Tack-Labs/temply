'use client';

import { useQuery } from '@tanstack/react-query';
import type { TemplateCopy, WorkflowTemplate } from '~/lib/template-stage';
import { copyOf } from '~/lib/template-stage';
import { httpGet } from '~/lib/http';
import { EmailPreviewIFrame } from './email-preview-iframe';
import { ErrorState } from './ui/surfaces';
import { PageLoading } from './ui/page-loading';

export function useTemplateCopy(row: WorkflowTemplate, copy: TemplateCopy) {
  const shown = copyOf(row, copy);
  return useQuery({
    queryKey: ['template-copy', row.org_id, row.id, copy, shown?.stamp],
    queryFn: async ({ signal }) => {
      const result = await httpGet<{ html: string; updatedAt: string }>(`/api/v1/templates/${row.id}/preview`,
        { copy, ...(shown?.stamp ? { v: shown.stamp } : {}) }, { signal });
      if (result.updatedAt !== shown?.stamp) throw new Error('This copy changed. Reload the page to see the latest copy.');
      return result;
    },
    enabled: Boolean(shown),
    staleTime: Infinity,
    retry: false,
  });
}

export function TemplateCopyPreview({ template, copy }: { template: WorkflowTemplate; copy: TemplateCopy }) {
  const preview = useTemplateCopy(template, copy);
  if (preview.isError) return <ErrorState description={preview.error.message || 'Could not load this preview.'} onRetry={() => void preview.refetch()} />;
  if (!preview.data) return <PageLoading label="Loading the preview…" />;
  return <EmailPreviewIFrame title={`${copy === 'staged' ? 'Staged' : copy === 'live' ? 'Live' : 'Draft'} email preview`}
    innerHTML={preview.data.html} className="h-[32rem] w-full rounded-xl border border-line bg-canvas" />;
}
