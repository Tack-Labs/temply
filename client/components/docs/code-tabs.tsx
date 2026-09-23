'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, pressable } from '~/components/ui/button';
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
    <div className="mt-5 max-w-2xl overflow-hidden rounded-md border border-line bg-raised">
      <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-1.5">
        <div role="tablist" aria-label="Language" className="flex items-center gap-0.5">
          {languages.map((entry) => {
            const active = entry.id === language;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => choose(entry.id)}
                className={cn(
                  'h-7 rounded-sm px-2 text-xs font-medium',
                  pressable,
                  active ? 'bg-accent-wash text-accent-ink' : 'text-muted hover:bg-hover hover:text-ink',
                )}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
        <Button variant="ghost" size="sm" onClick={copy} aria-label={copied ? 'Copied' : 'Copy code'}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {/* overflow-x-auto keeps a long URL inside the block instead of widening
          the page. */}
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-ink">
        <code>{snippets[language]}</code>
      </pre>
    </div>
  );
}
