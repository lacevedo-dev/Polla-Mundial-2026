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

# Schema sync opcional al arranque (desactivado por defecto).
# En producción las migraciones SQL de prisma/migrations/ se aplican manualmente;
# db push en cada deploy puede tardar o bloquear el arranque si el schema ya está al día.
if [ "${CORP_DB_PUSH_ON_START:-false}" = "true" ]; then
    if [ -n "${CORP_DATABASE_URL:-}" ] || [ -n "${DATABASE_URL:-}" ]; then
        echo "[entrypoint] CORP_DB_PUSH_ON_START=true — ejecutando prisma db push..."
        if npx prisma db push --skip-generate; then
            echo "[entrypoint] Schema corporativo sincronizado."
        else
            echo "[entrypoint] WARN: prisma db push falló; iniciando API de todos modos."
        fi
    else
        echo "[entrypoint] WARN: CORP_DB_PUSH_ON_START=true pero falta CORP_DATABASE_URL."
    fi
fi

# Iniciar la aplicación
exec node dist/main.js
