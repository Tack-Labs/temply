import { toast } from 'sonner';
import { errorMessage, httpDelete, httpGet, httpPost } from './http';

export type Asset = {
  id: string;
  user_id: string;
  imagekit_file_id: string;
  url: string;
  name: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  created_at: string | null;
};

export type AssetList = { assets: Asset[]; usedBytes: number; limitBytes: number | null };

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// SVG is excluded on purpose: Gmail/Outlook strip inline SVG, so it never
// renders in a real email. The server enforces the same list.
export const UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Email-safe: no f-auto (WebP breaks Outlook). w-1200 = 2x the 600px email
// width; q-80 halves the bytes at good quality.
export const EMAIL_TRANSFORM = 'tr=w-1200,q-80';
export const THUMB_TRANSFORM = 'tr=w-240';

export function withTransform(url: string, transform: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${transform}`;
}

/** ImageKit serves every account from ik.imagekit.io; anything else in a
 *  `src` is a URL the user pasted and hosts themselves. */
export function isLibraryUrl(src: string): boolean {
  return /^https:\/\/ik\.imagekit\.io\//.test(src);
}

export type UploadResult = {
  asset: Asset;
  /** Another asset of the user's already carries this name. Not a refusal —
   *  they are different images — but worth a word. */
  duplicateName: boolean;
};

export async function uploadAsset(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  return httpPost<UploadResult>('/api/v1/assets', form as unknown as Record<string, unknown>);
}

/** The one sentence every upload path shows: a warning when the name is
 *  already taken, so the user learns it once and in the same words. */
export function toastUploaded({ asset, duplicateName }: UploadResult) {
  if (duplicateName) {
    toast.warning(`Uploaded — you already have another image named "${asset.name}".`);
  } else {
    toast.success('Image uploaded');
  }
}

export function listAssets(): Promise<AssetList> {
  return httpGet<AssetList>('/api/v1/assets', {});
}

export function assetUsage(id: string): Promise<{ templates: { id: string; title: string }[] }> {
  return httpGet(`/api/v1/assets/${id}/usage`, {});
}

export async function deleteAsset(id: string): Promise<void> {
  await httpDelete(`/api/v1/assets/${id}`);
}

/** The editor's `onImageUpload`: uploads through our API and hands back the
 *  URL with the email-safe transform. Throws (after toasting) so the image
 *  node shows its error state; the server's own sentence is the toast. */
export function createEditorUploader(): (file: Blob) => Promise<string> {
  return async function onImageUpload(file: Blob): Promise<string> {
    const named = file as File;
    if (named.size > MAX_UPLOAD_BYTES) {
      toast.error('Images must be under 5 MB.');
      throw new Error('Image exceeds 5 MB');
    }
    try {
      const result = await uploadAsset(named);
      toastUploaded(result);
      return withTransform(result.asset.url, EMAIL_TRANSFORM);
    } catch (error) {
      toast.error(errorMessage(error) || 'Image upload failed. Please try again.');
      throw error;
    }
  };
}
