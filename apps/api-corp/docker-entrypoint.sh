#!/bin/sh
set -e

# Directorio donde se monta el volumen persistente (o donde se sirven los archivos)
UPLOADS_DIR="/app/apps/api-corp/uploads/branding"
# Directorio de respaldo dentro de la imagen Docker
SEED_DIR="/app/apps/api-corp/.seed/branding"

# Crear directorio de uploads si no existe
mkdir -p "$UPLOADS_DIR"

# Si el directorio de uploads está vacío, restaurar desde el seed de la imagen
if [ ! "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    echo "[entrypoint] Volumen de branding vacío — restaurando archivos desde la imagen..."
    if [ -d "$SEED_DIR" ] && [ "$(ls -A "$SEED_DIR" 2>/dev/null)" ]; then
        cp -r "$SEED_DIR"/* "$UPLOADS_DIR"/ 2>/dev/null || true
        echo "[entrypoint] Archivos de branding restaurados."
    else
        echo "[entrypoint] No hay archivos seed disponibles."
    fi
else
    echo "[entrypoint] Volumen de branding ya tiene contenido — se conserva."
fi

# Sincronizar schema Prisma con la BD corporativa (polla_corp).
# api-corp no usa migrate deploy; db push aplica columnas nuevas como penaltyHomeScore.
if [ -n "${CORP_DATABASE_URL:-}" ] || [ -n "${DATABASE_URL:-}" ]; then
    echo "[entrypoint] Aplicando schema Prisma (db push)..."
    MAX_RETRIES=5
    ATTEMPT=1
    until npx prisma db push --skip-generate; do
        if [ "$ATTEMPT" -ge "$MAX_RETRIES" ]; then
            echo "[entrypoint] ERROR: prisma db push falló tras ${MAX_RETRIES} intentos."
            exit 1
        fi
        echo "[entrypoint] Reintentando db push (${ATTEMPT}/${MAX_RETRIES}) en 5s..."
        ATTEMPT=$((ATTEMPT + 1))
        sleep 5
    done
    echo "[entrypoint] Schema corporativo sincronizado."
else
    echo "[entrypoint] WARN: CORP_DATABASE_URL no definida; se omite db push."
fi

# Iniciar la aplicación
exec node dist/main.js
