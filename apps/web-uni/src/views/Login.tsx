import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, Building2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { useTenantStore } from '../stores/tenant.store';
import { getRecaptchaToken } from '../recaptcha';
import { ApiError } from '../api';

export default function Login() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { login, isLoading, error } = useAuthStore();
    const tenant = useTenantStore((s) => s.tenant);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [notRegistered, setNotRegistered] = useState(false);

    const orgName = tenant?.branding?.companyDisplayName?.trim() || tenant?.name || 'Polla Coopcanapro';
    const primaryColor = tenant?.branding?.primaryColor ?? '#f59e0b';
    const configuredBackground = tenant?.branding?.heroImageUrl?.trim();
    const loginBackgroundUrl = configuredBackground || (tenant?.slug === 'coopcanapro'
        ? tenant?.branding?.logoUrl
        : null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setNotRegistered(false);
        try {
            const recaptchaToken = await getRecaptchaToken('login');
            const user = await login(identifier.trim(), password, recaptchaToken);
            if (user.mustChangePassword) {
                navigate('/change-password', { replace: true });
            } else {
                navigate(params.get('next') ?? '/', { replace: true });
            }
        } catch (err) {
            if (err instanceof ApiError && err.code === 'IDENTIFIER_NOT_FOUND') {
                setNotRegistered(true);
            }
        }
    };

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 relative overflow-hidden"
            style={loginBackgroundUrl ? {
                backgroundImage: `linear-gradient(rgba(2,6,23,0.48), rgba(2,6,23,0.72)), url(${loginBackgroundUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            } : undefined}
        >
            <div className="w-full max-w-sm relative z-10">
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    {tenant?.branding?.logoUrl ? (
                        <div
                            className="mx-auto mb-3 flex h-28 w-full max-w-sm items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/95 px-8 py-5 shadow-2xl shadow-black/30 backdrop-blur-sm"
                        >
                            <img
                                src={tenant.branding.logoUrl}
                                alt={orgName}
                                className="max-h-20 w-full object-contain"
                            />
                        </div>
                    ) : (
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <Building2 size={28} className="text-white" />
                        </div>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-slate-900/95 backdrop-blur-sm rounded-2xl p-6 space-y-4 border border-slate-800 shadow-2xl">
                    {notRegistered ? (
                        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-sm space-y-2">
                            <p className="text-rose-400">
                                La cédula <strong className="text-white">{identifier}</strong> no aparece registrada en la base de datos.
                            </p>
                            <p className="text-rose-400/80">
                                Si tiene alguna dificultad para ingresar o recuperar su clave, comuníquese con{' '}
                                <span className="text-white font-semibold">{orgName}</span> desde el chat de nuestra página web{' '}
                                <a href="https://www.coopcanapro.coop" target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: primaryColor }}>
                                    www.coopcanapro.coop
                                </a>{' '}
                                o desde WhatsApp{' '}
                                <a href="https://wa.me/573183143799" target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: primaryColor }}>
                                    573183143799
                                </a>.
                            </p>
                        </div>
                    ) : error ? (
                        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-sm">
                            {error}
                        </div>
                    ) : null}

                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-1.5">Documento</label>
                        <input
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required
                            autoComplete="username"
                            placeholder="Cédula o documento"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-1.5">Contraseña</label>
                        <div className="relative">
                            <input
                                type={showPass ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                            >
                                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ backgroundColor: primaryColor, color: '#fff' }}
                    >
                        {isLoading ? <><Loader2 size={16} className="animate-spin" /> Entrando...</> : 'Ingresar'}
                    </button>
                    <div className="text-right">
                        <Link to="/forgot-password" className="text-xs font-bold text-amber-400 hover:underline">
                            ¿Olvidaste tu contraseña?
                        </Link>
                    </div>
                    <div className="border-t border-slate-800 pt-4 text-center text-xs text-slate-300">
                        ¿No tienes cuenta?{' '}
                        <a href="https://pollacoopcanapro.atencionesvirtuales.com.co/login" className="font-bold text-amber-400 hover:underline">
                            Contáctanos
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}
