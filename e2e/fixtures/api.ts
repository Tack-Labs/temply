import type { APIRequestContext } from '@playwright/test';

/** The smallest document the editor and the renderer accept. */
export const EMPTY_DOC = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello from e2e' }] }] });

export type TemplateRow = {
  id: string; title: string; preview_text: string | null; content: string; theme: string | null; short_code: string;
  published_at: string | null; updated_at: string; share_token: string | null; has_unpublished_changes: boolean;
};

/**
 * Seeds through the app's own API, as the browser would: `page.request`
 * carries the signed-in cookies through the Next proxy, which adds the
 * identity headers the API trusts. Everything made here, or handed over
 * with a `track*`, is deleted at the end of the test that made it.
 */
export function makeApi(request: APIRequestContext) {
  const made = { templates: [] as string[], brands: [] as string[], assets: [] as string[], apiKeys: [] as string[] };
  const remember = (list: string[], id: string) => { if (!list.includes(id)) list.push(id); };
  const del = async (path: string, what: string) => {
    const res = await request.delete(path);
    if (!res.ok() && res.status() !== 404) throw new Error(`${what}: ${res.status()}`);
  };
  return {
    async createTemplate(opts: { title: string; content?: string; previewText?: string; theme?: string }): Promise<{ id: string; title: string }> {
      const res = await request.post('/api/v1/templates', { data: { title: opts.title, content: opts.content ?? EMPTY_DOC, previewText: opts.previewText, theme: opts.theme } });
      if (!res.ok()) throw new Error(`createTemplate: ${res.status()} ${await res.text()}`);
      const { template } = await res.json();
      remember(made.templates, template.id);
      return { id: template.id, title: template.title };
    },
    async getTemplate(id: string): Promise<TemplateRow> {
      const res = await request.get(`/api/v1/templates/${id}`);
      if (!res.ok()) throw new Error(`getTemplate: ${res.status()}`);
      return (await res.json()).template as TemplateRow;
    },
    /** A template the test made through the page rather than here, so the
     *  cleanup owns it from the moment its id is known. */
    track(id: string): void { remember(made.templates, id); },
    async deleteTemplate(id: string): Promise<void> {
      await del(`/api/v1/templates/${id}`, 'deleteTemplate');
      made.templates = made.templates.filter((t) => t !== id);
    },
    async createBrand(opts: { name: string; theme: string }): Promise<{ id: string }> {
      const res = await request.post('/api/v1/brands', { data: opts });
      if (!res.ok()) throw new Error(`createBrand: ${res.status()} ${await res.text()}`);
      const { brand } = await res.json();
      remember(made.brands, brand.id);
      return { id: brand.id };
    },
    trackBrand(id: string): void { remember(made.brands, id); },
    trackAsset(id: string): void { remember(made.assets, id); },
    trackApiKey(id: string): void { remember(made.apiKeys, id); },
    async cleanup(): Promise<void> {
      for (const id of [...made.templates]) await this.deleteTemplate(id);
      for (const id of made.brands) await del(`/api/v1/brands/${id}`, 'deleteBrand');
      for (const id of made.assets) await del(`/api/v1/assets/${id}`, 'deleteAsset');
      for (const id of made.apiKeys) await del(`/api/v1/api-keys/${id}`, 'revokeApiKey');
    },
  };
}
