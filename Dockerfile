# ---- Etapa 1: Build ----
FROM node:20-alpine AS build

# Configurar directorio de trabajo
WORKDIR /app

# Copiar configuracion de dependencias
COPY package*.json ./

# Instalar todas las dependencias
RUN npm ci || npm install

# Copiar el resto de archivos
COPY . .

# Construir el proyecto Vite para produccion
RUN npm run build

# ---- Etapa 2: Servidor (Nginx) ----
FROM nginx:alpine

# Copiar nuestra configuracion personalizada
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/

# Copiar los assets estaticos generados
COPY --from=build /app/dist /usr/share/nginx/html

# Exponer el puerto
EXPOSE 3003

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
