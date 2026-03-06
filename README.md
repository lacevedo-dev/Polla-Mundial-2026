# Polla 2026 Monorepo

Monorepo de **Polla 2026** con frontend en **React + Vite** y API en **NestJS + Prisma**.

## Estructura

- `apps/web` — aplicación web pública y autenticada
- `apps/api` — API NestJS, auth, ligas, predicciones y health checks
- `packages/shared` — tipos compartidos

## Prerrequisitos

- Node.js 22+
- npm 10+
- una base de datos MariaDB/MySQL accesible para el API

## Variables de entorno

### Frontend (`apps/web`)

- `apps/web/.env` — setup local
- `apps/web/.env.production` — valores para builds locales tipo producción
- `VITE_API_URL` es **obligatoria fuera de development**
- `VITE_ENABLE_DEV_ROUTES=true` solo habilita rutas de desarrollo en contextos **no productivos**

### API (`apps/api`)

1. Copia `apps/api/.env.example` a `apps/api/.env`
2. Ajusta al menos:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `PORT`

La API debe fallar temprano si falta `DATABASE_URL`, `JWT_SECRET` o si `PORT` es inválido.

## Primer arranque local

```bash
npm install
npm run api:dev
npm run web:dev
```

- Web local: `http://localhost:5173`
- API local: `http://localhost:3004`

## Comandos raíz del monorepo

| Comando | Propósito |
|---|---|
| `npm run web:dev` | levantar frontend en desarrollo |
| `npm run web:test` | ejecutar Vitest del frontend |
| `npm run web:build` | generar build del frontend |
| `npm run api:dev` | levantar API Nest en watch mode |
| `npm run api:test` | ejecutar Jest del API |
| `npm run api:e2e` | ejecutar pruebas e2e del API |
| `npm run api:build` | compilar la API |
| `npm run baseline:check` | correr baseline mínima de tests + builds desde la raíz |
| `npm run smoke:release -- --baseUrl=https://api.example.com` | ejecutar smoke HTTP del release target |

## Baseline mínima antes de continuar con slices funcionales

Ejecuta desde la raíz:

```bash
npm run baseline:check
npm run smoke:release -- --baseUrl=https://api-polla.agildesarrollo.com.co
```

Un release **MUST NOT be marked healthy** si cualquiera de esos checks falla.
En especial, **`GET /health/ready` remains `503`** implica que el release sigue degradado.

## Backend + Frontend Rollout Checklist

When shipping scoring or schema-sensitive changes, deploy in this order:

1. **Release source sync gate**
   - Verify local branch is aligned with deploy source:
     - `git fetch origin`
     - `git status -sb` (must not show `ahead` for `main` before release).
   - If `main` is ahead, push before triggering production deploy.
2. **Pre-release baseline gate**
   - Run `npm run baseline:check` from the repo root.
   - Fix any failing sub-check before continuing.
3. **API first**
   - Regenerate Prisma client after schema updates.
   - Build and test API (`npm run api:build`, `npm run api:test`, `npm run api:e2e`).
4. **Database alignment**
   - Ensure the runtime schema matches `apps/api/prisma/schema.prisma`.
   - Validate decimal-compatible `Prediction.points` before enabling leaderboard changes.
5. **Web second (build-time API URL required)**
   - Build web app (`npm run web:build`) with a valid `VITE_API_URL`.
   - For Docker builds, pass it explicitly:
     - `docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api-polla.agildesarrollo.com.co -t polla-web .`
   - Do **not** rely on `.env.production` inside Docker build context (`.dockerignore` excludes `.env*`).
6. **Post-deploy verification**
   - Run `npm run smoke:release -- --baseUrl=https://api-polla.agildesarrollo.com.co`.
   - Validate login flow (submit, loading state, remember-me behavior) against deployed API.
   - Validate league fetch calls against deployed API.
   - Confirm the browser is not calling `localhost` endpoints in production.
7. **Rollback plan (if API URL is misconfigured)**
   - Revert to the last known good web image.
   - Fix `VITE_API_URL` in deploy/build config.
   - Redeploy and repeat post-deploy verification.
8. **Process quality gate**
   - If any checklist step is missed during a release incident, treat it as a process defect.
   - Update this checklist before the next deployment window.

## API 502 Incident Response (Runbook)

When production API endpoints return `502`, execute this triage checklist before closing the incident:

1. **Runtime logs**
   - Capture startup/runtime errors from API container/process.
   - Confirm whether failure is application bootstrap, database connectivity, or upstream proxy.
2. **Environment validation**
   - Verify required env vars are present and valid (`DATABASE_URL`, `PORT`, `JWT_SECRET` as applicable).
   - Confirm no secret values are malformed or empty.
3. **Listener and routing checks**
   - Validate API process is listening on expected port.
   - Validate reverse proxy/upstream target points to the active API instance.
4. **Database connectivity**
   - Validate network reachability and credentials for DB host.
   - Confirm readiness check reflects DB state (`/health/ready`).
   - If readiness reports the database as down, verify whether the DB provider/user hit connection or quota limits before assuming an application bug.
   - Prefer running `cd apps/api && npx tsx prisma/test_connection.ts` to capture a categorized DB diagnostic (`config`, `network`, `credentials`, `quota`, `unknown`).

### Database Environment Isolation

- Local and non-production environments SHOULD use separate DB credentials or an isolated database target.
- Use `apps/api/.env.example` as the baseline for local setup; do **not** copy a production-limited `DATABASE_URL` into local development silently.
- If credential sharing is temporarily unavoidable, document the owner, mitigation window, and quota risk before repeated smoke tests or local debugging.

### Post-fix Smoke Procedure

After every fix attempt, run smoke checks and record HTTP status + timestamp:

- `GET /`
- `GET /health/live`
- `GET /health/ready`
- `POST /auth/login`
- `GET /leagues`

Expected healthy state:
- Health endpoints respond deterministically (`/health/live` 200; `/health/ready` 200 when DB is ready).
- Business endpoints stop returning `502`.

### Release Gate

A release **MUST NOT** be marked healthy while critical smoke checks fail.
If operations must continue with residual risk, owners must explicitly document risk acceptance and mitigation window.
This includes any case where `GET /health/ready` remains `503` because of DB provider quota/resource limits.
