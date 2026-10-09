import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The product's hosts and mail domains live in `shared/site.ts` and nowhere
 * else. A literal anywhere else is a second copy of the domain that a move
 * would miss, or mail from a domain the product does not own; a test that
 * needs an address uses a reserved example domain (RFC 2606) instead.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const SCANNED = ['client', 'server', 'shared', 'e2e'];
const HOME = join('shared', 'site.ts');
const SKIP = new Set(['node_modules', '.next', 'dist', 'drizzle', 'test-results', 'playwright-report']);
const HOSTS = /temply\.app|temply\.tacklabs\.co\.uk/;

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.next')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(ts|tsx|mjs|js|json|css|md)$/.test(name)) yield path;
  }
}

describe('the product’s hosts have one home', () => {
  it('names a real host or mail domain only in shared/site.ts', () => {
    const offenders: string[] = [];
    for (const top of SCANNED) {
      for (const path of files(join(ROOT, top))) {
        const relative = path.slice(ROOT.length + 1);
        if (relative === HOME) continue;
        const source = readFileSync(path, 'utf8');
        source.split('\n').forEach((line, index) => {
          if (HOSTS.test(line)) offenders.push(`${relative}:${index + 1}  ${line.trim().slice(0, 90)}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
