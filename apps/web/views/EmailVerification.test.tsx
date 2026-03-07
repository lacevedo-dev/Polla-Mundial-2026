import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmailVerification from './EmailVerification';
import { BrowserRouter } from 'react-router-dom';

const navigateMock = vi.fn();
const verifyEmailMock = vi.fn();
const resendVerificationMock = vi.fn();
let isLoadingState = false;
let userState = null as any;

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => navigateMock,
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('../stores/auth.store', () => ({
  useAuthStore: () => ({
    verifyEmail: verifyEmailMock,
    resendVerification: resendVerificationMock,
    isLoading: isLoadingState,
    user: userState,
  }),
}));

vi.mock('../components/UI', () => ({
  Button: ({ children, isLoading, disabled, ...props }: any) => (
    <button disabled={Boolean(isLoading || disabled)} {...props}>
      {children}
    </button>
  ),
  Input: ({ type, ...props }: any) => (
    <input type={type} {...props} />
  ),
  Card: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  Badge: ({ children, ...props }: any) => (
    <span {...props}>{children}</span>
  ),
}));

const sleep = async (ms: number) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

const renderWithRouter = (component: any) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('EmailVerification Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLoadingState = false;
    userState = { email: 'test@example.com' };
    sessionStorage.clear();
  });

  it('renders the email verification component with main content', () => {
    renderWithRouter(<EmailVerification />);

    expect(screen.getByText(/verifica tu correo/i)).toBeInTheDocument();
    expect(screen.getByText(/hemos enviado un enlace/i)).toBeInTheDocument();
  });

  it('displays email address when provided via props', () => {
    renderWithRouter(<EmailVerification email="user@gmail.com" />);

    expect(screen.getByText('user@gmail.com')).toBeInTheDocument();
  });

  it('displays stored email from user store', () => {
    userState = { email: 'store@example.com' };
    renderWithRouter(<EmailVerification />);

    expect(screen.getByText('store@example.com')).toBeInTheDocument();
  });

  it('renders manual token input toggle button', () => {
    renderWithRouter(<EmailVerification />);

    const toggleButton = screen.getByRole('button', { name: /ingresar código manualmente/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it('toggles manual token input field when clicking toggle button', async () => {
    renderWithRouter(<EmailVerification />);

    const toggleButton = screen.getByRole('button', { name: /ingresar código manualmente/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/pega el código del email/i)).toBeInTheDocument();
    });
  });

  it('submits valid token and calls verifyEmail', async () => {
    verifyEmailMock.mockResolvedValue({ success: true });
    renderWithRouter(<EmailVerification />);

    const toggleButton = screen.getByRole('button', { name: /ingresar código manualmente/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      const tokenInput = screen.getByPlaceholderText(/pega el código del email/i) as HTMLInputElement;
      fireEvent.change(tokenInput, { target: { value: 'valid-token-123' } });
    });

    const submitButton = screen.getByRole('button', { name: /verificar email/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(verifyEmailMock).toHaveBeenCalledWith('valid-token-123');
    });
  });

  it('displays error message when token is invalid', async () => {
    const errorMessage = 'El token es inválido. Por favor verifica y vuelve a intentar.';
    verifyEmailMock.mockRejectedValue(new Error('invalid'));

    renderWithRouter(<EmailVerification />);

    const toggleButton = screen.getByRole('button', { name: /ingresar código manualmente/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      const tokenInput = screen.getByPlaceholderText(/pega el código del email/i) as HTMLInputElement;
      fireEvent.change(tokenInput, { target: { value: 'invalid-token' } });
    });

    const submitButton = screen.getByRole('button', { name: /verificar email/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/el token es inválido/i)).toBeInTheDocument();
    });
  });

  it('displays error message when token is expired', async () => {
    verifyEmailMock.mockRejectedValue(new Error('expired'));

    renderWithRouter(<EmailVerification />);

    const toggleButton = screen.getByRole('button', { name: /ingresar código manualmente/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      const tokenInput = screen.getByPlaceholderText(/pega el código del email/i) as HTMLInputElement;
      fireEvent.change(tokenInput, { target: { value: 'expired-token' } });
    });

    const submitButton = screen.getByRole('button', { name: /verificar email/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/el token ha expirado/i)).toBeInTheDocument();
      expect(screen.getByText(/por favor solicita uno nuevo/i)).toBeInTheDocument();
    });
  });

  it('calls resendVerification when resend button is clicked', async () => {
    resendVerificationMock.mockResolvedValue({ success: true });
    renderWithRouter(<EmailVerification />);

    const resendButton = screen.getByRole('button', { name: /reenviar enlace/i });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(resendVerificationMock).toHaveBeenCalled();
    });
  });

  it('displays success message after resending', async () => {
    resendVerificationMock.mockResolvedValue({ success: true });
    renderWithRouter(<EmailVerification />);

    const resendButton = screen.getByRole('button', { name: /reenviar enlace/i });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(screen.getByText(/hemos reenviado el enlace/i)).toBeInTheDocument();
    });
  });

  it('disables verify button when token is empty', () => {
    renderWithRouter(<EmailVerification />);

    const toggleButton = screen.getByRole('button', { name: /ingresar código manualmente/i });
    fireEvent.click(toggleButton);

    const submitButton = screen.getByRole('button', { name: /verificar email/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables verify button when token is entered', async () => {
    renderWithRouter(<EmailVerification />);

    const toggleButton = screen.getByRole('button', { name: /ingresar código manualmente/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      const tokenInput = screen.getByPlaceholderText(/pega el código del email/i) as HTMLInputElement;
      fireEvent.change(tokenInput, { target: { value: 'some-token' } });

      const submitButton = screen.getByRole('button', { name: /verificar email/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('shows back to login button', () => {
    renderWithRouter(<EmailVerification />);

    const backButton = screen.getByRole('button', { name: /volver al iniciar sesión/i });
    expect(backButton).toBeInTheDocument();
  });

  it('navigates to login when back button is clicked', () => {
    renderWithRouter(<EmailVerification />);

    const backButton = screen.getByRole('button', { name: /volver al iniciar sesión/i });
    fireEvent.click(backButton);

    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('shows loading state while verifying', async () => {
    verifyEmailMock.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
    isLoadingState = true;

    renderWithRouter(<EmailVerification />);

    const toggleButton = screen.getByRole('button', { name: /ingresar código manualmente/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      const tokenInput = screen.getByPlaceholderText(/pega el código del email/i) as HTMLInputElement;
      fireEvent.change(tokenInput, { target: { value: 'test-token' } });
    });

    const submitButton = screen.getByRole('button', { name: /verificar email/i });
    expect(submitButton).toBeDisabled();
  });

  it('displays success message and redirects on successful verification', async () => {
    verifyEmailMock.mockResolvedValue({ success: true });
    renderWithRouter(<EmailVerification />);

    const toggleButton = screen.getByRole('button', { name: /ingresar código manualmente/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      const tokenInput = screen.getByPlaceholderText(/pega el código del email/i) as HTMLInputElement;
      fireEvent.change(tokenInput, { target: { value: 'valid-token-123' } });
    });

    const submitButton = screen.getByRole('button', { name: /verificar email/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email verificado/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays error when resend fails', async () => {
    resendVerificationMock.mockRejectedValue(new Error('Too many requests'));
    renderWithRouter(<EmailVerification />);

    const resendButton = screen.getByRole('button', { name: /reenviar enlace/i });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(screen.getByText(/error al reenviar/i)).toBeInTheDocument();
    });
  });
});
