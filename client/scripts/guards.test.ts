import { describe, expect, it } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The contrast guards are only worth having if they run. On their own they are
 * manual scripts, so this pulls them into `bun test` — the same command CI and
 * everyone else already runs — and fails the suite if a token pair, an email
 * default, or the editor theme stops being readable.
 */
const scripts = join(dirname(fileURLToPath(import.meta.url)));

async function runGuard(file: string) {
  const proc = Bun.spawn(['bun', 'run', join(scripts, file)], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const code = await proc.exited;
  const output = (await new Response(proc.stdout).text()) + (await new Response(proc.stderr).text());
  return { code, output };
}

describe('design guards run as part of the suite', () => {
  it('app tokens clear their contrast thresholds', async () => {
    const { code, output } = await runGuard('check-contrast.ts');
    expect(output, output).not.toContain('FAIL');
    expect(code).toBe(0);
  });

  it('email defaults survive a forced inversion', async () => {
    const { code, output } = await runGuard('check-email-dark.ts');
    expect(output, output).not.toContain('FAIL');
    expect(code).toBe(0);
  });

  it('the editor theme is sound in both themes', async () => {
    const { code, output } = await runGuard('check-editor-contrast.ts');
    expect(output, output).not.toContain('FAIL');
    expect(code).toBe(0);
  });

  it('app UI moves and casts shadows on tokens only', async () => {
    const { code, output } = await runGuard('check-motion.ts');
    expect(output, output).not.toContain('FAIL');
    expect(code).toBe(0);
  });
});
