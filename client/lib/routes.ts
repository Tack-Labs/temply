/**
 * Where someone who is already signed in goes from a door meant for someone
 * who is not: the header's Dashboard button and the login page.
 *
 * It lives here, imports nothing and is not a client module because the login
 * page reads it on the server (a Server Component gets a placeholder, not the
 * value, for a non-component export of a `'use client'` file) and the marketing
 * header reads it in a bundle that must not pull in Clerk.
 */
export const SIGNED_IN_HOME = '/dashboard/templates';
