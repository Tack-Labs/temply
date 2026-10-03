'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon, Loader2Icon, SendIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, Reveal } from '~/components/ui/surfaces';
import { cn } from '~/lib/classname';
import { FetchError, httpPost } from '~/lib/http';
import { CONTACT_EMAIL } from '~/lib/site';

type Status = 'idle' | 'sending' | 'sent' | 'error';
type Field = 'name' | 'email' | 'message';
type Errors = Partial<Record<Field, string>>;

// text-lg is 16px: anything smaller makes iOS zoom the page when a field takes
// focus. The border is the 3:1 `faint`, since the fill does not set a field
// apart from the card it sits on.
const control =
  'h-11 pointer-coarse:h-12 border-faint px-3.5 text-lg text-ink aria-invalid:border-danger-ink';
const labelClass = 'text-base font-semibold';
const failureClass = 'rounded-md bg-danger-wash px-3.5 py-2.5 text-base text-danger-ink';

// Matches what the server's own check accepts closely enough to catch a typo;
// the server stays the authority on whether an address is deliverable.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(name: string, email: string, message: string): Errors {
  const errors: Errors = {};
  if (!name.trim()) errors.name = 'Add your name.';
  if (!email.trim()) errors.email = 'Add an email address so we can reply.';
  else if (!EMAIL.test(email.trim())) errors.email = 'That does not look like an email address.';
  if (!message.trim()) errors.message = 'Write a few words about what you need.';
  return errors;
}

/** The last message that was set, held after it is cleared so a panel that is
 *  closing has words to fade out with instead of collapsing around nothing. */
function useKept(value: string | undefined) {
  const [kept, setKept] = useState(value ?? '');
  if (value && value !== kept) setKept(value);
  return kept;
}

/** A label, its control and the message that opens under it. The message is
 *  tied to the control only while it shows, so a screen reader is not pointed
 *  at words that have closed. */
function FieldGroup({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  children: (props: { id: string; 'aria-invalid': true | undefined; 'aria-describedby': string | undefined }) => React.ReactNode;
}) {
  const message = useKept(error);
  return (
    <div>
      <Label htmlFor={id} className={labelClass}>
        {label}
      </Label>
      <div className="mt-2">
        {children({
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? `${id}-error` : undefined,
        })}
      </div>
      <Reveal open={Boolean(error)}>
        <p id={`${id}-error`} className="pt-1.5 text-base text-danger-ink">
          {message}
        </p>
      </Reveal>
    </div>
  );
}

/** The landing page's contact form. Posts to /api/v1/contact, which stores the
 *  message and best-effort forwards it by mail. The `company` field is a
 *  honeypot: parked off-screen where no person will fill it. The form and its
 *  thanks share one grid cell and cross-fade, so the card keeps the height of
 *  the form and nothing below it jumps when the message goes. */
export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [failedWithAddress, setFailedWithAddress] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const sentRef = useRef<HTMLHeadingElement>(null);
  const returning = useRef(false);

  const sent = status === 'sent';
  const sending = status === 'sending';
  const banner = useKept(failure ?? undefined);
  const notice = (
    <>
      {banner}
      {failedWithAddress ? (
        <>
          {' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </>
      ) : null}
    </>
  );

  // Focus follows the swap. The form goes inert as it fades, which would drop
  // focus on the page; the confirmation takes it, and "Send another" hands it
  // back to the first field.
  useEffect(() => {
    if (sent) sentRef.current?.focus();
    else if (returning.current) {
      returning.current = false;
      nameRef.current?.focus();
    }
  }, [sent]);

  const clear = (field: Field) => setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    const found = validate(name, email, message);
    setErrors(found);
    const first = (['name', 'email', 'message'] as const).find((field) => found[field]);
    if (first) {
      setFailure(null);
      const target = { name: nameRef, email: emailRef, message: messageRef }[first];
      target.current?.focus();
      return;
    }

    setStatus('sending');
    setFailure(null);
    try {
      await httpPost('/api/v1/contact', {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        company,
      });
      setStatus('sent');
    } catch (error) {
      // The server's fuse words its own wait; anything else is not something a
      // visitor can act on, so they are given a way round it.
      const fuse = FetchError.isFetchError(error) && error.status === 429;
      setFailure(fuse ? error.message : 'That did not send. Try again, or email us at');
      setFailedWithAddress(!fuse);
      setAttempt((count) => count + 1);
      setStatus('error');
    }
  };

  const again = () => {
    setName('');
    setEmail('');
    setMessage('');
    setCompany('');
    setErrors({});
    setFailure(null);
    returning.current = true;
    setStatus('idle');
  };

  return (
    <Card inset={false} className="relative rounded-2xl p-6 shadow-md sm:p-8">
      <div className="grid">
        <form
          noValidate
          onSubmit={handleSubmit}
          aria-hidden={sent}
          inert={sent}
          className={cn(
            'flex flex-col gap-5 [grid-area:1/1] transition-opacity duration-base ease-out motion-reduce:transition-none',
            sent ? 'opacity-0' : 'opacity-100',
          )}
        >
          <FieldGroup id="contact-name" label="Name" error={errors.name}>
            {(aria) => (
              <Input
                {...aria}
                ref={nameRef}
                autoComplete="name"
                maxLength={100}
                className={control}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clear('name');
                }}
              />
            )}
          </FieldGroup>

          <FieldGroup id="contact-email" label="Email" error={errors.email}>
            {(aria) => (
              <Input
                {...aria}
                ref={emailRef}
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                placeholder="you@company.com"
                className={control}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clear('email');
                }}
              />
            )}
          </FieldGroup>

          <FieldGroup id="contact-message" label="Message" error={errors.message}>
            {(aria) => (
              <textarea
                {...aria}
                ref={messageRef}
                maxLength={5000}
                rows={5}
                className={cn(
                  'flex min-h-32 w-full resize-y rounded-md border bg-raised py-2.5 placeholder:text-muted',
                  control,
                  'h-auto pointer-coarse:h-auto',
                )}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  clear('message');
                }}
              />
            )}
          </FieldGroup>

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

          <div>
            <Reveal open={Boolean(failure)}>
              <div className="pb-4">
                {/* Only a failure that stands is a live region, and each attempt's
                    is a new element. A region that is always mounted announces a
                    change in its text, so the same failure twice, or one that
                    opens inside a container as it appears, can fall silent. The
                    plain copy keeps the words on screen through the fade-out,
                    which Reveal has hidden from assistive tech by then. */}
                {failure ? (
                  <p key={attempt} role="alert" className={failureClass}>
                    {notice}
                  </p>
                ) : (
                  <p className={failureClass}>{notice}</p>
                )}
              </div>
            </Reveal>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              aria-disabled={sending}
              className="aria-disabled:cursor-wait aria-disabled:opacity-45 aria-disabled:hover:bg-accent"
            >
              {sending ? (
                <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <SendIcon aria-hidden />
              )}
              {sending ? 'Sending' : 'Send message'}
            </Button>
          </div>
        </form>

        <div
          aria-hidden={!sent}
          inert={!sent}
          className={cn(
            'flex flex-col items-start gap-3.5 self-center py-2 [grid-area:1/1] transition-opacity duration-base ease-out motion-reduce:transition-none',
            sent ? 'opacity-100' : 'opacity-0',
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-success-wash text-success-ink">
            <CheckIcon className="size-5" aria-hidden />
          </span>
          <h3
            ref={sentRef}
            tabIndex={-1}
            className="font-display text-2xl font-semibold tracking-display text-ink outline-none"
          >
            Message sent
          </h3>
          <p className="text-lg text-muted">We&apos;ll reply to the email address you gave.</p>
          <Button type="button" variant="secondary" size="lg" onClick={again}>
            Send another
          </Button>
        </div>
      </div>
    </Card>
  );
}
