import type { BlockItem } from './types';
import {
  Text,
  Heading1,
  Heading2,
  Heading3,
  TextQuote,
} from 'lucide-react';

export const text: BlockItem = {
  title: 'Text',
  description: 'Just start typing with plain text.',
  searchTerms: ['p', 'paragraph'],
  icon: <Text className="mly:h-4 mly:w-4" />,
  command: ({ editor, range }) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .toggleNode('paragraph', 'paragraph')
      .run();
  },
};

export const heading1: BlockItem = {
  title: 'Heading 1',
  description: 'Big heading.',
  searchTerms: ['h1', 'title', 'big', 'large'],
  icon: <Heading1 className="mly:h-4 mly:w-4" />,
  command: ({ editor, range }) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .setNode('heading', { level: 1 })
      .run();
  },
};

export const heading2: BlockItem = {
  title: 'Heading 2',
  description: 'Medium heading.',
  searchTerms: ['h2', 'subtitle', 'medium'],
  icon: <Heading2 className="mly:h-4 mly:w-4" />,
  command: ({ editor, range }) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .setNode('heading', { level: 2 })
      .run();
  },
};

export const heading3: BlockItem = {
  title: 'Heading 3',
  description: 'Small heading.',
  searchTerms: ['h3', 'subtitle', 'small'],
  icon: <Heading3 className="mly:h-4 mly:w-4" />,
  command: ({ editor, range }) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .setNode('heading', { level: 3 })
      .run();
  },
};

export const blockquote: BlockItem = {
  title: 'Blockquote',
  description: 'Add blockquote.',
  searchTerms: ['quote', 'blockquote'],
  icon: <TextQuote className="mly:h-4 mly:w-4" />,
  command: ({ editor, range }) => {
    // @ts-ignore
    editor.chain().focus().deleteRange(range).toggleBlockquote().run();
  },
};

