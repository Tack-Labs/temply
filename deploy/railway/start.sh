#!/usr/bin/env bash
set -euo pipefail

: "${NEXT_PUBLIC_APP_URL:?Set NEXT_PUBLIC_APP_URL to the public site URL}"
: "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:?Set the Clerk publishable key}"
: "${CLERK_SECRET_KEY:?Set the Clerk secret key}"
: "${INTERNAL_API_SECRET:?Set a random INTERNAL_API_SECRET}"
: "${SQLITE_DB_PATH:=/data/maily.db}"
: "${PORT:=8080}"

# A missing volume must fail the release, rather than create an ephemeral
# database which appears healthy and disappears at the next deployment.
if [[ -n "${RAILWAY_ENVIRONMENT_ID:-}" ]]; then
  if [[ "${RAILWAY_VOLUME_MOUNT_PATH:-}" != /data || "$SQLITE_DB_PATH" != /data/maily.db ]]; then
    echo 'Attach a Railway volume at /data and set SQLITE_DB_PATH=/data/maily.db.' >&2
    exit 1
  fi
fi
if [[ "$PORT" == 3001 ]]; then
  echo 'PORT=3001 is reserved for the internal API; use 8080 for the web service.' >&2
  exit 1
fi
export SQLITE_DB_PATH
mkdir -p "$(dirname "$SQLITE_DB_PATH")"

api_pid=''
web_pid=''
cleanup() {
  trap - EXIT TERM INT
  for pid in "$web_pid" "$api_pid"; do
    if [[ -n "$pid" ]]; then kill -TERM "$pid" 2>/dev/null || true; fi
  done
  wait || true
}
trap cleanup EXIT
trap 'exit 0' TERM INT

# Only Next listens on the public interface. The API keeps its existing
# loopback binding and trusted-proxy authentication contract.
(cd /app/server && exec env PORT=3001 bun dist/index.js) &
api_pid=$!
(cd /app/client && exec env HOSTNAME=0.0.0.0 PORT="$PORT" API_URL=http://127.0.0.1:3001 node server.js) &
web_pid=$!

# Either process dying must stop the container so Railway can restart both.
status=0
wait -n "$api_pid" "$web_pid" || status=$?
echo "A Temply process exited (status $status); stopping the service." >&2
if [[ "$status" == 0 ]]; then status=1; fi
exit "$status"
