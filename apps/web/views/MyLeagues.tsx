import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Trophy, Plus, Globe, Users, Clock, CheckCircle2, X,
    ChevronRight, Wallet, Crown,
} from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';

function timeUntilExpiry(expiresAt?: string | null): string {
    if (!expiresAt) return '';
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expirada';
    const days = Math.floor(diff / 86_400_000);
    if (days >= 1) return `Expira en ${days} día${days !== 1 ? 's' : ''}`;
    const hours = Math.floor(diff / 3_600_000);
    return `Expira en ${hours}h`;
}

function formatCurrency(amount?: number | null, currency?: string | null): string {
    if (!amount) return 'Gratis';
    const sym = currency === 'COP' ? '$' : (currency ?? '$');
    return `${sym}${amount.toLocaleString('es-CO')}`;
}

function leagueInitials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0] ?? '')
        .join('')
        .toUpperCase();
}

function formatInvitationPrivacy(privacy?: 'PUBLIC' | 'PRIVATE'): string {
    return privacy === 'PUBLIC' ? 'Pública' : 'Privada';
}

const MyLeagues: React.FC = () => {
    const navigate = useNavigate();
    const {
        myLeagues, invitations, publicLeagues, isLoading,
        fetchMyLeagues, fetchInvitations, fetchPublicLeagues,
        setActiveLeague, acceptInvitation, declineInvitation,
    } = useLeagueStore();

    const [acceptingId, setAcceptingId] = React.useState<string | null>(null);
    const [decliningId, setDecliningId] = React.useState<string | null>(null);
    const [joiningId, setJoiningId] = React.useState<string | null>(null);

    React.useEffect(() => {
        void fetchMyLeagues();
        void fetchInvitations();
        void fetchPublicLeagues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSelectLeague = (leagueId: string) => {
        setActiveLeague(leagueId);
        navigate('/predictions');
    };

    const handleAccept = async (id: string) => {
        setAcceptingId(id);
        try {
            const leagueId = await acceptInvitation(id);
            setActiveLeague(leagueId);
            navigate('/predictions');
        } catch {
            setAcceptingId(null);
        }
    };

    const handleDecline = async (id: string) => {
        setDecliningId(id);
        try { await declineInvitation(id); } finally { setDecliningId(null); }
    };

    const handleJoinPublic = async (id: string) => {
        setJoiningId(id);
        try {
            // Public leagues can be joined via code — but we have the id, redirect to join page
            // or use the league id to join directly (requires join-by-id endpoint)
            // For now, navigate to create/join page
            navigate(`/join`);
        } finally {
            setJoiningId(null);
        }
    };

    return (
        <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 pb-24">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Mis Pollas</h1>
                <p className="mt-1 text-sm text-slate-500">Gestiona tus ligas y acepta nuevas invitaciones.</p>
            </div>

            {/* INVITACIONES PENDIENTES */}
            {(invitations.length > 0 || isLoading) && (
                <section>
                    <div className="mb-3 flex items-center gap-2">
                        <Trophy size={13} className="text-slate-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                            Invitaciones pendientes
                        </span>
                    </div>
                    <div className="space-y-3">
                        {invitations.map((inv) => (
                            <div
                                key={inv.id}
                                className="flex items-start gap-4 rounded-2xl bg-slate-900 px-5 py-4 text-white"
                            >
                                {/* League avatar */}
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-sm font-black">
                                    {leagueInitials(inv.leagueName)}
                                </div>

                                {/* Info */}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-black uppercase tracking-wide text-white">
                                        {inv.leagueName}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">
                                        {inv.leagueCode ? (
                                            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5">
                                                {inv.leagueCode}
                                            </span>
                                        ) : null}
                                        <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5">
                                            {formatInvitationPrivacy(inv.privacy)}
                                        </span>
                                        {inv.plan ? (
                                            <span className="rounded-full border border-lime-500/30 bg-lime-500/10 px-2 py-0.5 text-lime-300">
                                                {inv.plan}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="mt-0.5 text-xs text-slate-400">
                                        Invitado por{' '}
                                        <span className="font-bold text-lime-400">{inv.inviterName}</span>
                                        {inv.inviterUsername ? <span className="text-slate-500"> · @{inv.inviterUsername}</span> : null}
                                    </p>
                                    {inv.leagueDescription ? (
                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">
                                            {inv.leagueDescription}
                                        </p>
                                    ) : null}
                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                                        <span className="inline-flex items-center gap-1">
                                            <Users size={11} className="text-slate-500" />
                                            {inv.memberCount ?? 0}/{inv.maxParticipants ?? '∞'} participantes
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Wallet size={11} className={inv.baseFee ? 'text-amber-300' : 'text-slate-500'} />
                                            {formatCurrency(inv.baseFee, inv.currency)}
                                        </span>
                                        {inv.primaryTournamentName ? (
                                            <span className="inline-flex items-center gap-1">
                                                <Trophy size={11} className="text-slate-500" />
                                                {inv.primaryTournamentName}
                                            </span>
                                        ) : null}
                                    </div>
                                    {inv.expiresAt && (
                                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                                            <Clock size={10} />
                                            {timeUntilExpiry(inv.expiresAt)}
                                        </p>
                                    )}
                                    {typeof inv.closePredictionMinutes === 'number' ? (
                                        <p className="mt-1 text-[10px] text-slate-500">
                                            Cierre de pronósticos: {inv.closePredictionMinutes} min antes
                                        </p>
                                    ) : null}
                                </div>

                                {/* Actions */}
                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                        onClick={() => handleDecline(inv.id)}
                                        disabled={decliningId === inv.id}
                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
                                    >
                                        <X size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleAccept(inv.id)}
                                        disabled={acceptingId === inv.id}
                                        className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-lime-400 px-4 text-[10px] font-black uppercase tracking-wider text-slate-900 transition hover:bg-lime-300 disabled:opacity-60"
                                    >
                                        {acceptingId === inv.id
                                            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                                            : <><CheckCircle2 size={14} /> Unirme</>
                                        }
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* MIS LIGAS ACTIVAS */}
            <section>
                <div className="mb-3 flex items-center gap-2">
                    <Crown size={13} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                        Mis ligas activas
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Loading skeletons */}
                    {isLoading && myLeagues.length === 0 &&
                        [1, 2].map((i) => (
                            <div key={i} className="h-44 animate-pulse rounded-[1.75rem] bg-slate-100" />
                        ))
                    }

                    {/* League cards — hover: lift + lime accent */}
                    {myLeagues.map((league) => (
                        <button
                            key={league.id}
                            onClick={() => handleSelectLeague(league.id)}
                            className="group relative flex flex-col rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-lime-400 hover:shadow-[0_8px_24px_-4px_rgba(163,230,53,0.25)]"
                        >
                            {/* Role badge */}
                            <span className={`absolute right-4 top-4 rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
                                league.role === 'ADMIN'
                                    ? 'bg-slate-900 text-lime-400'
                                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                            }`}>
                                {league.role === 'ADMIN' ? 'Admin' : 'Jugador'}
                            </span>

                            {/* Avatar */}
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white transition-colors group-hover:bg-lime-400 group-hover:text-slate-900">
                                {leagueInitials(league.name)}
                            </div>

                            {/* Name */}
                            <p className="pr-16 text-sm font-black uppercase leading-tight tracking-tight text-slate-900 transition-colors group-hover:text-lime-600">
                                {league.name}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                                {league.stats?.memberCount ?? 0} participantes
                            </p>

                            {/* Stats */}
                            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 transition-colors group-hover:border-lime-100">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Ranking</p>
                                    <p className="text-lg font-black text-slate-900">
                                        {league.stats?.rank ? `#${league.stats.rank}` : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Puntos</p>
                                    <p className="text-lg font-black text-lime-500">
                                        {league.stats?.points ?? 0}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}

                    {/* Create new — always last */}
                    <button
                        onClick={() => navigate('/create-league')}
                        className="group flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-[1.75rem] border-2 border-dashed border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-lime-400 hover:bg-lime-50 hover:shadow-[0_8px_24px_-4px_rgba(163,230,53,0.15)]"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lime-400 text-slate-900 shadow-md transition-transform duration-200 group-hover:scale-110">
                            <Plus size={24} />
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition-colors group-hover:text-lime-700">
                                Crear nueva polla
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                                Organiza tu propia liga<br />con amigos o compañeros.
                            </p>
                        </div>
                    </button>
                </div>
            </section>

            {/* EXPLORAR LIGAS PÚBLICAS */}
            <section>
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Globe size={13} className="text-slate-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                            Explorar ligas públicas
                        </span>
                    </div>
                    {publicLeagues.length > 0 && (
                        <button
                            onClick={() => navigate('/join')}
                            className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-700"
                        >
                            Ver todas
                        </button>
                    )}
                </div>

                <p className="mb-4 text-xs text-slate-400">
                    Únete a ligas globales y compite por premios mayores.
                </p>

                {publicLeagues.length === 0 && !isLoading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
                        <Globe size={28} className="mx-auto mb-2 text-slate-200" />
                        <p className="text-sm font-bold text-slate-400">No hay ligas públicas disponibles</p>
                        <p className="mt-1 text-xs text-slate-300">Vuelve pronto o crea la tuya.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {publicLeagues.slice(0, 6).map((league) => {
                            const isFree = !league.baseFee;
                            const isHighStakes = league.baseFee && league.baseFee >= 100_000;
                            return (
                                <div
                                    key={league.id}
                                    className="group relative flex flex-col rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_8px_24px_-4px_rgba(147,197,253,0.35)]"
                                >
                                    {/* Price / badge */}
                                    <div className="absolute right-4 top-4 flex items-center gap-1.5">
                                        {isHighStakes && (
                                            <span className="rounded-lg bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-900">
                                                High Stakes
                                            </span>
                                        )}
                                        <span className={`rounded-lg px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                            isFree ? 'bg-lime-100 text-lime-700' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {isFree ? 'Gratis' : formatCurrency(league.baseFee, league.currency)}
                                        </span>
                                    </div>

                                    {/* Globe icon */}
                                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-400">
                                        <Globe size={18} />
                                    </div>

                                    {/* Name */}
                                    <p className="pr-20 text-sm font-black uppercase leading-tight tracking-tight text-slate-900 transition-colors group-hover:text-blue-700">
                                        {league.name}
                                    </p>

                                    {/* Members */}
                                    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                                        <Users size={10} />
                                        {league.memberCount}
                                        {league.maxParticipants ? ` / ${league.maxParticipants}` : ''} Jugadores
                                    </p>

                                    {/* Prize */}
                                    {league.baseFee && league.baseFee > 0 && (
                                        <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-lime-600">
                                            <Wallet size={10} />
                                            Bolsa: {formatCurrency(
                                                (league.baseFee ?? 0) * (league.memberCount ?? 0),
                                                league.currency,
                                            )}
                                        </p>
                                    )}

                                    {/* CTA */}
                                    <button
                                        onClick={() => handleJoinPublic(league.id)}
                                        disabled={joiningId === league.id}
                                        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50 group-hover:border-blue-200 group-hover:text-blue-600 disabled:opacity-50"
                                    >
                                        Ver detalles <ChevronRight size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
};

export default MyLeagues;
