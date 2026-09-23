import type { Editor } from '@tiptap/core';
import { useCallback, useState } from 'react';
import type { VariableFunctionOptions, Variables } from '@/extensions';
import { knownNames } from './variable';

type Filter = (query: string) => string[];

const nothingKnownYet: Filter = () => [];

/**
 * `knownNames` for a field that offers them: the document is read once, when
 * the field opens, and the filter that read returns answers every keystroke
 * after without touching the document again.
 *
 * `snapshot` takes that reading and does two things with it, because the two
 * kinds of field need it differently. It returns the filter, for a surface
 * handed its options once at open (the phone's dock). And it stores it, so
 * anything derived from `search` — a memo over the draft, say — recomputes on
 * the same open rather than waiting for a keystroke to invalidate it: a field
 * that opened with a name already in it would otherwise offer nothing until
 * that name was edited.
 */
export function useKnownNames(
  editor: Editor,
  kind: 'variables' | 'conditions',
  variables: Variables | undefined,
  from: VariableFunctionOptions['from'],
): { search: Filter; snapshot: () => Filter } {
  const [search, setSearch] = useState<Filter>(() => nothingKnownYet);
  const snapshot = useCallback(() => {
    const taken = knownNames(editor, kind, variables, from);
    setSearch(() => taken);
    return taken;
  }, [editor, kind, variables, from]);
  return { search, snapshot };
}
