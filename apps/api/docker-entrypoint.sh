#!/bin/sh
set -e

echo "[entrypoint] Applying Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] Starting API..."
exec node dist/apps/api/src/main.js
