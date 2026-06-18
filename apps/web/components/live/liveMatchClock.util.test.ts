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

    it('no reinicia segundos si el sync repite el mismo minuto', () => {
        const prev = { minute: 10, syncedAt: 1_000_000 };
        const now = 1_000_000 + 30_000;
        const next = resolveClockAnchor(10, 1_000_000 + 20_000, prev, now);
        expect(next).toBe(prev);
    });

    it('formatea primer tiempo y reposición', () => {
        const playing = computeLiveClockState({
            matchDate: new Date().toISOString(),
            elapsed: 44,
            lastSyncAt: Date.now() - 30_000,
            statusShort: '1H',
            now: Date.now(),
            anchor: { minute: 44, syncedAt: Date.now() - 30_000 },
        });
        expect(formatLiveClockMinute(playing)).toMatch(/44'/);

        const stoppage = computeLiveClockState({
            matchDate: new Date().toISOString(),
            elapsed: 45,
            lastSyncAt: Date.now() - 360_000,
            statusShort: '1H',
            now: Date.now(),
            anchor: { minute: 45, syncedAt: Date.now() - 360_000 },
        });
        expect(formatLiveClockMinute(stoppage)).toBe("45+6'");
    });

    it('formatea segundo tiempo y reposición', () => {
        const secondHalf = computeLiveClockState({
            matchDate: new Date().toISOString(),
            elapsed: 46,
            lastSyncAt: Date.now() - 15_000,
            statusShort: '2H',
            now: Date.now(),
            anchor: { minute: 46, syncedAt: Date.now() - 15_000 },
        });
        expect(formatLiveClockMinute(secondHalf)).toMatch(/46'/);
        expect(formatLiveClockSeconds(secondHalf)).toMatch(/^46:\d{2}$/);

        const stoppage = computeLiveClockState({
            matchDate: new Date().toISOString(),
            elapsed: 90,
            lastSyncAt: Date.now() - 300_000,
            statusShort: '2H',
            now: Date.now(),
            anchor: { minute: 90, syncedAt: Date.now() - 300_000 },
        });
        expect(formatLiveClockMinute(stoppage)).toBe("90+5'");
    });
});
