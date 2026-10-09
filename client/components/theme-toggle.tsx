'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from '~/components/theme-provider';
import { Button } from '~/components/ui/button';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    // 44px: it sits beside the sidebar's Settings row, which is that tall for
    // every pointer, and a 32px button next to it read as a different kit.
    <Button
      variant="secondary"
      size="icon"
      className="size-11"
      onClick={toggle}
      aria-label="Dark theme"
      aria-pressed={isDark}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
