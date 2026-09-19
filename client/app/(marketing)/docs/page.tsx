import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsNav } from '~/components/docs/docs-nav';
import { ApiReference } from '~/components/docs/api-reference';
import { DarkMode } from '~/components/docs/dark-mode';
import { YourTeam } from '~/components/docs/team';
import {
  CreatingATemplate,
  Editor,
  Introduction,
  UsingBrands,
} from '~/components/docs/docs-content';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'How Temply builds email that survives the clients that still parse HTML like it is 2005.',
};

// The ids the headings in docs-content carry. The nav highlights whichever of
// these the reader is in, so the two lists have to stay in step.
//
// The editor comes last on purpose: it is a reference you return to, several
// times longer than the rest, and a first-time reader should meet the shape of
// the product before the catalogue of blocks.
const sections = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'creating-a-template', label: 'Creating a template' },
  { id: 'brands', label: 'Using brands' },
  { id: 'dark-mode', label: 'Dark mode' },
  { id: 'team', label: 'Your team' },
  {
    id: 'api',
    label: 'The API',
    children: [
      { id: 'api-keys', label: 'Keys' },
      { id: 'api-templates', label: 'List templates' },
      { id: 'api-template', label: 'Get a template' },
      { id: 'api-render', label: 'Render a template' },
      { id: 'api-data', label: 'The data object' },
      { id: 'api-errors', label: 'Errors and limits' },
    ],
  },
  {
    id: 'editor',
    label: 'The editor',
    // The block groups rather than the blocks themselves: two dozen entries
    // would leave the contents column longer than most of the sections it
    // points at.
    children: [
      { id: 'blocks-text', label: 'Text blocks' },
      { id: 'blocks-media', label: 'Media blocks' },
      { id: 'blocks-layout', label: 'Layout blocks' },
      { id: 'blocks-advanced', label: 'Advanced blocks' },
      { id: 'blocks-components', label: 'Components' },
      { id: 'shortcuts', label: 'Shortcuts' },
      { id: 'variables', label: 'Variables' },
      { id: 'show-if', label: 'Show if' },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="overflow-x-clip">
      <div className="mx-auto max-w-5xl px-5 pt-16 pb-24 sm:pt-20">
        <header className="max-w-2xl">
          <p className="font-mono text-2xs tracking-[0.16em] text-accent-ink uppercase">
            Documentation
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance text-ink lg:text-4xl">
            How Temply works
          </h1>
          <p className="mt-4 max-w-xl text-lg text-pretty text-muted">
            What the editor gives you, how a template goes from empty to sent,
            what a brand carries, who on your team can do what, and how your
            app asks for the finished email.
          </p>
        </header>

        {/* Single column below lg with the contents first, because a reader on
            a phone wants to see the shape of the page before the prose. At lg
            the same source order becomes the left rail. */}
        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16">
          {/* top-16 clears the sticky h-12 header with a little air. */}
          <div className="lg:sticky lg:top-16 lg:self-start">
            <DocsNav sections={sections} />
          </div>

          {/* min-w-0 so a long line inside a section — a URL in the curl block
              — scrolls within its own container rather than widening the grid. */}
          <div className="flex min-w-0 flex-col gap-16">
            <Introduction />
            <CreatingATemplate />
            <UsingBrands />
            <DarkMode />
            <YourTeam />
            <ApiReference />
            <Editor />
          </div>
        </div>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted">
          <p>&copy; {new Date().getFullYear()} Temply</p>
          <Link href="/playground" className="text-accent-ink underline-offset-4 hover:underline">
            Try the editor
          </Link>
        </div>
      </footer>
    </div>
  );
}
