'use client';

import { useEffect, useState } from 'react';
import { HelpCircleIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { EDITOR_SHORTCUTS, formatKeys } from '~/lib/editor-shortcuts';
import { useIsApple } from '~/lib/use-platform';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/classname';

/**
 * What the editor answers to. Slash and @ are discoverable by accident; moving
 * a block with the keyboard is not, and nothing on screen mentions it.
 */
export function EditorCheatsheet({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const isApple = useIsApple();

  // The shortcut for the list of shortcuts. Ignored while typing in a field,
  // where a slash is a slash.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Keyboard shortcuts"
          title={
            isApple === null
              ? 'Keyboard shortcuts'
              : `Keyboard shortcuts (${isApple ? '⌘/' : 'Ctrl+/'})`
          }
          className={className}
        >
          <HelpCircleIcon />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            What the editor answers to, beyond the menus.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {EDITOR_SHORTCUTS.map((group) => (
            <section key={group.title}>
              <h3 className="text-2xs font-medium tracking-wide text-faint uppercase">
                {group.title}
              </h3>
              <dl className="mt-2 space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.keys} className="flex items-baseline gap-3">
                    <dt className="shrink-0">
                      <kbd
                        className={cn(
                          'rounded-xs border border-line bg-surface px-1.5 py-0.5 font-mono text-2xs text-ink',
                          isApple === null && 'opacity-0'
                        )}
                      >
                        {formatKeys(item.keys, isApple ?? true)}
                      </kbd>
                    </dt>
                    <dd className="text-sm text-muted">{item.what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
