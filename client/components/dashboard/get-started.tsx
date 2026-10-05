'use client';

import Link from 'next/link';
import { ArrowRightIcon, BracesIcon, CheckIcon, FileTextIcon, GlobeIcon, MailIcon, PlugIcon } from 'lucide-react';
import type { TemplateListItem } from '~/lib/template-search';
import { Card } from '../ui/surfaces';

export function GetStarted({ template }: { template?: TemplateListItem }) {
  const base = template ? `/templates/${template.id}` : '/dashboard/templates';
  const steps = [
    { title: 'Start with an email', detail: 'Pick a receipt, welcome email or another starter.', href: base, icon: FileTextIcon, done: Boolean(template) },
    { title: 'Add the personal details', detail: 'Choose the name, links and details your app will fill in.', href: template ? `${base}/variables` : base, icon: BracesIcon, done: false },
    { title: 'Send yourself a test', detail: 'Check the words and design in your own inbox.', href: base, icon: MailIcon, done: false },
    { title: 'Publish when you’re ready', detail: 'Save a version your app can use. Future edits stay in the draft.', href: template ? `${base}/review` : base, icon: GlobeIcon, done: (template?.live_version ?? 0) > 0 },
    { title: 'Connect your app', detail: 'Follow the setup steps or hand them to your developer.', href: template ? `${base}/connect` : '/dashboard/connect', icon: PlugIcon, done: false },
  ];
  return <Card className="overflow-hidden p-0">
    <div className="border-b border-line bg-accent-wash px-5 py-5 sm:px-6">
      <p className="text-xs font-medium text-accent-ink">Your starter guide</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">From your first idea to an email your app can use</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">You handle the words and the design. Temply prepares the email. Your app sends it with the provider you already use.</p>
    </div>
    <ol className="divide-y divide-line">
      {steps.map((step, index) => <li key={step.title}><Link href={step.href} className="flex items-center gap-4 px-5 py-4 hover:bg-hover sm:px-6">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${step.done ? 'bg-success-wash text-success-ink' : 'bg-hover text-muted'}`} aria-hidden>
          {step.done ? <CheckIcon className="size-4" /> : <step.icon className="size-4" />}
        </span>
        {step.done ? <span className="sr-only">Completed:</span> : null}
        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink">{index + 1}. {step.title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted">{step.detail}</p></div>
        <ArrowRightIcon className="size-4 shrink-0 text-muted" />
      </Link></li>)}
    </ol>
  </Card>;
}
