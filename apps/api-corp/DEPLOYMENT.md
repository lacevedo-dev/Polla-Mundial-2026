# 🚀 Guía de Deployment - API Corporativo

## 📋 Prerequisitos

- ✅ Base de datos MySQL creada: `u875522599_polla_corp`
- ✅ Usuario de BD: `u875522599_polla_corp`
- ✅ Dokploy configurado
- ✅ API principal funcionando

## 🔧 Paso 1: Configurar Variables de Entorno en Dokploy

En el panel de Dokploy, configurar las siguientes variables:

```env
# Base de datos corporativa
# Usar el host real de la BD. `localhost` solo aplica si MySQL corre en el mismo host/contenedor.
CORP_DATABASE_URL=mysql://usuario:password@host:3306/polla_corp?connectionLimit=1&minimumIdle=0
# Activar temporalmente para diagnosticar conexi�n directa MariaDB en logs de arranque.
CORP_DATABASE_STARTUP_PROBE=false
# Fallback de emergencia: permite usar DATABASE_URL si Dokploy no inyecta CORP_DATABASE_URL.
# Mantener false salvo diagn�stico temporal.
CORP_ALLOW_DATABASE_URL_FALLBACK=false

# API Principal (ajustar URL según deployment)
MAIN_API_URL=https://api.pollamundial.com
INTERNAL_API_KEY=<GENERAR_CLAVE_SECRETA_COMPARTIDA>

# JWT (DEBE ser el mismo que el API principal)
JWT_SECRET=<MISMO_SECRET_QUE_API_PRINCIPAL>

# Configuración del servidor
PORT=3001
NODE_ENV=production

# Scheduler de emails corporativo
# Mantener en false salvo que api-corp deba despachar emails directamente.
CORP_EMAIL_DISPATCHER_ENABLED=false
```

### 🔑 Generar INTERNAL_API_KEY

```bash
# Generar clave segura
openssl rand -base64 32
```

**IMPORTANTE:** Esta misma clave debe configurarse en el API principal como `INTERNAL_API_KEY`.

## 🏗️ Paso 2: Deploy desde Dokploy

1. Ir a Dokploy → Aplicaciones
2. Crear nueva aplicación o seleccionar `polla-mundial-2026-apicorp`
3. Configurar:
   - **Repositorio**: `github.com/lacevedo-dev/Polla-Mundial-2026`
   - **Branch**: `main`
   - **Dockerfile**: `apps/api-corp/Dockerfile`
   - **Puerto**: `3001`
4. Agregar variables de entorno (ver Paso 1)
5. Click en **Deploy**

## 🗄️ Paso 3: Inicializar Base de Datos

Una vez que el contenedor esté corriendo:

### Opción A: Desde el contenedor

```bash
# Conectarse al contenedor
docker exec -it <container-name> sh

# Aplicar schema Prisma
cd /app/apps/api-corp
npx prisma db push

# Verificar tablas creadas
npx prisma studio
```

### Opción B: Desde MySQL directamente

```bash
# Conectarse a MySQL
mysql -u u875522599_polla_corp -p u875522599_polla_corp

# Verificar que las tablas se crearon
SHOW TABLES;

# Debería mostrar:
# - CorporateTenant
# - TenantBranding
# - TenantConfig
# - TenantMember
# - TenantSubscription
# - TenantInvitation
# - League
# - LeagueMember
# - LeagueMatch
# - LeagueTournament
# - ScoringRule
# - Prediction
# - Tournament
# - Team
# - Match
# - User
```

## 🔄 Paso 4: Sincronización Inicial

Ejecutar sincronización manual para poblar datos de fútbol:

```bash
# Desde el contenedor
curl -X POST http://localhost:3001/internal/sync \
  -H "x-internal-api-key: <TU_INTERNAL_API_KEY>"
```

O esperar a que los cron jobs ejecuten automáticamente:
- Torneos: cada hora
- Equipos: cada 6 horas
- Partidos: cada 10 minutos

## ✅ Paso 5: Verificación

### Health Check

```bash
curl http://localhost:3001/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "service": "api-corp",
  "version": "0.0.1",
  "timestamp": "2026-06-04T06:00:00.000Z",
  "database": "connected",
  "mainApiUrl": "https://api.pollamundial.com"
}
```

### Verificar Sincronización

```bash
# Conectarse a MySQL
mysql -u u875522599_polla_corp -p u875522599_polla_corp

# Verificar datos sincronizados
SELECT COUNT(*) FROM Tournament;
SELECT COUNT(*) FROM Team;
SELECT COUNT(*) FROM `Match`;
```

### Logs

```bash
# Ver logs del contenedor
docker logs <container-name> -f --tail 100

# Buscar mensajes de sincronización
docker logs <container-name> 2>&1 | grep "Sincronizando"
```

No deber�an aparecer errores recurrentes de `EmailDispatcherScheduler` si `CORP_EMAIL_DISPATCHER_ENABLED=false`.

## 🔐 Paso 6: Configurar INTERNAL_API_KEY en API Principal

En el API principal (puerto 3000), agregar la misma clave:

```env
INTERNAL_API_KEY=<MISMA_CLAVE_QUE_API_CORP>
```

Redeploy del API principal para aplicar cambios.

## 🌐 Paso 7: Configurar Proxy/DNS (Opcional)

Si se usa un proxy reverso (Nginx, Traefik):

```nginx
# Ejemplo Nginx
location /api-corp/ {
    proxy_pass http://localhost:3001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 📊 Monitoreo Post-Deployment

### Verificar Cron Jobs

```bash
# Ver logs de sincronización
docker logs <container-name> 2>&1 | grep "DataSyncService"

# Deberías ver:
# [DataSyncService] Sincronizando torneos...
# [DataSyncService] ✅ 5 torneos sincronizados
# [DataSyncService] Sincronizando equipos...
# [DataSyncService] ✅ 32 equipos sincronizados
# [DataSyncService] Sincronizando partidos...
# [DataSyncService] ✅ 64 partidos sincronizados
```

### Verificar Conectividad con API Principal

```bash
curl http://localhost:3001/health

# Verificar que mainApiUrl esté configurado correctamente
```

## 🐛 Troubleshooting


#### Hostinger / MySQL remoto

Para una base corporativa alojada en Hostinger, usa el host remoto de MySQL, por ejemplo `srv1849.hstgr.io`, no `localhost`, si `api-corp` corre en Dokploy/VPS externo.

Ejemplo sin exponer la contrase�a real:

```env
CORP_DATABASE_URL=mysql://u875522599_polla_corp:<PASSWORD_URL_ENCODED>@srv1849.hstgr.io:3306/u875522599_polla_corp?connectionLimit=1&minimumIdle=1&acquireTimeout=30000
```

Si el log dice `Access denied for user 'u875522599_polla_corp'@'187.77.222.75'`, Hostinger/MySQL est� rechazando la conexi�n desde esa IP p�blica. Debes autorizar `187.77.222.75` en Remote MySQL / Allow remote connections, o crear un usuario con permisos para esa IP/`%`.

### Error: "Cannot connect to database"

```bash
# Verificar credenciales
echo $CORP_DATABASE_URL

# Verificar que MySQL esté corriendo
mysql -u u875522599_polla_corp -p -h localhost

# Verificar permisos
SHOW GRANTS FOR 'u875522599_polla_corp'@'%';
```

Si los logs muestran algo como `Access denied for user '...'@'<IP>'`, el problema no es de pool de Prisma: MySQL rechaz� la conexi�n desde la IP del servidor/contenedor. Autoriza esa IP en el hosting/servidor MySQL o configura `CORP_DATABASE_URL` con un host/usuario que tenga permisos remotos. En Dokploy, evita copiar una URL con `localhost` salvo que la base de datos est� en el mismo host accesible desde el contenedor.

### Error: "INTERNAL_API_KEY no configurada"

```bash
# Verificar variable de entorno
docker exec <container-name> env | grep INTERNAL_API_KEY

# Si no aparece, agregarla en Dokploy y redeploy
```

### Error: "Prisma Client not generated"

```bash
# Regenerar Prisma Client
docker exec <container-name> sh -c "cd /app/apps/api-corp && npx prisma generate"

# Reiniciar contenedor
docker restart <container-name>
```

### Sincronización no funciona

```bash
# Verificar que MAIN_API_URL esté correcto
docker exec <container-name> env | grep MAIN_API_URL

# Probar endpoint interno del API principal
curl https://api.pollamundial.com/internal/status \
  -H "x-internal-api-key: <TU_KEY>"

# Debería retornar: {"ok":true,"service":"api-main","timestamp":"..."}
```

## 🔄 Rollback

Si algo falla, hacer rollback al deployment anterior:

```bash
# En Dokploy, ir a Deployments
# Seleccionar deployment anterior
# Click en "Rollback"
```

## 📝 Checklist Final

- [ ] Variables de entorno configuradas en Dokploy
- [ ] Build exitoso sin errores
- [ ] Contenedor corriendo (puerto 3001)
- [ ] Health check retorna `status: "ok"`
- [ ] Base de datos conectada (`database: "connected"`)
- [ ] Tablas creadas en `u875522599_polla_corp`
- [ ] Sincronización inicial ejecutada
- [ ] Datos de torneos/equipos/partidos presentes
- [ ] INTERNAL_API_KEY configurado en ambos APIs
- [ ] Logs sin errores críticos
- [ ] Cron jobs ejecutándose correctamente

## 🎉 Deployment Exitoso

Una vez completados todos los pasos, el API corporativo estará:

- ✅ Corriendo en puerto 3001
- ✅ Usando BD independiente `u875522599_polla_corp`
- ✅ Sincronizando datos automáticamente
- ✅ Listo para recibir tráfico corporativo

## 📞 Soporte

Si encuentras problemas, revisar:
1. Logs del contenedor
2. Logs de MySQL
3. Variables de entorno
4. Conectividad entre APIs
