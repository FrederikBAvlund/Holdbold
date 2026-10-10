#!/bin/sh
set -eu

# Enable on Coolify: use migrations from the NEW image before accepting traffic.
# Coolify's pre-deploy command executes in the previous image instead.
if [ "${RUN_DATABASE_MIGRATIONS:-false}" = "true" ]; then
  ./node_modules/.bin/prisma migrate deploy
fi

exec "$@"
