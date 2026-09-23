'use client';

import { useAuth } from '@clerk/nextjs';
import { PUBLIC_API_URL } from '~/lib/site';

import { CheckIcon, CopyIcon, KeyIcon, Loader2Icon, LockIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMinimumDisplay } from '~/hooks/use-minimum-display';
import { httpDelete, httpGet, httpPost } from '~/lib/http';
import { toast } from 'sonner';
import { isLimitReached } from '@temply/shared/plans';
import { Button, pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import { PlanLimitBanner } from '~/components/dashboard/plan-limit-banner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { PageLoading } from '~/components/ui/page-loading';
import { Badge, Card, EmptyState, ErrorState } from '~/components/ui/surfaces';

type ApiKeyMode = 'live' | 'test';

type ApiKeyItem = {
  id: string;
  name: string;
  key_prefix: string;
  mode: ApiKeyMode;
  created_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
};

type ApiKeyListResponse = {
  keys: ApiKeyItem[];
};

type CreateKeyResponse = {
  key: {
    id: string;
    name: string;
    key_prefix: string;
    full_key: string;
  };
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyMode, setKeyMode] = useState<ApiKeyMode>('live');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => httpGet<ApiKeyListResponse>('/api/v1/api-keys', {}),
  });
  const showLoading = useMinimumDisplay(isLoading);
  const { orgRole } = useAuth();
  const isAdmin = orgRole === 'org:admin';

  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => httpGet<{ usage: { apiKeys: number }; limits: { maxApiKeys: number | null } }>('/api/v1/billing', {}),
  });
  const apiKeyLimit = billing?.limits?.maxApiKeys ?? null;
  // Free's cap is 0 — the feature is locked, not used up. That reads
  // differently from a Pro user who has spent all five, so keep them apart.
  const featureLocked = apiKeyLimit === 0;
  const atLimit = billing ? isLimitReached(billing.usage?.apiKeys ?? 0, apiKeyLimit) : false;

  const { mutateAsync: createKey, isPending: isCreating } = useMutation({
    mutationFn: (input: { name: string; mode: ApiKeyMode }) =>
      httpPost<CreateKeyResponse>('/api/v1/api-keys', input),
    onSuccess: (result) => {
      setNewlyCreatedKey(result.key.full_key);
      setKeyName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error) => toast.error(error.message || 'Could not create the key'),
  });

  const { mutateAsync: revokeKey } = useMutation({
    mutationFn: (id: string) => httpDelete(`/api/v1/api-keys/${id}`),
    onSuccess: () => {
      toast.success('Key revoked');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error) => toast.error(error.message || 'Could not revoke the key'),
  });

  // Live keys are gated by the plan; a test key is open to everyone, so on
  // a locked plan the dialog opens on Test and Live is shown as the upsell.
  const openCreate = () => {
    setNewlyCreatedKey(null);
    setKeyMode(featureLocked || atLimit ? 'test' : 'live');
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!keyName.trim()) return;
    await createKey({ name: keyName.trim(), mode: keyMode });
    setShowCreate(false);
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const keys = data?.keys ?? [];

  if (!isAdmin) {
    return (
      <EmptyState
        icon={LockIcon}
        title="API keys are for admins"
        description="Ask an admin on your team to create or revoke keys. Your app keeps working with the keys they made."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* The layout's header carries the title now, so the one action the page
          owns sits on its own row rather than being dropped with it. The empty
          states below carry their own call to action, so the row only appears
          once there is a list for it to sit above. */}
      {keys.length > 0 ? (
        <div className="flex justify-end">
          <Button variant="primary" onClick={openCreate}>
            <PlusIcon />
            Create key
          </Button>
        </div>
      ) : null}

      {atLimit && !featureLocked ? (
        <PlanLimitBanner
          title={`You've used all ${apiKeyLimit} API keys on your plan.`}
          detail="Upgrade for more."
        />
      ) : null}

      {newlyCreatedKey ? (
        <Card className="border-accent bg-accent-wash">
          <p className="text-sm font-medium text-ink">Your new key</p>
          <p className="mt-0.5 text-sm text-muted">
            Copy it now. For your safety it is not shown again.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-sm border border-line bg-raised px-2.5 py-1.5 font-mono text-sm text-ink">
              {newlyCreatedKey}
            </code>
            <Button onClick={() => copyKey(newlyCreatedKey)}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </Card>
      ) : null}

      {showLoading ? (
        <PageLoading label="Loading your keys…" />
      ) : isError ? (
        <ErrorState
          description="We could not load your keys. Any keys you already created are still active."
          onRetry={() => refetch()}
        />
      ) : keys.length === 0 && featureLocked ? (
        <EmptyState
          icon={LockIcon}
          title="Live keys are a Pro feature"
          description="A test key is free on every plan: it renders your drafts so you can build against the API before you upgrade."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" onClick={openCreate}>
                <PlusIcon />
                Create test key
              </Button>
              <Button asChild>
                <Link href="/dashboard/settings/plan">Upgrade to Pro</Link>
              </Button>
            </div>
          }
        />
      ) : keys.length === 0 ? (
        <EmptyState
          icon={KeyIcon}
          title="No API keys"
          description="Create one to read your templates from your own application."
          action={
            <Button variant="primary" onClick={openCreate}>
              <PlusIcon />
              Create key
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-3.5 py-2 text-left text-xs font-medium text-muted">Name</th>
                <th scope="col" className="px-3.5 py-2 text-left text-xs font-medium text-muted">Key</th>
                <th scope="col" className="px-3.5 py-2 text-left text-xs font-medium text-muted">Created</th>
                <th scope="col" className="px-3.5 py-2 text-left text-xs font-medium text-muted">Last used</th>
                <th scope="col" className="px-3.5 py-2 text-left text-xs font-medium text-muted">Status</th>
                <th scope="col" className="px-3.5 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((key) => (
                <tr key={key.id}>
                  <td className="px-3.5 py-2.5 font-medium text-ink">
                    <span className="flex items-center gap-2">
                      {key.name}
                      {key.mode === 'test' ? <Badge tone="neutral">Test</Badge> : null}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <code className="rounded-xs bg-hover px-1.5 py-0.5 font-mono text-xs text-muted">
                      {key.key_prefix}…
                    </code>
                  </td>
                  <td className="px-3.5 py-2.5 text-muted tabular-nums">
                    {formatDate(key.created_at) ?? '—'}
                  </td>
                  <td className="px-3.5 py-2.5 text-muted tabular-nums">
                    {formatDate(key.last_used_at) ?? 'Never'}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {key.revoked_at ? (
                      <Badge tone="danger">Revoked</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    {!key.revoked_at && (
                      <ConfirmDialog
                        title="Revoke this key?"
                        description="Anything using it will stop working."
                        confirmLabel="Revoke"
                        onConfirm={() => revokeKey(key.id)}
                      >
                        <Button variant="danger-quiet" size="sm">
                          <Trash2Icon />
                          Revoke
                        </Button>
                      </ConfirmDialog>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(
        <Card>
          <h2 className="text-sm font-semibold text-ink">Using a key</h2>
          <p className="mt-1 text-sm text-muted">
            Send it as a bearer token when you call the public API. A live key renders the
            published version of a template — edits wait in the draft until you publish. A
            test key renders the draft instead, is free on every plan, and stops at 1,000
            calls a month.{' '}
            <Link href="/docs#api" className="text-accent-ink underline-offset-4 hover:underline">
              Full API reference
            </Link>
          </p>
          <pre className="mt-3 overflow-x-auto rounded-sm border border-line bg-surface p-3 font-mono text-xs text-ink">
            <code>{`# The template's details
curl -H "Authorization: Bearer tply_live_..." \\
  ${PUBLIC_API_URL}/templates/tpl_abc123

# The finished email, with your data
curl -X POST -H "Authorization: Bearer tply_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"data":{"firstName":"Ada","isMember":true}}' \\
  ${PUBLIC_API_URL}/templates/tpl_abc123/render`}</code>
          </pre>
        </Card>
      )}

      {/* A Dialog rather than a positioned div: this needs the role, the focus
          trap, Escape, and a Tab order that cannot walk out into the page
          behind it — none of which a div carries on its own. */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) setKeyName('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Name it after where it will be used, so you know what you are revoking later.
            </DialogDescription>
          </DialogHeader>

          {/* Two chips, not a select: the choice is binary and the difference
              needs a sentence, which a dropdown has nowhere to put. */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-ink">Key type</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Key type">
              {(
                [
                  { mode: 'live' as const, label: 'Live', hint: 'Renders what you published. Counts toward your plan.' },
                  { mode: 'test' as const, label: 'Test', hint: 'Renders your draft. Free on every plan, 1,000 calls a month.' },
                ] as const
              ).map((option) => {
                const locked = option.mode === 'live' && (featureLocked || atLimit);
                const active = keyMode === option.mode;
                // The name is the word on the chip and nothing else. Read off
                // the content it was the whole tile — "Live" ran into "Pro"
                // with no separator, and the sentence underneath followed it
                // — so the choice took twenty words to hear. Both of those
                // still reach a reader, as the description they are.
                const hintId = `api-key-${option.mode}-hint`;
                const lockId = `api-key-${option.mode}-lock`;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={option.label}
                    aria-describedby={locked ? `${lockId} ${hintId}` : hintId}
                    disabled={locked}
                    onClick={() => setKeyMode(option.mode)}
                    className={cn(
                      'flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left',
                      pressable,
                      active ? 'border-accent bg-accent-wash' : 'border-line hover:bg-hover',
                      locked && 'opacity-60',
                    )}
                  >
                    <span className={cn('text-sm font-medium', active ? 'text-accent-ink' : 'text-ink')}>
                      {option.label}
                      {locked ? (
                        <span id={lockId} className="ml-1.5 text-xs font-normal text-muted">
                          Pro
                        </span>
                      ) : null}
                    </span>
                    <span id={hintId} className="text-xs text-muted">
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="api-key-name" className="block text-sm font-medium text-ink">
              Key name
            </label>
            <input
              id="api-key-name"
              className="h-8 w-full rounded-sm border border-line bg-raised px-2.5 text-sm text-ink placeholder:text-faint"
              placeholder="Production server"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowCreate(false);
                setKeyName('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!keyName.trim() || isCreating}
            >
              {isCreating ? <Loader2Icon className="animate-spin" /> : null}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
