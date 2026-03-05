# ==========================================
# Dockerfile para Frontend (Web)
# Contexto de build: Raíz del monorepo
# Comando de ejemplo: docker build -f apps/web/Dockerfile -t polla-web .
# ==========================================

# ---- Etapa 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar configuración de dependencias y lockfiles
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Instalar dependencias
RUN npm ci

# Copiar el todo el código del frontend y el paquete compartido
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# Construir el proyecto Vite para produccion
# Como estamos usando workspaces podemos hacerlo desde root o app
WORKDIR /app/apps/web
RUN npm run build

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
