import { describe, expect, it } from 'vitest';
import {
    computeLiveClockState,
    extrapolateTotalSeconds,
    formatLiveClockMinute,
    formatLiveClockSeconds,
    resolveClockAnchor,
} from './liveMatchClock.util';

describe('liveMatchClock.util', () => {
    it('extrapola segundos entre syncs', () => {
        const anchor = { minute: 1, syncedAt: 1_000_000 };
        expect(extrapolateTotalSeconds(anchor, 1_000_000 + 65_000)).toBe(125);
    });

    it('salta al minuto del servidor si va adelantado', () => {
        const prev = { minute: 1, syncedAt: 1_000_000 };
        const now = 1_000_000 + 50_000;
        const next = resolveClockAnchor(2, 1_000_000 + 45_000, prev, now);
        expect(next).toEqual({ minute: 2, syncedAt: 1_000_000 + 45_000 });
    });

    it('ignora sync stale que retrocede el minuto', () => {
        const prev = { minute: 48, syncedAt: 1_000_000 };
        const now = 1_000_000 + 30_000;
        const next = resolveClockAnchor(40, 1_000_000 + 20_000, prev, now);
        expect(next).toBe(prev);
    });

    it('no reinicia segundos si el sync repite el mismo minuto', () => {
        const prev = { minute: 10, syncedAt: 1_000_000 };
        const now = 1_000_000 + 30_000;
        const next = resolveClockAnchor(10, 1_000_000 + 20_000, prev, now);
        expect(next).toBe(prev);
    });

    it('formatea primer tiempo y reposición', () => {
        const baseNow = 1_700_000_000_000;
        const playing = computeLiveClockState({
            matchDate: new Date(baseNow).toISOString(),
            elapsed: 44,
            lastSyncAt: baseNow - 30_000,
            statusShort: '1H',
            now: baseNow,
            anchor: { minute: 44, syncedAt: baseNow - 30_000 },
        });
        expect(formatLiveClockMinute(playing)).toMatch(/44'/);

        const stoppage = computeLiveClockState({
            matchDate: new Date(baseNow).toISOString(),
            elapsed: 45,
            lastSyncAt: baseNow - 360_000,
            statusShort: '1H',
            now: baseNow,
            anchor: { minute: 45, syncedAt: baseNow - 360_000 },
        });
        expect(formatLiveClockMinute(stoppage)).toBe("45+6'");
    });

    it('formatea segundo tiempo y reposición', () => {
        const baseNow = 1_700_000_000_000;
        const secondHalf = computeLiveClockState({
            matchDate: new Date(baseNow).toISOString(),
            elapsed: 46,
            lastSyncAt: baseNow - 15_000,
            statusShort: '2H',
            now: baseNow,
            anchor: { minute: 46, syncedAt: baseNow - 15_000 },
        });
        expect(formatLiveClockMinute(secondHalf)).toMatch(/46'/);
        expect(formatLiveClockSeconds(secondHalf)).toMatch(/^46:\d{2}$/);

        const stoppage = computeLiveClockState({
            matchDate: new Date(baseNow).toISOString(),
            elapsed: 90,
            lastSyncAt: baseNow - 300_000,
            statusShort: '2H',
            now: baseNow,
            anchor: { minute: 90, syncedAt: baseNow - 300_000 },
        });
        expect(formatLiveClockMinute(stoppage)).toBe("90+5'");
    });

    it('marca fase de penales con status P (tanda en curso)', () => {
        const baseNow = 1_700_000_000_000;
        const penalties = computeLiveClockState({
            matchDate: new Date(baseNow).toISOString(),
            elapsed: 120,
            lastSyncAt: baseNow,
            statusShort: 'P',
            now: baseNow,
        });
        expect(penalties.halfLabel).toBe('Penales');
        expect(penalties.phase).toBe('pen');
    });
});
