import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login, { normalizeCheckboxState } from './Login';

const navigateMock = vi.fn();
const loginMock = vi.fn();
let isLoadingState = false;
let userState = { emailVerified: true } as any;

vi.mock('react-router-dom', () => ({
    useNavigate: () => navigateMock,
}));

const mockAuthStore = {
    useAuthStore: vi.fn(() => ({
        login: loginMock,
        isLoading: isLoadingState,
    })),
};

mockAuthStore.useAuthStore.getState = vi.fn(() => ({
    user: userState,
    isLoading: isLoadingState,
}));

vi.mock('../stores/auth.store', () => mockAuthStore);

vi.mock('../components/ui/input', () => ({
    Input: (props: any) => {
        const { isLoading, leftIcon, rightIcon, ...rest } = props;
        const testId = rest.type === 'password' ? 'new-password-input' : 'new-input';
        return <input data-testid={testId} {...rest} />;
    },
}));

vi.mock('../components/ui/button', () => ({
    Button: ({ children, isLoading, disabled, ...props }: any) => (
        <button disabled={Boolean(isLoading || disabled)} {...props}>
            {children}
        </button>
    ),
}));

vi.mock('../components/ui/checkbox', () => ({
    Checkbox: ({ id, checked, disabled, onCheckedChange }: any) => (
        <input
            id={id}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onCheckedChange?.(event.target.checked)}
        />
    ),
}));

vi.mock('../components/ui/label', () => ({
    Label: (props: any) => <label {...props} />,
}));

vi.mock('../components/UI', () => ({
    EmailAutocompleteInput: ({ value, onValueChange, ...props }: any) => (
        <input
            data-testid="legacy-email-autocomplete"
            value={value ?? ''}
            onChange={(event) => onValueChange?.(event.target.value)}
            {...props}
        />
    ),
}));

describe('Login view', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isLoadingState = false;
        loginMock.mockResolvedValue(undefined);
    });

    it('submits credentials once and navigates to dashboard', async () => {
        const user = userEvent.setup();
        render(<Login />);

        await user.type(screen.getByTestId('legacy-email-autocomplete'), 'ana@mail.com');
        await user.type(screen.getByTestId('new-password-input'), '123456');
        await user.click(screen.getByRole('button', { name: /Entrar al Estadio/i }));

        await waitFor(() =>
            expect(loginMock).toHaveBeenCalledWith({
                identifier: 'ana@mail.com',
                password: '123456',
            }),
        );
        expect(loginMock).toHaveBeenCalledTimes(1);
        expect(navigateMock).toHaveBeenCalledWith('/dashboard');
    }, 15000);

    it('disables interactive controls while loading to avoid duplicate submit', async () => {
        const user = userEvent.setup();
        isLoadingState = true;

        render(<Login />);

        const submitButton = screen.getByRole('button', { name: /Entrar al Estadio/i });
        const rememberCheckbox = screen.getByLabelText(/Mantenerme conectado/i);
        expect(submitButton).toBeDisabled();
        expect(rememberCheckbox).toBeDisabled();

        await user.click(submitButton);
        expect(loginMock).not.toHaveBeenCalled();
    });

    it('toggles remember-me via checkbox and its label', async () => {
        const user = userEvent.setup();
        render(<Login />);

        const rememberCheckbox = screen.getByLabelText(/Mantenerme conectado/i) as HTMLInputElement;
        expect(rememberCheckbox.checked).toBe(false);

        await user.click(rememberCheckbox);
        expect(rememberCheckbox.checked).toBe(true);

        await user.click(screen.getByText(/Mantenerme conectado/i));
        expect(rememberCheckbox.checked).toBe(false);
    });

    it('keeps legacy email autocomplete while using new password primitive', () => {
        render(<Login />);

        expect(screen.getByTestId('legacy-email-autocomplete')).toBeInTheDocument();
        expect(screen.getByTestId('new-password-input')).toBeInTheDocument();
    });

    it('opens and closes the legal dialog from login without leaving the screen', async () => {
        const user = userEvent.setup();
        render(<Login />);

        await user.click(screen.getByRole('button', { name: /ver términos de servicio/i }));
        expect(screen.getByRole('dialog', { name: /términos y condiciones/i })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /cerrar términos y condiciones/i }));
        await waitFor(() =>
            expect(screen.queryByRole('dialog', { name: /términos y condiciones/i })).not.toBeInTheDocument(),
        );
        expect(screen.getByRole('button', { name: /Entrar al Estadio/i })).toBeInTheDocument();
    });
});

describe('Login Email Verification Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isLoadingState = false;
        userState = { emailVerified: false };
        sessionStorage.clear();
    });

    it('redirects unverified user to verify-email instead of dashboard', async () => {
        const user = userEvent.setup();
        loginMock.mockResolvedValue(undefined);

        render(<Login />);

        await user.type(screen.getByTestId('legacy-email-autocomplete'), 'unverified@mail.com');
        await user.type(screen.getByTestId('new-password-input'), '123456');
        await user.click(screen.getByRole('button', { name: /Entrar al Estadio/i }));

        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/verify-email');
        });
        expect(navigateMock).not.toHaveBeenCalledWith('/dashboard');
    }, 15000);

    it('redirects verified user to dashboard', async () => {
        const user = userEvent.setup();
        userState = { emailVerified: true };
        loginMock.mockResolvedValue(undefined);

        render(<Login />);

        await user.type(screen.getByTestId('legacy-email-autocomplete'), 'verified@mail.com');
        await user.type(screen.getByTestId('new-password-input'), '123456');
        await user.click(screen.getByRole('button', { name: /Entrar al Estadio/i }));

        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/dashboard');
        });
    }, 15000);

    it('stores email in sessionStorage when redirecting to verify-email', async () => {
        const user = userEvent.setup();
        userState = { emailVerified: false };
        loginMock.mockResolvedValue(undefined);

        render(<Login />);

        await user.type(screen.getByTestId('legacy-email-autocomplete'), 'unverified@mail.com');
        await user.type(screen.getByTestId('new-password-input'), '123456');
        await user.click(screen.getByRole('button', { name: /Entrar al Estadio/i }));

        await waitFor(() => {
            expect(sessionStorage.getItem('registrationEmail')).toBe('unverified@mail.com');
        });
    }, 15000);
});

describe('normalizeCheckboxState', () => {
    it('resolves to deterministic boolean values', () => {
        expect(normalizeCheckboxState(true)).toBe(true);
        expect(normalizeCheckboxState(false)).toBe(false);
        expect(normalizeCheckboxState('indeterminate')).toBe(false);
    });
});
