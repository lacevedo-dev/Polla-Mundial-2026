import React from 'react';
import { Trophy, Check, ChevronRight, Calendar, MapPin, Loader2, CheckSquare, Square } from 'lucide-react';
import { request } from '../../api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Match {
    id: string;
    homeTeam: { name: string; logoUrl?: string };
    awayTeam: { name: string; logoUrl?: string };
    date: string;
    venue?: string;
    phase?: string;
    status: string;
}

interface Tournament {
    id: string;
    name: string;
    season: number;
    logoUrl?: string;
}

interface MatchSelectorProps {
    tournamentIds: string[];
    selectedMatchIds: string[];
    onToggleMatch: (matchId: string) => void;
    onToggleAllMatches: (tournamentId: string, matchIds: string[]) => void;
    onContinue: () => void;
    onBack: () => void;
}

export const MatchSelector: React.FC<MatchSelectorProps> = ({
    tournamentIds,
    selectedMatchIds,
    onToggleMatch,
    onToggleAllMatches,
    onContinue,
    onBack,
}) => {
    const [loading, setLoading] = React.useState(true);
    const [tournaments, setTournaments] = React.useState<Map<string, { tournament: Tournament; matches: Match[] }>>(new Map());
    const [expandedTournament, setExpandedTournament] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadTournamentsAndMatches = async () => {
            setLoading(true);
            try {
                const tournamentsData = await request<Tournament[]>('/leagues/tournaments');
                const tournamentsMap = new Map<string, { tournament: Tournament; matches: Match[] }>();

                for (const tournamentId of tournamentIds) {
                    const tournament = tournamentsData.find(t => t.id === tournamentId);
                    if (!tournament) continue;

                    const matches = await request<Match[]>(`/matches?tournamentId=${tournamentId}&status=SCHEDULED,LIVE`);
                    tournamentsMap.set(tournamentId, { tournament, matches });
                }

                setTournaments(tournamentsMap);
                if (tournamentIds.length === 1) {
                    setExpandedTournament(tournamentIds[0]);
                }
            } catch (error) {
                console.error('Error loading tournaments and matches:', error);
            } finally {
                setLoading(false);
            }
        };

        loadTournamentsAndMatches();
    }, [tournamentIds]);

    const getTournamentMatchIds = (tournamentId: string): string[] => {
        return tournaments.get(tournamentId)?.matches.map(m => m.id) || [];
    };

    const getSelectedCountForTournament = (tournamentId: string): number => {
        const matchIds = getTournamentMatchIds(tournamentId);
        return matchIds.filter(id => selectedMatchIds.includes(id)).length;
    };

    const areAllMatchesSelected = (tournamentId: string): boolean => {
        const matchIds = getTournamentMatchIds(tournamentId);
        return matchIds.length > 0 && matchIds.every(id => selectedMatchIds.includes(id));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={32} className="animate-spin text-lime-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-slate-900">Selecciona los Partidos</h2>
                <p className="mt-2 text-sm text-slate-600">
                    Elige los partidos que incluirás en tu polla. Puedes seleccionar todos o solo algunos.
                </p>
            </div>

            <div className="space-y-3">
                {Array.from(tournaments.entries()).map(([tournamentId, { tournament, matches }]) => {
                    const isExpanded = expandedTournament === tournamentId;
                    const selectedCount = getSelectedCountForTournament(tournamentId);
                    const allSelected = areAllMatchesSelected(tournamentId);

                    return (
                        <div key={tournamentId} className="rounded-2xl border-2 border-slate-200 overflow-hidden">
                            <button
                                onClick={() => setExpandedTournament(isExpanded ? null : tournamentId)}
                                className="w-full flex items-center gap-4 p-4 bg-white hover:bg-slate-50 transition-colors"
                            >
                                {tournament.logoUrl && (
                                    <img
                                        src={tournament.logoUrl}
                                        alt={tournament.name}
                                        className="h-10 w-10 shrink-0 rounded-lg object-contain"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                )}
                                {!tournament.logoUrl && (
                                    <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
                                        <Trophy size={20} className="text-slate-400" />
                                    </div>
                                )}
                                <div className="flex-1 text-left">
                                    <h3 className="font-bold text-slate-900">{tournament.name}</h3>
                                    <p className="text-xs text-slate-600 mt-0.5">
                                        {selectedCount} de {matches.length} partidos seleccionados
                                    </p>
                                </div>
                                <ChevronRight
                                    size={20}
                                    className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                />
                            </button>

                            {isExpanded && (
                                <div className="border-t-2 border-slate-200 bg-slate-50/50">
                                    <div className="p-3 border-b border-slate-200 bg-white">
                                        <button
                                            onClick={() => onToggleAllMatches(tournamentId, getTournamentMatchIds(tournamentId))}
                                            className="flex items-center gap-2 text-sm font-bold text-lime-600 hover:text-lime-700"
                                        >
                                            {allSelected ? (
                                                <>
                                                    <CheckSquare size={16} />
                                                    Deseleccionar todos
                                                </>
                                            ) : (
                                                <>
                                                    <Square size={16} />
                                                    Seleccionar todos
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
                                        {matches.length === 0 ? (
                                            <p className="text-center text-sm text-slate-500 py-8">
                                                No hay partidos disponibles para este torneo
                                            </p>
                                        ) : (
                                            matches.map((match) => {
                                                const isSelected = selectedMatchIds.includes(match.id);
                                                return (
                                                    <button
                                                        key={match.id}
                                                        onClick={() => onToggleMatch(match.id)}
                                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                                            isSelected
                                                                ? 'border-lime-500 bg-lime-50/50'
                                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div
                                                            className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
                                                                isSelected
                                                                    ? 'border-lime-500 bg-lime-500'
                                                                    : 'border-slate-300'
                                                            }`}
                                                        >
                                                            {isSelected && <Check size={12} className="text-white" />}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    {match.homeTeam.logoUrl && (
                                                                        <img
                                                                            src={match.homeTeam.logoUrl}
                                                                            alt={match.homeTeam.name}
                                                                            className="h-5 w-5 object-contain"
                                                                            onError={(e) => {
                                                                                e.currentTarget.style.display = 'none';
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <span className="text-sm font-bold text-slate-900 truncate">
                                                                        {match.homeTeam.name}
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-400">vs</span>
                                                                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                                                                    <span className="text-sm font-bold text-slate-900 truncate">
                                                                        {match.awayTeam.name}
                                                                    </span>
                                                                    {match.awayTeam.logoUrl && (
                                                                        <img
                                                                            src={match.awayTeam.logoUrl}
                                                                            alt={match.awayTeam.name}
                                                                            className="h-5 w-5 object-contain"
                                                                            onError={(e) => {
                                                                                e.currentTarget.style.display = 'none';
                                                                            }}
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-slate-600">
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar size={12} />
                                                                    {format(new Date(match.date), "d 'de' MMM, HH:mm", { locale: es })}
                                                                </span>
                                                                {match.venue && (
                                                                    <span className="flex items-center gap-1 truncate">
                                                                        <MapPin size={12} />
                                                                        {match.venue}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-white via-white to-transparent">
                <div className="flex gap-3">
                    <button
                        onClick={onBack}
                        className="px-6 py-4 rounded-2xl border-2 border-slate-300 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
                    >
                        ATRÁS
                    </button>
                    <button
                        onClick={onContinue}
                        disabled={selectedMatchIds.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-lime-500 px-6 py-4 text-sm font-black text-white shadow-lg shadow-lime-500/30 transition-all hover:bg-lime-600 hover:shadow-xl hover:shadow-lime-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        CONTINUAR CON {selectedMatchIds.length} PARTIDO{selectedMatchIds.length !== 1 ? 'S' : ''}
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};
