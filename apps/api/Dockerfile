# ==========================================
# Dockerfile para Backend (API)
# Contexto de build: Raíz del monorepo
# Comando de ejemplo: docker build -f apps/api/Dockerfile -t polla-api .
# ==========================================

# ---- Etapa 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar openssl requerido por Prisma en Alpine,
# python3 y build-base requeridos por bcrypt (libreria nativa)
RUN apk add --no-cache openssl build-base python3

# Copiar package.json principal y de los workspaces
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Instalar todas las dependencias (usando npm ci con retry para mayor resiliencia)
RUN npm ci --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5 || \
    npm ci --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5 || \
    npm ci

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

# ---- Etapa 2: Producción ----
FROM node:22-alpine AS runner

WORKDIR /app

# Instalar openssl necesario para que Prisma funcione en Alpine
RUN apk add --no-cache openssl

# Setear entorno de producción
ENV NODE_ENV=production

# Copiar los node_modules base del workspace (dependencias izadas)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copiar la carpeta compartida ya construida/tipada
COPY --from=builder /app/packages ./packages

# Copiar los artefactos de la API (incluyendo dependencias especificas si las hay, prisma y dist)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=builder /app/apps/api/package.json ./apps/api/

WORKDIR /app/apps/api

# Puerto donde corre NestJS según tu .env (ej. 3004)
# Asegúrate de pasar el env var correspondiente al levantar el contenedor
EXPOSE 3000

# Aplicar migraciones pendientes y luego arrancar el servidor
# Usando ";" para que el servidor siempre inicie aunque migrate falle
CMD ["/bin/sh", "-c", "npx prisma migrate deploy; node dist/src/main.js"]
