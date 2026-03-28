# Football Sync Module - API-Football Integration

Sistema adaptativo de sincronización de resultados de partidos desde API-Football con optimización dinámica de requests.

## Características

✅ **Sincronización Automática**: Actualiza resultados de partidos en tiempo real
✅ **Optimización Adaptativa**: Ajusta frecuencia de polling según cantidad de partidos y requests disponibles
✅ **Control de Cuota**: Gestión inteligente del límite de 100 requests/día
✅ **Cálculo Automático**: Dispara cálculo de puntos cuando un partido finaliza
✅ **Monitoreo Admin**: Dashboard completo de uso y estadísticas

## Configuración

### 1. Variables de Entorno

Agrega las siguientes variables a `apps/api/.env`:

```bash
# API-Football Configuration
API_FOOTBALL_KEY="tu_api_key_de_api_football"
API_FOOTBALL_BASE_URL="https://v3.football.api-sports.io"
API_FOOTBALL_DAILY_LIMIT=100
MIN_SYNC_INTERVAL_MINUTES=5
MAX_SYNC_INTERVAL_MINUTES=30
TIMEZONE="America/Bogota"
```

### 2. Migración de Base de Datos

```bash
cd apps/api
npx prisma migrate dev --name add_football_sync
npx prisma generate
```

### 3. Instalación de Dependencias

```bash
npm install
```

Las dependencias necesarias ya están en `package.json`:
- `@nestjs/axios`
- `@nestjs/schedule`
- `@nestjs/config`
- `axios`

## Uso

### Vincular Partidos con API-Football

Antes de sincronizar, debes vincular tus partidos locales con IDs de fixtures de API-Football:

```bash
# Opción 1: Via endpoint admin
PATCH /admin/football/match/{matchId}/link
Body: { "externalId": "867890" }

# Opción 2: Via SQL directo
UPDATE Match SET externalId = '867890' WHERE id = 'tu_match_id';
```

### Sincronización Automática

El sistema ejecuta automáticamente los siguientes cron jobs:

| Job | Frecuencia | Propósito |
|-----|-----------|-----------|
| `adaptiveSyncTick` | Cada 1 minuto | Evalúa si debe sincronizar según plan |
| `generateDailyPlan` | Medianoche | Genera plan diario de sincronización |
| `peakHoursSync` | Cada 5 min (9AM-11PM) | Sync agresivo durante horas pico |
| `syncYesterdayResults` | 2AM diario | Finaliza partidos del día anterior |

### Sincronización Manual

**Endpoints Admin** (requieren auth + rol `SUPERADMIN`):

```bash
# Ver estado actual
GET /admin/football/usage

# Sincronizar partidos de hoy manualmente
POST /admin/football/sync-today

# Sincronizar un partido específico
POST /admin/football/sync-match/{matchId}

# Ver plan de sincronización
GET /admin/football/plan

# Ver logs de requests
GET /admin/football/requests/today

# Ver estado del scheduler
GET /admin/football/status
```

## Algoritmo de Optimización

### Estrategias de Sync

El sistema calcula dinámicamente la mejor estrategia según recursos disponibles:

| Estrategia | Requests/Partido | Intervalo | Uso |
|------------|------------------|-----------|-----|
| `AGGRESSIVE` | ≥ 20 | 5-6 min | Pocos partidos, muchos requests |
| `BALANCED` | 10-19 | 7-12 min | Carga normal |
| `CONSERVATIVE` | 5-9 | 15-24 min | Muchos partidos |
| `EMERGENCY` | < 5 | 30 min | Cuota casi agotada |

### Ejemplo de Cálculo

```typescript
// Día con 6 partidos, 80 requests disponibles
REQUESTS_POR_PARTIDO = 80 / 6 = 13 requests
ESTRATEGIA = BALANCED
INTERVALO = 120 min / 13 = ~9 minutos

// Resultado: Sincroniza cada 9 minutos durante partidos en vivo
```

## Respuesta de Endpoints

### GET /admin/football/usage

```json
{
  "today": "2026-06-15",
  "matches": {
    "scheduled": 3,
    "live": 2,
    "finished": 1,
    "total": 6
  },
  "requests": {
    "used": 28,
    "available": 72,
    "budget": 72,
    "limit": 100
  },
  "sync": {
    "intervalMinutes": 8,
    "strategy": "BALANCED",
    "nextSyncIn": "3 min 45 sec",
    "lastSync": "2026-06-15T14:30:22.000Z"
  },
  "forecast": {
    "estimatedTotal": 65,
    "margin": 35,
    "confidence": "high"
  }
}
```

### POST /admin/football/sync-today

```json
{
  "message": "Sync completed successfully",
  "matchesUpdated": 4
}
```

## Flujo de Trabajo

### 1. Configuración Inicial

```bash
# 1. Obtener API key de API-Football
# https://www.api-football.com/

# 2. Configurar .env
API_FOOTBALL_KEY="tu_key_aqui"

# 3. Migrar base de datos
npx prisma migrate dev

# 4. Reiniciar API
npm run api:dev
```

### 2. Vincular Partidos

```bash
# Buscar fixture ID en API-Football para tu competición
# Ejemplo: Copa América 2026, fixture ID 867890

# Vincular partido local
curl -X PATCH http://localhost:3004/admin/football/match/cm123/link \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"externalId": "867890"}'
```

### 3. Monitorear Sincronización

```bash
# Ver uso actual
curl http://localhost:3004/admin/football/usage \
  -H "Authorization: Bearer YOUR_JWT"

# Forzar sync manual si es necesario
curl -X POST http://localhost:3004/admin/football/sync-today \
  -H "Authorization: Bearer YOUR_JWT"
```

## Mapeo de Estados

### API-Football → MatchStatus

| API-Football | Nuestro Status | Descripción |
|--------------|----------------|-------------|
| `TBD`, `NS` | `SCHEDULED` | Programado |
| `1H`, `HT`, `2H`, `LIVE` | `LIVE` | En vivo |
| `FT`, `AET`, `PEN` | `FINISHED` | Finalizado |
| `PST`, `SUSP` | `POSTPONED` | Pospuesto |
| `CANC`, `ABD` | `CANCELLED` | Cancelado |

## Cálculo de Puntos

Cuando un partido cambia a `FINISHED`, se dispara automáticamente:

```typescript
await predictionsService.calculateMatchPoints(matchId);
```

Esto actualiza los puntos de todas las predicciones para ese partido según las reglas de scoring configuradas en cada liga.

## Troubleshooting

### No se están sincronizando partidos

1. **Verificar API key**:
   ```bash
   # Revisar logs del API
   # Buscar: "API_FOOTBALL_KEY not configured"
   ```

2. **Verificar external IDs**:
   ```sql
   SELECT id, externalId FROM Match WHERE externalId IS NOT NULL;
   ```

3. **Revisar cuota diaria**:
   ```bash
   GET /admin/football/usage
   # Si "available": 0, esperar al día siguiente
   ```

### Errores de autenticación (401)

- Verificar que `API_FOOTBALL_KEY` sea válida
- Revisar que la suscripción de API-Football esté activa

### Rate limit excedido (429)

- El sistema automáticamente detiene sync cuando se alcanza el límite
- Revisar `GET /admin/football/requests/today` para ver uso detallado

### Partidos no se actualizan en tiempo real

- Verificar que `Match.externalId` esté configurado
- Revisar que los partidos estén marcados como `LIVE` en API-Football
- Consultar `GET /admin/football/status` para ver si scheduler está corriendo

## Testing

```bash
# Ejecutar tests unitarios
npm run test -- football-sync

# Con coverage
npm run test:cov -- football-sync

# Tests específicos
npm run test -- rate-limiter.service.spec
npm run test -- sync-plan.service.spec
```

## Arquitectura

```
football-sync/
├── dto/
│   └── api-football.dto.ts       # DTOs y tipos
├── services/
│   ├── api-football-client.service.ts   # Cliente HTTP
│   ├── rate-limiter.service.ts          # Control de cuota
│   ├── sync-plan.service.ts             # Optimización adaptativa
│   └── match-sync.service.ts            # Lógica de sync
├── schedulers/
│   └── adaptive-sync.scheduler.ts       # Cron jobs
├── football-sync.controller.ts          # Endpoints admin
├── football-sync.module.ts              # Módulo NestJS
└── README.md                            # Esta documentación
```

## Mejoras Futuras

- [ ] WebSocket/SSE para push de actualizaciones en tiempo real al frontend
- [ ] Cache con Redis para reducir consultas a BD
- [ ] Alertas automáticas vía email cuando se alcanza 90% de cuota
- [ ] Soporte para múltiples competiciones simultáneas
- [ ] Panel de admin visual en el frontend
- [ ] Retry automático con backoff exponencial

## Soporte

Para problemas o preguntas, revisar:
1. Logs del API (`npm run api:dev`)
2. Dashboard de uso (`GET /admin/football/usage`)
3. Documentación de API-Football: https://www.api-football.com/documentation-v3

## Update Notes

- The planning view groups status checks for multiple matches into a single planned request when they share the same sync window.
- Carry-over matches are highlighted as combined status requests, and unlinked matches are marked as link-plus-status batches.
- Event queries are planned only for halftime and final milestones, and only if budget remains; if a fixture returns no useful events, it is marked as non-retryable so the budget is preserved for the rest of the day.
