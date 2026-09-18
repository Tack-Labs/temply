import { describe, expect, it } from 'bun:test';
import { getSchema } from '@tiptap/core';
import '../test/dom';
import { extensions } from '.';
import { PLACEHOLDERLESS_WRAPPERS } from './placeholder';

describe('PLACEHOLDERLESS_WRAPPERS', () => {
  it('names only nodes the schema still has', () => {
    // A name the schema has dropped does nothing and says nothing: the branch
    // never runs, and the block it was meant to quiet — if one ever came
    // back under that name — would prompt like an empty paragraph. `show`
    // outlived its node here for exactly that reason.
    const schema = getSchema(extensions({}));
    expect(
      PLACEHOLDERLESS_WRAPPERS.filter((name) => !(name in schema.nodes))
    ).toEqual([]);
  });

  // Only that direction is asserted. Which of the schema's other
  // block-holding nodes belong here is a design question — `listItem` is one
  // this list has never claimed — and a test cannot tell that decision from
  // an oversight.
});
