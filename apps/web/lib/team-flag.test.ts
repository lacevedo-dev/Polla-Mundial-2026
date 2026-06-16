import { describe, expect, it } from 'vitest';
import { codeToFlagIso, resolveTeamFlagUrl } from './team-flag';

describe('codeToFlagIso', () => {
    it('mapea códigos FIFA de 3 letras', () => {
        expect(codeToFlagIso('MEX')).toBe('mx');
        expect(codeToFlagIso('ENG')).toBe('gb-eng');
        expect(codeToFlagIso('SCO')).toBe('gb-sct');
    });

    it('normaliza variantes API-Football con dígitos', () => {
        expect(codeToFlagIso('US1')).toBe('us');
        expect(codeToFlagIso('FR1')).toBe('fr');
        expect(codeToFlagIso('CZ1')).toBe('cz');
    });

    it('mapea abreviaturas API-Football', () => {
        expect(codeToFlagIso('mex')).toBe('mx');
        expect(codeToFlagIso('spa')).toBe('es');
        expect(codeToFlagIso('swi')).toBe('ch');
        expect(codeToFlagIso('net')).toBe('nl');
    });

    it('acepta códigos ISO de 2 letras', () => {
        expect(codeToFlagIso('mx')).toBe('mx');
        expect(codeToFlagIso('CO')).toBe('co');
    });

    it('devuelve null para códigos ambiguos o desconocidos', () => {
        expect(codeToFlagIso('SOU')).toBeNull();
        expect(codeToFlagIso('TBDA')).toBeNull();
    });
});

describe('resolveTeamFlagUrl', () => {
    it('prioriza flagcdn cuando el código es mapeable', () => {
        expect(resolveTeamFlagUrl('https://media.api-sports.io/football/teams/16.png', 'MEX'))
            .toBe('https://flagcdn.com/w80/mx.png');
    });

    it('usa flagUrl cuando el código no es mapeable', () => {
        const apiUrl = 'https://media.api-sports.io/football/teams/1531.png';
        expect(resolveTeamFlagUrl(apiUrl, 'SOU')).toBe(apiUrl);
    });

    it('usa flagcdn con código mapeable aunque no haya flagUrl', () => {
        expect(resolveTeamFlagUrl(null, 'ARG')).toBe('https://flagcdn.com/w80/ar.png');
    });
});
