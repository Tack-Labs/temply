import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicPreviewPath } from '@temply/shared/api';
import { BrandMark } from '~/components/brand-mark';
import { Badge } from '~/components/ui/surfaces';
import { serverFetch } from '~/lib/server-fetch';

export const dynamic = 'force-dynamic';

type Preview = { title: string; previewText: string | null; html: string; updatedAt: string | null };

async function loadPreview(token: string): Promise<Preview | null> {
  const res = await serverFetch(publicPreviewPath(token));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('The preview could not be loaded');
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const preview = await loadPreview(token);
  return {
    // The email's own title, as the author wrote it, with no brand after it:
    // a reviewer was sent one email, not the product.
    title: preview ? { absolute: `${preview.title} — preview` } : 'Preview',
    robots: 'noindex',
  };
}

/**
 * What a review link opens: the email as the author's draft stands, in a
 * sandboxed frame so its markup cannot touch this page, under one line that
 * says whose email it is and that it is a preview.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await loadPreview(token);
  if (!preview) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-sunken">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-raised px-4">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark className="size-4 shrink-0 text-accent" />
          <span className="truncate text-sm font-medium text-ink">{preview.title}</span>
          <Badge tone="neutral">Preview</Badge>
        </div>
        <Link href="/" className="shrink-0 text-xs text-muted transition-colors hover:text-ink">
          Made with Temply
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-4 lg:p-6">
        {preview.previewText ? (
          <p className="mb-3 text-xs text-muted">
            Preview text: <span className="text-ink">{preview.previewText}</span>
          </p>
        ) : null}
        {/* sandbox with no allowances: the email is inert HTML, and nothing
            it carries can reach this page. */}
        <iframe
          title={`Preview of ${preview.title}`}
          sandbox=""
          srcDoc={preview.html}
          className="min-h-[70vh] w-full flex-1 rounded-lg border border-line bg-white shadow-canvas"
        />
      </main>
    </div>
  );
}
