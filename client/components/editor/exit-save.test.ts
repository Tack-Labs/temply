import { describe, expect, it } from 'bun:test';
import { createAutosave } from '~/lib/autosave';
import { captureThenFlush, captureThenLeave, createExitBeacon } from './exit-save';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The editor as the exits see it: a document that keeps changing, and a
 *  capture that is the only thing handing snapshots to the autosave — on a
 *  timer, so at any moment the autosave holds something older than the
 *  screen. */
function editing() {
  const saved: string[] = [];
  const document = { text: 'a' };
  const autosave = createAutosave<string>({
    delayMs: 20,
    save: async (snapshot) => {
      await tick(5);
      saved.push(snapshot);
    },
  });
  const capture = () => autosave.change(document.text);
  return { saved, document, autosave, capture };
}

describe('captureThenFlush', () => {
  it('saves what is on screen, not the last capture', async () => {
    const { saved, document, autosave, capture } = editing();
    capture(); // the debounce fired a second ago
    document.text = 'ab'; // typed since; the next capture is still pending
    await captureThenFlush(capture, autosave);
    expect(saved).toEqual(['ab']);
    expect(autosave.pending()).toBe(false);
  });

  it('resolves only once the save has settled', async () => {
    const { saved, autosave, capture } = editing();
    const done = captureThenFlush(capture, autosave);
    expect(saved).toEqual([]);
    await done;
    expect(saved).toEqual(['a']);
  });
});

describe('captureThenLeave', () => {
  it('posts the pending capture on the way out', async () => {
    const { saved, document, autosave, capture } = editing();
    capture();
    document.text = 'ab';
    captureThenLeave(capture, autosave);
    await tick(10);
    expect(saved).toEqual(['ab']);
  });

  it('leaves no timer behind to save again', async () => {
    const { saved, autosave, capture } = editing();
    captureThenLeave(capture, autosave);
    await tick(40);
    expect(saved).toEqual(['a']);
  });
});

describe('createExitBeacon', () => {
  /** The hook's shape: capture writes the newest snapshot where the beacon
   *  reads it, and hands it to the autosave only when it differs from what
   *  the server already holds. */
  function exiting() {
    const sent: string[] = [];
    const document = { text: 'a' };
    let latest: { fingerprint: string } | null = null;
    let onServer: string | null = null;
    const beacon = createExitBeacon({
      capture: () => {
        if (document.text === onServer) return;
        latest = { fingerprint: document.text };
      },
      pending: () => latest !== null && latest.fingerprint !== onServer,
      snapshot: () => latest,
      send: (snapshot) => sent.push(snapshot.fingerprint),
    });
    return { sent, document, beacon, settle: () => { onServer = document.text; } };
  }

  it('beacons the capture the debounce was still holding', () => {
    const { sent, document, beacon } = exiting();
    document.text = 'ab';
    beacon();
    expect(sent).toEqual(['ab']);
  });

  it('sends one snapshot once, however many events one exit fires', () => {
    const { sent, beacon } = exiting();
    beacon();
    beacon();
    beacon();
    expect(sent).toEqual(['a']);
  });

  it('sends again for work done after the page came back', () => {
    const { sent, document, beacon } = exiting();
    beacon();
    document.text = 'ab';
    beacon();
    expect(sent).toEqual(['a', 'ab']);
  });

  it('stays quiet when the autosave has nothing left', () => {
    const { sent, beacon, settle } = exiting();
    settle();
    beacon();
    expect(sent).toEqual([]);
  });
});
