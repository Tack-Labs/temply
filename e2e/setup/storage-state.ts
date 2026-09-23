import { join } from 'node:path';

// Split out of auth.setup.ts: that file calls Playwright's `test()` at
// module scope, which throws ("did not expect test() to be called here")
// the moment anything outside an actual test run — the config, this spec —
// imports it just to read a constant. This module has no such call, so the
// config and every spec can import the one path safely.
export const STORAGE_STATE = join(import.meta.dirname, '..', '.auth', 'user.json');
