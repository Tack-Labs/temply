/**
 * Fails the build when app UI reaches past the motion and shadow tokens.
 *
 * The vocabulary lives in app/globals.css: duration-fast / base / slow and
 * ease-out / in / spring, shadows xs through xl. A numeric duration, an
 * arbitrary curve or a Tailwind shadow that is not on the ladder is a colour
 * outside the token layer by another name — it looks right in one place and
 * drifts everywhere else. Marketing and the docs demos choreograph their own
 * scenes and are left alone, as is the editor core with its `mly:` prefix.
 *
 * Run: bun run check:motion
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app/(app)', 'app/(auth)', 'components', 'hooks'];
const SKIP = ['components/marketing', 'components/docs'];

/** Pattern, and what to reach for instead. */
const RULES: Array<[RegExp, string]> = [
  [/\bduration-\d+\b/, 'use duration-fast, duration-base or duration-slow'],
  [/\bduration-\[/, 'use duration-fast, duration-base or duration-slow'],
  [/\bease-\[/, 'use ease-out, ease-in or ease-spring'],
  [/cubic-bezier\(/, 'use ease-out, ease-in or ease-spring'],
  [/\bshadow-(2xl|inner)\b/, 'shadows run xs through xl, or canvas'],
];

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

let failures = 0;
for (const root of ROOTS) {
  for (const file of walk(join(CLIENT, root))) {
    const rel = relative(CLIENT, file);
    if (SKIP.some((s) => rel.startsWith(s))) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const [pattern, fix] of RULES) {
        const hit = pattern.exec(line);
        if (hit) {
          failures += 1;
          console.log(`  FAIL  ${rel}:${i + 1}  ${hit[0]} — ${fix}`);
        }
      }
    });
  }
}

if (failures > 0) {
  console.log(`\n${failures} place${failures === 1 ? '' : 's'} move${failures === 1 ? 's' : ''} outside the motion tokens.`);
  process.exit(1);
}
console.log('Every transition and shadow in the app UI sits on a token.');
