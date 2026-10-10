#!/usr/bin/env bash
set -euo pipefail
cd /opt/holdbold
# Held until docker exec finishes; skip an overlapping invocation.
exec 9>/var/lock/holdbold-cron.lock
flock -n 9 || exit 0
docker compose --env-file .env.production -f compose.production.yml exec -T app node dist/cron.cjs
