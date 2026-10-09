'use client';

import { EmailEditorSandbox } from '~/components/email-editor-sandbox';
export default function PlaygroundClient({ children }: { children: React.ReactNode }) {
  return (
    // The page keeps the marketing surface, so the editor's panels read as
    // raised on it the way they do in the app.
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1600px] sm:px-5 sm:pt-12 sm:pb-16">
        <div className="px-4 pt-6 pb-5 sm:mb-10 sm:p-0">
          {children}
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
    </div>
  );
}
