import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2, Mail, ShieldAlert } from 'lucide-react';
import { request, ApiError } from '../api';
import { useTenantStore } from '../stores/tenant.store';

function deriveContactUrl(contactEmail?: string | null): string | null {
    if (!contactEmail) return null;
    const domain = contactEmail.split('@')[1];
    return domain ? `www.${domain}` : null;
}

export default function ForgotPassword() {
    const tenant = useTenantStore((s) => s.tenant);
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const orgName = tenant?.branding?.companyDisplayName?.trim() || tenant?.name || 'Portal corporativo';
    const primaryColor = tenant?.branding?.primaryColor ?? '#f59e0b';

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await request<{ ok: boolean; found?: boolean }>('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ identifier: identifier.trim(), appUrl: window.location.origin }),
            });
            if (res.found === false) {
                setNotFound(true);
            } else {
                setSent(true);
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No fue posible procesar la solicitud.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <div className="w-full max-w-md">
                <Link to="/login" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white mb-5">
                    <ArrowLeft size={14} /> Volver al login
                </Link>

                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-2xl">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: primaryColor }}>
                            <Mail size={24} className="text-white" />
                        </div>
                        <h1 className="text-xl font-black text-white">Recuperar contraseña</h1>
                        <p className="text-slate-400 text-sm mt-1">{orgName}</p>
                    </div>

                    {notFound ? (
                        <div className="text-center space-y-4">
                            <AlertCircle size={44} className="text-rose-400 mx-auto" />
                            <div className="text-sm text-slate-300 space-y-2">
                                <p>La cédula <strong className="text-white">{identifier}</strong> no aparece registrada en la base de datos.</p>
                                {(() => {
                                    const contactUrl = deriveContactUrl(tenant?.contactEmail);
                                    return contactUrl ? (
                                        <p className="text-slate-400">Comuníquese con <span className="text-white font-semibold">{orgName}</span> en{' '}
                                            <a href={`https://${contactUrl}`} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: primaryColor }}>
                                                {contactUrl}
                                            </a>.
                                        </p>
                                    ) : (
                                        <p className="text-slate-400">Comuníquese con <span className="text-white font-semibold">{orgName}</span> para solicitar su registro.</p>
                                    );
                                })()}
                            </div>
                            <button onClick={() => { setNotFound(false); setError(null); }} className="block w-full rounded-xl py-3 text-center text-sm font-black text-white" style={{ backgroundColor: primaryColor }}>
                                Intentar con otro documento
                            </button>
                            <Link to="/login" className="block text-xs text-slate-500 hover:text-slate-300 mt-1">Volver al login</Link>
                        </div>
                    ) : sent ? (
                        <div className="text-center space-y-4">
                            <CheckCircle2 size={44} className="text-emerald-400 mx-auto" />
                            <p className="text-sm text-slate-300">
                                Si el documento <strong>{identifier}</strong> está registrado, enviaremos las instrucciones al correo asociado.
                            </p>
                            <Link to="/login" className="block w-full rounded-xl py-3 text-center text-sm font-black text-white" style={{ backgroundColor: primaryColor }}>
                                Volver al login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Número de documento</label>
                                <input
                                    type="text"
                                    required
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    autoComplete="username"
                                    inputMode="numeric"
                                    placeholder="Cédula o documento de identidad"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !identifier.trim()}
                                className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                style={{ backgroundColor: primaryColor, color: '#fff' }}
                            >
                                {loading ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : 'Enviar instrucciones'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
