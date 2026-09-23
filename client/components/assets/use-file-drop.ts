'use client';

import { useEffect, useState } from 'react';

/**
 * Files dragged anywhere over the window. The page, not a box on it, is the
 * drop zone: a library that is nearly empty would otherwise offer a zone a
 * few hundred pixels tall and let the browser open the image for any drop
 * below it.
 *
 * dragenter/dragleave fire for every element the pointer crosses, so a
 * counter — not a boolean — decides when the drag has really left.
 */
export function useFileDrop(onFiles: (files: FileList) => void, enabled = true): boolean {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    // A closed picker must not take drops meant for the editor canvas, which
    // has its own drop-to-upload; while disabled nothing is listened to.
    if (!enabled) {
      setDragging(false);
      return;
    }
    let depth = 0;
    const carriesFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');

    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth += 1;
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      // Without this the browser treats the drop as navigation to the file.
      event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      if (event.dataTransfer?.files.length) onFiles(event.dataTransfer.files);
    };

    document.addEventListener('dragenter', enter);
    document.addEventListener('dragleave', leave);
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragenter', enter);
      document.removeEventListener('dragleave', leave);
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, [onFiles, enabled]);

  return dragging;
}
