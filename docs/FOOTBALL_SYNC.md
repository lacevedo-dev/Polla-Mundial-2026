# Football Sync - Sincronización con API-Football

## 🎯 Descripción

Sistema de sincronización automática de resultados de partidos desde API-Football con optimización adaptativa del límite de 100 requests/día.

### Características

- ✅ Sincronización automática de resultados en tiempo real
- ✅ Optimización dinámica según cantidad de partidos y requests disponibles
- ✅ Cálculo automático de puntos cuando finaliza un partido
- ✅ Dashboard admin para monitoreo

---

## ⚡ Setup Rápido

### 1. Obtener API Key

Registrarse en https://www.api-football.com/ y copiar la API key del dashboard.

### 2. Configurar Variables de Entorno

En `apps/api/.env`:

```bash
API_FOOTBALL_KEY="tu_api_key_aqui"
API_FOOTBALL_BASE_URL="https://v3.football.api-sports.io"
API_FOOTBALL_DAILY_LIMIT=100
MIN_SYNC_INTERVAL_MINUTES=5
MAX_SYNC_INTERVAL_MINUTES=30
TIMEZONE="America/Bogota"
```

### 3. Aplicar Migración de Base de Datos

**Ya fue aplicada automáticamente con `prisma migrate dev`**

Si necesitas aplicarla manualmente, el SQL está en:
`apps/api/prisma/migrations/20260319_add_football_sync_tables/migration.sql`

### 4. Iniciar API

```bash
npm run api:dev
```

---

## 🔧 Uso

### Vincular Partidos con API-Football

Antes de sincronizar, vincular partidos locales con IDs de fixtures de API-Football:

```bash
# Via endpoint admin
PATCH /admin/football/match/{matchId}/link
Body: { "externalId": "867890" }
```

### Endpoints Admin Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/admin/football/usage` | GET | Ver uso y plan de sincronización |
| `/admin/football/sync-today` | POST | Forzar sync manual |
| `/admin/football/sync-match/:id` | POST | Sync de partido específico |
| `/admin/football/match/:id/link` | PATCH | Vincular partido con fixture ID |
| `/admin/football/plan` | GET | Plan diario detallado |
| `/admin/football/requests/today` | GET | Logs de requests |

### Ejemplo: Ver Estado Actual

```bash
curl http://localhost:3004/admin/football/usage \
  -H "Authorization: Bearer YOUR_JWT"
```

Respuesta:
```json
{
  "today": "2026-03-19",
  "requests": {
    "used": 12,
    "available": 88,
    "limit": 100
  },
  "sync": {
    "intervalMinutes": 7,
    "strategy": "BALANCED",
    "nextSyncIn": "2 min 30 sec"
  }
}
```

---

## 🤖 Sincronización Automática

El sistema ejecuta automáticamente:

- **Cada 1 min**: Evalúa si debe sincronizar según plan
- **Cada 5 min (9AM-11PM)**: Sync agresivo durante horas pico
- **Medianoche**: Genera plan diario
- **2AM**: Finaliza partidos del día anterior

### Estrategias Adaptativas

| Partidos | Requests Disponibles | Estrategia | Intervalo |
|----------|---------------------|------------|-----------|
| 1-2 | 80+ | AGGRESSIVE | 5 min |
| 3-6 | 50+ | BALANCED | 7-10 min |
| 7-10 | 30+ | CONSERVATIVE | 15-20 min |
| Cualquiera | < 5 | EMERGENCY | 30 min |

---

## 🔍 Cómo Funciona

### Optimización Dinámica

```
Ejemplo: 6 partidos, 80 requests disponibles
→ 80 ÷ 6 = 13 requests por partido
→ 120 min ÷ 13 = 9 minutos de intervalo
→ Estrategia: BALANCED
→ Resultado: Sync cada 9 min durante partidos en vivo
```

### Flujo de Actualización

```
14:00 → Partido inicia → Status: LIVE
14:09 → Sync (Colombia 0-0 Brasil)
14:18 → Sync (Colombia 1-0 Brasil)
16:00 → Partido finaliza → Status: FINISHED
       → Última sync (2-1)
       → Calcula puntos automáticamente
```

---

## 🛠️ Troubleshooting

### No sincroniza partidos

1. Verificar que partidos tienen `externalId`:
   ```sql
   SELECT id, externalId FROM Match WHERE externalId IS NOT NULL;
   ```

2. Verificar API key en `.env`
3. Revisar logs: buscar `[FootballSyncModule]`

### Error 401 Unauthorized

- Verificar que `API_FOOTBALL_KEY` sea válida
- Renovar suscripción en api-football.com si expiró

### Límite de requests excedido

- Revisar uso: `GET /admin/football/usage`
- El límite se resetea a medianoche UTC
- Sistema automáticamente detiene sync al alcanzar límite

---

## 📊 Tablas de Base de Datos

### ApiFootballRequest
Log de requests a la API con endpoint, parámetros y cantidad de partidos obtenidos.

### DailySyncPlan
Plan diario con estrategia, intervalo calculado y budget de requests.

### Match (actualizado)
- `externalId`: ID del fixture en API-Football
- `lastSyncAt`: Última sincronización
- `syncCount`: Contador de syncs

---

## 📚 Documentación Técnica

Ver documentación completa en: [`apps/api/src/football-sync/README.md`](../apps/api/src/football-sync/README.md)

---

**Versión**: 1.0.0
**Compatibilidad**: NestJS 11.x, Prisma 7.x, Node 22+
