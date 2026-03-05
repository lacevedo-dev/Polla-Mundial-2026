# ---- Etapa 1: Build ----
FROM node:20-alpine AS build

# Configurar directorio de trabajo
WORKDIR /app

# Copiar configuración de dependencias (package.json y package-lock.json si existe)
COPY package*.json ./

# Instalar todas las dependencias
RUN npm ci || npm install

# Copiar el resto de archivos
COPY . .

# Construir el proyecto Vite para producción (crea la carpeta dist)
RUN npm run build

# ---- Etapa 2: Servidor (Nginx) ----
FROM nginx:alpine

# Copiar nuestra configuración personalizada (recomendado para SPA con try_files)
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/

# Copiar los assets estáticos generados al directorio de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Exponer el puerto por el que se despachará el app en Dokploy
EXPOSE 3003

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
