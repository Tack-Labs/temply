import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import type { Asset } from '~/lib/assets';
import { AssetGrid } from './asset-grid';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
const zone = process.env.TZ;
afterEach(() => {
  cleanup();
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const asset = (created_at: string | null): Asset => ({
  id: 'a1',
  user_id: 'u1',
  imagekit_file_id: 'f1',
  url: 'https://ik.example/logo.png',
  name: 'logo.png',
  mime: 'image/png',
  bytes: 2048,
  width: 64,
  height: 64,
  created_at,
});

const date = (created_at: string | null) =>
  render(<AssetGrid view="list" mode="manage" assets={[asset(created_at)]} onDelete={() => {}} />);

const day = (instant: string) =>
  new Date(instant).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

describe('the date on an asset row', () => {
  // The API sends `YYYY-MM-DD HH:MM:SS` in UTC with no zone on it, and `new
  // Date` reads that as the reader's local time. The date is a day, so a stamp
  // is only wrong where the local reading lands on the other side of midnight:
  // 03:00 UTC is still the day before in Los Angeles, and 23:30 UTC is already
  // the next day in Auckland.
  const cases = [
    { zone: 'America/Los_Angeles', stamp: '2026-10-03 03:00:00', instant: '2026-10-03T03:00:00Z' },
    { zone: 'Pacific/Auckland', stamp: '2026-10-03 23:30:00', instant: '2026-10-03T23:30:00Z' },
  ];

  for (const { zone: timeZone, stamp, instant } of cases) {
    it(`is the day the file was added for a reader in ${timeZone}`, () => {
      process.env.TZ = timeZone;
      const view = date(stamp);
      expect(view.getByText(day(instant))).toBeTruthy();
    });
  }

  it('is left out when the row has none', () => {
    const view = date(null);
    expect(view.queryByText(/\d{4}/)).toBeNull();
  });
});
