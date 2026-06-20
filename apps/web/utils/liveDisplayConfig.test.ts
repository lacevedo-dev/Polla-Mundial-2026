import { describe, expect, it } from 'vitest';
import {
    filterEventsForLiveDisplay,
    isRedCardEvent,
    isSubstitutionEvent,
    isYellowCardEvent,
} from './liveDisplayConfig';
import type { MatchEventItem } from '../hooks/useLiveSyncEvents';

const base = (overrides: Partial<MatchEventItem>): MatchEventItem => ({
    type: 'GOAL',
    detail: null,
    playerName: 'Player',
    assistName: null,
    minute: 10,
    extraMin: null,
    teamId: null,
    ...overrides,
});

describe('liveDisplayConfig', () => {
    it('detecta tarjetas y cambios', () => {
        expect(isYellowCardEvent(base({ type: 'CARD', detail: 'Yellow Card' }))).toBe(true);
        expect(isRedCardEvent(base({ type: 'CARD', detail: 'Red Card' }))).toBe(true);
        expect(isSubstitutionEvent(base({ type: 'SUBSTITUTION' }))).toBe(true);
    });

    it('filtra según toggles', () => {
        const events = [
            base({ type: 'GOAL' }),
            base({ type: 'CARD', detail: 'Yellow Card' }),
            base({ type: 'SUBSTITUTION', assistName: 'Out' }),
        ];
        const filtered = filterEventsForLiveDisplay(events, {
            goals: true,
            yellowCards: false,
            redCards: false,
            substitutions: true,
        });
        expect(filtered.map((e) => e.type)).toEqual(['GOAL', 'SUBSTITUTION']);
    });
});
