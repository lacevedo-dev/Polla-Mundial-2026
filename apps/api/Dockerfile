# ==========================================
# Dockerfile para Backend (API)
# Contexto de build: Raíz del monorepo
# Comando de ejemplo: docker build -f apps/api/Dockerfile -t polla-api .
# ==========================================

# ---- Etapa 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar openssl requerido por Prisma en Alpine,
# python3 y build-base requeridos por bcrypt (libreria nativa),
# Chromium y sus dependencias para whatsapp-web.js y puppeteer-core
RUN apk add --no-cache \
    openssl build-base python3 \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont \
    dbus udev

# Indicar a puppeteer que use el Chromium del sistema (no descargar el propio)
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copiar package.json principal y de los workspaces
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Instalar todas las dependencias (usando npm ci con retry para mayor resiliencia)
RUN npm ci --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5 || \
    npm ci --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5 || \
    npm install --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5

# Copiar el código fuente completo del API y el paquete compartido
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Generar cliente Prisma
WORKDIR /app/apps/api
# Prevenir fallo del COPY en runner creando anticipadamente la carpeta vacía si fue izada por npm
RUN mkdir -p /app/apps/api/node_modules
RUN npx prisma generate

# Compilar NestJS (esto generará /dist)
RUN npm run build

# Verificar que puppeteer-core esté disponible para el workspace API
RUN node -e "require('puppeteer-core'); console.log('puppeteer-core OK')"

# ---- Etapa 2: Producción ----
FROM node:22-alpine AS runner

WORKDIR /app

# Instalar openssl necesario para que Prisma funcione en Alpine,
# Chromium + libs para whatsapp-web.js / puppeteer-core en producción
RUN apk add --no-cache \
    openssl \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont \
    dbus udev

# Indicar a puppeteer el ejecutable del sistema
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Setear entorno de producción
ENV NODE_ENV=production \
    WHATSAPP_SESSION_PATH=/data/wwebjs_auth \
    UPLOADS_DIR=/data/uploads

# Copiar los node_modules base del workspace (dependencias izadas)
COPY --from=builder /app/node_modules ./node_modules
# Dependencias aisladas del workspace API (p. ej. puppeteer-core para WhatsApp)
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/package.json ./

# Copiar la carpeta compartida ya construida/tipada
COPY --from=builder /app/packages ./packages

# Copiar los artefactos de la API (incluyendo dependencias especificas si las hay, prisma y dist)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=builder /app/apps/api/package.json ./apps/api/

WORKDIR /app/apps/api

# Directorio para la sesión persistente de WhatsApp Web (LocalAuth).
# Monta un volumen Docker en esta ruta para que la sesión sobreviva redeployments.
# En Dokploy (sin duplicar el mismo Container Path):
#   /var/lib/dokploy/wwebjs/<appName>  →  /data/wwebjs_auth
#   /var/lib/dokploy/uploads/polla-api  →  /data/uploads
# No usar VOLUME aquí: Dokploy monta bind paths y Swarm falla con "duplicate mount point".
RUN mkdir -p /data/wwebjs_auth /data/uploads/avatars /data/uploads/branding

# Puerto donde corre NestJS según tu .env (ej. 3004)
# Asegúrate de pasar el env var correspondiente al levantar el contenedor
EXPOSE 3000

# Arrancar el servidor (migraciones se aplican manualmente en prod, no en cada deploy)
CMD ["node", "dist/apps/api/src/main.js"]
