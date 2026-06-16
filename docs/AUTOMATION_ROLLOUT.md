# Rollout automatización v2 (pre / en vivo / post)

Guía operativa para activar y validar la automatización de notificaciones por fases.

## Prerrequisitos

- Migraciones aplicadas: `20260616_automation_pre_match_steps`, `20260617_automation_live_steps`
- Football Sync activo (`docs/FOOTBALL_SYNC.md`)
- Canales configurados según necesidad: VAPID (push), WA Web (grupos), SMTP (email)
- Admin → **Procesos automáticos** accesible (rol SUPERADMIN)

## Feature flags

Cada fase tiene un flag independiente. **Todos OFF por defecto.**

| Flag admin | SystemConfig | Variable entorno (override) |
|------------|--------------|----------------------------|
| Pre-partido v2 | `automation:pre_match_v2` | `AUTOMATION_PRE_MATCH_V2` |
| En vivo v2 | `automation:live_phase_v2` | `AUTOMATION_LIVE_PHASE_V2` |
| Post-partido v2 | `automation:post_match_v2` | `AUTOMATION_POST_MATCH_V2` |

**Prioridad:** si la variable de entorno está definida (`true`/`false`), **bloquea** el toggle en admin.

### Activación desde admin (recomendado en staging)

1. Ir a **Admin → Procesos automáticos**
2. Panel **Feature flags v2** → activar en orden:
   1. Pre-partido v2
   2. En vivo v2 (tras validar pre)
   3. Post-partido v2 (tras un partido de prueba en vivo)

### Activación por entorno (prod / Dokploy)

```env
AUTOMATION_PRE_MATCH_V2=true
# AUTOMATION_LIVE_PHASE_V2=true
# AUTOMATION_POST_MATCH_V2=true
```

### Activación por SQL (alternativa)

```sql
INSERT INTO SystemConfig (`key`, `value`) VALUES ('automation:pre_match_v2', 'true')
  ON DUPLICATE KEY UPDATE `value` = 'true';
```

## Secuencia pre-partido (flag ON)

| Checkpoint | Audiencia | Canales |
|------------|-----------|---------|
| T-60 | Todos | Push, in-app |
| T-45 | Solo pendientes | Push, in-app, WA Grupo (nombres) |
| T-30 | Solo pendientes | Push, in-app, WA Grupo |
| T-final | Solo pendientes | Push, in-app, WA Grupo |
| Cierre | Todos | Push, in-app, WA, email |
| Reporte predicciones | Ligas | Email, WA imagen/PDF |

**Última escalada** = `closePredictionMinutes + 5` min antes del kickoff (ej. cierre 15 → alerta T-20).

## Secuencia en vivo (flag ON)

Disparada por Football Sync (no cron propio):

- Inicio partido, medio tiempo, 2.ª parte, fin live → push/in-app/WA
- Cada gol → notificación original + **segundo mensaje WA** con impacto en la polla

## Secuencia post-partido (flag ON)

- Resultado personal (push/in-app) con hora Bogotá
- WA Grupo con top del partido y acertadores
- Reporte final → flujo legacy (email + WA imagen/PDF)

## Checklist QA por fase

### Pre-partido v2

- [ ] Flag ON visible en admin (`source: db`, no locked)
- [ ] Partido con usuarios pendientes recibe escalada T-45/T-30/T-final
- [ ] WA Grupo lista nombres de quienes faltan
- [ ] Usuarios completos solo reciben T-60
- [ ] Modal **Ver mensaje** muestra preview coherente
- [ ] Reintento manual desde celda FAILED funciona

### En vivo v2

- [ ] Partido pasa SCHEDULED → LIVE: mensaje inicio
- [ ] HT y 2.ª parte notificados
- [ ] Gol dispara impacto WA (si hay predicciones)
- [ ] Fin live antes de calcular puntos

### Post-partido v2

- [ ] Partido FINISHED: push/in-app con marcador y puntos
- [ ] WA Grupo con top del partido
- [ ] Reporte final sigue enviándose

## Rollback

1. Desactivar flag en admin **o** `AUTOMATION_*_V2=false` en env **o** SQL `value = 'false'`
2. El sweep vuelve al flujo legacy automáticamente (sin redeploy)
3. Revisar matriz del día por pasos OVERDUE/FAILED

## Observabilidad

- **Matriz del día:** columnas pre / en vivo / post
- **Historial 24h:** filtrar por tipo
- **Config pasos:** toggles canal por paso
- **Preview:** `GET /admin/automation/message-preview?matchId=&step=&channel=`

## Tests locales

```bash
cd apps/api
npx jest src/automation --no-cache
npx tsc -p tsconfig.build.json --noEmit
```
