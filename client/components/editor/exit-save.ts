/**
 * What the editor does on its way out — leaving the tree, publishing, or the
 * page itself going away.
 *
 * All three obey one rule the hook cannot state in a line. The autosave is
 * only ever handed a snapshot by the debounced capture, so flushing on its
 * own posts the *previous* capture: the document as it stood up to a second
 * before the exit. Anything that wants what is on screen saved has to take
 * the capture itself, first. That ordering lives here, away from React, so
 * it can be held to it by a test.
 */

/** The part of the autosave an exit touches. */
export type PendingSave = {
  flush(): Promise<void>;
  dispose(): void;
  pending(): boolean;
};

/** Capture, then save now. Awaited, so the caller can tell whether the save
 *  settled — Publish refuses to go on without it. */
export async function captureThenFlush(capture: () => void, autosave: PendingSave): Promise<void> {
  capture();
  await autosave.flush();
}

/** The same on the way out of the tree, where there is nothing left to
 *  await: the capture is taken before the timer that was going to run it is
 *  stopped, and the request outlives the component. */
export function captureThenLeave(capture: () => void, autosave: PendingSave): void {
  capture();
  autosave.dispose();
  void autosave.flush();
}

/**
 * The last resort: a page that is going away cannot await a save, so the
 * pending draft is handed to the browser to post on its own.
 *
 * The events that mean "going away" differ by platform and several of them
 * fire for a single exit — iOS sends both a hidden `visibilitychange` and a
 * `pagehide` for one app switch — so a snapshot is beaconed once. Work done
 * after a page comes back from the cache is newer, has a new fingerprint,
 * and is beaconed again on the next exit.
 */
export function createExitBeacon<Snapshot extends { fingerprint: string }>(options: {
  capture: () => void;
  pending: () => boolean;
  snapshot: () => Snapshot | null;
  send: (snapshot: Snapshot) => void;
}): () => void {
  let sent: string | null = null;
  return () => {
    options.capture();
    const snapshot = options.snapshot();
    if (!snapshot || !options.pending()) return;
    if (snapshot.fingerprint === sent) return;
    sent = snapshot.fingerprint;
    options.send(snapshot);
  };
}
