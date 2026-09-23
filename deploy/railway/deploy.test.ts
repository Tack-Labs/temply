import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const deployScript = join(import.meta.dirname, 'deploy.sh');

function release(statuses: string[], health = { ok: true, db: 'ok' }, token = 'test-token') {
  const dir = mkdtempSync(join(tmpdir(), 'temply-deploy-test-'));
  const executable = (name: string, source: string) => writeFileSync(join(dir, name), `#!/bin/bash\nset -euo pipefail\n${source}`, { mode: 0o755 });
  try {
    writeFileSync(join(dir, 'statuses'), statuses.join('\n') + '\n');
    writeFileSync(join(dir, 'health.json'), JSON.stringify(health));
    executable('railway', `
      if [[ "$1" == up ]]; then
        echo uploaded > "$FIXTURE/uploaded"
        echo '{"deploymentId":"new-release"}'
      elif [[ "$1" == deployment && "$2" == list ]]; then
        count=$(cat "$FIXTURE/count" 2>/dev/null || echo 0)
        count=$((count + 1))
        echo "$count" > "$FIXTURE/count"
        status=$(sed -n "\${count}p" "$FIXTURE/statuses")
        if [[ -z "$status" ]]; then exit 1; fi
        printf '[{"id":"old-release","status":"SUCCESS"},{"id":"new-release","status":"%s"}]\\n' "$status"
      else
        exit 1
      fi
    `);
    executable('curl', 'echo checked > "$FIXTURE/checked"\ncat "$FIXTURE/health.json"\n');
    executable('sleep', 'exit 0\n');
    const result = Bun.spawnSync(['bash', deployScript], {
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        FIXTURE: dir,
        RAILWAY_TOKEN: token,
        RAILWAY_SERVICE_ID: 'test-service',
        RAILWAY_PUBLIC_URL: 'https://app.example.com',
        GITHUB_SHA: 'test-commit',
      },
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 10_000,
    });
    return {
      code: result.exitCode,
      error: result.stderr.toString(),
      uploaded: existsSync(join(dir, 'uploaded')),
      checked: existsSync(join(dir, 'checked')),
      polls: existsSync(join(dir, 'count')) ? Number(readFileSync(join(dir, 'count'), 'utf8')) : 0,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('Railway deployment gate', () => {
  test('waits for the uploaded release despite an older healthy deployment', () => {
    const result = release(['BUILDING', 'DEPLOYING', 'SUCCESS']);
    expect(result.code).toBe(0);
    expect(result.polls).toBe(3);
    expect(result.checked).toBe(true);
  });

  for (const status of ['FAILED', 'CRASHED', 'REMOVED', 'SKIPPED']) {
    test(`rejects ${status} despite an older healthy deployment`, () => {
      const result = release(['BUILDING', status]);
      expect(result.code).not.toBe(0);
      expect(result.error).toContain(status);
      expect(result.checked).toBe(false);
    });
  }

  test('rejects an unhealthy public endpoint after deployment succeeds', () => {
    const result = release(['SUCCESS'], { ok: false, db: 'unreachable' });
    expect(result.code).not.toBe(0);
    expect(result.checked).toBe(true);
  });

  test('fails before uploading when the token is missing', () => {
    const result = release(['SUCCESS'], undefined, '');
    expect(result.code).not.toBe(0);
    expect(result.error).toContain('RAILWAY_TOKEN');
    expect(result.uploaded).toBe(false);
  });

  test('refuses an ephemeral SQLite path on Railway', () => {
    const result = Bun.spawnSync(['bash', join(import.meta.dirname, 'start.sh')], {
      env: {
        ...process.env,
        RAILWAY_ENVIRONMENT_ID: 'test',
        RAILWAY_VOLUME_MOUNT_PATH: '',
        NEXT_PUBLIC_APP_URL: 'https://app.example.com',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'placeholder',
        CLERK_SECRET_KEY: 'placeholder',
        INTERNAL_API_SECRET: 'placeholder',
        SQLITE_DB_PATH: 'maily.db',
      },
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 10_000,
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('Attach a Railway volume at /data');
  });
});
