import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/templates(.*)', '/onboarding(.*)']);
const isOnboarding = createRouteMatcher(['/onboarding(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // Without an explicit destination `auth.protect()` answers signed-out
    // requests with a bare 404, which reads as a broken link rather than a
    // prompt to sign in.
    const { orgId } = await auth.protect({
      unauthenticatedUrl: new URL('/login', req.url).toString(),
    });
    // Every account lives in an organization. A signed-in user without an
    // active one — fresh from sign-up, or switched to none — has nowhere to
    // go but onboarding, which makes one.
    if (!orgId && !isOnboarding(req)) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
  }
});

// Only where a request needs Clerk: the pages behind sign-in and the two
// that sign you in, the proxy, and the review page — its serverFetch reads
// auth() to forward whoever is looking. The marketing pages are static and
// read no session on the server; the header learns whether you are signed
// in from the client, which needs no middleware. Running Clerk on every
// page cost a middleware pass per visit to the front page for nothing.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/templates/:path*',
    '/onboarding/:path*',
    '/login/:path*',
    '/sign-up/:path*',
    '/p/:path*',
    '/api/:path*',
  ],
};
