'use client';

import { useQuery } from '@tanstack/react-query';
import { httpGet } from '~/lib/http';
import { EmailPreviewIFrame } from './email-preview-iframe';
import { PageLoading } from './ui/page-loading';
import { ErrorState } from './ui/surfaces';

export function TemplateVersionPreview({ templateId, versionId }: { templateId: string; versionId: string }) {
  const preview = useQuery({
    queryKey: ['version-preview', templateId, versionId],
    queryFn: ({ signal }) => httpGet<{ html: string }>(`/api/v1/templates/${templateId}/versions/${versionId}/preview`, {}, { signal }),
    staleTime: Infinity,
  });
  if (preview.isError) return <ErrorState description={preview.error.message} onRetry={() => void preview.refetch()} />;
  if (!preview.data) return <PageLoading label="Loading this email…" />;
  return <EmailPreviewIFrame title="Saved version preview" innerHTML={preview.data.html} className="h-[32rem] w-full rounded-xl border border-line bg-canvas" />;
}
