import { useEffect, useState, useMemo } from 'react';
import { useAdminLeaguesStore } from '../../stores/admin.leagues.store';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import { format, compareAsc, compareDesc } from 'date-fns';
import { 
    CheckCircle2, 
    AlertCircle, 
    Search, 
    ArrowUpDown, 
    Calendar, 
    Trophy, 
    X,
    CheckSquare,
    Square,
    ChevronDown
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';

type SortField = 'date' | 'team' | 'phase' | 'status';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
    field: SortField;
    order: SortOrder;
}

interface LeagueMatchesManagerProps {
    leagueId: string;
}

export function LeagueMatchesManager({ leagueId }: LeagueMatchesManagerProps) {
    const [selectedTournament, setSelectedTournament] = useState<string>('ALL');
    const [selectedPhase, setSelectedPhase] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'date', order: 'asc' });
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

    // Filtrar partidos por búsqueda
    const filteredMatches = useMemo(() => {
        if (!searchQuery.trim()) return leagueMatches;
        
        const query = searchQuery.toLowerCase().trim();
        return leagueMatches.filter((match) => {
            const homeTeam = match.homeTeam.name.toLowerCase();
            const awayTeam = match.awayTeam.name.toLowerCase();
            const homeCode = (match.homeTeam.shortCode || '').toLowerCase();
            const awayCode = (match.awayTeam.shortCode || '').toLowerCase();
            const phase = (match.phase || '').toLowerCase();
            const formattedDate = format(new Date(match.matchDate), 'dd/MM/yyyy');
            
            return (
                homeTeam.includes(query) ||
                awayTeam.includes(query) ||
                homeCode.includes(query) ||
                awayCode.includes(query) ||
                phase.includes(query) ||
                formattedDate.includes(query)
            );
        });
    }, [leagueMatches, searchQuery]);

    // Ordenar partidos
    const sortedMatches = useMemo(() => {
        const sorted = [...filteredMatches];
        
        return sorted.sort((a, b) => {
            switch (sortConfig.field) {
                case 'date':
                    return sortConfig.order === 'asc' 
                        ? compareAsc(new Date(a.matchDate), new Date(b.matchDate))
                        : compareDesc(new Date(a.matchDate), new Date(b.matchDate));
                
                case 'team':
                    const teamA = a.homeTeam.name.toLowerCase();
                    const teamB = b.homeTeam.name.toLowerCase();
                    return sortConfig.order === 'asc' 
                        ? teamA.localeCompare(teamB)
                        : teamB.localeCompare(teamA);
                
                case 'phase':
                    const phaseOrder = ['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER', 'SEMI', 'THIRD_PLACE', 'FINAL'];
                    const phaseIndexA = phaseOrder.indexOf(a.phase);
                    const phaseIndexB = phaseOrder.indexOf(b.phase);
                    return sortConfig.order === 'asc' 
                        ? phaseIndexA - phaseIndexB
                        : phaseIndexB - phaseIndexA;
                
                case 'status':
                    const statusA = a.activeInLeague ? 1 : 0;
                    const statusB = b.activeInLeague ? 1 : 0;
                    return sortConfig.order === 'asc' 
                        ? statusA - statusB
                        : statusB - statusA;
                
                default:
                    return 0;
            }
        });
    }, [filteredMatches, sortConfig]);

    // Manejo de selección masiva
    const toggleSelectAll = () => {
        if (selectedMatches.size === sortedMatches.length && sortedMatches.length > 0) {
            setSelectedMatches(new Set());
        } else {
            setSelectedMatches(new Set(sortedMatches.map(m => m.id)));
        }
    };

    const toggleSelectMatch = (matchId: string) => {
        const newSelected = new Set(selectedMatches);
        if (newSelected.has(matchId)) {
            newSelected.delete(matchId);
        } else {
            newSelected.add(matchId);
        }
        setSelectedMatches(newSelected);
    };

    const clearSelection = () => {
        setSelectedMatches(new Set());
    };

    const handleSort = (field: SortField) => {
        setSortConfig(current => ({
            field,
            order: current.field === field && current.order === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleBulkActivate = async () => {
        if (selectedMatches.size === 0) {
            showToast('No hay partidos seleccionados', 'warning');
            return;
        }
        
        try {
            const promises = Array.from(selectedMatches).map(matchId => 
                activateMatch(leagueId, matchId)
            );
            await Promise.all(promises);
            showToast(`✓ ${selectedMatches.size} partidos activados`, 'success');
            setSelectedMatches(new Set());
        } catch (error) {
            console.error('Error bulk activating:', error);
            showToast('Error al activar partidos', 'error');
        }
    };

    const handleBulkDeactivate = async () => {
        if (selectedMatches.size === 0) {
            showToast('No hay partidos seleccionados', 'warning');
            return;
        }
        
        try {
            const promises = Array.from(selectedMatches).map(matchId => 
                deactivateMatch(leagueId, matchId)
            );
            await Promise.all(promises);
            showToast(`✓ ${selectedMatches.size} partidos desactivados`, 'success');
            setSelectedMatches(new Set());
        } catch (error) {
            console.error('Error bulk deactivating:', error);
            showToast('Error al desactivar partidos', 'error');
        }
    };

    const handleActivateAll = async () => {
        if (!selectedTournament || selectedTournament === 'ALL') {
            showToast('Selecciona un torneo específico primero', 'warning');
            return;
        }
        
        const tournamentName = leagueTournaments.find(t => t.id === selectedTournament)?.name || 'el torneo';
        const inactiveCount = sortedMatches.filter(m => !m.activeInLeague).length;
        
        if (inactiveCount === 0) {
            showToast('Todos los partidos ya están activos', 'info');
            return;
        }
        
        try {
            await activateAllTournamentMatches(leagueId, selectedTournament);
            showToast(`✓ ${inactiveCount} partidos de ${tournamentName} activados correctamente`, 'success');
            setSelectedMatches(new Set());
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
            {/* Barra de búsqueda y filtros */}
            <div className="flex flex-col gap-4">
                {/* Fila 1: Búsqueda y filtros principales */}
                <div className="flex gap-4 items-center flex-wrap">
                    <div className="relative flex-1 min-w-[280px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por equipo, código, fase o fecha (DD/MM/YYYY)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Ordenar:</span>
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                            <button
                                onClick={() => handleSort('date')}
                                className={`px-3 py-2 text-sm font-medium flex items-center gap-1 transition-colors ${
                                    sortConfig.field === 'date' 
                                        ? 'bg-amber-100 text-amber-800 border-amber-200' 
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                                title="Ordenar por fecha"
                            >
                                <Calendar className="h-4 w-4" />
                                Fecha
                                {sortConfig.field === 'date' && (
                                    <span className="text-xs">{sortConfig.order === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </button>
                            <button
                                onClick={() => handleSort('team')}
                                className={`px-3 py-2 text-sm font-medium flex items-center gap-1 border-l border-gray-200 transition-colors ${
                                    sortConfig.field === 'team' 
                                        ? 'bg-amber-100 text-amber-800' 
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                                title="Ordenar por equipo local"
                            >
                                <Trophy className="h-4 w-4" />
                                Equipo
                                {sortConfig.field === 'team' && (
                                    <span className="text-xs">{sortConfig.order === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </button>
                            <button
                                onClick={() => handleSort('phase')}
                                className={`px-3 py-2 text-sm font-medium flex items-center gap-1 border-l border-gray-200 transition-colors ${
                                    sortConfig.field === 'phase' 
                                        ? 'bg-amber-100 text-amber-800' 
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                                title="Ordenar por fase"
                            >
                                Fase
                                {sortConfig.field === 'phase' && (
                                    <span className="text-xs">{sortConfig.order === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </button>
                            <button
                                onClick={() => handleSort('status')}
                                className={`px-3 py-2 text-sm font-medium flex items-center gap-1 border-l border-gray-200 transition-colors ${
                                    sortConfig.field === 'status' 
                                        ? 'bg-amber-100 text-amber-800' 
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                                title="Ordenar por estado"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Estado
                                {sortConfig.field === 'status' && (
                                    <span className="text-xs">{sortConfig.order === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Fila 2: Filtros de torneo y fase */}
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

            {/* Barra de acciones masivas */}
            {selectedMatches.size > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckSquare className="h-5 w-5 text-amber-600" />
                        <span className="text-sm font-medium text-amber-900">
                            {selectedMatches.size} partido{selectedMatches.size !== 1 ? 's' : ''} seleccionado{selectedMatches.size !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleBulkActivate}
                            disabled={isSaving}
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Activar
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleBulkDeactivate}
                            disabled={isSaving}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                            <Square className="h-4 w-4 mr-1" />
                            Desactivar
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={clearSelection}
                            className="text-gray-500"
                        >
                            <X className="h-4 w-4 mr-1" />
                            Limpiar
                        </Button>
                    </div>
                </div>
            )}

            {/* Lista de partidos */}
            <div className="border rounded-lg">
                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Checkbox
                            checked={selectedMatches.size === sortedMatches.length && sortedMatches.length > 0}
                            onCheckedChange={toggleSelectAll}
                            disabled={isLoadingMatches || sortedMatches.length === 0 || isSaving}
                            aria-label="Seleccionar todos los partidos visibles"
                        />
                        <span className="text-sm font-medium">
                            {activeCount} de {leagueMatches.length} partidos activos
                            {searchQuery && ` • ${sortedMatches.length} resultado${sortedMatches.length !== 1 ? 's' : ''} de búsqueda`}
                        </span>
                    </div>
                    
                    {/* Indicador de ordenamiento */}
                    <div className="text-xs text-gray-500">
                        Ordenado por: {' '}
                        <span className="font-medium">
                            {sortConfig.field === 'date' && `Fecha ${sortConfig.order === 'asc' ? '(más reciente)' : '(más antiguo)'}`}
                            {sortConfig.field === 'team' && `Equipo ${sortConfig.order === 'asc' ? '(A-Z)' : '(Z-A)'}`}
                            {sortConfig.field === 'phase' && `Fase ${sortConfig.order === 'asc' ? '(ascendente)' : '(descendente)'}`}
                            {sortConfig.field === 'status' && `Estado ${sortConfig.order === 'asc' ? '(inactivos primero)' : '(activos primero)'}`}
                        </span>
                    </div>
                </div>

                <div className="divide-y max-h-[600px] overflow-y-auto">
                    {isLoadingMatches ? (
                        <div className="p-8 text-center text-gray-500">
                            Cargando partidos...
                        </div>
                    ) : sortedMatches.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            {searchQuery ? (
                                <>
                                    <p className="font-medium">Sin resultados para la búsqueda</p>
                                    <p className="text-sm mt-1">Intenta con otro término o limpia los filtros</p>
                                </>
                            ) : (
                                <>
                                    <p>No hay partidos. Vincula un torneo primero en la pestaña "Torneos".</p>
                                </>
                            )}
                        </div>
                    ) : (
                        sortedMatches.map((match) => (
                            <div
                                key={match.id}
                                className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${selectedMatches.has(match.id) ? 'bg-amber-50/50' : ''}`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Checkbox de selección masiva */}
                                    <Checkbox
                                        checked={selectedMatches.has(match.id)}
                                        onCheckedChange={() => toggleSelectMatch(match.id)}
                                        disabled={isSaving}
                                        aria-label={`Seleccionar partido ${match.homeTeam.name} vs ${match.awayTeam.name}`}
                                    />
                                    
                                    {/* Checkbox de activación en liga */}
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
                                    <strong>Activar todos de un torneo:</strong> Selecciona un torneo específico y haz clic en "Activar Todos del Torneo"
                                </li>
                                <li>
                                    <strong>Selección masiva:</strong> Usa los checkboxes para seleccionar varios partidos y activarlos/desactivarlos en grupo
                                </li>
                                <li>
                                    <strong>Activar individual:</strong> Marca el checkbox al lado de cada partido
                                </li>
                                <li>
                                    <strong>Buscar:</strong> Escribe el nombre del equipo, código, fase o fecha para filtrar rápidamente
                                </li>
                                <li>
                                    <strong>Ordenar:</strong> Usa el botón "Ordenar por" para organizar por fecha, equipo, fase o estado
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
