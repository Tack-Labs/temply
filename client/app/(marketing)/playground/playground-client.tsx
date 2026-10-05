'use client';

import { EmailEditorSandbox } from '~/components/email-editor-sandbox';
export default function PlaygroundClient({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-raised">
      <div className="mx-auto max-w-[1600px] sm:px-5 sm:py-8">
        <div className="px-4 pt-4 pb-4 sm:mb-6 sm:p-0">
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
