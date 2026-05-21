import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { request, ApiError } from '../api';
import { useAuthStore } from '../stores/auth.store';
import { useTenantStore } from '../stores/tenant.store';

export default function ChangePassword() {
    const navigate = useNavigate();
    const { user, setMustChangePassword, logout } = useAuthStore();
    const tenant = useTenantStore((s) => s.tenant);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const isForced = user?.mustChangePassword === true;
    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'ZonaPronósticos';
    const primaryColor = tenant?.branding?.primaryColor ?? '#f59e0b';

    /* — Validaciones de la nueva contraseña — */
    const validations = {
        length: newPassword.length >= 8,
        differentFromCurrent: newPassword.length > 0 && newPassword !== currentPassword,
        matches: confirmPassword.length > 0 && newPassword === confirmPassword,
    };
    const allValid = validations.length && validations.differentFromCurrent && validations.matches;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!allValid) {
            setError('Revisa que la contraseña cumpla todos los requisitos');
            return;
        }
        setLoading(true);
        try {
            await request('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            setMustChangePassword(false);
            setSuccess(true);
            setTimeout(() => navigate('/', { replace: true }), 1800);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ backgroundColor: `${primaryColor}20` }}
                    >
                        <KeyRound size={26} style={{ color: primaryColor }} />
                    </div>
                    <h1 className="text-2xl font-black text-white">Cambiar contraseña</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {isForced ? 'Es tu primer ingreso, configura una contraseña segura' : `Actualiza tu acceso a ${orgName}`}
                    </p>
                </div>

                {/* Aviso "primer login" */}
                {isForced && !success && (
                    <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
                        <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-amber-200 text-xs leading-relaxed">
                            <p className="font-semibold mb-0.5">Por seguridad</p>
                            <p className="text-amber-300/80">
                                Debes cambiar la contraseña temporal antes de continuar. Esto te tomará 30 segundos.
                            </p>
                        </div>
                    </div>
                )}

                {success ? (
                    <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center space-y-3">
                        <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
                        <h2 className="text-lg font-black text-white">¡Contraseña actualizada!</h2>
                        <p className="text-slate-400 text-sm">Redirigiendo al portal...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-slate-900 rounded-2xl p-6 space-y-4 border border-slate-800">
                        {error && (
                            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Current password */}
                        <Field
                            label={isForced ? 'Contraseña temporal' : 'Contraseña actual'}
                            value={currentPassword}
                            onChange={setCurrentPassword}
                            show={showCurrent}
                            onToggleShow={() => setShowCurrent(!showCurrent)}
                            placeholder={isForced ? 'La que recibiste por email' : '••••••••'}
                            autoComplete="current-password"
                        />

                        {/* New password */}
                        <Field
                            label="Nueva contraseña"
                            value={newPassword}
                            onChange={setNewPassword}
                            show={showNew}
                            onToggleShow={() => setShowNew(!showNew)}
                            placeholder="Mínimo 8 caracteres"
                            autoComplete="new-password"
                        />

                        {/* Confirm */}
                        <Field
                            label="Confirmar nueva contraseña"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            show={showNew}
                            placeholder="Repite la nueva contraseña"
                            autoComplete="new-password"
                        />

                        {/* Reglas */}
                        <ul className="text-xs space-y-1 pt-1">
                            <Rule ok={validations.length} text="Al menos 8 caracteres" />
                            <Rule ok={validations.differentFromCurrent} text="Diferente a la actual" />
                            <Rule ok={validations.matches} text="Las contraseñas coinciden" />
                        </ul>

                        <button
                            type="submit"
                            disabled={loading || !allValid}
                            className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: primaryColor, color: '#0f172a' }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Actualizando...
                                </>
                            ) : (
                                'Cambiar contraseña'
                            )}
                        </button>

                        {!isForced && (
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="w-full text-slate-400 hover:text-slate-200 text-xs font-medium pt-1"
                            >
                                Cancelar
                            </button>
                        )}

                        {isForced && (
                            <button
                                type="button"
                                onClick={() => { logout(); navigate('/login', { replace: true }); }}
                                className="w-full text-slate-500 hover:text-slate-300 text-xs font-medium pt-1"
                            >
                                Salir
                            </button>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}

/* ─── Subcomponents ────────────────────────────────────── */
interface FieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    show?: boolean;
    onToggleShow?: () => void;
    placeholder?: string;
    autoComplete?: string;
}

function Field({ label, value, onChange, show, onToggleShow, placeholder, autoComplete }: FieldProps) {
    return (
        <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">{label}</label>
            <div className="relative">
                <input
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
                {onToggleShow && (
                    <button
                        type="button"
                        onClick={onToggleShow}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        tabIndex={-1}
                    >
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
            </div>
        </div>
    );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
    return (
        <li className={`flex items-center gap-2 ${ok ? 'text-emerald-400' : 'text-slate-500'}`}>
            <CheckCircle2 size={12} className={ok ? 'opacity-100' : 'opacity-30'} />
            <span>{text}</span>
        </li>
    );
}
