import { useEffect, useState } from 'react';
import { useAdminLeaguesStore } from '../../stores/admin.leagues.store';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import { format } from 'date-fns';

interface LeagueMatchesManagerProps {
    leagueId: string;
}

export function LeagueMatchesManager({ leagueId }: LeagueMatchesManagerProps) {
    const [selectedTournament, setSelectedTournament] = useState<string>('ALL');
    const [selectedPhase, setSelectedPhase] = useState<string>('ALL');

    const {
        leagueMatches,
        leagueTournaments,
        isLoadingMatches,
        isSaving,
        fetchLeagueMatches,
        fetchLeagueTournaments,
        activateMatch,
        deactivateMatch,
        activateAllTournamentMatches,
    } = useAdminLeaguesStore();

    useEffect(() => {
        // Cargar torneos vinculados
        fetchLeagueTournaments(leagueId);
    }, [leagueId, fetchLeagueTournaments]);

    useEffect(() => {
        // Cargar partidos cuando cambian los filtros
        fetchLeagueMatches(leagueId, {
            tournamentId: selectedTournament !== 'ALL' ? selectedTournament : undefined,
            phase: selectedPhase !== 'ALL' ? selectedPhase : undefined,
        });
    }, [leagueId, selectedTournament, selectedPhase, fetchLeagueMatches]);

    const activeCount = leagueMatches.filter((m) => m.activeInLeague).length;

    const handleActivateAll = async () => {
        if (!selectedTournament || selectedTournament === 'ALL') return;
        try {
            await activateAllTournamentMatches(leagueId, selectedTournament);
        } catch (error) {
            console.error('Error activating all matches:', error);
        }
    };

    const handleToggleMatch = async (matchId: string, currentState: boolean) => {
        try {
            if (currentState) {
                await deactivateMatch(leagueId, matchId);
            } else {
                await activateMatch(leagueId, matchId);
            }
        } catch (error) {
            console.error('Error toggling match:', error);
        }
    };

    const phaseLabels: Record<string, string> = {
        GROUP: 'Grupos',
        ROUND_OF_32: 'Dieciseisavos',
        ROUND_OF_16: 'Octavos',
        QUARTER: 'Cuartos',
        SEMI: 'Semifinales',
        THIRD_PLACE: 'Tercer Lugar',
        FINAL: 'Final',
    };

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <div className="flex gap-4 items-center">
                <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                    <SelectTrigger className="w-64">
                        <SelectValue placeholder="Todos los torneos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos los torneos</SelectItem>
                        {leagueTournaments.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                                {t.name} ({t.season})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Todas las fases" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todas</SelectItem>
                        {Object.entries(phaseLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    onClick={handleActivateAll}
                    disabled={selectedTournament === 'ALL' || isLoadingMatches || isSaving}
                >
                    Activar Todos del Torneo
                </Button>
            </div>

            {/* Lista de partidos */}
            <div className="border rounded-lg">
                <div className="p-4 border-b bg-gray-50">
                    <p className="text-sm font-medium">
                        {activeCount} de {leagueMatches.length} partidos activos
                    </p>
                </div>

                <div className="divide-y max-h-[600px] overflow-y-auto">
                    {isLoadingMatches ? (
                        <div className="p-8 text-center text-gray-500">
                            Cargando partidos...
                        </div>
                    ) : leagueMatches.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No hay partidos. Vincula un torneo primero en la pestaña "Torneos".
                        </div>
                    ) : (
                        leagueMatches.map((match) => (
                            <div
                                key={match.id}
                                className="p-4 flex items-center justify-between hover:bg-gray-50"
                            >
                                <div className="flex items-center gap-4">
                                    <Checkbox
                                        checked={match.activeInLeague}
                                        onCheckedChange={() =>
                                            handleToggleMatch(match.id, match.activeInLeague)
                                        }
                                        disabled={isSaving}
                                    />

                                    <div className="flex items-center gap-3">
                                        {match.homeTeam.flagUrl && (
                                            <img
                                                src={match.homeTeam.flagUrl}
                                                alt={match.homeTeam.name}
                                                className="w-6 h-6 object-contain"
                                            />
                                        )}
                                        <span className="font-medium">
                                            {match.homeTeam.shortCode || match.homeTeam.name}
                                        </span>

                                        <span className="text-gray-400">vs</span>

                                        <span className="font-medium">
                                            {match.awayTeam.shortCode || match.awayTeam.name}
                                        </span>
                                        {match.awayTeam.flagUrl && (
                                            <img
                                                src={match.awayTeam.flagUrl}
                                                alt={match.awayTeam.name}
                                                className="w-6 h-6 object-contain"
                                            />
                                        )}
                                    </div>

                                    {match.homeScore !== null && match.awayScore !== null && (
                                        <span className="text-sm font-mono text-gray-600">
                                            {match.homeScore} - {match.awayScore}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-500">
                                        {format(new Date(match.matchDate), 'dd/MM/yyyy HH:mm')}
                                    </span>

                                    <Badge variant="outline" className="capitalize">
                                        {phaseLabels[match.phase] || match.phase}
                                    </Badge>

                                    <Badge
                                        variant={match.activeInLeague ? 'default' : 'secondary'}
                                    >
                                        {match.activeInLeague ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Información adicional */}
            {leagueMatches.length > 0 && (
                <div className="text-sm text-gray-500">
                    <p>
                        Los partidos activos son los que aparecerán disponibles para pronósticos
                        en esta polla.
                    </p>
                    <p className="mt-1">
                        Los pronósticos existentes se mantienen incluso si desactivas un partido.
                    </p>
                </div>
            )}
        </div>
    );
}
