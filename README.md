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
