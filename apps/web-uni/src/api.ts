const DEV_API_URL = 'http://localhost:3001';

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

export function resolveCorpBrandingAssetUrl(rawPath?: string | null): string | undefined {
    const normalizedPath = rawPath?.trim();
    if (!normalizedPath) return undefined;

    if (!normalizedPath.startsWith('/uploads/branding/')) {
        return normalizedPath;
    }

    return `${BASE_URL}${normalizedPath}`;
}

/**
 * Detecta el slug del tenant desde el hostname actual.
 * Se usa para inyectar X-Tenant-Slug en cada request a la API,
 * ya que en producción el Host header apunta a api.zonapronosticos.com
 * y el backend no puede saber el tenant de origen sin este header.
 */
function resolveTenantSlug(): string | null {
    // Prioridad 1: variable de entorno explícita (producción)
    const envSlug = (import.meta.env.VITE_TENANT_SLUG as string)?.trim();
    if (envSlug) return envSlug;

    // Prioridad 2: detección automática desde hostname
    const hostname = window.location.hostname;
    const subdomainMatch = hostname.match(/^([^.]+)\.atencionesvirtuales\.com.co$/);
    if (subdomainMatch && subdomainMatch[1] !== 'www') return subdomainMatch[1];
    const isCustomDomain =
        !hostname.includes('zonapronosticos.com') &&
        !hostname.includes('tupollamundial.com') &&
        !hostname.includes('localhost') &&
        !hostname.includes('127.0.0.1');
    if (isCustomDomain) return hostname;
    return null;
}

function getHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const token = localStorage.getItem('corp_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const slug = resolveTenantSlug();
    if (slug) headers.set('X-Tenant-Slug', slug);

    return headers;
}

export async function uploadFile<T = unknown>(path: string, formData: FormData): Promise<T> {
    const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = new Headers();
    const token = localStorage.getItem('corp_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const slug = resolveTenantSlug();
    if (slug) headers.set('X-Tenant-Slug', slug);

    console.log('[uploadFile] POST', url, 'token?', !!token, 'slug?', slug);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
        console.warn('[uploadFile] Timeout after 30s, aborting');
        controller.abort();
    }, 30000);

    try {
        const res = await fetch(url, { method: 'POST', body: formData, headers, signal: controller.signal });
        clearTimeout(timeout);
        console.log('[uploadFile] Response status:', res.status);
        if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try {
                const body = await res.json();
                msg = body?.message ?? body?.error ?? msg;
            } catch (e) {
                console.warn('[uploadFile] Could not parse error JSON:', e);
            }
            throw new ApiError(msg, { status: res.status });
        }
        return res.json() as Promise<T>;
    } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            throw new ApiError('La subida tardó demasiado. Verifica tu conexión o que el endpoint esté activo.', { status: 0 });
        }
        console.error('[uploadFile] Fetch error:', err);
        throw err;
    }
}

export async function request<T = unknown>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, { ...init, headers: getHeaders(init.headers as HeadersInit) });

    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        let code: string | undefined;
        try {
            const body = await res.json();
            msg = body?.message ?? body?.error ?? msg;
            code = body?.code ?? undefined;
        } catch { /* ignore */ }
        throw new ApiError(msg, { status: res.status, code });
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}
