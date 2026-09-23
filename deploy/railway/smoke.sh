#!/usr/bin/env bash
# Run only against the disposable Docker volume this script creates.
set -euo pipefail
image="${1:-temply:ci}"
name="temply-smoke-$$"
volume="$name-data"
cleanup() {
  result=$?
  trap - EXIT
  if [[ "$result" != 0 ]]; then docker logs "$name" 2>/dev/null || true; fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  exit "$result"
}
trap cleanup EXIT
docker volume create "$volume" >/dev/null

start() {
  docker run -d --name "$name" -p 127.0.0.1::8080 \
    --mount "type=volume,source=$volume,target=/data" \
    -e RAILWAY_ENVIRONMENT_ID=smoke -e RAILWAY_VOLUME_MOUNT_PATH=/data \
    -e NEXT_PUBLIC_APP_URL=http://localhost:8080 \
    -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk \
    -e CLERK_SECRET_KEY=sk_test_placeholder -e INTERNAL_API_SECRET=smoke-secret \
    "$image" >/dev/null
  address="http://$(docker port "$name" 8080/tcp)"
  for ((attempt=0; attempt<60; attempt++)); do
    if curl -fsS --max-time 2 "$address/api/health" 2>/dev/null | jq -e '.ok == true and .db == "ok"' >/dev/null; then
      return
    fi
    if [[ "$(docker inspect -f '{{.State.Running}}' "$name")" != true ]]; then break; fi
    sleep 1
  done
  echo 'Container did not become healthy.' >&2
  return 1
}

start
curl -fsS --max-time 10 "$address/" >/dev/null
curl -fsS --max-time 10 "$address/favicon.svg" >/dev/null
asset=$(docker exec "$name" find /app/client/.next/static -type f -name '*.js' -print -quit)
curl -fsS --max-time 10 "$address/_next/static/${asset#/app/client/.next/static/}" >/dev/null
# Client-supplied identity headers must not bypass the Next.js proxy.
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
  -H 'x-user-id: forged-user' -H 'x-org-id: forged-org' "$address/api/v1/templates")
[[ "$code" == 401 ]]

docker exec "$name" bun -e '
  import { Database } from "bun:sqlite";
  const db = new Database(process.env.SQLITE_DB_PATH);
  db.run("CREATE TABLE deployment_probe (value TEXT NOT NULL)");
  db.run("INSERT INTO deployment_probe VALUES (?)", ["survives replacement"]);
  const content = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Deployment render probe" }] }] });
  db.run("INSERT INTO mails (id,user_id,title,content,short_code,share_token) VALUES (?,?,?,?,?,?)",
    ["probe", "smoke", "Probe", content, "probe", "smoke-token"]);
  db.close();
'
curl -fsS --max-time 10 "$address/api/public/v1/preview/smoke-token" \
  | jq -e '.html | contains("Deployment render probe")' >/dev/null
docker exec -w /app/server "$name" bun scripts/backup-db.ts
docker stop --time 30 "$name" >/dev/null
[[ "$(docker inspect -f '{{.State.ExitCode}}' "$name")" == 0 ]]
docker rm "$name" >/dev/null
start
docker exec "$name" bun -e '
  import { Database } from "bun:sqlite";
  import { readdirSync } from "node:fs";
  const db = new Database(process.env.SQLITE_DB_PATH);
  if (db.query("SELECT value FROM deployment_probe").get()?.value !== "survives replacement") process.exit(1);
  if (db.query("PRAGMA integrity_check").get()?.integrity_check !== "ok") process.exit(1);
  db.close();
  const snapshot = readdirSync(process.env.BACKUP_DIR).find(name => name.endsWith(".db"));
  if (!snapshot) process.exit(1);
  const backup = new Database(`${process.env.BACKUP_DIR}/${snapshot}`, { readonly: true });
  if (backup.query("SELECT value FROM deployment_probe").get()?.value !== "survives replacement") process.exit(1);
  if (backup.query("PRAGMA integrity_check").get()?.integrity_check !== "ok") process.exit(1);
  backup.close();
'

# A dead API must take down the container, even while Next can serve pages.
docker exec "$name" bun -e '
  import { readdirSync, readFileSync } from "node:fs";
  for (const pid of readdirSync("/proc").filter(name => /^\d+$/.test(name))) {
    let command;
    try { command = readFileSync(`/proc/${pid}/cmdline`, "utf8"); } catch { continue; }
    if (command.startsWith("bun\0dist/index.js")) {
      process.kill(Number(pid), "SIGTERM");
      process.exit(0);
    }
  }
  process.exit(1);
'
for ((attempt=0; attempt<30; attempt++)); do
  if [[ "$(docker inspect -f '{{.State.Running}}' "$name")" == false ]]; then break; fi
  sleep 1
done
[[ "$(docker inspect -f '{{.State.Running}}' "$name")" == false ]]
[[ "$(docker inspect -f '{{.State.ExitCode}}' "$name")" != 0 ]]
echo 'Production container passed routing, assets, auth, persistence, backup and shutdown checks.'
