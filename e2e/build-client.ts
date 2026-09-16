import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `next build` for the e2e stack, leaving the checkout as it found it.
 * Besides its own dist directory, a build writes two tracked files for
 * whichever distDir it ran with: `next-env.d.ts` is pointed at that
 * directory's route types, and that directory is added to tsconfig's
 * `include`. Both belong to the dev checkout's `.next` — tsconfig cannot
 * list both directories, since each `routes.d.ts` declares the same global
 * types — so the two files are put back the moment the build has finished.
 *
 * The snapshot lives on disk, not in memory: Playwright kills the build's
 * whole process group when it gives up or is interrupted, and nothing in
 * here runs after that. A snapshot a killed build left behind is restored
 * by the next run before it builds.
 */
const client = join(import.meta.dirname, '..', 'client');
const tracked = ['next-env.d.ts', 'tsconfig.json'];
const snapshot = join(import.meta.dirname, '.tmp', 'client-tracked.json');

function restore(): void {
  const kept = JSON.parse(readFileSync(snapshot, 'utf8')) as Record<string, string>;
  for (const file of tracked) writeFileSync(join(client, file), kept[file]);
  rmSync(snapshot);
}

if (existsSync(snapshot)) restore();
mkdirSync(join(import.meta.dirname, '.tmp'), { recursive: true });
writeFileSync(snapshot, JSON.stringify(Object.fromEntries(tracked.map((file) => [file, readFileSync(join(client, file), 'utf8')]))));

const build = Bun.spawnSync(['bun', 'run', 'build'], { cwd: client, stdio: ['inherit', 'inherit', 'inherit'] });

restore();
process.exit(build.signalCode ? 1 : build.exitCode);
