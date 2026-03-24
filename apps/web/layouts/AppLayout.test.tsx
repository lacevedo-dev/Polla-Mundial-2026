import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from './AppLayout';

const { navigateMock, logoutMock, checkAuthMock, fetchPlanConfigMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
    logoutMock: vi.fn(),
    checkAuthMock: vi.fn(),
    fetchPlanConfigMock: vi.fn(),
}));

let authState: any = {
    user: {
        id: 'user-1',
        name: 'Ana',
        email: 'ana@mail.com',
        username: 'ana',
        role: 'PLAYER',
        systemRole: 'USER',
    },
    logout: logoutMock,
    isSuperAdmin: () => false,
    checkAuth: checkAuthMock,
    sessionChecked: true,
};

vi.mock('react-router-dom', () => ({
    useNavigate: () => navigateMock,
    NavLink: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    Outlet: () => <div data-testid="app-outlet">Protected content</div>,
}));

vi.mock('../stores/auth.store', () => ({
    useAuthStore: (selector?: (state: typeof authState) => unknown) =>
        selector ? selector(authState) : authState,
}));

vi.mock('../stores/config.store', () => ({
    useConfigStore: (selector: (state: { fetchPlanConfig: typeof fetchPlanConfigMock }) => unknown) =>
        selector({ fetchPlanConfig: fetchPlanConfigMock }),
}));

describe('AppLayout session guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        authState = {
            user: {
                id: 'user-1',
                name: 'Ana',
                email: 'ana@mail.com',
                username: 'ana',
                role: 'PLAYER',
                systemRole: 'USER',
            },
            logout: logoutMock,
            isSuperAdmin: () => false,
            checkAuth: checkAuthMock,
            sessionChecked: true,
        };
        fetchPlanConfigMock.mockResolvedValue(undefined);
    });

    it('waits for stored session validation before rendering protected content', () => {
        localStorage.setItem('token', 'stale-token');
        authState = {
            ...authState,
            user: null,
            sessionChecked: false,
        };
        checkAuthMock.mockReturnValue(new Promise(() => {}));

        render(<AppLayout />);

        expect(checkAuthMock).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/validando tu sesi[oó]n/i)).toBeInTheDocument();
        expect(screen.queryByTestId('app-outlet')).not.toBeInTheDocument();
    });

    it('redirects to login when stored session verification fails', async () => {
        localStorage.setItem('token', 'stale-token');
        authState = {
            ...authState,
            user: null,
            sessionChecked: false,
        };
        checkAuthMock.mockResolvedValue(false);

        render(<AppLayout />);

        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/login');
        });
    });
});
