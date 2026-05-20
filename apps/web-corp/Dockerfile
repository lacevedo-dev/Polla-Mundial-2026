# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar manifiestos del workspace para aprovechar caché de Docker
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web-corp/package.json    ./apps/web-corp/

# Instalar TODAS las deps del monorepo (necesario para resolver @polla-2026/shared)
RUN npm ci --ignore-scripts

# Copiar código fuente de lo que necesitamos
COPY packages/shared/ ./packages/shared/
COPY apps/web-corp/   ./apps/web-corp/

# VITE_API_URL se inyecta en build-time (Vite la embebe en el bundle)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run corp:build

# ── Stage 2: Serve con nginx ─────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/apps/web-corp/dist /usr/share/nginx/html
COPY apps/web-corp/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
