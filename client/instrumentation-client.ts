/**
 * Browser-side error monitoring. Off unless a DSN is set, so a checkout of
 * the repo reports nothing anywhere by accident. No session replay and no
 * tracing: what we want to know is that a page broke and where — the
 * editor's every keystroke is not ours to record.
 *
 * Loaded after the page is idle, not with it. Next bundles whatever this
 * file imports into the script every page carries, and the Sentry client
 * was the largest thing on the front page — a visitor reading the pitch
 * paid for the editor's crash reporter before the pitch had painted. The
 * SDK is fetched once the browser has nothing better to do; errors thrown
 * before then are held and handed over when it arrives, so nothing is
 * lost to the wait beyond what happens in the same tick as the crash.
 */
type Sentry = typeof import('@sentry/nextjs');

let sentry: Sentry | null = null;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn && typeof window !== 'undefined') {
  const held: unknown[] = [];
  const onError = (event: ErrorEvent) => held.push(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => held.push(event.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  const load = () =>
    import('@sentry/nextjs').then((mod) => {
      mod.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
        tracesSampleRate: 0,
        sendDefaultPii: false,
      });
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      for (const error of held.splice(0)) mod.captureException(error);
      sentry = mod;
    });

  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => void load());
  else window.setTimeout(() => void load(), 0);
}

/** Next hands every navigation here; before the SDK is in there is nothing to tell. */
export const onRouterTransitionStart = (href: string, navigationType: string): void => {
  sentry?.captureRouterTransitionStart(href, navigationType);
};
