import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { request, ApiError } from '../api';
import { useTenantStore } from '../stores/tenant.store';

export default function ResetPassword() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const tenant = useTenantStore((s) => s.tenant);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const orgName = tenant?.branding?.companyDisplayName?.trim() || tenant?.name || 'Portal corporativo';
    const primaryColor = tenant?.branding?.primaryColor ?? '#f59e0b';

    const validations = {
        length: newPassword.length >= 8,
        matches: confirmPassword.length > 0 && newPassword === confirmPassword,
    };
    const allValid = validations.length && validations.matches;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!allValid) return;
        setError(null);
        setLoading(true);
        try {
            await request('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, newPassword }),
            });
            setSuccess(true);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo restablecer la contraseña.');
        } finally {
            setLoading(false);
        }
    }

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
                <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center space-y-4 w-full max-w-sm">
                    <ShieldAlert size={44} className="text-rose-400 mx-auto" />
                    <p className="text-white font-bold">Enlace no válido</p>
                    <p className="text-slate-400 text-sm">El enlace de recuperación es inválido o ha expirado.</p>
                    <Link
                        to="/forgot-password"
                        className="block w-full rounded-xl py-3 text-center text-sm font-black text-white"
                        style={{ backgroundColor: primaryColor }}
                    >
                        Solicitar nuevo enlace
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ backgroundColor: `${primaryColor}20` }}
                    >
                        <KeyRound size={26} style={{ color: primaryColor }} />
                    </div>
                    <h1 className="text-2xl font-black text-white">Nueva contraseña</h1>
                    <p className="text-slate-400 text-sm mt-1">{orgName}</p>
                </div>

                {success ? (
                    <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center space-y-4">
                        <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
                        <h2 className="text-lg font-black text-white">¡Contraseña actualizada!</h2>
                        <p className="text-slate-400 text-sm">Ya puedes iniciar sesión con tu nueva contraseña.</p>
                        <Link
                            to="/login"
                            className="block w-full rounded-xl py-3 text-center text-sm font-black text-white"
                            style={{ backgroundColor: primaryColor }}
                        >
                            Ir al login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-slate-900 rounded-2xl p-6 space-y-4 border border-slate-800">
                        {error && (
                            <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Nueva contraseña</label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    placeholder="Mínimo 8 caracteres"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                                    tabIndex={-1}
                                >
                                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-1.5">Confirmar contraseña</label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    placeholder="Repite la nueva contraseña"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                                    tabIndex={-1}
                                >
                                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <ul className="text-xs space-y-1 pt-1">
                            <li className={`flex items-center gap-2 ${validations.length ? 'text-emerald-400' : 'text-slate-500'}`}>
                                <CheckCircle2 size={12} className={validations.length ? 'opacity-100' : 'opacity-30'} />
                                Al menos 8 caracteres
                            </li>
                            <li className={`flex items-center gap-2 ${validations.matches ? 'text-emerald-400' : 'text-slate-500'}`}>
                                <CheckCircle2 size={12} className={validations.matches ? 'opacity-100' : 'opacity-30'} />
                                Las contraseñas coinciden
                            </li>
                        </ul>

                        <button
                            type="submit"
                            disabled={loading || !allValid}
                            className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: primaryColor, color: '#fff' }}
                        >
                            {loading ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : 'Guardar nueva contraseña'}
                        </button>

                        <div className="text-center">
                            <Link to="/login" className="text-xs text-slate-500 hover:text-slate-300">
                                Volver al login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
