#!/bin/bash
set -euo pipefail

# Deploy and (re)schedule the cache-build cron job on Fly.io.
#
# Prerequisites (set ONCE per environment, then this script is idempotent):
#   fly secrets set --app mitre-riders     CACHE_BUILD_TOKEN=<long random string>
#   fly secrets set --app mitre-riders-job CACHE_BUILD_TOKEN=<same value>
#
# This script consolidates what `schedule-job.sh` and the previous
# `run-job.sh` were doing. We use `fly machine run --schedule` (the modern
# replacement for `fly cron`).

APP_NAME="mitre-riders-job"
SCHEDULE="0 2 * * *" # Daily at 02:00 UTC.

echo "Deploying cache build job to fly.io..."

if ! fly apps list | grep -q "^${APP_NAME}\b"; then
  echo "Creating new app ${APP_NAME}..."
  fly apps create "${APP_NAME}"
else
  echo "App ${APP_NAME} already exists; deploying new image..."
fi

fly deploy --config fly.job.toml

echo "Scheduling job (${SCHEDULE} UTC)..."
fly machine run . --app "${APP_NAME}" --schedule "${SCHEDULE}"

cat <<EOF

Done.

To run the job manually right now:
  fly apps restart ${APP_NAME}

To inspect schedule:
  fly machine list --app ${APP_NAME}

To change the schedule for an existing machine:
  fly machine update <machine-id> --schedule "<cron-expression>" --app ${APP_NAME}
EOF
