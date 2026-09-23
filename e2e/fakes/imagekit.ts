import type { Received } from './index';

const files = new Map<string, { bytes: Uint8Array; type: string; name: string }>();

/** Uploads are kept in memory and served back from /cdn, so an image a test
 *  uploads is one the editor can actually draw. */
export function imagekitRoutes(base: string, record: (r: Received) => void) {
  return async (req: Request, path: string): Promise<Response | null> => {
    if (req.method === 'POST' && path === '/api/v1/files/upload') {
      const form = await req.formData();
      const file = form.get('file');
      const fileName = String(form.get('fileName') ?? 'upload');
      if (!(file instanceof Blob)) return Response.json({ message: 'no file' }, { status: 400 });
      const fileId = `file_${Math.random().toString(36).slice(2, 10)}`;
      files.set(fileId, { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type || 'application/octet-stream', name: fileName });
      record({ method: 'POST', path, body: { fileName, size: file.size, folder: String(form.get('folder') ?? '') } });
      return Response.json({ fileId, name: fileName, url: `${base}/cdn/${fileId}/${encodeURIComponent(fileName)}`, filePath: `/${fileName}`, size: file.size });
    }
    const del = path.match(/^\/api\/v1\/files\/([^/]+)$/);
    if (req.method === 'DELETE' && del) {
      record({ method: 'DELETE', path, body: {} });
      return files.delete(del[1]) ? new Response(null, { status: 204 }) : Response.json({ message: 'not found' }, { status: 404 });
    }
    const cdn = path.match(/^\/cdn\/([^/]+)\//);
    if (req.method === 'GET' && cdn) {
      const f = files.get(cdn[1]);
      return f ? new Response(f.bytes, { headers: { 'content-type': f.type } }) : new Response(null, { status: 404 });
    }
    return null;
  };
}

export function resetImagekit() { files.clear(); }
