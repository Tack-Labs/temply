/**
 * Bytes as a person reads them. One decimal only while the number is small
 * enough for it to matter (2.5 MB), none once it is not (12 MB) — the same
 * rule a file manager uses, so quota copy never reads as a spreadsheet.
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? Math.round(value) : value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded} ${units[unit]}`;
}
