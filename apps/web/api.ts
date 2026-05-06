export const DEV_FALLBACK_API_URL = 'http://localhost:3004';

type ApiErrorOptions = {
    status?: number;
    code?: string;
    cause?: unknown;
};

export class ApiError extends Error {
    status?: number;
    code?: string;

    constructor(message: string, options: ApiErrorOptions = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = options.status;
        this.code = options.code;

        if (options.cause !== undefined) {
            (this as Error & { cause?: unknown }).cause = options.cause;
        }
    }
}

export function resolveBaseUrl(mode: string, rawBaseUrl?: string): string {
    const configuredBaseUrl = rawBaseUrl?.trim();

    if (mode === 'development' || mode === 'test') {
        return (configuredBaseUrl || DEV_FALLBACK_API_URL).replace(/\/+$/, '');
    }

    if (!configuredBaseUrl) {
        throw new Error('VITE_API_URL is required outside development mode.');
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(configuredBaseUrl);
    } catch {
        throw new Error(`VITE_API_URL is invalid: "${configuredBaseUrl}".`);
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error(`VITE_API_URL must use http or https: "${configuredBaseUrl}".`);
    }

    return configuredBaseUrl.replace(/\/+$/, '');
}

export const BASE_URL = resolveBaseUrl(import.meta.env.MODE, import.meta.env.VITE_API_URL);

export function resolveApiAssetUrl(rawPath?: string | null): string | undefined {
    const normalizedPath = rawPath?.trim();
    if (!normalizedPath) {
        return undefined;
    }

    if (
        normalizedPath.startsWith('http://') ||
        normalizedPath.startsWith('https://') ||
        normalizedPath.startsWith('data:') ||
        normalizedPath.startsWith('blob:')
    ) {
        return normalizedPath;
    }

    if (normalizedPath.startsWith('/')) {
        return `${BASE_URL}${normalizedPath}`;
    }

    return `${BASE_URL}/${normalizedPath.replace(/^\/+/, '')}`;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('token');
    const headers = new Headers(options.headers);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    try {
        const { useTenantStore } = await import('./stores/tenant.store');
        const slug = useTenantStore.getState().activeTenant?.slug;
        if (slug) headers.set('X-Tenant-Slug', slug);
    } catch {
        // store no disponible aún — ok, continuar sin header
    }

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    let response: Response;
    try {
        response = await fetch(`${BASE_URL}${normalizedPath}`, {
            ...options,
            headers,
        });
    } catch (error) {
        throw new ApiError('Error de red', {
            code: 'NETWORK_ERROR',
            cause: error,
        });
    }

    if (!response.ok) {
        const errorBody = await parseErrorBody(response);
        throw new ApiError(errorBody.message || 'Error en la petición', {
            status: response.status,
            code: errorBody.code,
        });
    }

    if (response.status === 204) return {} as T;

    return response.json();
}

async function parseErrorBody(response: Response): Promise<{ message: string; code?: string }> {
    const rawBody = await response.text().catch(() => '');
    if (!rawBody) {
        return { message: 'Error de red' };
    }

    try {
        const parsedBody = JSON.parse(rawBody) as { message?: string | string[]; code?: string };
        const message = Array.isArray(parsedBody.message)
            ? parsedBody.message.join(', ')
            : parsedBody.message;

        return {
            message: message || 'Error de red',
            code: parsedBody.code,
        };
    } catch {
        return { message: rawBody };
    }
}
