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

echo "[entrypoint] CORP_DEPLOY_STAMP=${CORP_DEPLOY_STAMP:-unset}"

if [ -f /app/apps/api-corp/.build-info.json ]; then
    echo "[entrypoint] Build info: $(cat /app/apps/api-corp/.build-info.json)"
else
    echo "[entrypoint] AVISO: .build-info.json no encontrado — imagen antigua o build incompleto."
fi

# Iniciar la aplicación
exec node dist/main.js
