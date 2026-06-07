# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar manifiestos del workspace para aprovechar caché de Docker
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web-uni/package.json    ./apps/web-uni/

# Instalar deps del monorepo
RUN npm install --ignore-scripts

# Copiar código fuente de lo que necesitamos
COPY packages/shared/ ./packages/shared/
COPY apps/web-uni/   ./apps/web-uni/

# VITE_API_URL se inyecta en build-time (Vite la embebe en el bundle)
ARG VITE_API_URL=https://api-polla-coop.atencionesvirtuales.com.co
ENV VITE_API_URL=$VITE_API_URL

# Slug del tenant corporativo (para enviar X-Tenant-Slug en cada request)
ARG VITE_TENANT_SLUG=coopcanapro
ENV VITE_TENANT_SLUG=$VITE_TENANT_SLUG

RUN npm run build --workspace=@polla-2026/web-uni

# ── Stage 2: Serve con nginx ─────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/apps/web-uni/dist /usr/share/nginx/html
COPY apps/web-uni/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
