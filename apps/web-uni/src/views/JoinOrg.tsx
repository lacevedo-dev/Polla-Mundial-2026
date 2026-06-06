import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Building2 } from 'lucide-react';
import { request, ApiError } from '../api';
import { useAuthStore } from '../stores/auth.store';

type Phase = 'loading' | 'need_login' | 'accepting' | 'success' | 'error';

export default function JoinOrg() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token');
    const { user } = useAuthStore();
    const [phase, setPhase] = useState<Phase>('loading');
    const [orgName, setOrgName] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!token) {
            setPhase('error');
            setErrorMsg('El enlace de invitación no es válido.');
            return;
        }
        if (!user) {
            setPhase('need_login');
            return;
        }
        acceptInvitation();
    }, [token, user]);

    const acceptInvitation = async () => {
        if (!token) return;
        setPhase('accepting');
        try {
            const res = await request<{ tenantName: string }>(`/tenant-invitations/accept/${token}`, {
                method: 'POST',
            });
            setOrgName(res.tenantName ?? 'tu organización');
            setPhase('success');
            setTimeout(() => navigate('/'), 3000);
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'No se pudo aceptar la invitación';
            setErrorMsg(msg);
            setPhase('error');
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-center">
            <div className="w-full max-w-sm">
                {phase === 'loading' && (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={40} className="text-amber-400 animate-spin" />
                        <p className="text-slate-300 font-semibold">Verificando invitación...</p>
                    </div>
                )}

                {phase === 'need_login' && (
                    <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
                        <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Building2 size={28} className="text-amber-400" />
                        </div>
                        <h2 className="text-xl font-black text-white mb-2">Tienes una invitación</h2>
                        <p className="text-slate-400 text-sm mb-6">
                            Debes iniciar sesión para aceptar la invitación a esta organización.
                        </p>
                        <Link
                            to={`/login?next=/join-org?token=${token}`}
                            className="block w-full py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 font-black rounded-xl transition-colors text-sm"
                        >
                            Iniciar sesión
                        </Link>
                    </div>
                )}

                {phase === 'accepting' && (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={40} className="text-amber-400 animate-spin" />
                        <p className="text-slate-300 font-semibold">Aceptando invitación...</p>
                    </div>
                )}

                {phase === 'success' && (
                    <div className="flex flex-col items-center gap-4">
                        <CheckCircle size={56} className="text-emerald-400" />
                        <div>
                            <h2 className="text-xl font-black text-white">¡Bienvenido!</h2>
                            <p className="text-slate-400 text-sm mt-1">
                                Ya eres parte de <strong className="text-white">{orgName}</strong>.
                                Redirigiendo al portal...
                            </p>
                        </div>
                    </div>
                )}

                {phase === 'error' && (
                    <div className="flex flex-col items-center gap-4">
                        <XCircle size={56} className="text-rose-400" />
                        <div>
                            <h2 className="text-xl font-black text-white">Invitación no válida</h2>
                            <p className="text-slate-400 text-sm mt-1">{errorMsg}</p>
                        </div>
                        <Link
                            to="/"
                            className="mt-2 text-amber-400 text-sm hover:underline font-semibold"
                        >
                            Ir al inicio
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
