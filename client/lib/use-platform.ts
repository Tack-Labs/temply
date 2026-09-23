'use client';

import { useEffect, useState } from 'react';

/**
 * Whether to write shortcuts the Apple way (⌘⇧D) or the other way
 * (Ctrl+Shift+D).
 *
 * Null until the answer is known. The server cannot know it, and guessing
 * during the first paint shows half our readers the wrong key — callers render
 * the glyph invisibly until this resolves rather than flashing a ⌘ at someone
 * holding a Ctrl key.
 */
export function useIsApple(): boolean | null {
  const [isApple, setIsApple] = useState<boolean | null>(null);

  useEffect(() => {
    // `navigator.platform` is deprecated and lies on some browsers;
    // userAgentData is the supported route where it exists.
    const hinted = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
    const platform = hinted?.platform || navigator.platform || navigator.userAgent || '';
    setIsApple(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  return isApple;
}
