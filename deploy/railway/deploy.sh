#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${RAILWAY_TOKEN:?Set an environment-scoped Railway project token}"
: "${RAILWAY_SERVICE_ID:?Set the Railway service ID}"
: "${RAILWAY_PUBLIC_URL:?Set the public HTTPS site URL}"
command -v railway >/dev/null
command -v jq >/dev/null

# --ci can return when build logs finish. Poll the exact uploaded deployment
# so an older healthy release cannot make this release look successful.
deployment_id=$(railway up --service "$RAILWAY_SERVICE_ID" --detach --json \
  --message "${GITHUB_SHA:-$(git rev-parse HEAD)}" | jq -er '.deploymentId')
echo "Waiting for Railway deployment $deployment_id"
deadline=$((SECONDS + 1200))
previous_status=''
while (( SECONDS < deadline )); do
  status=$(railway deployment list --service "$RAILWAY_SERVICE_ID" --limit 20 --json \
    | jq -r --arg id "$deployment_id" '.[] | select(.id == $id) | .status')
  if [[ "$status" != "$previous_status" ]]; then
    echo "Railway deployment status: ${status:-pending}"
    previous_status="$status"
  fi
  case "$status" in
    SUCCESS)
      curl --fail --silent --show-error --retry 6 --retry-all-errors --retry-delay 5 \
        --connect-timeout 10 --max-time 30 "${RAILWAY_PUBLIC_URL%/}/api/health" \
        | jq -e '.ok == true and .db == "ok"'
      echo "Railway deployment $deployment_id is healthy."
      exit 0
      ;;
    FAILED|CRASHED|REMOVED|SKIPPED|CANCELED|CANCELLED)
      echo "Railway deployment $deployment_id ended with $status; inspect its logs in Railway." >&2
      exit 1
      ;;
  esac
  sleep 10
done
echo "Timed out waiting for Railway deployment $deployment_id (last status: $status)." >&2
exit 1
