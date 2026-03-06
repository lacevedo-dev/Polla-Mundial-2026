import { describe, expect, it } from 'vitest';
import { buildRoutes, resolveDevelopmentSurfaceFlags } from './router';

function collectPaths(routes: ReturnType<typeof buildRoutes>): string[] {
    return routes.flatMap((route) => {
        const currentPath = route.path ? [route.path] : [];
        const childPaths = route.children ? collectPaths(route.children) : [];
        return [...currentPath, ...childPaths];
    });
}

describe('buildRoutes', () => {
    it('excludes development-only routes by default', () => {
        const paths = collectPaths(buildRoutes({ includeDevRoutes: false }));

        expect(paths).not.toContain('/design-system');
        expect(paths).not.toContain('/before-after');
    });

    it('includes development-only routes when explicitly enabled', () => {
        const paths = collectPaths(buildRoutes({ includeDevRoutes: true }));

        expect(paths).toContain('/design-system');
        expect(paths).toContain('/before-after');
    });
});

describe('resolveDevelopmentSurfaceFlags', () => {
    it('enables dev routes automatically in development mode', () => {
        expect(resolveDevelopmentSurfaceFlags({ mode: 'development' })).toEqual({
            includeDevRoutes: true,
        });
    });

    it('allows explicit non-production opt-in outside development', () => {
        expect(
            resolveDevelopmentSurfaceFlags({
                mode: 'staging',
                enableDevRoutes: 'true',
            }),
        ).toEqual({
            includeDevRoutes: true,
        });
    });

    it('keeps dev routes disabled in production even with an override flag', () => {
        expect(
            resolveDevelopmentSurfaceFlags({
                mode: 'production',
                enableDevRoutes: 'true',
            }),
        ).toEqual({
            includeDevRoutes: false,
        });
    });
});
