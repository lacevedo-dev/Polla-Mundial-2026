export const DEV_FALLBACK_API_URL = 'http://localhost:3004';

export function resolveBaseUrl(mode: string, rawBaseUrl?: string): string {
    const configuredBaseUrl = rawBaseUrl?.trim();

    if (mode === 'development') {
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

const BASE_URL = resolveBaseUrl(import.meta.env.MODE, import.meta.env.VITE_API_URL);

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('token');
    const headers = new Headers(options.headers);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${BASE_URL}${normalizedPath}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Error de red' }));
        throw new Error(error.message || 'Error en la petición');
    }

    if (response.status === 204) return {} as T;

    return response.json();
}
