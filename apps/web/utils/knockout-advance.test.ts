import { describe, expect, it } from 'vitest';
import {
    getLiveAdvancePickStatus,
    isPenaltyPhaseStatus,
    resolvePredictionAdvanceTeamId,
} from './knockout-advance';

describe('knockout-advance live helpers', () => {
    it('detecta fase de penales en curso', () => {
        expect(isPenaltyPhaseStatus('P')).toBe(true);
        expect(isPenaltyPhaseStatus('BT')).toBe(true);
        expect(isPenaltyPhaseStatus('PEN')).toBe(true);
        expect(isPenaltyPhaseStatus('2H')).toBe(false);
    });

    it('resuelve clasificado desde marcador o pick manual', () => {
        expect(
            resolvePredictionAdvanceTeamId('home', 'away', { home: '2', away: '1' }),
        ).toBe('home');
        expect(
            resolvePredictionAdvanceTeamId('home', 'away', {
                home: '1',
                away: '1',
                advanceTeamId: 'away',
            }),
        ).toBe('away');
    });

    it('marca pick en penales como pendiente cuando el marcador está empatado', () => {
        expect(
            getLiveAdvancePickStatus({
                resolvedAdvanceTeamId: 'home',
                result: { home: 1, away: 1 },
                statusShort: 'P',
            }),
        ).toBe('pending_penalties');
    });

    it('compara pick con clasificado real cuando ya está definido', () => {
        expect(
            getLiveAdvancePickStatus({
                resolvedAdvanceTeamId: 'home',
                advancingTeamId: 'home',
                result: { home: 1, away: 1 },
            }),
        ).toBe('winning');

        expect(
            getLiveAdvancePickStatus({
                resolvedAdvanceTeamId: 'home',
                advancingTeamId: 'away',
                result: { home: 1, away: 1 },
            }),
        ).toBe('losing');
    });
});
