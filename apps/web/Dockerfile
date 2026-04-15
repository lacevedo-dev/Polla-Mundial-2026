# ==========================================
# Dockerfile para Frontend (Web)
# Contexto de build: Raíz del monorepo
# Comando de ejemplo: docker build -f apps/web/Dockerfile -t polla-web .
# ==========================================

# ---- Etapa 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# ARG para invalidar caché de dependencias cuando cambie package-lock.json
ARG DEPS_CACHEBUST=1

# Copiar configuración de dependencias y lockfiles
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Instalar dependencias
RUN npm ci

# ARG CACHEBUST debe ir ANTES del COPY de fuentes para que un valor dinámico
# invalide el cache de Docker desde esta capa hacia adelante (COPY + build).
# Pasa --build-arg CACHEBUST=$(date +%s) desde Dokploy para forzar rebuild.
ARG CACHEBUST=1

# Copiar el todo el código del frontend y el paquete compartido
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# DEBUG: verifica que el código clonado tiene los fixes del error #185
# (Esto se puede eliminar una vez confirmado el deploy correcto)
RUN echo "=== DEBUG: CACHE_VERSION en dashboard.store ===" && \
    grep "CACHE_VERSION" apps/web/stores/dashboard.store.ts || \
    echo "WARN: archivo no encontrado o sin CACHE_VERSION"
RUN echo "=== DEBUG: lineas de isValidStats en dashboard.store ===" && \
    grep -c "isValidStats" apps/web/stores/dashboard.store.ts || echo "0"
RUN echo "=== DEBUG: git commit del clone ===" && \
    cat apps/web/stores/dashboard.store.ts | wc -l

# Configuración de variables públicas de Vite en build-time
# Se usa la URL de producción por defecto si no se pasa como --build-arg
ARG VITE_API_URL=https://api-polla.agildesarrollo.com.co
ENV VITE_API_URL=${VITE_API_URL}
RUN test -n "$VITE_API_URL" || (echo "ERROR: VITE_API_URL is required for frontend production build." && exit 1)

# Construir el proyecto Vite para produccion
WORKDIR /app/apps/web
RUN echo "Cache bust: $CACHEBUST" && npm run build

# ---- Etapa 2: Servidor (Nginx) ----
FROM nginx:alpine

# Limpiar assets por defecto de nginx y añadir configuración (espera nginx.conf en web)
RUN rm -rf /usr/share/nginx/html/*
RUN rm /etc/nginx/conf.d/default.conf

# Copiamos la configuración de Nginx desde apps/web
COPY apps/web/nginx.conf /etc/nginx/conf.d/

# Copiamos la salida generada de la construcción del frontend 
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Exponer el puerto
EXPOSE 3003

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
