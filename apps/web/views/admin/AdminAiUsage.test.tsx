import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminAiUsage from './AdminAiUsage';

const fetchRecordsMock = vi.fn();
const fetchStatsMock = vi.fn();
const setFiltersMock = vi.fn();

let storeState: any;

vi.mock('../../stores/admin.ai-usage.store', () => ({
    useAdminAiUsageStore: (selector: any) => (selector ? selector(storeState) : storeState),
}));

describe('AdminAiUsage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storeState = {
            records: [
                {
                    id: 'rec-1',
                    userId: 'user-1',
                    leagueId: 'league-1',
                    matchId: 'match-1',
                    feature: 'match_insights',
                    creditsUsed: 1,
                    insightGenerated: true,
                    requestData: JSON.stringify({
                        homeTeam: 'Colombia',
                        awayTeam: 'México',
                    }),
                    responseData: JSON.stringify({
                        smartPick: 'Colombia',
                        scores: ['2-1', '1-1', '1-0'],
                    }),
                    clientInfo: 'Match: Colombia vs México',
                    createdAt: '2026-03-19T16:08:00.000Z',
                    user: {
                        id: 'user-1',
                        name: 'Luis Angel Acevedo Velez',
                        email: 'lacevedovelez@gmail.com',
                        username: 'luis',
                        plan: 'GOLD',
                    },
                },
            ],
            stats: {
                totalRecords: 1,
                totalCreditsUsed: 1,
                byFeature: [{ feature: 'match_insights', _sum: { creditsUsed: 1 }, _count: 1 }],
                byPlan: [{ plan: 'GOLD', _sum: { usedCredits: 1, totalCredits: 30 }, _count: 1 }],
            },
            total: 1,
            filters: {
                page: 1,
                limit: 50,
            },
            isLoading: false,
            error: null,
            fetchRecords: fetchRecordsMock,
            fetchStats: fetchStatsMock,
            setFilters: setFiltersMock,
            resetUserCredits: vi.fn(),
        };
    });

    it('shows count summary and correct pagination range without NaN values', () => {
        render(<AdminAiUsage />);

        expect(screen.getByText(/1 registro total/i)).toBeInTheDocument();
        expect(screen.getByText(/1 visibles/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Mostrando 1-1 de 1/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
    });

    it('opens a detail modal with the request and response payloads', async () => {
        const user = userEvent.setup();
        render(<AdminAiUsage />);

        await user.click(screen.getByRole('button', { name: /Ver consulta/i }));

        expect(screen.getByText(/Detalle de consulta IA/i)).toBeInTheDocument();
        expect(screen.getByText(/Consulta enviada/i)).toBeInTheDocument();
        expect(screen.getByText(/Respuesta registrada/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Colombia/).length).toBeGreaterThan(0);
        expect(screen.getByText(/smartPick/)).toBeInTheDocument();
    });
});
