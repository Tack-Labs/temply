import { describe, expect, it } from 'bun:test';
import { createAutosave, type AutosaveStatus } from './autosave';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

function harness({ fail = 0 }: { fail?: number } = {}) {
  const saved: string[] = [];
  const statuses: AutosaveStatus[] = [];
  let failures = fail;
  const autosave = createAutosave<string>({
    delayMs: 20,
    save: async (snapshot) => {
      await tick(10);
      if (failures > 0) {
        failures -= 1;
        throw new Error('offline');
      }
      saved.push(snapshot);
    },
    onStatus: (s) => statuses.push(s),
  });
  return { autosave, saved, statuses };
}

describe('autosave', () => {
  it('saves once, after the pause, with the newest snapshot', async () => {
    const { autosave, saved, statuses } = harness();
    autosave.change('a');
    autosave.change('ab');
    autosave.change('abc');
    expect(saved).toEqual([]);
    await tick(45);
    expect(saved).toEqual(['abc']);
    expect(statuses).toEqual(['dirty', 'dirty', 'dirty', 'saving', 'saved']);
  });

  it('keeps a change made during a save and saves it afterwards', async () => {
    const { autosave, saved } = harness();
    autosave.change('a');
    await tick(25); // the save for "a" is in flight
    autosave.change('ab');
    await tick(50);
    expect(saved).toEqual(['a', 'ab']);
  });

  it('flush saves immediately and resolves when the save has settled', async () => {
    const { autosave, saved } = harness();
    autosave.change('a');
    await autosave.flush();
    expect(saved).toEqual(['a']);
    expect(autosave.pending()).toBe(false);
  });

  it('flush with nothing pending does nothing', async () => {
    const { autosave, saved, statuses } = harness();
    await autosave.flush();
    expect(saved).toEqual([]);
    expect(statuses).toEqual([]);
  });

  it('keeps the snapshot after a failed save so flush can retry it', async () => {
    const { autosave, saved, statuses } = harness({ fail: 1 });
    autosave.change('a');
    await tick(45);
    expect(saved).toEqual([]);
    expect(statuses.at(-1)).toBe('error');
    expect(autosave.pending()).toBe(true);
    await autosave.flush();
    expect(saved).toEqual(['a']);
    expect(statuses.at(-1)).toBe('saved');
  });

  it('dispose stops the timer but leaves the snapshot for a final flush', async () => {
    const { autosave, saved } = harness();
    autosave.change('a');
    autosave.dispose();
    await tick(45);
    expect(saved).toEqual([]);
    await autosave.flush();
    expect(saved).toEqual(['a']);
  });
});
