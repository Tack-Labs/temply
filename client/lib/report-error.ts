import * as Sentry from '@sentry/nextjs';

/**
 * Where a caught error goes: the console always, Sentry when a DSN is set
 * (the SDK drops the event otherwise). The error pages call this so none
 * of them learns about the SDK.
 */
export function reportError(error: unknown): void {
  console.error(error);
  Sentry.captureException(error);
}
