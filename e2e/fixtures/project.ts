import { test, type TestInfo } from '@playwright/test';

/**
 * Whether the running project is the phone one. The same specs run on both
 * projects, and where a page differs below `sm` — the sidebar behind a
 * drawer, the editor's phone shell — this is the one question they ask.
 * Imports only the runner, so every fixture can use it without a cycle.
 * A fixture that is handed its `TestInfo` passes it in; a spec or helper
 * reads the running test's.
 */
export const onPhone = (info: TestInfo = test.info()) => info.project.name.startsWith('phone');
