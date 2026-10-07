'use client';

import { useEffect } from 'react';
import { reportError } from '~/lib/report-error';

/**
 * The root layout itself failed, so nothing of the app — fonts, tokens,
 * providers — can be assumed. Plain HTML, inline colours, one button.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f5f7fa',
          color: '#0b1220',
          textAlign: 'center',
          padding: '0 1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Temply could not start</h1>
          <p style={{ fontSize: '0.875rem', color: '#5b6478', maxWidth: '24rem', margin: '0 auto 1rem' }}>
            Reload the page. If it keeps happening, the reference is {error.digest ?? 'unavailable'}.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: '2rem',
              padding: '0 0.75rem',
              borderRadius: '0.375rem',
              border: 0,
              background: '#5b45e0',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
