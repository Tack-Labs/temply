import type { APIRequestContext } from '@playwright/test';

/** The smallest document the editor and the renderer accept. */
export const EMPTY_DOC = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello from e2e' }] }] });

/** A 1×1 transparent PNG: real magic bytes, so the server's type sniff accepts it. */
export const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

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
  // A missing row fails by name rather than as a property read off undefined.
  const named = async <T extends { name: string }>(path: string, key: string, name: string, what: string): Promise<T> => {
    const res = await request.get(path);
    if (!res.ok()) throw new Error(`${what}s: ${res.status()}`);
    const row = ((await res.json())[key] as T[]).find((r) => r.name === name);
    if (!row) throw new Error(`no ${what} named ${name}`);
    return row;
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
    /** A brand the page made, read back so the test can own its id and
     *  read its stored theme. Reading is not tracking: a brand that has
     *  to outlive the test is handed over with `trackBrand` later. */
    brandNamed(name: string) { return named<{ id: string; theme: string; name: string }>('/api/v1/brands', 'brands', name, 'brand'); },
    /** The stored name is the given stem plus the extension the server
     *  sniffed, and the URL is where the fake ImageKit serves it from. */
    async uploadAsset(fileName: string): Promise<{ id: string; name: string; url: string }> {
      const res = await request.post('/api/v1/assets', { multipart: { file: { name: fileName, mimeType: 'image/png', buffer: PNG_1x1 } } });
      if (!res.ok()) throw new Error(`uploadAsset: ${res.status()} ${await res.text()}`);
      const { asset } = await res.json();
      remember(made.assets, asset.id);
      return { id: asset.id, name: asset.name, url: asset.url };
    },
    trackAsset(id: string): void { remember(made.assets, id); },
    assetNamed(name: string) { return named<{ id: string; url: string; name: string }>('/api/v1/assets', 'assets', name, 'asset'); },
    trackApiKey(id: string): void { remember(made.apiKeys, id); },
    apiKeyNamed(name: string) { return named<{ id: string; name: string }>('/api/v1/api-keys', 'keys', name, 'API key'); },
    /** Every delete is attempted: one that fails must not leave the rest
     *  behind for the run, so the failures are gathered and thrown as one. */
    async cleanup(): Promise<void> {
      const failed: string[] = [];
      const attempt = async (work: Promise<void>) => {
        try {
          await work;
        } catch (error) {
          failed.push(error instanceof Error ? error.message : String(error));
        }
      };
      for (const id of [...made.templates]) await attempt(this.deleteTemplate(id));
      for (const id of made.brands) await attempt(del(`/api/v1/brands/${id}`, 'deleteBrand'));
      for (const id of made.assets) await attempt(del(`/api/v1/assets/${id}`, 'deleteAsset'));
      for (const id of made.apiKeys) await attempt(del(`/api/v1/api-keys/${id}`, 'revokeApiKey'));
      if (failed.length) throw new Error(`cleanup: ${failed.length} delete(s) failed\n${failed.join('\n')}`);
    },
  };
}
