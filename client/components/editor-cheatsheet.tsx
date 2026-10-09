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
          size="icon"
          aria-label="Keyboard shortcuts"
          title={
            isApple === null
              ? 'Keyboard shortcuts'
              : `Keyboard shortcuts (${isApple ? '⌘/' : 'Ctrl+/'})`
          }
          // 40px, the height of the view switch's pills it sits beside.
          className={cn('size-10 [&_svg]:size-5', className)}
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

        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {EDITOR_SHORTCUTS.map((group) => (
            <section key={group.title}>
              <h3 className="text-xs font-bold tracking-widest text-muted uppercase">
                {group.title}
              </h3>
              <dl className="mt-3 space-y-2.5">
                {group.items.map((item) => (
                  <div key={item.keys} className="flex items-baseline gap-3">
                    <dt className="shrink-0">
                      {/* A key cap: the field's border on a small raised box. */}
                      <kbd
                        className={cn(
                          'inline-block rounded-md border-[1.5px] border-line-strong bg-raised px-2 py-0.5 font-mono text-sm text-ink',
                          isApple === null && 'opacity-0'
                        )}
                      >
                        {formatKeys(item.keys, isApple ?? true)}
                      </kbd>
                    </dt>
                    <dd className="text-ui text-ink-soft">{item.what}</dd>
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
