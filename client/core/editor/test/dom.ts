// Registers a document before any editor is created. Imported for its side
// effect at the top of every editor test.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

/**
 * The globals the editor has no use for and the server cannot live without.
 * happy-dom reimplements the whole fetch and stream stack, but Bun's server
 * code reaches for the runtime's own: Elysia's compiled handler calls
 * `headers.toJSON()`, which only Bun's Headers has, and `@react-email/render`
 * pipes into a WritableStream that Bun's ReadableStream refuses unless it is
 * Bun's own. The DOM and event globals are left as happy-dom registers them —
 * those are the half tiptap actually needs.
 */
const RUNTIME_OWNED = [
  'Request', 'Response', 'Headers', 'fetch',
  'FormData', 'Blob', 'File',
  'WritableStream', 'TransformStream',
] as const;

/**
 * Bun runs every test file in one process, so without this handback the editor
 * tests decide whether the server tests pass — by file order, which differs
 * between machines and Bun releases. That is exactly how a green suite on macOS
 * turned into a red one on CI.
 */
if (typeof document === 'undefined') {
  const runtime = new Map(RUNTIME_OWNED.map((key) => [key, globalThis[key]]));

  GlobalRegistrator.register();

  for (const [key, value] of runtime) Object.assign(globalThis, { [key]: value });
}
