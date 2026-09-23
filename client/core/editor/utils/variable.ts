import type { Editor } from '@tiptap/core';
import { collectDataKeys } from '@temply/shared/template-data';
import type {
  VariableFunctionOptions,
  Variables,
  Variable,
} from '@/extensions';

export function processVariables(
  variables: Variables,
  options: VariableFunctionOptions
): Array<Variable> {
  const { query } = options;
  const queryLower = query.toLowerCase();

  let filteredVariables: Array<Variable> = [];
  if (Array.isArray(variables)) {
    filteredVariables = variables.filter((variable) =>
      variable.name.toLowerCase().startsWith(queryLower)
    );

    if (
      query.length > 0 &&
      !filteredVariables.some((variable) => variable.name === query)
    ) {
      filteredVariables.push({ name: query, required: true });
    }

    return filteredVariables;
  } else if (typeof variables === 'function') {
    return variables(options);
  } else {
    throw new Error(
      `Invalid variables type. Expected 'Array' or 'Function', but received '${typeof variables}'.`,
    );
  }
}

/**
 * Every name a field can offer: the ones this template already uses (as
 * variables or, for `kind: 'conditions'`, as Show-if keys), then the ones the
 * app supplies. The document is the half that carries the weight — nothing
 * populates the app's list yet — so a name typed once is offered everywhere
 * after, which is the only reason the second variable in a template is
 * easier to write than the first.
 *
 * The document is read once, here, rather than inside the returned function:
 * a field surface calls that function on every keystroke, and re-reading
 * `editor.getJSON()` that often means re-serialising the whole email per
 * character typed — on the phone, the device least able to afford it. Call
 * this where the surface opens, so the snapshot is taken once, and hand the
 * returned function to the surface as its per-keystroke filter.
 */
export function knownNames(
  editor: Editor,
  kind: 'variables' | 'conditions',
  variables: Variables | undefined,
  from: VariableFunctionOptions['from'],
): (query: string) => string[] {
  const inDocument = collectDataKeys(editor.getJSON())[kind];
  return (query) => {
    const needle = query.toLowerCase();
    const offered = processVariables(variables ?? [], { query, from, editor }).map((variable) => variable.name);
    return [...new Set([...inDocument.filter((name) => name.toLowerCase().includes(needle)), ...offered])];
  };
}
