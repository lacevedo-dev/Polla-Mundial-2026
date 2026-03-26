import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, LogIn, Ticket, Users, Info } from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';
import { request } from '../api';

interface LeaguePreview {
    name: string;
    description?: string;
    memberCount?: number;
    adminName?: string;
}

const JoinLeague: React.FC = () => {
    const navigate = useNavigate();
    const { code: codeFromRoute } = useParams();
    const joinLeague = useLeagueStore((state) => state.joinLeague);
    const [code, setCode] = React.useState(codeFromRoute?.toUpperCase() ?? '');
    const [error, setError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [leaguePreview, setLeaguePreview] = React.useState<LeaguePreview | null>(null);
    const [previewLoading, setPreviewLoading] = React.useState(false);

    const isAuthenticated = Boolean(localStorage.getItem('token'));

    // Fetch league preview when there's a code from route
    React.useEffect(() => {
        if (!codeFromRoute) return;
        const normalized = codeFromRoute.toUpperCase();

        // If not authenticated, save code and redirect to register
        if (!isAuthenticated) {
            localStorage.setItem('pending_league_code', normalized);
            navigate(`/register?joinCode=${normalized}`, { replace: true });
            return;
        }

        setPreviewLoading(true);
        request<LeaguePreview>(`/leagues/info-by-code/${normalized}`)
            .then((data) => {
                setLeaguePreview(data);
            })
            .catch(() => {
                // Endpoint doesn't exist or league not found — show generic UI
                setLeaguePreview(null);
            })
            .finally(() => {
                setPreviewLoading(false);
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codeFromRoute, isAuthenticated]);

    const handleJoin = async () => {
        const normalizedCode = code.trim().toUpperCase();
        if (!normalizedCode) {
            setError('Ingresa un código válido para unirte a la liga.');
            return;
        }

        if (!isAuthenticated) {
            localStorage.setItem('pending_league_code', normalizedCode);
            navigate(`/register?joinCode=${normalizedCode}`);
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await joinLeague(normalizedCode);
            navigate('/my-leagues', {
                state: {
                    justJoined: true,
                    leagueName: leaguePreview?.name ?? normalizedCode,
                },
            });
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible unirte a la liga.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const displayLeagueName = leaguePreview?.name;

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-xl rounded-[2.5rem] bg-white p-8 shadow-2xl">
                <div className="flex items-center gap-3 text-lime-700">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-100">
                        <Ticket className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-lime-600">Unirse a una liga</p>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
                            {displayLeagueName ? displayLeagueName : 'Ingresa tu código'}
                        </h1>
                    </div>
                </div>

                {/* League preview card */}
                {previewLoading && (
                    <div className="mt-6 animate-pulse rounded-2xl bg-slate-100 h-24" />
                )}

                {!previewLoading && leaguePreview && (
                    <div className="mt-6 rounded-2xl border border-lime-200 bg-lime-50 p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-slate-900">
                                <Users className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-black uppercase tracking-wide text-slate-900">{leaguePreview.name}</p>
                                {leaguePreview.description && (
                                    <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{leaguePreview.description}</p>
                                )}
                                <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.14em]">
                                    {leaguePreview.memberCount != null && (
                                        <span className="rounded-full border border-lime-300 bg-lime-100 px-2 py-0.5 text-lime-700">
                                            {leaguePreview.memberCount} participante{leaguePreview.memberCount !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {leaguePreview.adminName && (
                                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
                                            Admin: {leaguePreview.adminName}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Generic info when no preview (code typed manually, no league found) */}
                {!previewLoading && !leaguePreview && code && (
                    <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span>
                            Liga privada — Código: <span className="font-black tracking-widest text-slate-700">{code}</span>
                        </span>
                    </div>
                )}

                {!codeFromRoute && (
                    <label className="mt-6 block">
                        <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Código de acceso</span>
                        <input
                            aria-label="Código de liga"
                            value={code}
                            onChange={(event) => setCode(event.target.value.toUpperCase())}
                            placeholder="ABC123"
                            className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-black uppercase tracking-[0.3em] text-slate-900 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-200"
                        />
                    </label>
                )}

                {codeFromRoute && !leaguePreview && !previewLoading && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Código de acceso</span>
                        <p className="mt-1 text-2xl font-black uppercase tracking-[0.3em] text-slate-900">{code}</p>
                    </div>
                )}

                {error ? (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                ) : null}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-lime-400 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSubmitting || previewLoading}
                        onClick={handleJoin}
                    >
                        {isAuthenticated ? (
                            <>
                                {isSubmitting
                                    ? 'Uniéndose...'
                                    : displayLeagueName
                                        ? `Unirme a ${displayLeagueName}`
                                        : 'Unirme ahora'}
                                <ArrowRight className="h-4 w-4 shrink-0" />
                            </>
                        ) : (
                            <>
                                Crear cuenta para unirme
                                <LogIn className="h-4 w-4 shrink-0" />
                            </>
                        )}
                    </button>
                    {!isAuthenticated ? (
                        <button
                            className="rounded-2xl border border-slate-200 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-600 hover:bg-slate-50"
                            onClick={() => navigate(`/login?joinCode=${code}`)}
                        >
                            Ya tengo cuenta
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default JoinLeague;
