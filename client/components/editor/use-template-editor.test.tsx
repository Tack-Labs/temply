import { afterEach, describe, expect, it, mock } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { WorkflowTemplate } from '~/lib/template-stage';

// next/font only resolves inside the Next compiler and the model reaches it
// through the canvas font, so the real module cannot load here to be put back.
mock.module('./canvas-font', () => ({ CANVAS_FONT_FAMILY: 'Inter, sans-serif' }));
const { useTemplateEditor } = await import('./use-template-editor');

// The router comes from Next's own context rather than a `mock.module` of
// next/navigation: the model's graph loads half the editor, and a stand-in
// put back afterwards leaked into the next file that mocks the same module.
const router = { push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {}, back: () => {}, forward: () => {} } as unknown as AppRouterInstance;

afterEach(cleanup);

const row = {
  id: 't1', title: 'Welcome', org_id: 'org', updated_at: 'u', content: null, theme: null, preview_text: null,
  published_at: null, published_content: null, published_theme: null, published_preview_text: null,
  staged_at: null, staged_content: null, staged_theme: null, staged_preview_text: null,
  review_requested_at: null, review_requested_by: null, returned_at: null, return_note: null, live_version: 1,
} as unknown as WorkflowTemplate;

function mount(props: { readOnly?: boolean; template?: WorkflowTemplate | null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(
    () => useTemplateEditor({ template: props.template === undefined ? row : props.template, readOnly: props.readOnly, isAdmin: true }),
    {
      wrapper: ({ children }) => (
        <AppRouterContext.Provider value={router}>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </AppRouterContext.Provider>
      ),
    },
  );
}

describe('beforeStage', () => {
  // A read-only workspace has no autosave, so there is nothing to flush and
  // nothing a navigation could lose. Answering false there left the header's
  // back link, the tab row and "Connect your app" dead without a word.
  it('lets a read-only editor leave: there is nothing to save', async () => {
    const view = mount({ readOnly: true });
    expect(view.result.current.autosave).toBeNull();
    expect(await view.result.current.beforeStage()).toBe(true);
  });

  it('still refuses when a writable editor has no autosave to flush through', async () => {
    const view = mount({ template: null });
    expect(view.result.current.autosave).toBeNull();
    expect(await view.result.current.beforeStage()).toBe(false);
  });
});
