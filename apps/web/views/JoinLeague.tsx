import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, LogIn, Ticket } from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';

const JoinLeague: React.FC = () => {
    const navigate = useNavigate();
    const { code: codeFromRoute } = useParams();
    const joinLeague = useLeagueStore((state) => state.joinLeague);
    const [code, setCode] = React.useState(codeFromRoute?.toUpperCase() ?? '');
    const [error, setError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const isAuthenticated = Boolean(localStorage.getItem('token'));

    const handleJoin = async () => {
        const normalizedCode = code.trim().toUpperCase();
        if (!normalizedCode) {
            setError('Ingresa un código válido para unirte a la liga.');
            return;
        }

        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await joinLeague(normalizedCode);
            navigate('/dashboard');
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible unirte a la liga.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-xl rounded-[2.5rem] bg-white p-8 shadow-2xl">
                <div className="flex items-center gap-3 text-lime-700">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-100">
                        <Ticket className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-lime-600">Unirse a una liga</p>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Ingresa tu código real</h1>
                    </div>
                </div>

                <p className="mt-6 text-sm text-slate-500">
                    Esta pantalla ya usa el flujo real de <code>POST /leagues/join</code> con body <code>{'{ code }'}</code>.
                    Si llegaste desde un enlace público, el código se precargó automáticamente.
                </p>

                <label className="mt-6 block">
                    <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Código de acceso</span>
                    <input
                        aria-label="Código de liga"
                        value={code}
                        onChange={(event) => setCode(event.target.value.toUpperCase())}
                        placeholder="ABC123"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-black uppercase tracking-[0.3em] text-slate-900 outline-none"
                    />
                </label>

                {error ? (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                ) : null}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-lime-400 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSubmitting}
                        onClick={handleJoin}
                    >
                        {isAuthenticated ? (
                            <>
                                {isSubmitting ? 'Uniendo...' : 'Unirme ahora'}
                                <ArrowRight className="h-4 w-4" />
                            </>
                        ) : (
                            <>
                                Iniciar sesión para unirme
                                <LogIn className="h-4 w-4" />
                            </>
                        )}
                    </button>
                    {!isAuthenticated ? (
                        <button
                            className="rounded-2xl border border-slate-200 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-600"
                            onClick={() => navigate('/register')}
                        >
                            Crear cuenta
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default JoinLeague;
