import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { callApi } from './call-api';

export async function serverFetch(path: string, init?: RequestInit) {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  // Forward the resolved user the same way the /api proxy does. Without this
  // the API can only fall back to verifying the Clerk session itself, which
  // needs CLERK_SECRET_KEY — unset in keyless development.
  const { userId, orgId, orgRole } = await auth();

  return callApi(path, {
    ...init,
    headers: {
      ...init?.headers,
      Cookie: cookieHeader,
      'Content-Type': 'application/json',
      'x-user-id': userId || '',
      'x-org-id': orgId || '',
      'x-org-role': orgRole || '',
      'x-internal-token': process.env.INTERNAL_API_SECRET || '',
    },
  });
}
