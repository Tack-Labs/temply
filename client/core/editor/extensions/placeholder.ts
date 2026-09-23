import Placeholder from '@tiptap/extension-placeholder';

/**
 * Blocks that hold other blocks, and so have nothing of their own to prompt
 * for — the line inside them carries the prompt instead.
 *
 * Every name here has to be one the schema admits: a name it has dropped is a
 * silent no-op, which is how `show` sat in this list long after the node it
 * named became the `showIfKey` attribute. `placeholder.test.ts` asks the
 * schema rather than a reader.
 */
export const PLACEHOLDERLESS_WRAPPERS = [
  'columns',
  'column',
  'section',
  'repeat',
  'blockquote',
];

export const PlaceholderExtension = Placeholder.configure({
  placeholder: ({ node }) => {
    if (node.type.name === 'heading') {
      return `Heading ${node.attrs.level}`;
    } else if (node.type.name === 'htmlCodeBlock') {
      return 'Type your HTML code...';
    } else if (PLACEHOLDERLESS_WRAPPERS.includes(node.type.name)) {
      return '';
    }

    return 'Write something or / to see commands';
  },
  includeChildren: true,
});
