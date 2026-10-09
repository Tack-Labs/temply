'use client';

import { useMutation } from '@tanstack/react-query';
import { CheckIcon, CopyIcon, Link2Icon, Loader2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { Input } from '~/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { httpDelete, httpPost } from '~/lib/http';
import { useBilling } from '~/lib/billing';
import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';

/**
 * A review link for a saved template: anyone holding it sees the draft,
 * signed out, as it stands when they open it. The lightest form of
 * collaboration — no members, no roles — and the one most small teams
 * actually need. The link can be turned off; making a new one afterwards
 * is a new secret, so the old one stays dead.
 *
 * A dialog, not a popover, because it opens from an item of the ⋯ menu: a
 * popover anchored to a menu item lost its focus to the menu the moment the
 * pointer left the item, and closed before the link could be copied. A
 * dialog holds focus until it is dismissed, on every pointer.
 */
export function ShareLinkPopover({
  templateId,
  initialToken,
  trigger,
}: {
  templateId: string;
  initialToken: string | null;
  /** Replaces the default button: the ⋯ menus open this from an item, and
   *  the dialog's trigger has to be the item itself or the menu eats the press. */
  trigger?: React.ReactElement;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  // A read-only workspace can copy or turn off a link it already has, but
  // can't make a new one.
  const { data: billing } = useBilling();
  const readOnly = billing?.plan === 'lapsed';
  const [copied, setCopied] = useState(false);
  const [, copyText] = useCopyToClipboard();
  // The origin is the browser's; read after mount so the server render
  // never has to guess it.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const { mutateAsync: createLink, isPending: isCreating } = useMutation({
    mutationFn: () => httpPost<{ token: string }>(`/api/v1/templates/${templateId}/share`, {}),
    onSuccess: (data) => setToken(data.token),
    onError: (error) => toast.error(error.message || 'Could not create the link'),
  });

  const { mutateAsync: removeLink, isPending: isRemoving } = useMutation({
    mutationFn: () => httpDelete(`/api/v1/templates/${templateId}/share`),
    onSuccess: () => {
      setToken(null);
      toast.success('Link turned off');
    },
    onError: (error) => toast.error(error.message || 'Could not turn the link off'),
  });

  const url = token ? `${origin}/p/${token}` : '';

  const copy = async () => {
    // The hook checks the API exists before reaching for it: on a plain-http
    // LAN origin — how the phone opens this in dev — there is none, and a
    // bare call would fail with nothing on screen to say so.
    if (!(await copyText(url))) {
      toast.error('Could not copy the link.');
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="compact" aria-label="Share a review link">
            <Link2Icon />
            <span className="hidden sm:inline">Share</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md p-5">
        <DialogHeader>
          <DialogTitle>Review link</DialogTitle>
          <DialogDescription>
            Anyone with the link can see this email without signing in. It shows your
            draft, so what they see follows your edits.
          </DialogDescription>
        </DialogHeader>
        {token ? (
          <>
            <div className="mt-4 flex items-center gap-2">
              {/* The field at its own height, and the button beside it at the
                  same one, so the row reads as one control. */}
              <Input
                readOnly
                value={url}
                aria-label="Review link"
                onFocus={(event) => event.currentTarget.select()}
                className="min-w-0 flex-1 px-3 font-mono text-sm"
              />
              <Button size="md" className="px-4" onClick={copy} aria-label={copied ? 'Copied' : 'Copy link'}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="mt-3 flex justify-end">
              <ConfirmDialog
                title="Turn off the link?"
                description="Anyone who has it will see a page saying it is no longer active. You can make a new link later."
                confirmLabel="Turn off"
                onConfirm={() => removeLink()}
              >
                <Button variant="danger-quiet" size="compact" disabled={isRemoving}>
                  {isRemoving ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}
                  Turn off link
                </Button>
              </ConfirmDialog>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <Button variant="primary" onClick={() => createLink()} disabled={isCreating || readOnly}>
              {isCreating ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : <Link2Icon />}
              Create link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
