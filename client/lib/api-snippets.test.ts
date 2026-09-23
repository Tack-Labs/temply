import { describe, expect, it } from 'bun:test';
import { PUBLIC_RENDER_ROUTE, PUBLIC_TEMPLATE_ROUTE, PUBLIC_TEMPLATES_ROUTE, publicRenderPath, publicTemplatePath, publicTemplatesPath } from '@temply/shared/api';
import { API_ORIGIN, listSnippet, errorSnippets, metaSnippet, renderSnippets, sendSnippets, SNIPPET_LANGUAGES } from './api-snippets';

/**
 * The snippets are what an integrator pastes. Each one has to hit the path
 * the server actually serves, send the key the way the server reads it, and
 * post a data object the render endpoint accepts.
 */
describe('API snippets', () => {
  const code = 'tpl_AbCd1234';
  const snippets = renderSnippets(code);

  it('cover every language the switch offers', () => {
    expect(Object.keys(snippets).sort()).toEqual(SNIPPET_LANGUAGES.map((l) => l.id).sort());
  });

  for (const { id } of SNIPPET_LANGUAGES) {
    it(`${id} posts to the render route with a bearer key and a data object`, () => {
      const snippet = snippets[id];
      expect(snippet).toContain(`${API_ORIGIN}${publicRenderPath(code)}`);
      expect(snippet).toMatch(/Bearer tply_live_/);
      expect(snippet).toContain('firstName');
      expect(snippet).toContain('isMember');
    });
  }

  it('the paths match the server’s route patterns', () => {
    expect(publicRenderPath(code)).toBe(PUBLIC_RENDER_ROUTE.replace(':shortCode', code));
    expect(publicTemplatePath(code)).toBe(PUBLIC_TEMPLATE_ROUTE.replace(':shortCode', code));
  });

  it('the list call reads the templates route', () => {
    expect(publicTemplatesPath()).toBe(PUBLIC_TEMPLATES_ROUTE);
    expect(listSnippet()).toContain(`${API_ORIGIN}${publicTemplatesPath()}`);
  });

  it('the metadata call reads the template route', () => {
    expect(metaSnippet(code)).toContain(`${API_ORIGIN}${publicTemplatePath(code)}`);
  });

  describe('the send example', () => {
    const send = sendSnippets(code);
    it('covers every language the switch offers', () => {
      expect(Object.keys(send).sort()).toEqual(SNIPPET_LANGUAGES.map((l) => l.id).sort());
    });
    for (const { id } of SNIPPET_LANGUAGES) {
      it(`${id} reads the title, renders, and hands html and text to the provider`, () => {
        const snippet = send[id];
        expect(snippet).toContain(`${API_ORIGIN}${publicTemplatePath(code)}`);
        expect(snippet).toContain(`${API_ORIGIN}${publicRenderPath(code)}`);
        expect(snippet).toMatch(/title/);
        expect(snippet).toMatch(/html/);
        expect(snippet).toMatch(/text/);
      });
    }
  });

  describe('the error example', () => {
    const errors = errorSnippets(code);
    it('covers every language the switch offers', () => {
      expect(Object.keys(errors).sort()).toEqual(SNIPPET_LANGUAGES.map((l) => l.id).sort());
    });
    for (const { id } of SNIPPET_LANGUAGES) {
      it(`${id} reads missing on a 422 and Retry-After on a 429`, () => {
        const snippet = errors[id];
        expect(snippet).toContain('422');
        expect(snippet).toContain('missing');
        expect(snippet).toContain('429');
        expect(snippet).toContain('Retry-After');
      });
    }
  });
});
