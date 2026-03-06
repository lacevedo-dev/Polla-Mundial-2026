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
    <input data-testid={type === 'date' ? 'register-date-input' : undefined} type={type} {...props} />
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

const reachAvatarStep = async () => {
  const view = render(<Register />);

  fireEvent.change(screen.getByPlaceholderText(/juan/i), { target: { value: 'Ana Gomez' } });
  fireEvent.change(screen.getByTestId('register-date-input'), { target: { value: '2000-01-01' } });
  fireEvent.change(screen.getByPlaceholderText(/310 123 4567/i), { target: { value: '3101234568' } });
  fireEvent.change(screen.getByTestId('register-email-input'), { target: { value: 'ana@mail.com' } });

  await sleep(550);
  await waitFor(() => expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled());

  fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
  await sleep(450);

  fireEvent.change(screen.getByTestId('register-username-input'), { target: { value: 'anagomez' } });

  const passwordInputs = view.container.querySelectorAll('input[type="password"]');
  expect(passwordInputs).toHaveLength(2);

  fireEvent.change(passwordInputs[0] as HTMLInputElement, { target: { value: 'Password1' } });
  fireEvent.change(passwordInputs[1] as HTMLInputElement, { target: { value: 'Password1' } });

  await sleep(1050);
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
});
