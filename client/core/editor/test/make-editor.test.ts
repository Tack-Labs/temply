import { describe, expect, it } from 'bun:test';
import './dom';
import { makeEditor } from './make-editor';

describe('makeEditor', () => {
  it('builds an editor from JSON and reads it back', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }] });
    expect(editor.getText()).toBe('Hi');
    editor.destroy();
    expect(document.body.childElementCount).toBe(0);
  });
});
