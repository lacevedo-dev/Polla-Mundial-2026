# Rollout automatización v2 (pre / en vivo / post)

Guía operativa para activar y validar la automatización de notificaciones por fases.

## Prerrequisitos

- Migraciones aplicadas: `20260616_automation_pre_match_steps`, `20260617_automation_live_steps`
- Football Sync activo (`docs/FOOTBALL_SYNC.md`)
- Canales configurados según necesidad: VAPID (push), WA Web (grupos), SMTP (email)
- Admin → **Procesos automáticos** accesible (rol SUPERADMIN)

## Control operativo (lo que importa en prod)

El envío automático **no depende** de activar los feature flags v2. Lo que gobierna el runtime es:

| Control | Dónde | Efecto |
|---------|--------|--------|
| Toggle **Activo** por paso | Admin → Config pasos | Si OFF, el orquestador omite ese paso |
| Overrides de canal | Admin → Config pasos | Push / WA Grupo / email por paso |
| WA Web conectado | Admin → WhatsApp | Jobs `PENDING` → dispatcher los envía |
| Cron `runMatchAutomationSweep` | Cada minuto | Pre-partido + cierre + reportes + post |

**Mínimo para un partido (ej. 7 p.m.):** Football Sync ON, pasos relevantes **Activo** ON, WA Web **CONNECTED** y ligas con grupo asignado.

### Sweep unificado (cron)

Cada minuto ejecuta siempre, en orden:

1. Orquestador pre-partido (T-60 + escaladas T-45/T-30/T-final)
2. Cierre de predicciones (`sendPredictionClosingAlerts`)
3. Notificaciones de resultado (v2 si flag post ON, si no legacy)
4. Reporte de predicciones + reporte final pendiente
5. Cierre de partidos stale sin enlace

Incluye **catch-up**: si el cron pierde la ventana de 5 min de un checkpoint, reintenta mientras el kickoff no haya pasado (escaladas y cierre).

Ventana del contexto: lookback **120 min** y retención **130 min** post-kickoff para partidos LIVE.

## Feature flags v2 (opcionales / rollout)

Los flags siguen existiendo en admin para rollout gradual y métricas, pero **ya no bloquean** pre-partido ni en vivo.

| Flag admin | SystemConfig | Variable entorno | Uso actual |
|------------|--------------|------------------|------------|
| Pre-partido v2 | `automation:pre_match_v2` | `AUTOMATION_PRE_MATCH_V2` | Referencia en admin; sweep usa orquestador v2 siempre |
| En vivo v2 | `automation:live_phase_v2` | `AUTOMATION_LIVE_PHASE_V2` | Referencia en admin; en vivo obedece toggle por paso |
| Post-partido v2 | `automation:post_match_v2` | `AUTOMATION_POST_MATCH_V2` | **Sí cambia runtime:** v2 vs legacy en resultados personalizados |

**Prioridad env:** si la variable está definida (`true`/`false`), bloquea el toggle en admin.

Persistencia toggles por paso: `SystemConfig` key `automation:step_overrides` (JSON por `AutomationStep`).

## Secuencia pre-partido

| Checkpoint | Audiencia | Canales |
|------------|-----------|---------|
| T-60 | Todos | Push, in-app, WA Grupo |
| T-45 | Solo pendientes | Push, in-app, WA Grupo (nombres) |
| T-30 | Solo pendientes | Push, in-app, WA Grupo |
| T-final | Solo pendientes | Push, in-app, WA Grupo |
| Cierre | Todos | Push, in-app, WA, email |
| Reporte predicciones | Ligas | Email, WA imagen/PDF |

**Última escalada** = `closePredictionMinutes + 5` min antes del kickoff (ej. cierre 15 → alerta T-20).

WA Grupo usa el mismo patrón que goles y resultados: `WhatsappGroupService.enqueueNotification()` → job `PENDING` → dispatcher.

## Secuencia en vivo

Disparada por **Football Sync** (transiciones de status API-Football), no por cron propio:

- Inicio partido, medio tiempo, 2.ª parte, fin live → push/in-app/WA (toggle **Activo** por paso)
- Cada gol → notificación directa (como siempre) + **impacto WA** si el paso GOAL_IMPACT está activo

## Secuencia post-partido

- Resultado personal: v2 si `post_match_v2` ON, si no flujo legacy
- WA Grupo con top del partido (v2)
- Reporte final → email + WA imagen/PDF (evento + cola)

## Checklist QA por fase

### Pre-partido

- [ ] Pasos T-60 … cierre **Activo** ON en Config pasos
- [ ] Partido con pendientes recibe escalada T-45/T-30/T-final (o catch-up en el minuto siguiente)
- [ ] WA Grupo lista nombres de quienes faltan
- [ ] Usuarios completos solo reciben T-60
- [ ] Cierre dispara aunque pre-partido v2 flag esté OFF
- [ ] Modal **Ver mensaje** muestra preview coherente
- [ ] Reintento manual desde celda FAILED funciona

### En vivo

- [ ] Pasos inicio / HT / 2H / fin **Activo** ON
- [ ] Partido SCHEDULED → LIVE: mensaje inicio (sin depender de `live_phase_v2`)
- [ ] HT y 2.ª parte notificados
- [ ] Gol dispara WA (flujo directo match-sync)
- [ ] Fin live antes de calcular puntos

### Post-partido

- [ ] Partido FINISHED: push/in-app con marcador y puntos
- [ ] WA Grupo con top del partido
- [ ] Reporte final sigue enviándose

## Rollback / pausar

1. **Por paso:** Admin → Config pasos → desactivar **Activo** en el paso concreto (recomendado)
2. **Post v2 → legacy:** flag post OFF o `AUTOMATION_POST_MATCH_V2=false`
3. **Env override:** `AUTOMATION_*_V2=false` solo afecta post-partido v2 en runtime; pre/en vivo siguen por toggles de paso
4. Revisar matriz del día por pasos OVERDUE/FAILED; usar **REENVIAR** si hace falta recuperar uno puntual

## Observabilidad

- **Matriz del día:** columnas pre / en vivo / post
- **Historial 24h:** filtrar por tipo
- **Config pasos:** toggles canal por paso
- **Preview:** `GET /admin/automation/message-preview?matchId=&step=&channel=`
- Reporte predicciones / resultado personal muestran SUCCESS si `predictionReportSentAt` / `resultNotificationSentAt` ya están marcados

## Tests locales

```bash
cd apps/api
npx jest src/automation src/notifications/match-automation-sweep.scheduler.spec.ts --no-cache
npx tsc -p tsconfig.build.json --noEmit
```
