import type { Received } from './index';

export function resendRoutes(record: (r: Received) => void) {
  return async (req: Request, path: string): Promise<Response | null> => {
    if (req.method === 'POST' && path === '/emails') {
      const body = await req.json();
      record({ method: 'POST', path, body });
      return Response.json({ id: `email_${Math.random().toString(36).slice(2, 10)}` });
    }
    return null;
  };
}
