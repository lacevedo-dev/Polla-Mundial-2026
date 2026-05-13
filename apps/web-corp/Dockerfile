# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/web-corp/package.json ./apps/web-corp/

RUN npm ci --workspace=@polla-2026/web-corp --ignore-scripts

COPY apps/web-corp/ ./apps/web-corp/

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run corp:build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/apps/web-corp/dist /usr/share/nginx/html
COPY apps/web-corp/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
