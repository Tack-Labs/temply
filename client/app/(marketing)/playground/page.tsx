import { JsonLd } from '~/components/json-ld';
import Link from 'next/link';
import { publicPageMetadata, publicPageSchema } from '~/lib/seo';
import PlaygroundClient from './playground-client';

export const metadata = publicPageMetadata('/playground');

export default function PlaygroundPage() {
  return (
    <>
      <JsonLd data={publicPageSchema('/playground')} />
      <PlaygroundClient>
        <h1 className="font-display text-xl font-semibold tracking-display text-ink">
          Email editor playground
        </h1>
        <div className="mt-2 max-w-2xl space-y-2 text-sm leading-relaxed text-muted">
          <p>
            Try the visual email editor without an account. Arrange blocks, add text and buttons,
            and preview responsive HTML for a welcome message, receipt or another transactional email.
            The canvas uses your template&apos;s own colours and fonts, so changing the app theme
            keeps the email&apos;s design intact.
          </p>
          <p>
            On a computer, edit directly on the canvas. On a phone, use the panels to explore the
            template and its preview. This sandbox does not upload images or save your work to a
            workspace. <Link href="/sign-up" className="text-accent-ink hover:underline">Create an account</Link>{' '}
            to keep templates and publish them, or{' '}
            <Link href="/docs" className="text-accent-ink hover:underline">read the docs</Link>{' '}
            to learn how variables, brands and the rendering API fit together.
          </p>
        </div>
      </PlaygroundClient>
    </>
  );
}
