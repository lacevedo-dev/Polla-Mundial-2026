import React from 'react';
import { Trophy, Check, ChevronRight } from 'lucide-react';

interface Tournament {
    id: string;
    name: string;
    country?: string;
    season: number;
    logoUrl?: string;
    active: boolean;
}

interface TournamentSelectorProps {
    tournaments: Tournament[];
    selectedIds: string[];
    onToggle: (id: string) => void;
    onContinue: () => void;
}

export const TournamentSelector: React.FC<TournamentSelectorProps> = ({
    tournaments,
    selectedIds,
    onToggle,
    onContinue,
}) => {
    const activeTournaments = tournaments.filter(t => t.active);

    return (
        <div className="space-y-4">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-slate-900">Selecciona los Torneos</h2>
                <p className="mt-2 text-sm text-slate-600">
                    Elige uno o varios torneos para tu polla. Luego podrás seleccionar los partidos específicos.
                </p>
            </div>

            {activeTournaments.length === 0 ? (
                <div className="py-16 text-center">
                    <Trophy size={48} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">
                        No hay torneos activos disponibles
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        Los administradores deben importar torneos desde la API de Football
                    </p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {activeTournaments.map((tournament) => {
                        const isSelected = selectedIds.includes(tournament.id);
                        return (
                            <button
                                key={tournament.id}
                                onClick={() => onToggle(tournament.id)}
                                className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                                    isSelected
                                        ? 'border-lime-500 bg-lime-50/50 shadow-md'
                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                {tournament.logoUrl && (
                                    <img
                                        src={tournament.logoUrl}
                                        alt={tournament.name}
                                        className="h-12 w-12 shrink-0 rounded-lg object-contain"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                )}
                                {!tournament.logoUrl && (
                                    <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
                                        <Trophy size={24} className="text-slate-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-900 truncate">
                                        {tournament.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                                        {tournament.country && (
                                            <span className="font-semibold">{tournament.country}</span>
                                        )}
                                        <span>Temporada {tournament.season}</span>
                                    </div>
                                </div>
                                <div
                                    className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isSelected
                                            ? 'border-lime-500 bg-lime-500'
                                            : 'border-slate-300'
                                    }`}
                                >
                                    {isSelected && <Check size={14} className="text-white" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {selectedIds.length > 0 && (
                <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-white via-white to-transparent">
                    <button
                        onClick={onContinue}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-lime-500 px-6 py-4 text-sm font-black text-white shadow-lg shadow-lime-500/30 transition-all hover:bg-lime-600 hover:shadow-xl hover:shadow-lime-500/40"
                    >
                        CONTINUAR CON {selectedIds.length} TORNEO{selectedIds.length > 1 ? 'S' : ''}
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};
