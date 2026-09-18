import { JSONContent } from '@tiptap/core';
import { spacing } from './spacing';
import { DEFAULT_SPACER_HEIGHT } from '@/extensions';

/**
 * To replace deprecated node type or attributes
 * to avoid breaking changes, we can replace the deprecated node type or attributes
 * with the new one in the JSON content object.
 * @param json - previous JSON content object
 * @returns JSONContent - new JSON content object
 */
export function replaceDeprecatedNode(json: JSONContent) {
  const stack = [json];

  while (stack.length) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    // A node type the schema no longer admits does not arrive as a hole in the
    // document. `createNodeFromContent` catches the parse failure and falls
    // back to an empty doc, so one stale node blanks the whole template on the
    // canvas with nothing on screen saying so — and the first keystroke after
    // that persists the blank over the stored row. Every rename below is a
    // node whose replacement takes the same attributes and the same content,
    // so the document survives the schema it was written against.
    if (node.type === 'for') {
      node.type = 'repeat';
    }

    if (node.type === 'codeBlock') {
      node.type = 'htmlCodeBlock';
    }

    if (node.type === 'spacer') {
      let height = node.attrs?.height;
      if (
        typeof height === 'string' &&
        ['sm', 'md', 'lg', 'xl'].includes(height)
      ) {
        height =
          spacing.find((s) => s.short === height)?.value ||
          DEFAULT_SPACER_HEIGHT;
      }

      node.attrs = {
        ...node.attrs,
        height,
      };
    }

    if (node.content) {
      stack.push(...node.content);
    }
  }

  return json;
}
