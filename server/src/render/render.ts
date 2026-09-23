import type { JSONContent } from '@tiptap/core';
import { Engine } from './engine';
import type { EngineConfig, MissingVariablePolicy, RenderOptions } from './engine';

export async function render(
  content: JSONContent,
  config?: EngineConfig &
    RenderOptions & {
      /**
       * Draw each pill as the placeholder set in the editor rather than as
       * `{{name}}` — for a thumbnail or a review page, where "Hi there" reads
       * as an email and "Hi {{firstName,fallback=there}}" reads as a
       * template. A pill with no placeholder still shows its name.
       */
      showPlaceholders?: boolean;
      /** What to do when data is given but a value is not. Defaults to
       *  refusing, which is what a real send wants. */
      missing?: MissingVariablePolicy;
    }
): Promise<string> {
  const { theme, preview, payload, showPlaceholders, missing, ...rest } = config || {};

  const engine = new Engine(content);
  engine.setPreviewText(preview);
  engine.setTheme(theme || {});
  if (showPlaceholders) {
    engine.setVariableFormatter(({ variable, fallback }) => fallback ?? `{{${variable}}}`);
  }
  if (missing) engine.setMissingVariablePolicy(missing);
  // Supplying data — even an empty object — is what switches the engine from
  // "composing" to "rendering for a recipient": variables resolve and
  // conditions are evaluated.
  // The routes accept payload as t.Any(), so any JSON shape arrives here.
  // Only a plain object is data — a string would hand Object.entries its
  // characters as keys.
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    engine.setShouldReplaceVariableValues(true);
    engine.setPayloadValues(payload);
    // The payload map only feeds "Show if" and repeat lookups; variable pills
    // read the variable-values map, so the flat text entries go there too or
    // {{name}} never resolves.
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string' || typeof value === 'number') {
        engine.setVariableValue(key, String(value));
      }
    }
  }

  return engine.render(rest);
}
