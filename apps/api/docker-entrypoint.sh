#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL no está definida. No se pueden aplicar migraciones."
  exit 1
fi

echo "[entrypoint] Estado de migraciones (antes):"
npx prisma migrate status || true

echo "[entrypoint] Aplicando migraciones Prisma..."
MAX_RETRIES=5
ATTEMPT=1
until npx prisma migrate deploy; do
  if [ "$ATTEMPT" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] ERROR: migrate deploy falló tras ${MAX_RETRIES} intentos."
    exit 1
  fi
  echo "[entrypoint] Reintentando migraciones (${ATTEMPT}/${MAX_RETRIES}) en 5s..."
  ATTEMPT=$((ATTEMPT + 1))
  sleep 5
done

echo "[entrypoint] Migraciones aplicadas correctamente."
npx prisma migrate status || true

echo "[entrypoint] Iniciando API..."
exec node dist/apps/api/src/main.js
