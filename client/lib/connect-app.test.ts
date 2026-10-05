import { describe, expect, it } from 'bun:test';
import { connectionSnippet } from './connect-app';

const options = { origin: 'https://temply.example', shortCode: 'tpl_abc', data: { firstName: "O'Brien", hasDiscount: true } };

describe('connection requests', () => {
  it('uses the shared render path and keeps a secret out of all setup notes', () => {
    for (const language of ['curl', 'javascript', 'python'] as const) {
      const snippet = connectionSnippet({ ...options, language, version: 7 });
      expect(snippet).toContain('https://temply.example/api/public/v1/templates/tpl_abc/render');
      expect(snippet).toContain('TEMPLY_KEY');
      expect(snippet).toContain('7');
      expect(snippet).not.toContain('tply_live_');
    }
  });

  it('quotes apostrophes safely in a command-line payload and leaves the latest version unpinned', () => {
    const snippet = connectionSnippet({ ...options, language: 'curl' });
    expect(snippet).toContain(`O'"'"'Brien`);
    expect(snippet).not.toContain('"version"');
  });

  it('provides a runnable Python request with JSON booleans inside encoded JSON', () => {
    const snippet = connectionSnippet({ ...options, language: 'python' });
    expect(snippet).toContain('urllib.request.Request');
    expect(snippet).toContain('\\"hasDiscount\\": true');
    expect(snippet).toContain('.encode()');
  });
});
