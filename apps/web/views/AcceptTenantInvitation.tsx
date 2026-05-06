import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { request } from '../api';
import { useAuthStore } from '../stores/auth.store';

type State = 'loading' | 'success' | 'error' | 'needs_login';

export default function AcceptTenantInvitation() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token');
    const { user } = useAuthStore();

    const [state, setState] = useState<State>('loading');
    const [message, setMessage] = useState('');
    const [tenantName, setTenantName] = useState('');

    useEffect(() => {
        if (!token) {
            setState('error');
            setMessage('Enlace de invitación inválido o expirado.');
            return;
        }

        if (!user) {
            setState('needs_login');
            return;
        }

        const accept = async () => {
            try {
                const res = await request<{ ok: boolean; tenantSlug: string; tenantName: string }>(
                    `/tenant-invitations/accept/${token}`,
                    { method: 'POST' },
                );
                setTenantName(res.tenantName);
                setState('success');
                setTimeout(() => navigate('/'), 3000);
            } catch (err: any) {
                setState('error');
                setMessage(err?.message ?? 'Error al aceptar la invitación');
            }
        };

        accept();
    }, [token, user, navigate]);

    if (state === 'needs_login') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-4">
                    <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
                        <span className="text-3xl">🏆</span>
                    </div>
                    <h1 className="text-xl font-black text-slate-900">Tienes una invitación</h1>
                    <p className="text-sm text-slate-500">Inicia sesión para aceptarla</p>
                    <button
                        onClick={() => navigate(`/login?redirect=${encodeURIComponent(window.location.href)}`)}
                        className="w-full py-3 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm hover:bg-amber-500 transition-all"
                    >
                        Iniciar sesión
                    </button>
                    <button
                        onClick={() => navigate(`/register?redirect=${encodeURIComponent(window.location.href)}`)}
                        className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
                    >
                        Crear cuenta
                    </button>
                </div>
            </div>
        );
    }

    if (state === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center space-y-3">
                    <Loader2 size={36} className="text-amber-400 animate-spin mx-auto" />
                    <p className="text-slate-500 font-semibold">Verificando invitación...</p>
                </div>
            </div>
        );
    }

    if (state === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-4">
                    <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
                    <h1 className="text-xl font-black text-slate-900">¡Bienvenido a {tenantName}!</h1>
                    <p className="text-sm text-slate-500">Ya eres parte de la organización. Redirigiendo...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="bg-white rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-4">
                <XCircle size={48} className="text-rose-500 mx-auto" />
                <h1 className="text-xl font-black text-slate-900">Invitación no válida</h1>
                <p className="text-sm text-slate-500">{message}</p>
                <button
                    onClick={() => navigate('/')}
                    className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
                >
                    Ir al inicio
                </button>
            </div>
        </div>
    );
}
