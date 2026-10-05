import { expect, test } from 'bun:test';
import { passwordSignIn } from './session';

const user = { email: 'tester@example.test', password: 'test-password' };

test('activates the newly created session and the requested workspace together', async () => {
  const calls: unknown[] = [];
  await passwordSignIn({ user, orgId: 'org_requested', clerk: {
    client: { signIn: { create: async (params) => {
      calls.push(params);
      return { status: 'complete', createdSessionId: 'session_new' };
    } } },
    setActive: async (params) => {
      calls.push({ session: params.session, organization: params.organization });
      expect(await params.navigate()).toBeUndefined();
    },
  } });
  expect(calls).toEqual([
    { strategy: 'password', identifier: user.email, password: user.password },
    { session: 'session_new', organization: 'org_requested' },
  ]);
});

test('does not activate an incomplete password sign-in or a missing session', async () => {
  for (const result of [
    { status: 'needs_second_factor', createdSessionId: null },
    { status: 'complete', createdSessionId: null },
  ]) {
    let activated = false;
    await expect(passwordSignIn({ user, orgId: 'org_requested', clerk: {
      client: { signIn: { create: async () => result } },
      setActive: async () => { activated = true; },
    } })).rejects.toThrow('Clerk password sign-in did not complete');
    expect(activated).toBe(false);
  }
});
