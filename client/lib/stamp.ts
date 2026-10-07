// The API's timestamps are UTC text in the database's own shape
// (`2026-10-06 10:00:00`) with no zone on them, and `Date` reads a string
// without one as the reader's local time, hours out in any zone but UTC. A
// stamp that names its own zone (an ISO string with `Z` or an offset) is
// left to `Date`, so every date the API sends can go through here.
const ZONELESS = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/;

/** The moment an API timestamp names, or an invalid `Date` when it names none. */
export function parseStamp(stamp: string): Date {
  const bare = ZONELESS.exec(stamp.trim());
  return new Date(bare ? `${bare[1]}T${bare[2]}Z` : stamp);
}
