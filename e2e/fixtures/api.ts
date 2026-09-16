import type { APIRequestContext } from '@playwright/test';

/** The smallest document the editor and the renderer accept. */
export const EMPTY_DOC = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello from e2e' }] }] });

/**
 * Seeds through the app's own API, as the browser would: `page.request`
 * carries the signed-in cookies through the Next proxy, which adds the
 * identity headers the API trusts. Everything made here, or handed over
 * with `track`, is deleted at the end of the test that made it.
 */
export function makeApi(request: APIRequestContext) {
  const made: string[] = [];
  return {
    async createTemplate(opts: { title: string; content?: string }): Promise<{ id: string; title: string }> {
      const res = await request.post('/api/v1/templates', { data: { title: opts.title, content: opts.content ?? EMPTY_DOC } });
      if (!res.ok()) throw new Error(`createTemplate: ${res.status()} ${await res.text()}`);
      const { template } = await res.json();
      made.push(template.id);
      return { id: template.id, title: template.title };
    },
    /** A template the test made through the page rather than here, so the
     *  cleanup owns it from the moment its id is known. */
    track(id: string): void {
      if (!made.includes(id)) made.push(id);
    },
    async deleteTemplate(id: string): Promise<void> {
      const res = await request.delete(`/api/v1/templates/${id}`);
      if (!res.ok() && res.status() !== 404) throw new Error(`deleteTemplate: ${res.status()}`);
      const i = made.indexOf(id);
      if (i >= 0) made.splice(i, 1);
    },
    async cleanup(): Promise<void> {
      for (const id of [...made]) await this.deleteTemplate(id);
    },
  };
}
