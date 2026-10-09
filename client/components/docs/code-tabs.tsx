'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { SegmentedControl } from '~/components/ui/segmented-control';
import { docsPanelRows } from '~/components/docs/panel';
import { cn } from '~/lib/classname';
import type { SnippetLanguage } from '~/lib/api-snippets';

const STORAGE_KEY = 'temply:docs-language';

/**
 * A code block with a language switch. The reader's choice is remembered in
 * this browser, so every block on the page and the next visit open on the
 * language they use — picking it once is the whole interaction.
 */
export function CodeTabs({
  languages,
  snippets,
  initial = 'curl',
}: {
  languages: { id: SnippetLanguage; label: string }[];
  snippets: Record<SnippetLanguage, string>;
  initial?: SnippetLanguage;
}) {
  const [language, setLanguage] = useState<SnippetLanguage>(initial);
  const [copied, setCopied] = useState(false);

  // Read the remembered choice after mount: the server cannot know it, and
  // rendering it during hydration would mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as SnippetLanguage | null;
      if (stored && stored in snippets) setLanguage(stored);
    } catch {
      // Storage can be blocked; the default is fine.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (next: SnippetLanguage) => {
    setLanguage(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered, still switched.
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippets[language]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The block is selectable; a failed copy needs no toast.
    }
  };

  return (
    <div className={cn(docsPanelRows, 'mt-5 max-w-2xl overflow-hidden')}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2.5 py-2">
        <SegmentedControl
          size="sm"
          label="Language"
          value={language}
          onValueChange={choose}
          options={languages.map((entry) => ({ value: entry.id, label: entry.label }))}
        />
        <Button variant="ghost" size="compact" onClick={copy} aria-label={copied ? 'Copied' : 'Copy code'}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {/* overflow-x-auto keeps a long URL inside the block instead of widening
          the page. */}
      <pre className="overflow-x-auto p-4 font-mono text-ui leading-relaxed text-ink">
        <code>{snippets[language]}</code>
      </pre>
    </div>
  );
}
