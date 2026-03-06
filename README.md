<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1JHiwsecdCdd_YIUW0U4Kg4cTM9CGIJft

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend + Frontend Rollout Checklist

When shipping scoring or schema-sensitive changes, deploy in this order:

1. **Release source sync gate**
   - Verify local branch is aligned with deploy source:
     - `git fetch origin`
     - `git status -sb` (must not show `ahead` for `main` before release).
   - If `main` is ahead, push before triggering production deploy.
2. **API first**
   - Regenerate Prisma client after schema updates.
   - Build and test API (`npm run api:build`, `npm run test --workspace=@polla-2026/api`).
3. **Database alignment**
   - Ensure the runtime schema matches `apps/api/prisma/schema.prisma`.
   - Validate decimal-compatible `Prediction.points` before enabling leaderboard changes.
4. **Web second (build-time API URL required)**
   - Build web app (`npm run web:build`) with a valid `VITE_API_URL`.
   - For Docker builds, pass it explicitly:
     - `docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api-polla.agildesarrollo.com.co -t polla-web .`
   - Do **not** rely on `.env.production` inside Docker build context (`.dockerignore` excludes `.env*`).
5. **Post-deploy verification**
   - Validate login flow (submit, loading state, remember-me behavior) against deployed API.
   - Validate league fetch calls against deployed API.
   - Confirm the browser is not calling `localhost` endpoints in production.
6. **Rollback plan (if API URL is misconfigured)**
   - Revert to the last known good web image.
   - Fix `VITE_API_URL` in deploy/build config.
   - Redeploy and repeat post-deploy verification.
7. **Process quality gate**
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
