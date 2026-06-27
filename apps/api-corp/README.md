# API Corporativo - Polla Mundial 2026

Backend independiente para clientes B2B con base de datos separada.

## 🗄️ Base de Datos

### Configuración

El API corporativo usa su propia base de datos MariaDB independiente del API principal.

**Variables de entorno:**
```env
# BD Corporativa (independiente)
CORP_DATABASE_URL="mysql://user:password@host:3306/polla_corp"

# API Principal (para sincronización)
MAIN_API_URL="https://api.pollamundial.com"
INTERNAL_API_KEY="clave-secreta-compartida"
```

### Migración Inicial

1. **Crear la base de datos:**
```bash
mysql -u root -p
CREATE DATABASE polla_corp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON polla_corp.* TO 'polla_user'@'%';
FLUSH PRIVILEGES;
```

2. **Aplicar schema:**
```bash
cd apps/api-corp
npx prisma db push
```

3. **Generar Prisma Client:**
```bash
npx prisma generate
```

## 🔄 Sincronización de Datos

El API corporativo sincroniza automáticamente:

- **Torneos**: Cada hora
- **Equipos**: Cada 6 horas  
- **Partidos**: Cada 10 minutos

### Sincronización Manual

```bash
# Desde el contenedor
curl -X POST http://localhost:3001/internal/sync \
  -H "x-internal-api-key: YOUR_KEY"
```

## 📦 Deployment

### Docker Build

```bash
docker build -f apps/api-corp/Dockerfile -t polla-api-corp:latest .
```

### Variables de Entorno Requeridas

```env
# Base de datos corporativa
CORP_DATABASE_URL=mysql://user:pass@host:3306/polla_corp

# API Principal
MAIN_API_URL=https://api.pollamundial.com
INTERNAL_API_KEY=secret-key-here

# JWT (compartido con API principal)
JWT_SECRET=same-as-main-api

# Puerto
PORT=3001
NODE_ENV=production
```

### Dokploy

1. Crear nueva aplicación en Dokploy
2. Configurar variables de entorno
3. Conectar al repositorio
4. Seleccionar `apps/api-corp/Dockerfile`
5. Deploy

## 🏗️ Arquitectura

### Módulos Override

El API corporativo usa versiones personalizadas de algunos módulos:

- **PrismaModule**: Usa `@prisma/client-corp` con BD independiente
- **AuthModule**: Stub de `AvatarStorageService` sin dependencias de filesystem
- **EmailModule**: Sin scheduler de auditoría
- **CorpPortalController**: Endpoints `/corp/*` en `src/overrides/corp-portal.controller.ts` (fuente de verdad; `apps/api` re-exporta)

> **Deploy:** los cambios de pronósticos/partidos corporativos deben hacerse en `apps/api-corp/src/overrides/corp-portal.controller.ts` para que Dokploy dispare el build de `api-corp`.

### Módulos Compartidos

Importa del API principal vía alias `@corp-api/*`:

- `UsersModule`
- `CorporateTenantModule`
- `PushNotificationsModule`

### Módulos Propios

- **FootballProxyModule**: Proxy de datos de fútbol desde API principal
- **DataSyncModule**: Sincronización automática de datos
- **CorpHealthModule**: Health check

## 🔧 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Generar Prisma Clients
cd apps/api && npx prisma generate
cd ../api-corp && npx prisma generate

# Iniciar en desarrollo
cd apps/api-corp
npm run start:dev
```

## 📊 Endpoints

### Públicos
- `GET /health` - Health check
- `POST /auth/login` - Login corporativo
- `GET /corp/*` - Endpoints corporativos (requieren JWT)

### Internos
- Sincronización automática vía cron jobs
- No expone endpoints internos públicamente

## 🚀 Próximos Pasos

- [ ] Implementar caché Redis para datos sincronizados
- [ ] Agregar métricas de sincronización
- [ ] Implementar retry logic en sincronización
- [ ] Agregar webhooks para sincronización en tiempo real
- [ ] Separar usuarios corporativos en BD propia
