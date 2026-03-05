const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004';

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('token');
    const headers = new Headers(options.headers);

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${BASE_URL}${path}`, {
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
