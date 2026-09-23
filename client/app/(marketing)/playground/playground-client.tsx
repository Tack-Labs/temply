'use client';

import { EmailEditorSandbox } from '~/components/email-editor-sandbox';
export default function PlaygroundClient() {
  return (
    <main className="min-h-screen bg-raised">
      {/* On a phone the shell brings its own top bar and fills the screen, so
          the page frame steps out of the way: no gutter, no padding, no page
          title above it. Above `sm` the title sits under the marketing
          header's brand mark, so the gutter matches that header's. */}
      <div className="mx-auto max-w-5xl sm:px-5 sm:py-8">
        <div className="mb-6 hidden sm:block">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Email Editor
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Craft and preview your email templates
          </p>
        </div>
        <EmailEditorSandbox
          imageUploads={false}
          autofocus={false}
          seedFields={{
            subject: 'Welcome to Temply',
            previewText: 'Build a responsive email in about a minute.',
            fromName: 'Temply',
            to: 'you@example.com',
            replyTo: 'reply@example.com',
          }}
        />
      </div>
    </main>
  );
}
