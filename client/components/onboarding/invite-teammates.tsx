'use client';

import { useOrganization } from '@clerk/nextjs';
import { Loader2Icon, SendIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/surfaces';
import { isEmailAddress } from '@temply/shared/email';


/** Splits on commas, spaces and newlines — a pasted list arrives any way. */
function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
  const unique = [...new Set(parts.map((p) => p.toLowerCase()))];
  return { valid: unique.filter((p) => isEmailAddress(p)), invalid: unique.filter((p) => !isEmailAddress(p)) };
}

/**
 * The optional second step. Everyone invited joins as a member — the person
 * setting the workspace up is its admin — and the step can be skipped and
 * done later from Settings → Team.
 */
export function InviteTeammates() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [raw, setRaw] = useState('');
  const [sending, setSending] = useState(false);
  const { valid, invalid } = parseEmails(raw);

  const send = async () => {
    if (!organization || valid.length === 0) return;
    setSending(true);
    try {
      await organization.inviteMembers({ emailAddresses: valid, role: 'org:member' });
      toast.success(valid.length === 1 ? 'Invite sent' : `${valid.length} invites sent`);
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the invites');
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink">Invite your team</h1>
        <p className="mt-1 text-sm text-muted">
          They can build and publish emails with you. You can do this later from Settings → Team.
        </p>
      </div>
      <Card className="space-y-3">
        <label htmlFor="invite-emails" className="block text-sm font-medium text-ink">
          Email addresses
        </label>
        <textarea
          id="invite-emails"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder="ada@example.com, grace@example.com"
          rows={3}
          className="w-full rounded-sm border border-line bg-raised px-2.5 py-2 text-sm text-ink placeholder:text-faint"
        />
        {invalid.length > 0 ? (
          <p className="text-xs text-danger-ink">Not an email address: {invalid.join(', ')}</p>
        ) : (
          <p className="text-xs text-muted">Separate several with commas or new lines.</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => router.push('/dashboard')} disabled={sending}>
            Skip for now
          </Button>
          <Button variant="primary" onClick={send} disabled={sending || valid.length === 0 || invalid.length > 0}>
            {sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
            {valid.length > 1 ? `Send ${valid.length} invites` : 'Send invite'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
