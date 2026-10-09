'use client';

import { useRef, useState } from 'react';
import { GlobeIcon, HistoryIcon, Link2Icon, Loader2Icon, MoreHorizontalIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Badge } from '../ui/surfaces';
import { ConfirmPublish } from '../confirm-publish';
import { DeleteEmailDialog } from '../delete-email-dialog';
import { SaveStatus } from '../save-status';
import { ShareLinkPopover } from '../share-link-popover';
import { VersionHistoryDialog } from '../version-history-dialog';
import type { TemplateEditorModel } from './use-template-editor';

// The header's buttons are page-level: 48px, with the 18px side padding the
// board draws on the quiet ones.
const barButton = 'px-4.5';

/**
 * The right-hand end of the editor's header: what a customer does with the
 * template, in the order they reach for it. Publish is the one primary action
 * and sits last, where the eye finishes. Send a test is the one other thing
 * done often enough to stay on the bar. History and Share are reached a few
 * times in a template's life and sit behind the ⋯ menu with Delete, as they
 * do on the phone, so the bar is two buttons and not four; Delete is one
 * confirmation away rather than one slip.
 *
 * Every control acts on a saved template, so the anonymous playground, which
 * has no template, draws nothing here. A read-only workspace keeps History,
 * Share and the test send, which it may still use, and loses only Publish.
 */
export function EditorActions({ model }: { model: TemplateEditorModel }) {
  const { template, readOnly, isPublishing, publishArmed, publishStatus, publishedLabel, sendArmed } = model;
  // Delete's confirmation is held here, outside the menu: a dialog mounted
  // inside menu content goes with the menu the moment it closes. The menu is
  // not modal for the same reason the phone's is — a modal menu leaves the
  // layer opened from it unclickable behind its pointer-event guard.
  const [deleting, setDeleting] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);

  if (!template?.id) return null;

  return (
    <>
      {/* Internal-debug delivery — only for a saved template. The anonymous
          playground must not advertise a send capability the product does
          not offer. "Send anyway" has to be readable to mean anything, so
          the label is never hidden. */}
      <Button variant="secondary" className={barButton} onClick={model.handleSend}>
        <SendIcon />
        {sendArmed ? 'Send anyway' : 'Send a test'}
      </Button>
      {/* Armed means the first click found errors and opened the checks; the
          second goes through, and wears the colour of what it overrides. The
          label never takes a progress word, so the name a reader or a spec
          finds the button by is the same in flight. */}
      {model.isAdmin ? (
        <ConfirmPublish model={model}>
          {(publish) => (
            <Button
              variant={publishArmed ? 'danger' : 'primary'}
              disabled={readOnly || isPublishing || (publishStatus === 'published' && !publishArmed)}
              aria-busy={isPublishing}
              onClick={publish}
              title={publishedLabel ?? undefined}
            >
              {isPublishing ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : <GlobeIcon />}
              {publishArmed ? 'Publish anyway' : 'Publish'}
            </Button>
          )}
        </ConfirmPublish>
      ) : null}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {/* Not named "More": the phone's menu is, and a spec or a reader
              looking for one must not land on the other. */}
          <Button ref={moreRef} variant="ghost" size="icon" className="size-11" aria-label="More actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* The dialog and the popover are opened from their item, which is
              their trigger: a dialog mounted inside the menu would go with it,
              so the item keeps the menu open (preventDefault) and the layer
              opens over it, as the phone's ⋯ menu does. */}
          <VersionHistoryDialog
            templateId={template.id}
            hasUnpublishedChanges={model.unpublished}
            onDiscarded={model.handleDiscarded}
            onRestored={model.handleRestored}
            trigger={
              <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                <HistoryIcon />
                History
              </DropdownMenuItem>
            }
          />
          <ShareLinkPopover
            templateId={template.id}
            initialToken={template.share_token ?? null}
            trigger={
              <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                <Link2Icon />
                Share link
              </DropdownMenuItem>
            }
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-danger-ink [&_svg]:text-danger-ink" onSelect={() => setDeleting(true)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteEmailDialog
        templateId={template.id}
        trigger={null}
        open={deleting}
        onOpenChange={setDeleting}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          moreRef.current?.focus();
        }}
      />
    </>
  );
}

/**
 * Where the draft stands, beside the template's name: how it compares with
 * what is published, and whether it has been saved. The badge is keyed on the
 * state so a change of state fades the new word in rather than swapping it
 * under the reader; the save status fades rather than unmounts, so it keeps
 * its width and the badge never shifts when it appears. A template with no
 * badge to show draws only the save status, which is the one live region the
 * editor has for autosave.
 */
export function EditorStatus({ model }: { model: TemplateEditorModel }) {
  const { publishBadge, publishStatus, saveStatus, autosave } = model;
  return (
    <>
      {publishBadge ? (
        <Badge key={publishStatus} tone={publishBadge.tone} dot className="fade-in-mount">
          {publishBadge.label}
        </Badge>
      ) : null}
      <SaveStatus className="text-base" status={saveStatus} onRetry={() => void autosave?.flush()} />
    </>
  );
}
