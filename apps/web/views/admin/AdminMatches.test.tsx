import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminMatches, { groupAdminMatchesByDate } from './AdminMatches';

const fetchMatchesMock = vi.fn().mockResolvedValue(undefined);
const fetchTeamsMock = vi.fn().mockResolvedValue(undefined);
const fetchTournamentsMock = vi.fn().mockResolvedValue(undefined);
const deleteMatchMock = vi.fn();
const setFiltersMock = vi.fn();

let storeState: any;

vi.mock('../../stores/admin.matches.store', () => ({
    useAdminMatchesStore: (selector: any) => (selector ? selector(storeState) : storeState),
}));

describe('AdminMatches', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storeState = {
            matches: [
                {
                    id: 'match-1',
                    phase: 'GROUP',
                    round: 'Group A',
                    group: 'A',
                    matchDate: '2026-03-28T16:00:00.000Z',
                    venue: 'Estadio 1',
                    status: 'SCHEDULED',
                    homeTeam: { id: 'team-1', name: 'Argentina', code: 'ARG' },
                    awayTeam: { id: 'team-2', name: 'Brasil', code: 'BRA' },
                },
                {
                    id: 'match-2',
                    phase: 'GROUP',
                    round: 'Group A',
                    group: 'A',
                    matchDate: '2026-03-29T16:00:00.000Z',
                    venue: 'Estadio 2',
                    status: 'SCHEDULED',
                    homeTeam: { id: 'team-3', name: 'Chile', code: 'CHI' },
                    awayTeam: { id: 'team-4', name: 'Perú', code: 'PER' },
                },
            ],
            teams: [],
            tournaments: [],
            total: 2,
            summary: { blocked: 0, failing: 0, healthy: 0, pending: 2 },
            filters: {
                page: 1,
                limit: 50,
            },
            isLoading: false,
            isSaving: false,
            error: null,
            fetchMatches: fetchMatchesMock,
            fetchTeams: fetchTeamsMock,
            fetchTournaments: fetchTournamentsMock,
            createMatch: vi.fn(),
            updateMatch: vi.fn(),
            updateScore: vi.fn(),
            resendPredictionReport: vi.fn(),
            resendResultsReport: vi.fn(),
            getMatchPreviewLeagues: vi.fn(),
            getMatchLeagueRecipients: vi.fn(),
            getEmailPreviewHtml: vi.fn(),
            syncMatch: vi.fn(),
            fetchLinkCandidates: vi.fn(),
            fetchMatchHistory: vi.fn(),
            autoLinkAndSync: vi.fn(),
            bulkAutoLink: vi.fn(),
            getMatchApiHistory: vi.fn(),
            deleteMatch: deleteMatchMock,
            createTeam: vi.fn(),
            updateTeam: vi.fn(),
            setFilters: setFiltersMock,
        };
    });

    it('renders date group separators and wires the date filters to the store', () => {
        render(<AdminMatches />);

        const groups = groupAdminMatchesByDate(storeState.matches);

        expect(screen.getByLabelText(/^Desde$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Hasta$/i)).toBeInTheDocument();
        expect(screen.getAllByText(groups[0].label).length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText(groups[1].label).length).toBeGreaterThanOrEqual(2);

        fireEvent.change(screen.getByLabelText(/^Desde$/i), { target: { value: '2026-03-28' } });

        expect(setFiltersMock).toHaveBeenCalledWith({ startDate: '2026-03-28', page: 1 });
    });
});
