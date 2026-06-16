# ================================================================
# Dockerfile — Backend Corporativo (api-corp)
# Contexto de build: Raíz del monorepo
# Comando: docker build -f apps/api-corp/Dockerfile -t polla-api-corp .
#
# Dokploy watch paths (webhook): apps/api-corp/** Y apps/api/**
# (corp-portal y predictions viven en apps/api; sin esto el deploy no se dispara).
# ================================================================

# ---- Etapa 1: Build ----
FROM node:22-alpine AS builder

ARG GIT_COMMIT=unknown
ARG CACHE_BUST=unknown

WORKDIR /app

RUN apk add --no-cache openssl build-base python3

# Copiar manifiestos de los workspaces relevantes
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api-corp/package.json ./apps/api-corp/
COPY packages/shared/package.json ./packages/shared/

# Instalar dependencias (hoisted por npm workspaces)
RUN npm ci --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5 || \
    npm ci --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5 || \
    npm install --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5

# Copiar config de build PRIMERO (invalida caché si cambia)
COPY apps/api-corp/webpack.config.js /app/apps/api-corp/
COPY apps/api-corp/tsconfig.build.json /app/apps/api-corp/

# Copiar código fuente
# api-corp importa módulos de apps/api vía alias @corp-api → apps/api/src
COPY apps/api ./apps/api
COPY apps/api-corp ./apps/api-corp
COPY packages/shared ./packages/shared

# Generar cliente Prisma del API principal (para módulos compartidos)
WORKDIR /app/apps/api
RUN mkdir -p /app/apps/api/node_modules
RUN npx prisma generate

# Generar cliente Prisma corporativo (BD independiente)
# DATABASE_URL es un placeholder solo para satisfacer Prisma 7.x en build time
WORKDIR /app/apps/api-corp
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" npx prisma generate --schema=./prisma/schema.prisma

# Compilar api-corp (webpack bundling, resuelve alias @corp-api en build time)
WORKDIR /app/apps/api-corp
RUN mkdir -p /app/apps/api-corp/node_modules
RUN echo "api-corp build cache=${CACHE_BUST} commit=${GIT_COMMIT}" && npm run build
RUN grep -q 'ranking-breakdown-v5' /app/apps/api-corp/dist/main.js \
    || (echo "ERROR: el bundle no incluye ranking-breakdown-v5 — build incompleto" && exit 1)
RUN printf '{"gitCommit":"%s","builtAt":"%s","rankingBreakdown":true}\n' "${GIT_COMMIT}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > /app/apps/api-corp/.build-info.json

# ---- Etapa 2: Producción ----
FROM node:22-alpine AS runner

ARG GIT_COMMIT=unknown

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV BUILD_GIT_COMMIT=${GIT_COMMIT}
ENV CORP_DEPLOY_STAMP=ranking-breakdown-v5

# Dependencias hoisted
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

COPY --from=builder /app/packages ./packages

# Artefactos de api-corp
COPY --from=builder /app/apps/api-corp/dist ./apps/api-corp/dist
COPY --from=builder /app/apps/api-corp/.build-info.json ./apps/api-corp/.build-info.json
COPY --from=builder /app/apps/api-corp/package.json ./apps/api-corp/

WORKDIR /app/apps/api-corp

EXPOSE 3001

# Seed de archivos de branding — se copia a un directorio de respaldo dentro de la imagen.
# El entrypoint restaura estos archivos al volumen persistente solo si está vacío.
COPY --from=builder /app/apps/api-corp/uploads/branding ./.seed/branding

COPY --from=builder /app/apps/api-corp/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
