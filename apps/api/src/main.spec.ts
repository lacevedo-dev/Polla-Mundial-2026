import { assertRequiredEnv, resolveStartupDiagnostics } from './config/startup.config';

describe('startup diagnostics', () => {
    it('uses default port when PORT is not set', () => {
        const diagnostics = resolveStartupDiagnostics({
            DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
        });

        expect(diagnostics.port).toBe(3000);
        expect(diagnostics.missingEnv).toEqual([]);
    });

    it('uses explicit port when PORT is valid', () => {
        const diagnostics = resolveStartupDiagnostics({
            DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
            PORT: '3004',
        });

        expect(diagnostics.port).toBe(3004);
        expect(diagnostics.missingEnv).toEqual([]);
    });

    it('reports missing required env keys', () => {
        const diagnostics = resolveStartupDiagnostics({
            PORT: '3000',
        });

        expect(diagnostics.missingEnv).toEqual(['DATABASE_URL']);
        expect(() => assertRequiredEnv(diagnostics)).toThrow('Missing required environment variable(s): DATABASE_URL');
    });

    it('fails with actionable message when PORT is invalid', () => {
        expect(() =>
            resolveStartupDiagnostics({
                DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
                PORT: 'invalid',
            }),
        ).toThrow('PORT must be a positive integer');
    });
});
