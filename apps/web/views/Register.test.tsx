import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Register from './Register';

const navigateMock = vi.fn();
const registerMock = vi.fn();
let isLoadingState = false;

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../stores/auth.store', () => ({
  useAuthStore: () => ({
    register: registerMock,
    isLoading: isLoadingState,
  }),
}));

vi.mock('../components/UI', () => ({
  Button: ({ children, isLoading, disabled, ...props }: any) => (
    <button disabled={Boolean(isLoading || disabled)} {...props}>
      {children}
    </button>
  ),
  Input: ({ leftIcon, rightIcon, type, ...props }: any) => (
    <div>
      <input
        data-testid={
          type === 'date'
            ? 'register-date-input'
            : String(props.placeholder ?? '').includes('•') || String(props.placeholder ?? '').includes('\\u2022')
              ? 'register-password-input'
              : undefined
        }
        type={type}
        {...props}
      />
      {rightIcon ? <div data-testid="register-input-right-icon">{rightIcon}</div> : null}
    </div>
  ),
  EmailAutocompleteInput: ({ value, onValueChange, rightIcon, ...props }: any) => (
    <input
      data-testid="register-email-input"
      value={value ?? ''}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...props}
    />
  ),
  AutocompleteInput: ({ value, onValueChange, suggestionTitle, leftIcon, rightIcon, ...props }: any) => (
    <input
      data-testid="register-username-input"
      value={value ?? ''}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...props}
    />
  ),
  Checkbox: ({ id, checked, disabled, onChange, ...props }: any) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

class MockFileReader {
  public result: string | ArrayBuffer | null = null;
  public onloadend: null | (() => void) = null;
  public onerror: null | (() => void) = null;

  readAsDataURL(file: File) {
    this.result = `data:${file.type};base64,preview-${encodeURIComponent(file.name)}`;
    this.onloadend?.();
  }
}

const sleep = async (ms: number) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

const getStep2PasswordInputs = () => screen.getAllByTestId('register-password-input') as HTMLInputElement[];

const fillStep2 = async (
  view: ReturnType<typeof render>,
  {
    username = 'anagomez',
    password = 'Password1',
    confirmPassword = password,
  }: { username?: string; password?: string; confirmPassword?: string } = {},
) => {
  fireEvent.change(screen.getByTestId('register-username-input'), { target: { value: username } });

  let [passwordInput, confirmPasswordInput] = getStep2PasswordInputs();
  fireEvent.change(passwordInput, { target: { value: password } });
  fireEvent.change(confirmPasswordInput, { target: { value: confirmPassword } });

  await sleep(1050);

  [passwordInput, confirmPasswordInput] = getStep2PasswordInputs();
  return { passwordInput, confirmPasswordInput };
};

const reachPasswordStep = async () => {
  const view = render(<Register />);

  fireEvent.change(screen.getByPlaceholderText(/juan/i), { target: { value: 'Ana Gomez' } });
  fireEvent.change(screen.getByTestId('register-date-input'), { target: { value: '2000-01-01' } });
  fireEvent.change(screen.getByPlaceholderText(/310 123 4567/i), { target: { value: '3101234568' } });
  fireEvent.change(screen.getByTestId('register-email-input'), { target: { value: 'ana@mail.com' } });

  await sleep(550);
  await waitFor(() => expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled());

  fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
  await sleep(450);

  return { view };
};

const reachAvatarStep = async () => {
  const { view } = await reachPasswordStep();
  const passwordInputs = getStep2PasswordInputs();
  expect(passwordInputs).toHaveLength(2);

  await fillStep2(view);
  await waitFor(() => expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled());

  fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
  await sleep(450);

  return { view };
};

describe('Register avatar capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLoadingState = false;
    registerMock.mockResolvedValue(undefined);
    vi.stubGlobal('FileReader', MockFileReader as any);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows separate visible actions for taking a photo or choosing a file on step 3', async () => {
    await reachAvatarStep();

    expect(screen.getByRole('button', { name: /tomar foto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /elegir archivo/i })).toBeInTheDocument();
  }, 15000);

  it('configures the hidden mobile camera input with image capture settings', async () => {
    const { view } = await reachAvatarStep();

    const cameraInput = view.container.querySelector('#avatar-camera-input') as HTMLInputElement | null;
    expect(cameraInput).not.toBeNull();
    expect(cameraInput).toHaveAttribute('type', 'file');
    expect(cameraInput).toHaveAttribute('accept', 'image/*');
    expect(cameraInput).toHaveAttribute('capture', 'user');
  }, 15000);

  it('reuses the same preview state when selecting an image from camera or gallery', async () => {
    const { view } = await reachAvatarStep();

    const cameraInput = view.container.querySelector('#avatar-camera-input') as HTMLInputElement;
    const fileInput = view.container.querySelector('#avatar-file-input') as HTMLInputElement;

    fireEvent.change(cameraInput, {
      target: {
        files: [new File(['camera-photo'], 'camera-selfie.jpg', { type: 'image/jpeg' })],
      },
    });
    await sleep(850);

    await waitFor(() =>
      expect(screen.getByAltText('Preview')).toHaveAttribute('src', expect.stringContaining('camera-selfie.jpg')),
    );

    fireEvent.change(fileInput, {
      target: {
        files: [new File(['gallery-photo'], 'gallery-choice.png', { type: 'image/png' })],
      },
    });
    await sleep(850);

    await waitFor(() =>
      expect(screen.getByAltText('Preview')).toHaveAttribute('src', expect.stringContaining('gallery-choice.png')),
    );
  }, 15000);

  it('keeps the register payload unchanged even when an avatar preview was selected', async () => {
    const { view } = await reachAvatarStep();

    const fileInput = view.container.querySelector('#avatar-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['avatar'], 'profile-photo.webp', { type: 'image/webp' })],
      },
    });
    await sleep(850);

    fireEvent.click(view.container.querySelector('#terms') as HTMLInputElement);
    fireEvent.click(screen.getByRole('button', { name: /finalizar registro/i }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith({
        email: 'ana@mail.com',
        username: 'anagomez',
        password: 'Password1',
        name: 'Ana Gomez',
        phone: '3101234568',
        countryCode: '+57',
      }),
    );

    expect(Object.keys(registerMock.mock.calls[0][0]).sort()).toEqual([
      'countryCode',
      'email',
      'name',
      'password',
      'phone',
      'username',
    ]);
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  }, 15000);

  it('shows a friendly operational error on step 3 when registration is temporarily unavailable', async () => {
    registerMock.mockRejectedValueOnce(
      new Error('El registro está temporalmente no disponible. Intenta nuevamente en unos minutos.'),
    );

    const { view } = await reachAvatarStep();

    fireEvent.click(view.container.querySelector('#terms') as HTMLInputElement);
    fireEvent.click(screen.getByRole('button', { name: /finalizar registro/i }));

    await waitFor(() =>
      expect(
        screen.getByText('El registro está temporalmente no disponible. Intenta nuevamente en unos minutos.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/Paso 3 de 3/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Internal server error$/i)).not.toBeInTheDocument();
  }, 15000);

  it('opens the legal dialog from register step 3 and preserves avatar plus checkbox state when closed', async () => {
    const { view } = await reachAvatarStep();

    const fileInput = view.container.querySelector('#avatar-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['avatar'], 'profile-photo.webp', { type: 'image/webp' })],
      },
    });
    await sleep(850);

    const termsCheckbox = view.container.querySelector('#terms') as HTMLInputElement;
    fireEvent.click(termsCheckbox);
    expect(termsCheckbox.checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /ver términos y condiciones/i }));
    expect(screen.getByRole('dialog', { name: /términos y condiciones/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cerrar términos y condiciones/i }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /términos y condiciones/i })).not.toBeInTheDocument(),
    );
    expect(screen.getByAltText('Preview')).toHaveAttribute('src', expect.stringContaining('profile-photo.webp'));
    expect((view.container.querySelector('#terms') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Paso 3 de 3/i)).toBeInTheDocument();
  }, 15000);
});

describe('Register password visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLoadingState = false;
    registerMock.mockResolvedValue(undefined);
    vi.stubGlobal('FileReader', MockFileReader as any);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts step 2 with hidden password fields and icon controls to reveal them', async () => {
    const { view } = await reachPasswordStep();
    const [passwordInput, confirmPasswordInput] = getStep2PasswordInputs();

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /^mostrar contraseña$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^mostrar confirmación de contraseña$/i })).toBeInTheDocument();
  }, 15000);

  it('reveals only the primary password field and preserves its value', async () => {
    const { view } = await reachPasswordStep();
    let [passwordInput, confirmPasswordInput] = getStep2PasswordInputs();

    fireEvent.change(passwordInput, { target: { value: 'Password1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Secret999' } });
    fireEvent.click(screen.getByRole('button', { name: /^mostrar contraseña$/i }));

    [passwordInput, confirmPasswordInput] = getStep2PasswordInputs();

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(passwordInput).toHaveValue('Password1');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveValue('Secret999');
    expect(screen.getByRole('button', { name: /^ocultar contraseña$/i })).toBeInTheDocument();
  }, 15000);

  it('reveals the confirm password field independently and preserves its value', async () => {
    const { view } = await reachPasswordStep();
    let [passwordInput, confirmPasswordInput] = getStep2PasswordInputs();

    fireEvent.change(passwordInput, { target: { value: 'Password1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: /^mostrar confirmación de contraseña$/i }));

    [passwordInput, confirmPasswordInput] = getStep2PasswordInputs();

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveValue('Password1');
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');
    expect(confirmPasswordInput).toHaveValue('Password1');
    expect(screen.getByRole('button', { name: /^ocultar confirmación de contraseña$/i })).toBeInTheDocument();
  }, 15000);

  it('keeps password requirements and match validation accurate while fields are visible', async () => {
    const { view } = await reachPasswordStep();

    fireEvent.click(screen.getByRole('button', { name: /^mostrar contraseña$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^mostrar confirmación de contraseña$/i }));

    await fillStep2(view, { username: 'anagomez', password: 'password1', confirmPassword: 'password1' });
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    const [passwordInput, confirmPasswordInput] = getStep2PasswordInputs();
    fireEvent.change(passwordInput, { target: { value: 'Password1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password1' } });

    await waitFor(() => expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled());
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');
  }, 15000);

  it('does not submit or advance the wizard when a reveal icon is clicked', async () => {
    const { view } = await reachPasswordStep();
    await fillStep2(view);
    await waitFor(() => expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: /^mostrar contraseña$/i }));

    expect(screen.getByText(/Paso 2 de 3/i)).toBeInTheDocument();
    expect(screen.queryByText(/Paso 3 de 3/i)).not.toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  }, 15000);
});
