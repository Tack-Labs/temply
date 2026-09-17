import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Workspaces = { shared: string; second: string; secondUserId: string };

/** Written by the setup project; the ids Clerk gave the run's two workspaces. */
export const WORKSPACES_FILE = join(import.meta.dirname, '..', '.auth', 'workspaces.json');

export function readWorkspaces(): Workspaces {
  return JSON.parse(readFileSync(WORKSPACES_FILE, 'utf8')) as Workspaces;
}
