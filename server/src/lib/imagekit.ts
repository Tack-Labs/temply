import ImageKit from 'imagekit';

/** The three things the server asks of the image host, narrowed from the
 *  SDK so the e2e stack can stand a fake in: the SDK lets its upload
 *  endpoint be set but hard-codes the host it deletes from. `upload`'s
 *  return keeps the fields the asset row is built from — everything else
 *  ImageKit sends back goes unread. */
export type ImageHost = {
  upload(opts: { file: Buffer; fileName: string; folder: string; useUniqueFileName: boolean }): Promise<{ fileId: string; url: string; size: number; width?: number; height?: number }>;
  deleteFile(fileId: string): Promise<void>;
};

let client: ImageHost | null = null;

/** Built lazily so the server still boots when image uploads are not
 *  configured — listing and deleting the library never needs the keys, and
 *  a URL pasted into the editor never touches ImageKit at all. */
export function getImageKit(): ImageHost | null {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!publicKey || !privateKey || !urlEndpoint) return null;
  if (client) return client;

  const uploadEndpoint = process.env.IMAGEKIT_UPLOAD_ENDPOINT;
  const apiBase = process.env.IMAGEKIT_API_BASE?.replace(/\/$/, '');
  const sdk = new ImageKit({ publicKey, privateKey, urlEndpoint, ...(uploadEndpoint ? { uploadEndpoint } : {}) });

  client = {
    async upload(opts) {
      const result = await sdk.upload(opts);
      return { fileId: result.fileId, url: result.url, size: result.size, width: result.width, height: result.height };
    },
    async deleteFile(fileId) {
      if (!apiBase) {
        await sdk.deleteFile(fileId);
        return;
      }
      // The SDK's own request, re-made against the base we were given. The
      // error shape mirrors the SDK's so callers keep reading the status.
      const res = await fetch(`${apiBase}/v1/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: { authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw Object.assign(new Error(body || `ImageKit delete failed: ${res.status}`), { $ResponseMetadata: { statusCode: res.status } });
      }
    },
  };
  return client;
}

/** Test-only: clears the cached client so a test can flip the env vars and
 *  observe `getImageKit()` return null again, instead of the previous
 *  test's cached instance. */
export function resetImageKitForTests(): void {
  client = null;
}

/** Organisational only — the private key is the access boundary, the folder
 *  just keeps one user's files together in the ImageKit console. */
export function assetFolder(orgId: string): string {
  return `/temply/${orgId}`;
}
