import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEV_FALLBACK_API_URL, resolveBaseUrl } from './api';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dockerfilePath = path.resolve(currentDir, 'Dockerfile');
const readmePath = path.resolve(currentDir, '../../README.md');

const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
const readmeContent = fs.readFileSync(readmePath, 'utf8');

describe('Spec scenarios: web/api-runtime-config', () => {
    it('Development fallback works for local iteration', () => {
        expect(resolveBaseUrl('development', undefined)).toBe(DEV_FALLBACK_API_URL);
    });

    it('Production uses configured API URL', () => {
        expect(resolveBaseUrl('production', 'https://api.example.com/')).toBe('https://api.example.com');
    });

    it('Missing production variable triggers explicit error', () => {
        expect(() => resolveBaseUrl('production', '')).toThrowError(/VITE_API_URL is required/i);
    });

    it('Invalid production URL is rejected', () => {
        expect(() => resolveBaseUrl('production', 'not-a-url')).toThrowError(/VITE_API_URL is invalid/i);
    });

    it('Build injects public API URL correctly', () => {
        expect(dockerfileContent).toMatch(/ARG\s+VITE_API_URL/);
        expect(dockerfileContent).toMatch(/ENV\s+VITE_API_URL=\$\{VITE_API_URL\}/);
    });

    it('Production build without VITE_API_URL fails early', () => {
        expect(dockerfileContent).toMatch(/RUN test -n "\$VITE_API_URL"/);
        expect(dockerfileContent).toMatch(/required for frontend production build/i);
    });
});

describe('Spec scenarios: operations/release-rollout', () => {
    it('Ahead local branch is synchronized before release', () => {
        expect(readmeContent).toContain('git fetch origin');
        expect(readmeContent).toContain('git status -sb');
        expect(readmeContent).toContain('If `main` is ahead, push before triggering production deploy.');
    });

    it('Deployment is blocked on unsynchronized source', () => {
        expect(readmeContent).toContain("must not show `ahead` for `main` before release");
    });

    it('Smoke test validates production API host', () => {
        expect(readmeContent).toContain('Validate login flow');
        expect(readmeContent).toContain('Validate league fetch calls');
        expect(readmeContent).toContain('not calling `localhost` endpoints');
    });

    it('Host mismatch triggers rollback decision', () => {
        expect(readmeContent).toContain('Rollback plan');
        expect(readmeContent).toContain('Revert to the last known good web image.');
        expect(readmeContent).toContain('Redeploy and repeat post-deploy verification.');
    });

    it('Team follows updated checklist', () => {
        expect(readmeContent).toContain('## Backend + Frontend Rollout Checklist');
        expect(readmeContent).toContain('Web second (build-time API URL required)');
    });

    it('Missing checklist item is treated as process defect', () => {
        expect(readmeContent).toContain('treat it as a process defect');
        expect(readmeContent).toContain('Update this checklist before the next deployment window.');
    });
});
