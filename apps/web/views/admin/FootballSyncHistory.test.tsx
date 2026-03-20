import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FootballSyncHistory from './FootballSyncHistory';

const fetchHistoryMock = vi.fn();

let storeState: any;

vi.mock('../../stores/football-sync.store', () => ({
  useFootballSyncStore: (selector: any) => (selector ? selector(storeState) : storeState),
}));

describe('FootballSyncHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      history: {
        logs: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
        summary: {
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          totalRequestsUsed: 0,
          totalMatchesUpdated: 0,
        },
      },
      isLoading: false,
      error: null,
      fetchHistory: fetchHistoryMock,
    };
  });

  it('uses canonical backend enum values when filtering by sync type', async () => {
    const user = userEvent.setup();
    render(<FootballSyncHistory />);

    expect(fetchHistoryMock).toHaveBeenCalledWith({ page: 1, limit: 20 });

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'AUTO_SYNC');

    await waitFor(() => {
      expect(fetchHistoryMock).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        type: 'AUTO_SYNC',
      });
    });
  });
});
