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
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface LeagueMatchesManagerProps {
    leagueId: string;
}

export function LeagueMatchesManager({ leagueId }: LeagueMatchesManagerProps) {
    const [selectedTournament, setSelectedTournament] = useState<string>('ALL');
    const [selectedPhase, setSelectedPhase] = useState<string>('ALL');
    const { showToast } = useToast();

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
        if (!selectedTournament || selectedTournament === 'ALL') {
            showToast('Selecciona un torneo específico primero', 'warning');
            return;
        }
        
        const tournamentName = leagueTournaments.find(t => t.id === selectedTournament)?.name || 'el torneo';
        const inactiveCount = leagueMatches.filter(m => !m.activeInLeague).length;
        
        if (inactiveCount === 0) {
            showToast('Todos los partidos ya están activos', 'info');
            return;
        }
        
        try {
            await activateAllTournamentMatches(leagueId, selectedTournament);
            showToast(`✓ ${inactiveCount} partidos de ${tournamentName} activados correctamente`, 'success');
        } catch (error) {
            console.error('Error activating all matches:', error);
            showToast('Error al activar los partidos. Intenta de nuevo.', 'error');
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
            <div className="flex gap-4 items-center flex-wrap">
                <div className="flex flex-col gap-1">
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
                    {selectedTournament === 'ALL' && leagueTournaments.length > 0 && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Selecciona un torneo para activar todos sus partidos
                        </p>
                    )}
                </div>

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

                <div className="relative group">
                    <Button
                        onClick={handleActivateAll}
                        disabled={selectedTournament === 'ALL' || isLoadingMatches || isSaving}
                        className="flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Activando...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Activar Todos del Torneo
                            </>
                        )}
                    </Button>
                    
                    {selectedTournament === 'ALL' && !isLoadingMatches && (
                        <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-amber-50 border border-amber-200 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800">
                                    Selecciona un torneo específico para activar todos sus partidos de una vez
                                </p>
                            </div>
                        </div>
                    )}
                </div>
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-900 space-y-2">
                            <p className="font-medium">
                                Cómo activar partidos para pronósticos:
                            </p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>
                                    <strong>Activar todos:</strong> Selecciona un torneo específico y haz clic en "Activar Todos del Torneo"
                                </li>
                                <li>
                                    <strong>Activar individual:</strong> Marca el checkbox al lado de cada partido
                                </li>
                            </ul>
                            <p className="text-xs mt-2 text-blue-700">
                                ℹ️ Los partidos activos aparecerán en la página de pronósticos. Los pronósticos existentes se mantienen incluso si desactivas un partido.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            {leagueMatches.length === 0 && !isLoadingMatches && leagueTournaments.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-900">
                            <p className="font-medium mb-2">No hay partidos disponibles</p>
                            <p>Para agregar partidos a esta polla:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-2 mt-2">
                                <li>Ve a la pestaña <strong>"Torneos"</strong></li>
                                <li>Vincula un torneo a esta polla</li>
                                <li>Regresa aquí para activar los partidos</li>
                            </ol>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
