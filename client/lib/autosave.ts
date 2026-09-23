/**
 * The draft autosave: collects changes, waits for a pause, saves once.
 *
 * Pure scheduling — no React, no network — so the timing rules can be tested
 * without a browser. The editor hands in a snapshot on every change; the
 * scheduler keeps only the newest and posts it `delayMs` after the last one.
 * A change that lands while a save is in flight is kept and saved as soon as
 * that save settles, so nothing typed during the round trip is lost. A
 * failed save keeps the snapshot and reports `error`; `flush()` is the retry.
 */

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export type Autosave<T> = {
  /** Something changed; save it after the pause. */
  change(snapshot: T): void;
  /** Save now, if there is anything to save. Resolves once the save settles. */
  flush(): Promise<void>;
  /** True while a snapshot is waiting to be saved or is being saved. */
  pending(): boolean;
  /** Stop the timer. Whatever is pending stays pending for a final flush. */
  dispose(): void;
};

export function createAutosave<T>(options: {
  delayMs: number;
  save: (snapshot: T) => Promise<void>;
  onStatus?: (status: AutosaveStatus) => void;
}): Autosave<T> {
  const { delayMs, save, onStatus = () => {} } = options;
  let queued: { snapshot: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const run = async (): Promise<void> => {
    if (inFlight) return inFlight;
    if (!queued) return;
    const { snapshot } = queued;
    queued = null;
    onStatus('saving');
    inFlight = save(snapshot).then(
      () => {
        inFlight = null;
        // A newer snapshot arrived mid-save: it is the one that matters now.
        if (queued) return run();
        onStatus('saved');
      },
      () => {
        inFlight = null;
        // Keep the newest of what failed and what arrived since, for the retry.
        if (!queued) queued = { snapshot };
        onStatus('error');
      },
    );
    return inFlight;
  };

  return {
    change(snapshot) {
      queued = { snapshot };
      onStatus('dirty');
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, delayMs);
    },
    async flush() {
      clearTimer();
      await run();
    },
    pending() {
      return queued !== null || inFlight !== null;
    },
    dispose() {
      clearTimer();
    },
  };
}
