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

/**
 * The one door a stored row's content goes through on its way to the canvas.
 *
 * Three paths put a stored document on screen — the first mount, History →
 * Restore and Discard draft — and each used to parse for itself. Two
 * remembered the migration and one did not, so a row written before a schema
 * change blanked the canvas on restore and the next keystroke autosaved the
 * blank over the row. Nothing enforced the rule, so there is no rule any more:
 * parsing and migrating are the same call.
 *
 * A string is a row's `content` column, which is JSON text rather than HTML,
 * and it is parsed the way `JSON.parse` parses one — a corrupt row throws, for
 * the caller to decide what to keep on screen. An object is cloned first: the
 * migration rewrites in place, and its inputs include React state and an
 * imported JSON module that the rest of the app expects to find unchanged.
 */
export function storedDocument(content: string | JSONContent): JSONContent {
  const json =
    typeof content === 'string'
      ? (JSON.parse(content) as JSONContent)
      : (structuredClone(content) as JSONContent);

  // A row whose content is a bare array of blocks rather than a document is
  // the shape this has always accepted; it is wrapped rather than rejected.
  const doc =
    json?.type === 'doc'
      ? json
      : ({ type: 'doc', content: json } as unknown as JSONContent);

  return replaceDeprecatedNode(doc);
}
