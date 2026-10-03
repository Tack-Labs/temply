'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from '~/components/theme-provider';
import { Button } from '~/components/ui/button';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={toggle}
      aria-label="Dark theme"
      aria-pressed={isDark}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
