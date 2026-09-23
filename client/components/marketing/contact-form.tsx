'use client';

import { useState } from 'react';
import { Loader2Icon, SendIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { httpPost } from '~/lib/http';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const inputClass =
  'w-full rounded-md border border-line bg-raised px-3 text-sm text-ink placeholder:text-faint';

/** The landing page's contact form. Posts to /api/v1/contact, which stores the
 *  message and best-effort forwards it by mail. The `company` field is a
 *  honeypot: parked off-screen where no person will fill it. */
export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      await httpPost('/api/v1/contact', { name, email, message, company });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <p className="mx-auto max-w-md text-lg text-pretty text-muted">
        Thanks — we&apos;ll get back to you soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="contact-name" className="block text-sm font-medium text-ink">
            Name
          </label>
          <input
            id="contact-name"
            required
            maxLength={100}
            className={`h-9 ${inputClass}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contact-email" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            maxLength={254}
            className={`h-9 ${inputClass}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact-message" className="block text-sm font-medium text-ink">
          Message
        </label>
        <textarea
          id="contact-message"
          required
          maxLength={5000}
          rows={5}
          className={`py-2 ${inputClass}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {/* Honeypot — off-screen, out of the tab order, invisible to people. */}
      <div aria-hidden className="absolute -left-[9999px] top-auto">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button type="submit" variant="primary" size="lg" disabled={status === 'sending'}>
          {status === 'sending' ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          Send message
        </Button>
        {status === 'error' ? (
          <p className="text-sm text-danger-ink">Something went wrong — please try again.</p>
        ) : null}
      </div>
    </form>
  );
}
