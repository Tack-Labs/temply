import { AnyExtension, Extension } from '@tiptap/core';

import StarterKit from '@tiptap/starter-kit';
import ListItem from '@tiptap/extension-list-item';
import Paragraph from '@tiptap/extension-paragraph';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Heading from '@tiptap/extension-heading';
import Underline from '@tiptap/extension-underline';
import Document from '@tiptap/extension-document';
import Focus from '@tiptap/extension-focus';
import Dropcursor from '@tiptap/extension-dropcursor';

import { BlockKeyboardShortcuts } from './block-keyboard';
import { Color } from './color';
import { HorizontalRule } from './horizontal-rule';
import { Footer } from '../nodes/footer';
import { Spacer } from '../nodes/spacer';
import { LinkCardExtension, LinkCardOptions } from './link-card';
import { ShowIfHighlight } from './show-if-highlight';
import { TrailingNode } from './trailing-node/trailing-node';
import { ColumnsExtension } from '../nodes/columns/columns';
import { ColumnExtension } from '../nodes/columns/column';
import { SectionExtension } from '../nodes/section/section';
import { ButtonExtension } from '../nodes/button/button';
import { LogoExtension } from '../nodes/logo/logo';
import { ImageExtension } from '../nodes/image/image';
import { LinkExtension } from '../nodes/link';
import { LinkOptions } from '@tiptap/extension-link';
import { HeadingExtension } from '../nodes/heading/heading';
import { ParagraphExtension } from '../nodes/paragraph/paragraph';
import { RepeatExtension } from '../nodes/repeat/repeat';

export type TemplyKitOptions = {
  linkCard?: Partial<LinkCardOptions> | false;
  repeat?: Partial<{}> | false;
  section?: Partial<{}> | false;
  columns?: Partial<{}> | false;
  column?: Partial<{}> | false;
  button?: Partial<{}> | false;
  spacer?: Partial<{}> | false;
  logo?: Partial<{}> | false;
  image?: Partial<{}> | false;
  link?: Partial<LinkOptions> | false;
};

/**
 * The last blocks of a document that already give the customer somewhere to
 * type, so a line added after them would buy nothing.
 *
 * Two shapes answer that. A textblock takes the caret inside itself —
 * `paragraph`, `heading` and `footer`, and `htmlCodeBlock`, where the caret
 * blinks in the `pre` and typing lands in it exactly as it does in a heading.
 * Everything else named here is an atom or a wrapper that ProseMirror puts a
 * gap cursor after, which is a caret at the top level in its own right. The
 * code block is the one shape where getting *out* is not Enter — Enter adds a
 * line of code — but ArrowDown at the end of it makes the paragraph after it,
 * so the document still continues.
 *
 * Everything not named — `bulletList`, `orderedList` and `blockquote` — puts
 * the only caret it has inside a wrapper, so the next block a customer asks
 * for is built in there rather than after it.
 *
 * A document the customer never edited must not change shape when we open it,
 * so the trailing line is added only where there is genuinely nowhere else to
 * go. It renders as a blank line at the foot of the email, which is the price
 * of being able to type there at all.
 */
const ALREADY_SOMEWHERE_TO_TYPE = [
  'paragraph',
  'heading',
  'footer',
  'htmlCodeBlock',
  'section',
  'columns',
  'repeat',
  'horizontalRule',
  'button',
  'image',
  'logo',
  'linkCard',
  'spacer',
];

export const TemplyKit = Extension.create<TemplyKitOptions>({
  name: 'temply-kit',

  addOptions() {
    return {
      link: {
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          class: 'mly:no-underline',
        },
        openOnClick: false,
      },
    };
  },

  addExtensions() {
    const extensions: AnyExtension[] = [
      BlockKeyboardShortcuts,
      ShowIfHighlight,
      // A document that ends in a list or a blockquote has nowhere at the top
      // level left to type: the caret can only land inside the wrapper, so
      // everything added afterwards is built in there. One empty paragraph is
      // kept at the end of those so the document always has a line of its own
      // to continue on.
      TrailingNode.configure({ notAfter: ALREADY_SOMEWHERE_TO_TYPE }),
      Document.extend({
        content: '(block|columns)+',
      }),
      StarterKit.configure({
        code: {
          HTMLAttributes: {
            class:
              'mly:px-1 mly:relative mly:py-0.5 mly:bg-[#efefef] mly:text-sm mly:rounded-md mly:tracking-normal mly:font-normal',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class:
              'mly:not-prose mly:border-l-4 mly:border-gray-300 mly:pl-4 mly:mt-4 mly:mb-4 mly:relative',
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: 'mly:relative',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'mly:relative',
          },
        },
        heading: false,
        paragraph: false,
        horizontalRule: false,
        dropcursor: false,
        document: false,
        // The renderer draws one node type per case and throws on anything
        // else, so a node this kit registers without a case there is a block a
        // customer can put in a template that can then never be previewed,
        // preflighted, published or sent. StarterKit's `codeBlock` was exactly
        // that: no slash entry, no bubble menu, no phone affordance, reachable
        // only through its own Mod-Alt-C. Temply's code block is
        // `htmlCodeBlock`, which the renderer knows; this one stays off.
        codeBlock: false,
      }) as AnyExtension,
      Underline,
      Color.configure({ types: [TextStyle.name, ListItem.name] }),
      TextStyle.configure(),
      TextAlign.configure({
        types: [Paragraph.name, Heading.name, Footer.name],
      }),
      HorizontalRule,
      Footer,
      Focus,
      Dropcursor.configure({
        color: '#555',
        width: 3,
        class: 'ProseMirror-dropcursor',
      }),
      HeadingExtension.configure({
        levels: [1, 2, 3],
        HTMLAttributes: {
          class: 'mly:relative',
        },
      }),
      ParagraphExtension.configure({
        HTMLAttributes: {
          class: 'mly:relative',
        },
      }),
    ];

    if (this.options.linkCard !== false) {
      extensions.push(LinkCardExtension.configure(this.options.linkCard));
    }

    if (this.options.repeat !== false) {
      extensions.push(RepeatExtension);
    }

    if (this.options.section !== false) {
      extensions.push(SectionExtension);
    }

    if (this.options.columns !== false) {
      extensions.push(ColumnsExtension);
    }

    if (this.options.column !== false) {
      extensions.push(ColumnExtension);
    }

    if (this.options.button !== false) {
      extensions.push(ButtonExtension);
    }

    if (this.options.spacer !== false) {
      extensions.push(Spacer);
    }

    if (this.options.logo !== false) {
      extensions.push(LogoExtension);
    }

    if (this.options.image !== false) {
      extensions.push(ImageExtension);
    }

    if (this.options.link !== false) {
      extensions.push(LinkExtension.configure(this.options.link));
    }

    return extensions;
  },
});
