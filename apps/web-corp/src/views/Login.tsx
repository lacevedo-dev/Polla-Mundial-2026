import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, Building2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { useTenantStore } from '../stores/tenant.store';

export default function Login() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { login, isLoading, error } = useAuthStore();
    const tenant = useTenantStore((s) => s.tenant);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'ZonaPronosticos';
    const primaryColor = tenant?.branding?.primaryColor ?? '#f59e0b';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate(params.get('next') ?? '/');
        } catch { /* error ya está en el store */ }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4">
            <div className="w-full max-w-sm">
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    {tenant?.branding?.logoUrl ? (
                        <img src={tenant.branding.logoUrl} alt={orgName} className="h-14 mx-auto object-contain mb-3" />
                    ) : (
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <Building2 size={28} className="text-white" />
                        </div>
                    )}
                    <h1 className="text-2xl font-black text-white">{orgName}</h1>
                    <p className="text-slate-400 text-sm mt-1">Ingresa a tu portal corporativo</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-slate-900 rounded-2xl p-6 space-y-4 border border-slate-800">
                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-1.5">Correo electrónico</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            placeholder="tu@empresa.com"
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
                </form>

                <p className="text-center text-slate-500 text-xs mt-6">
                    ¿No tienes cuenta?{' '}
                    <a href="https://zonapronosticos.com" className="text-amber-400 hover:underline">
                        Contáctanos
                    </a>
                </p>
            </div>
        </div>
    );
}
