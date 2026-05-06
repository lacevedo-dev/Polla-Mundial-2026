const DEV_API_URL = 'http://localhost:3004';

export class ApiError extends Error {
    status?: number;
    code?: string;
    constructor(message: string, public readonly options: { status?: number; code?: string } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = options.status;
        this.code = options.code;
    }
}

function getBaseUrl(): string {
    const env = import.meta.env;
    if (env.MODE === 'development' || env.MODE === 'test') {
        return (env.VITE_API_URL || DEV_API_URL).replace(/\/+$/, '');
    }
    if (!env.VITE_API_URL) throw new Error('VITE_API_URL is required in production');
    return env.VITE_API_URL.replace(/\/+$/, '');
}

export const BASE_URL = getBaseUrl();

function getHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const token = localStorage.getItem('corp_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const devSlug = import.meta.env.VITE_TENANT_SLUG as string | undefined;
    if (devSlug) headers.set('X-Tenant-Slug', devSlug);

    return headers;
}

export async function request<T = unknown>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, { ...init, headers: getHeaders(init.headers as HeadersInit) });

    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            msg = body?.message ?? body?.error ?? msg;
        } catch { /* ignore */ }
        throw new ApiError(msg, { status: res.status });
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}
