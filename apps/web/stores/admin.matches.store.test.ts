import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminMatchesStore } from './admin.matches.store';

const requestMock = vi.fn();

vi.mock('../api', () => ({
    BASE_URL: 'http://localhost',
    request: (...args: unknown[]) => requestMock(...args),
}));

describe('admin.matches.store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requestMock.mockResolvedValue({
            data: [],
            total: 0,
            summary: { blocked: 0, failing: 0, healthy: 0, pending: 0 },
        });
        useAdminMatchesStore.setState({
            filters: {
                page: 1,
                limit: 50,
            },
        } as any);
    });

    it('includes the date range filters in the backend query', async () => {
        useAdminMatchesStore.setState((state) => ({
            filters: {
                ...state.filters,
                startDate: '2026-03-28',
                endDate: '2026-03-30',
            },
        }));

        await useAdminMatchesStore.getState().fetchMatches();

        expect(requestMock).toHaveBeenCalledTimes(1);
        const [url] = requestMock.mock.calls[0];

        expect(String(url)).toContain('/admin/matches?');
        expect(String(url)).toContain('page=1');
        expect(String(url)).toContain('limit=50');
        expect(String(url)).toContain('startDate=2026-03-28');
        expect(String(url)).toContain('endDate=2026-03-30');
    });
});
