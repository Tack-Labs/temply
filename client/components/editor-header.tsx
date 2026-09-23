'use client';

import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '~/components/theme-toggle';
import { UserMenu } from '~/components/dashboard/user-menu';

export function EditorHeader() {
  return (
    <header className="flex h-12 items-center justify-between border-b border-line bg-raised px-4">
      <Link
        href="/dashboard/templates"
        className="flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu align="end" showLabel={false} />
      </div>
    </header>
  );
}
