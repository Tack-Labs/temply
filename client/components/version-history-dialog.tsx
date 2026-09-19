'use client';

import { HistoryIcon, Loader2Icon, RotateCcwIcon, Undo2Icon } from 'lucide-react';
import type { Mail } from '~/db/schema';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { List, Row } from '~/components/ui/item';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, } from '@tanstack/react-query';
import { httpGet, httpPost } from '~/lib/http';
import { Button } from '~/components/ui/button';
import { ErrorState } from '~/components/ui/surfaces';
import { storedDocument } from '~/core/editor/utils/replace-deprecated';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

type Version = {
  id: string;
  version_number: number;
  title: string;
  created_at: string | null;
};

type VersionDetail = Version & {
  preview_text: string | null;
  content: string;
};

type VersionHistoryDialogProps = {
  templateId?: string;
  /** True while the draft differs from the published copy. */
  hasUnpublishedChanges?: boolean;
  /** The draft was replaced by the published copy; the editor should show it. */
  onDiscarded?: (template: Mail) => void;
  /** The draft was replaced by a version; the editor should show it. */
  onRestored?: (template: Mail) => void;
  /** Replaces the default button — the phone opens this from a menu item, and
   *  a dialog trigger has to be the item itself or the menu eats the tap. */
  trigger?: React.ReactElement;
};

export function VersionHistoryDialog({
  templateId,
  hasUnpublishedChanges = false,
  onDiscarded,
  onRestored,
  trigger,
}: VersionHistoryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<VersionDetail | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['versions', templateId],
    queryFn: () => httpGet<{ versions: Version[] }>(`/api/v1/templates/${templateId}/versions`, {}),
    enabled: !!templateId && open,
  });

  const { mutateAsync: restoreVersion, isPending: isRestoring } = useMutation({
    mutationFn: (versionId: string) =>
      httpPost<{ template: Mail }>(`/api/v1/templates/${templateId}/versions/${versionId}/restore`, {}),
    onSuccess: (data) => {
      toast.success('Version restored');
      setOpen(false);
      setPreviewVersion(null);
      // The canvas is still holding the document the restore replaced, so
      // the row that comes back with the response is put on screen. A route
      // refresh alone would not: the editor is mounted from the content it
      // opened with and keeps it.
      onRestored?.(data.template);
      router.refresh();
    },
    onError: (error) => toast.error(error.message || 'Could not restore the version'),
  });

  const { mutateAsync: discardDraft, isPending: isDiscarding } = useMutation({
    mutationFn: () => httpPost<{ template: Mail }>(`/api/v1/templates/${templateId}/discard`, {}),
    onSuccess: (data) => {
      toast.success('Draft discarded');
      setOpen(false);
      onDiscarded?.(data.template);
      router.refresh();
    },
    onError: (error) => toast.error(error.message || 'Could not discard the draft'),
  });

  const { mutateAsync: fetchVersionDetail } = useMutation({
    mutationFn: async (versionId: string) => {
      return httpGet<{ version: VersionDetail }>(
        `/api/v1/templates/${templateId}/versions/${versionId}`,
        {}
      );
    },
    onSuccess: (data) => {
      setPreviewVersion(data.version);
    },
    onError: (error) => toast.error(error.message || 'Could not open the version'),
  });

  // The preview reads the row through the same door the canvas does, so what
  // is on screen is the document a restore would land. A row too damaged to
  // parse is the one case that has no way back, and it says so here instead of
  // throwing the dialog into the root error boundary.
  const previewJson = useMemo(() => {
    if (!previewVersion) return null;
    try {
      return JSON.stringify(storedDocument(previewVersion.content), null, 2);
    } catch {
      return null;
    }
  }, [previewVersion]);

  if (!templateId) return null;

  const versions = data?.versions ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setPreviewVersion(null); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button">
            <HistoryIcon />
            <span className="hidden sm:inline">History</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="min-w-0 max-w-lg overflow-hidden p-4">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Every publish is a version; restoring one puts it in your draft. Only the last 10 are kept.
          </DialogDescription>
        </DialogHeader>

        {/* The draft is the one "version" that is not in the list, so the way
            back from it lives here too: drop it and stand on the published
            copy. Hidden when there is nothing to drop. */}
        {hasUnpublishedChanges && !previewVersion ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn-wash bg-warn-wash/50 px-3 py-2">
            <p className="text-sm text-ink">
              Your draft has changes that are not published.
            </p>
            <ConfirmDialog
              title="Discard the draft?"
              description="Everything since the last publish goes, and the editor shows the published version."
              confirmLabel="Discard"
              onConfirm={() => discardDraft()}
            >
              <Button variant="danger-quiet" size="sm" disabled={isDiscarding}>
                {isDiscarding ? <Loader2Icon className="animate-spin" /> : <Undo2Icon />}
                Discard changes
              </Button>
            </ConfirmDialog>
          </div>
        ) : null}

        {previewVersion ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">
                Version {previewVersion.version_number}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewVersion(null)}>
                &larr; Back to list
              </Button>
            </div>
            {previewJson === null ? (
              <ErrorState
                title="This version will not open"
                description="Its saved content is damaged, so there is nothing to preview and nothing to restore. Your other versions are unaffected."
              />
            ) : (
              <div className="max-h-80 overflow-auto rounded-lg border border-line bg-surface p-3">
                <pre className="whitespace-pre-wrap text-xs text-ink">{previewJson}</pre>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreviewVersion(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => restoreVersion(previewVersion.id)}
                disabled={isRestoring || previewJson === null}
              >
                {isRestoring ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
                Restore this version
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2Icon className="h-6 w-6 animate-spin text-faint" />
          </div>
        ) : versions.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">
            No versions yet. Each publish creates one.
          </div>
        ) : (
          <List>
            {versions.map((version) => (
              <Row
                key={version.id}
                onClick={() => fetchVersionDetail(version.id)}
                primaryLabel={`Preview version ${version.version_number}`}
                title={`Version ${version.version_number}`}
                subtitle={
                  version.created_at ? new Date(version.created_at).toLocaleString() : 'Unknown date'
                }
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => restoreVersion(version.id)}
                    disabled={isRestoring}
                    className="text-accent-ink hover:bg-accent-wash hover:text-accent-ink"
                  >
                    <RotateCcwIcon />
                    Restore
                  </Button>
                }
              />
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
