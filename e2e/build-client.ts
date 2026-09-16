import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `next build` for the e2e stack, leaving the checkout as it found it.
 * Besides its own dist directory, a build writes two tracked files for
 * whichever distDir it ran with: `next-env.d.ts` is pointed at that
 * directory's route types, and that directory is added to tsconfig's
 * `include`. Both belong to the dev checkout's `.next` — tsconfig cannot
 * list both directories, since each `routes.d.ts` declares the same global
 * types — so the two files are put back the moment the build has finished.
 */
const client = join(import.meta.dirname, '..', 'client');
const kept = ['next-env.d.ts', 'tsconfig.json'].map((file) => {
  const path = join(client, file);
  return { path, content: readFileSync(path) };
});

const build = Bun.spawnSync(['bun', 'run', 'build'], { cwd: client, stdio: ['inherit', 'inherit', 'inherit'] });

for (const { path, content } of kept) writeFileSync(path, content);
process.exit(build.exitCode);
