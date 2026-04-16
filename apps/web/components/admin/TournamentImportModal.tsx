import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    AlertCircle, ArrowLeft, ArrowRight, Calendar, Check, CheckCircle2, ChevronDown,
    Clock, Download, FlaskConical, Globe, Hash, Info, Loader2, Plus, RefreshCw, Search, Shield, Sparkles, Trophy, Users, X, Zap,
} from 'lucide-react';
import { request } from '../../api';
import { CreateTestLeaguesModal } from './CreateTestLeaguesModal';

const DATE_CACHE_PREFIX = 'adminFixtureCache_';const DATE_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 horas

interface DateCache {
    date: string;
    data: FixtureResult[];
    fetchedAt: number;
}

/* ─── types ─────────────────────────────────────────────────────── */

interface LeagueSearchResult {
    id: number;
    name: string;
    country: string;
    countryCode?: string;
    type: string;
    logoUrl?: string;
    currentSeason?: number;
    seasons: number[];
}

interface TournamentPreview {
    league: LeagueSearchResult;
    season: number;
    totalFixtures: number;
    rounds: string[];
    teams: Array<{ id: number; name: string; logo?: string; alreadyExists: boolean }>;
    newTeamsCount: number;
    existingFixturesCount: number;
}

interface ImportResult {
    tournamentId: string;
    tournamentName: string;
    fixturesImported: number;
    fixturesUpdated: number;
    teamsCreated: number;
    teamsLinked: number;
    skipped: number;
    errors: string[];
    dryRun: boolean;
    matchIds?: string[]; // IDs of imported matches for seeding
}

interface League {
    id: string;
    name: string;
    status: string;
    baseFee: number | null;
}

interface SeedResult {
    strategy: string;
    leagues: Array<{ name: string; members: number; created: number; skipped: number; payments: number }>;
    matches: number;
    totalCreated: number;
    totalSkipped: number;
    totalPayments: number;
}

interface UsageInfo {
    requests: { used: number; limit: number; available: number };
}

interface TeamResult {
    id: number;
    name: string;
    code?: string;
    logo?: string;
    country?: string;
    national: boolean;
}

interface FixtureResult {
    fixtureId: number;
    date: string;
    status: string;
    statusLong: string;
    homeTeam: { id: number; name: string; logo?: string };
    awayTeam: { id: number; name: string; logo?: string };
    homeScore: number | null;
    awayScore: number | null;
    league: { id: number; name: string; country: string; logo?: string; round: string };
    venue: string | null;
    alreadyImported: boolean;
}

interface Props {
    onClose: () => void;
    onImported: () => void;
}

const STEP_LABELS = ['Buscar liga', 'Temporada', 'Vista previa', 'Importar', 'Seed (opcional)'];

/* ─── Popular leagues — Colombia primero ────────────────────────── */
// Búsqueda por ID numérico: el backend detecta que es número y usa ?id= en vez de ?search=
const POPULAR_LEAGUES = [
    { query: '239',  label: 'Liga BetPlay',                country: 'Colombia',        note: 'Primera División Colombia · ID 239' },
    { query: '241',  label: 'Copa Colombia',               country: 'Colombia',        note: 'Torneo eliminatorio Colombia · ID 241' },
    { query: '1',    label: 'FIFA World Cup 2026',         country: 'World',           note: 'ID 1 · Solo partidos oficiales del torneo' },
    { query: '10',   label: 'Amistosos Internacionales',   country: 'World',           note: 'ID 10 · Amistosos de selecciones nacionales' },
    { query: '9',    label: 'Copa América',                country: 'América del Sur', note: 'ID 9' },
    { query: '2',    label: 'UEFA Champions League',       country: 'Europa',          note: 'ID 2' },
];

/* ─── Rate limit badge ───────────────────────────────────────────── */
const RateBadge: React.FC<{ usage: UsageInfo | null }> = ({ usage }) => {
    if (!usage) return null;
    const { used, limit, available } = usage.requests;
    const pct = Math.round((used / limit) * 100);
    const color = pct >= 90 ? 'bg-rose-100 text-rose-700' : pct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-lime-100 text-lime-700';
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${color}`} title={`${available} requests disponibles hoy`}>
            <Zap size={10} /> {used}/{limit}
        </span>
    );
};

/* ─── Step indicator ─────────────────────────────────────────────── */
const StepDots: React.FC<{ step: number }> = ({ step }) => (
    <div className="flex items-center gap-2 mb-6">
        {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${i < step ? 'bg-lime-400 text-slate-900' : i === step ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {i < step ? <Check size={12} strokeWidth={3} /> : i + 1}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && <div className={`flex-1 h-px mt-[-12px] transition-colors ${i < step ? 'bg-lime-400' : 'bg-slate-200'}`} />}
            </React.Fragment>
        ))}
    </div>
);

/* ─── Main component ─────────────────────────────────────────────── */
const TournamentImportModal: React.FC<Props> = ({ onClose, onImported }) => {
    const [step, setStep] = useState(0);
    const [usage, setUsage] = useState<UsageInfo | null>(null);
    const [mode, setMode] = useState<'league' | 'date' | 'team' | 'id'>('league');

    // Step 0: Import by fixture ID
    const [fixtureIdInput, setFixtureIdInput] = useState('');
    const [previewingIds, setPreviewingIds] = useState(false);
    const [idFixtures, setIdFixtures] = useState<FixtureResult[]>([]);
    const [idError, setIdError] = useState('');

    // Step 0: Search by league
    const [searchQuery, setSearchQuery] = useState('');
    const [searchCountry, setSearchCountry] = useState('');
    const [searchResults, setSearchResults] = useState<LeagueSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [selectedLeague, setSelectedLeague] = useState<LeagueSearchResult | null>(null);

    // Step 0: Search by team
    const [teamQuery, setTeamQuery] = useState('');
    const [teamResults, setTeamResults] = useState<TeamResult[]>([]);
    const [searchingTeam, setSearchingTeam] = useState(false);
    const [teamError, setTeamError] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<TeamResult | null>(null);
    const [teamSeason, setTeamSeason] = useState(new Date().getFullYear());
    const [teamFixtures, setTeamFixtures] = useState<FixtureResult[]>([]);
    const [loadingTeamFixtures, setLoadingTeamFixtures] = useState(false);

    // Step 0: Search by date
    const [fixtureDate, setFixtureDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [fixtureResults, setFixtureResults] = useState<FixtureResult[]>([]);
    const [dateCachedAt, setDateCachedAt] = useState<number | null>(null);
    const [searchingDate, setSearchingDate] = useState(false);
    const [dateError, setDateError] = useState('');
    const [dateTeamFilter, setDateTeamFilter] = useState('');
    const [selectedFixtures, setSelectedFixtures] = useState<Set<number>>(new Set());
    const [dateCreateTeams, setDateCreateTeams] = useState(true);
    const [dateOverwrite, setDateOverwrite] = useState(false);

    // Load cache when date changes
    useEffect(() => {
        const raw = localStorage.getItem(`${DATE_CACHE_PREFIX}${fixtureDate}`);
        if (!raw) { setFixtureResults([]); setDateCachedAt(null); return; }
        try {
            const cached: DateCache = JSON.parse(raw);
            if (Date.now() - cached.fetchedAt < DATE_CACHE_TTL_MS) {
                setFixtureResults(cached.data);
                setDateCachedAt(cached.fetchedAt);
                setSelectedFixtures(new Set());
            } else {
                localStorage.removeItem(`${DATE_CACHE_PREFIX}${fixtureDate}`);
                setFixtureResults([]);
                setDateCachedAt(null);
            }
        } catch { setFixtureResults([]); setDateCachedAt(null); }
    }, [fixtureDate]);

    // Step 1: Season + options
    const [season, setSeason] = useState<number>(new Date().getFullYear());
    const [createTeams, setCreateTeams] = useState(true);
    const [overwriteExisting, setOverwriteExisting] = useState(false);

    // Step 2: Preview
    const [preview, setPreview] = useState<TournamentPreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [showAllTeams, setShowAllTeams] = useState(false);

    // Step 3: Import
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [importError, setImportError] = useState('');
    const [importedMatchIds, setImportedMatchIds] = useState<number[]>([]);

    // Step 4: Seed
    const [leagues, setLeagues] = useState<League[]>([]);
    const [loadingLeagues, setLoadingLeagues] = useState(false);
    const [selectedLeagueIds, setSelectedLeagueIds] = useState<Set<string>>(new Set());
    const [seedStrategy, setSeedStrategy] = useState<'random' | 'conservative' | 'home_bias' | 'realistic'>('realistic');
    const [simulatePayments, setSimulatePayments] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
    const [seedError, setSeedError] = useState('');
    const [showCreateTestModal, setShowCreateTestModal] = useState(false);
    const [seedProgress, setSeedProgress] = useState<{
        message: string;
        progress: number;
        currentLeague?: string;
        memberProgress?: string;
    } | null>(null);

    // Load leagues when entering step 4
    useEffect(() => {
        if (step === 4 && leagues.length === 0 && !loadingLeagues) {
            void loadLeaguesForSeed();
        }
    }, [step]);

    /* ─ load usage on mount ─ */
    useEffect(() => {
        request<UsageInfo>('/admin/football/usage').then(setUsage).catch(() => null);
    }, []);

    /* ─ reload usage after each API-consuming action ─ */
    const refreshUsage = useCallback(() => {
        request<UsageInfo>('/admin/football/usage').then(setUsage).catch(() => null);
    }, []);

    /* ─ derived: filtered date fixtures by team name OR league/tournament ─ */
    const filteredDateFixtures = useMemo(() => {
        const q = dateTeamFilter.toLowerCase().trim();
        if (!q) return fixtureResults;
        return fixtureResults.filter(f =>
            f.homeTeam.name.toLowerCase().includes(q) ||
            f.awayTeam.name.toLowerCase().includes(q) ||
            f.league.name.toLowerCase().includes(q) ||
            f.league.country.toLowerCase().includes(q)
        );
    }, [fixtureResults, dateTeamFilter]);

    const importableDateFixtures = useMemo(
        () => filteredDateFixtures.filter(f => !f.alreadyImported || dateOverwrite),
        [filteredDateFixtures, dateOverwrite]
    );

    const isFixtureSelectable = useCallback((fixture: FixtureResult) => (
        !fixture.alreadyImported || dateOverwrite
    ), [dateOverwrite]);

    const selectableFixtureIds = useMemo(() => {
        const source =
            mode === 'date' ? filteredDateFixtures :
            mode === 'team' ? teamFixtures :
            mode === 'id' ? idFixtures :
            [];

        return new Set(source.filter(isFixtureSelectable).map((fixture) => fixture.fixtureId));
    }, [mode, filteredDateFixtures, teamFixtures, idFixtures, isFixtureSelectable]);

    useEffect(() => {
        setSelectedFixtures((prev) => {
            const next = new Set([...prev].filter((fixtureId) => selectableFixtureIds.has(fixtureId)));
            return next.size === prev.size ? prev : next;
        });
    }, [selectableFixtureIds]);

    /* ─ search ─ */
    const handleSearch = useCallback(async (overrideQuery?: string) => {
        const q = overrideQuery ?? searchQuery;
        if (!q.trim()) return;
        setSearching(true);
        setSearchError('');
        setSearchResults([]);
        try {
            const data = await request<LeagueSearchResult[]>(
                `/admin/football/leagues/search?q=${encodeURIComponent(q)}&country=${encodeURIComponent(searchCountry)}`,
            );
            setSearchResults(data);
            refreshUsage();
        } catch (e: any) {
            setSearchError(e?.message ?? 'Error al buscar ligas');
        } finally {
            setSearching(false);
        }
    }, [searchQuery, searchCountry, refreshUsage]);

    /* debounce on typed query — for IDs trigger at 1+ digits, for text at 3+ chars */
    useEffect(() => {
        const isId = /^\d+$/.test(searchQuery.trim());
        const minLen = isId ? 1 : 3;
        const delay = isId ? 800 : 500;
        const t = setTimeout(() => { if (searchQuery.length >= minLen) void handleSearch(); }, delay);
        return () => clearTimeout(t);
    }, [searchQuery, handleSearch]);

    /* ─ search by team ─ */
    const handleSearchTeam = useCallback(async () => {
        if (!teamQuery.trim()) return;
        setSearchingTeam(true);
        setTeamError('');
        setTeamResults([]);
        setSelectedTeam(null);
        setTeamFixtures([]);
        try {
            const data = await request<TeamResult[]>(`/admin/football/teams/search?name=${encodeURIComponent(teamQuery)}`);
            setTeamResults(data);
            refreshUsage();
        } catch (e: any) {
            setTeamError(e?.message ?? 'Error al buscar equipos');
        } finally {
            setSearchingTeam(false);
        }
    }, [teamQuery, refreshUsage]);

    const handleLoadTeamFixtures = async (team: TeamResult) => {
        setSelectedTeam(team);
        setLoadingTeamFixtures(true);
        setTeamFixtures([]);
        setSelectedFixtures(new Set());
        try {
            const data = await request<FixtureResult[]>(`/admin/football/fixtures/by-team?teamId=${team.id}&season=${teamSeason}`);
            setTeamFixtures(data);
            refreshUsage();
        } catch (e: any) {
            setTeamError(e?.message ?? 'Error al cargar partidos');
        } finally {
            setLoadingTeamFixtures(false);
        }
    };

    /* ─ preview fixtures by IDs ─ */
    const handlePreviewByIds = async () => {
        const ids = fixtureIdInput
            .split(/[\s,;]+/)
            .map(s => s.trim())
            .filter(s => /^\d+$/.test(s))
            .map(Number);
        if (ids.length === 0) return;
        setPreviewingIds(true);
        setIdError('');
        setIdFixtures([]);
        setSelectedFixtures(new Set());
        try {
            // Fetch each fixture individually via the search endpoint trick — use date endpoint as fallback
            // We call import-selection in dry-run-like mode via previewing each ID
            const results: FixtureResult[] = [];
            for (const id of ids) {
                try {
                    const data = await request<FixtureResult[]>(`/admin/football/fixtures/by-id?id=${id}`);
                    results.push(...data);
                } catch {
                    // skip individual failures
                }
            }
            setIdFixtures(results);
            if (results.length === 0) setIdError('No se encontraron fixtures para los IDs ingresados. Verifica que los IDs sean correctos en api-football.com');
            refreshUsage();
        } catch (e: any) {
            setIdError(e?.message ?? 'Error al buscar fixtures');
        } finally {
            setPreviewingIds(false);
        }
    };

    /* ─ search by date ─ */
    const handleSearchByDate = async (force = false) => {
        if (!fixtureDate) return;
        // Use cache unless force refresh
        if (!force) {
            const raw = localStorage.getItem(`${DATE_CACHE_PREFIX}${fixtureDate}`);
            if (raw) {
                try {
                    const cached: DateCache = JSON.parse(raw);
                    if (Date.now() - cached.fetchedAt < DATE_CACHE_TTL_MS) {
                        setFixtureResults(cached.data);
                        setDateCachedAt(cached.fetchedAt);
                        setSelectedFixtures(new Set());
                        return;
                    }
                } catch { /* ignore, re-fetch */ }
            }
        }
        setSearchingDate(true);
        setDateError('');
        setFixtureResults([]);
        setSelectedFixtures(new Set());
        try {
            const data = await request<FixtureResult[]>(`/admin/football/fixtures/search?date=${fixtureDate}`);
            const fetchedAt = Date.now();
            setFixtureResults(data);
            setDateCachedAt(fetchedAt);
            localStorage.setItem(`${DATE_CACHE_PREFIX}${fixtureDate}`, JSON.stringify({ date: fixtureDate, data, fetchedAt }));
            refreshUsage();
        } catch (e: any) {
            setDateError(e?.message ?? 'Error al buscar partidos');
        } finally {
            setSearchingDate(false);
        }
    };

    const toggleFixture = (id: number) => {
        setSelectedFixtures((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleImportSelected = async () => {
        if (selectedFixtures.size === 0) return;
        setImporting(true);
        setImportError('');
        try {
            // Get full fixture data from results (already fetched and cached)
            const selectedFixtureData = fixtureResults
                .filter(f => selectedFixtures.has(f.fixtureId))
                .map(f => ({
                    fixture: {
                        id: f.fixtureId,
                        date: f.date,
                        status: { short: f.status, long: f.statusLong },
                        venue: { name: f.venue, city: null },
                    },
                    teams: {
                        home: { id: f.homeTeam.id, name: f.homeTeam.name, logo: f.homeTeam.logo },
                        away: { id: f.awayTeam.id, name: f.awayTeam.name, logo: f.awayTeam.logo },
                    },
                    goals: {
                        home: f.homeScore,
                        away: f.awayScore,
                    },
                    league: {
                        id: f.league.id,
                        name: f.league.name,
                        country: f.league.country,
                        round: f.league.round,
                    },
                }));
            
            if (selectedFixtureData.length === 0) {
                throw new Error('No hay partidos seleccionados');
            }

            // Use optimized endpoint with full data (no duplicate API call)
            const data = await request<ImportResult>('/admin/football/fixtures/import-with-data', {
                method: 'POST',
                body: JSON.stringify({
                    fixtures: selectedFixtureData,
                    createTeams: dateCreateTeams,
                    overwriteExisting: dateOverwrite,
                    tournamentName: mode === 'team' && selectedTeam ? `Amistosos ${selectedTeam.name}` : 'Amistosos Internacionales',
                }),
            });
            setImportResult(data);
            setStep(3);
            refreshUsage();
            // Load leagues for seed step
            void loadLeaguesForSeed();
        } catch (e: any) {
            setImportError(e?.message ?? 'Error al importar');
        } finally {
            setImporting(false);
        }
    };

    /* ─ quicklink: trigger real search ─ */
    const handleQuickSearch = (query: string) => {
        setSearchQuery(query);
        void handleSearch(query);
    };

    /* ─ select league → set default season ─ */
    const handleSelectLeague = (league: LeagueSearchResult) => {
        setSelectedLeague(league);
        const defaultSeason = league.currentSeason ?? league.seasons[0] ?? new Date().getFullYear();
        setSeason(defaultSeason);
        setStep(1);
    };

    /* ─ load preview ─ */
    const loadPreview = async () => {
        if (!selectedLeague) return;
        setLoadingPreview(true);
        setPreviewError('');
        setPreview(null);
        try {
            const data = await request<TournamentPreview>(
                `/admin/football/tournaments/preview?leagueId=${selectedLeague.id}&season=${season}`,
            );
            setPreview(data);
            setStep(2);
            refreshUsage();
        } catch (e: any) {
            setPreviewError(e?.message ?? 'Error al cargar vista previa');
        } finally {
            setLoadingPreview(false);
        }
    };

    /* ─ import ─ */
    const handleImport = async () => {
        if (!selectedLeague) return;
        setImporting(true);
        setImportError('');
        try {
            const data = await request<ImportResult>('/admin/football/tournaments/import', {
                method: 'POST',
                body: JSON.stringify({
                    leagueId: selectedLeague.id,
                    season,
                    createTeams,
                    overwriteExisting,
                    dryRun: false,
                }),
            });
            setImportResult(data);
            setStep(3);
            refreshUsage();
            // Load leagues for seed step
            void loadLeaguesForSeed();
        } catch (e: any) {
            setImportError(e?.message ?? 'Error al importar');
        } finally {
            setImporting(false);
        }
    };

    /* ─ load leagues for seed ─ */
    const loadLeaguesForSeed = async () => {
        setLoadingLeagues(true);
        try {
            const res = await request<{ data: League[] }>('/admin/leagues?limit=100&page=1');
            setLeagues(res.data);
        } catch {
            /* non-critical */
        } finally {
            setLoadingLeagues(false);
        }
    };

    /* ─ toggle league selection ─ */
    const toggleLeague = (id: string) => {
        setSelectedLeagueIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    /* ─ create test leagues ─ */
    const handleCreateTestLeagues = () => {
        setShowCreateTestModal(true);
    };

    const handleTestLeaguesSuccess = async () => {
        await loadLeaguesForSeed();
    };

    /* ─ generate seed with streaming ─ */
    const handleGenerateSeed = async () => {
        setSeeding(true);
        setSeedError('');
        setSeedResult(null);
        setSeedProgress({ message: 'Iniciando generación de pronósticos...', progress: 0 });

        try {
            // Priority: 1) Imported match IDs, 2) Selected fixtures, 3) Let backend decide
            let matchIds: string[] | undefined;
            
            if (importResult?.matchIds && importResult.matchIds.length > 0) {
                matchIds = importResult.matchIds;
            } else if (mode === 'date' || mode === 'team' || mode === 'id') {
                matchIds = [...selectedFixtures].map(String);
            }

            const token = localStorage.getItem('token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            
            const response = await fetch(`${apiUrl}/admin/predictions/bulk-seed-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    leagueIds: [...selectedLeagueIds],
                    matchIds,
                    strategy: seedStrategy,
                    simulatePayments,
                }),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No se pudo obtener el stream de respuesta');
            }

            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.type === 'error') {
                                setSeedError(data.message);
                                setSeedProgress(null);
                            } else if (data.type === 'complete') {
                                setSeedResult(data.data);
                                setSeedProgress(null);
                            } else if (data.type === 'progress' || data.type === 'league_start' || data.type === 'member_complete') {
                                setSeedProgress({
                                    message: data.message,
                                    progress: data.data?.progress || 0,
                                    currentLeague: data.data?.leagueName,
                                    memberProgress: data.data?.memberIndex && data.data?.totalMembers 
                                        ? `${data.data.memberIndex}/${data.data.totalMembers} miembros`
                                        : undefined,
                                });
                            } else if (data.type === 'league_complete') {
                                setSeedProgress({
                                    message: data.message,
                                    progress: data.data?.progress || 0,
                                });
                            }
                        } catch (parseError) {
                            console.error('Error parsing SSE data:', parseError);
                        }
                    }
                }
            }
        } catch (e: any) {
            setSeedError(e?.message ?? 'Error al generar pronósticos');
            setSeedProgress(null);
        } finally {
            setSeeding(false);
        }
    };

    /* ─ render ─ */
    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="w-full sm:max-w-2xl bg-white sm:rounded-[2rem] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                            <Trophy size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Importar Torneo</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Desde API-Football</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <RateBadge usage={usage} />
                        <button onClick={onClose} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Steps */}
                <div className="px-6 pt-5 shrink-0">
                    <StepDots step={step} />
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ scrollbarWidth: 'thin' }}>
                    <AnimatePresence mode="wait">

                        {/* ── Step 0: Search league ── */}
                        {step === 0 && (
                            <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

                                {/* Mode tabs */}
                                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                    <button onClick={() => setMode('league')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'league' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        <Trophy size={13} /> Liga
                                    </button>
                                    <button onClick={() => setMode('date')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'date' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        <Calendar size={13} /> Fecha
                                    </button>
                                    <button onClick={() => setMode('team')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'team' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        <Shield size={13} /> Equipo
                                    </button>
                                    <button onClick={() => setMode('id')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'id' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        <Hash size={13} /> ID
                                    </button>
                                </div>

                                {/* ── Date mode ── */}
                                {mode === 'date' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-600">Busca todos los partidos de un día específico y selecciona cuáles importar. Ideal para amistosos puntuales como Colombia vs Croacia.</p>

                                        {usage && (
                                            <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                                                <Info size={13} className="shrink-0 mt-0.5 text-slate-400" />
                                                <p>Buscar por fecha consume <strong>1 request</strong>. Cada fixture individual consume <strong>1 request adicional</strong> al importar. Quedan: <strong>{usage.requests.available}</strong>.</p>
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                value={fixtureDate}
                                                onChange={(e) => setFixtureDate(e.target.value)}
                                                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                            <button
                                                onClick={() => void handleSearchByDate(false)}
                                                disabled={searchingDate || !fixtureDate}
                                                className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-900 text-sm font-bold hover:bg-amber-500 disabled:opacity-50 transition-colors"
                                            >
                                                {searchingDate ? <Loader2 size={16} className="animate-spin" /> : 'Buscar'}
                                            </button>
                                        </div>

                                        {/* Cache timestamp + force refresh */}
                                        {dateCachedAt && !searchingDate && (
                                            <div className="flex items-center justify-between px-1">
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                    <Clock size={10} />
                                                    <span>Consultado {new Date(dateCachedAt).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <button
                                                    onClick={() => void handleSearchByDate(true)}
                                                    disabled={searchingDate}
                                                    className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 transition-colors"
                                                >
                                                    <RefreshCw size={10} /> Actualizar desde API
                                                </button>
                                            </div>
                                        )}

                                        {dateError && (
                                            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                                                <AlertCircle size={14} /> {dateError}
                                            </div>
                                        )}

                                        {searchingDate && (
                                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                                                <Loader2 size={16} className="animate-spin" /> Consultando API-Football…
                                            </div>
                                        )}

                                        {!searchingDate && fixtureResults.length > 0 && (
                                            <div className="space-y-3">
                                                {/* Team filter */}
                                                <div className="relative">
                                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Filtrar por equipo o torneo (ej: Colombia, UEFA…)"
                                                        value={dateTeamFilter}
                                                        onChange={(e) => setDateTeamFilter(e.target.value)}
                                                        className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                    />
                                                    {dateTeamFilter && (
                                                        <button onClick={() => setDateTeamFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                                        {filteredDateFixtures.length} de {fixtureResults.length} partidos
                                                        {dateTeamFilter.trim() && <span className="ml-1 normal-case font-normal">· "{dateTeamFilter}"</span>}
                                                    </p>
                                                    <button
                                                        onClick={() => setSelectedFixtures(
                                                            selectedFixtures.size === importableDateFixtures.length && importableDateFixtures.length > 0
                                                                ? new Set()
                                                                : new Set(importableDateFixtures.map(f => f.fixtureId))
                                                        )}
                                                        className="text-[10px] font-bold text-amber-600 hover:text-amber-700"
                                                    >
                                                        {selectedFixtures.size > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                                    </button>
                                                </div>

                                                {filteredDateFixtures.length === 0 && (
                                                    <p className="text-center text-sm text-slate-400 py-3">Sin partidos con "{dateTeamFilter}"</p>
                                                )}

                                                <div className="space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                                    {filteredDateFixtures.map((f) => (
                                                        <label
                                                            key={f.fixtureId}
                                                            className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                                                                f.alreadyImported && !dateOverwrite
                                                                    ? 'border-lime-200 bg-lime-50/50 opacity-70'
                                                                    : selectedFixtures.has(f.fixtureId)
                                                                    ? 'border-slate-900 bg-slate-50'
                                                                    : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedFixtures.has(f.fixtureId)}
                                                                disabled={!isFixtureSelectable(f)}
                                                                onChange={() => toggleFixture(f.fixtureId)}
                                                                className="w-4 h-4 accent-amber-500 shrink-0"
                                                            />
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                {f.homeTeam.logo && <img src={f.homeTeam.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
                                                                <span className="text-xs font-bold text-slate-800 truncate">{f.homeTeam.name}</span>
                                                                <span className="text-xs text-slate-400 shrink-0">
                                                                    {f.homeScore != null ? `${f.homeScore} - ${f.awayScore}` : 'vs'}
                                                                </span>
                                                                <span className="text-xs font-bold text-slate-800 truncate">{f.awayTeam.name}</span>
                                                                {f.awayTeam.logo && <img src={f.awayTeam.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
                                                            </div>
                                                            <div className="shrink-0 text-right">
                                                                <p className="text-[10px] text-slate-400 truncate max-w-[100px]">{f.league.name}</p>
                                                                {f.alreadyImported
                                                                    ? <span className="text-[10px] font-black text-lime-600">{dateOverwrite ? 'Reimportar / actualizar' : 'Ya importado'}</span>
                                                                    : <span className="text-[10px] text-slate-400">{new Date(f.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })} BOG</span>
                                                                }
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>

                                                <div className="flex gap-4 text-sm">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={dateCreateTeams} onChange={e => setDateCreateTeams(e.target.checked)} className="w-4 h-4 accent-lime-500" />
                                                        <span className="text-slate-700 font-medium">Crear equipos</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={dateOverwrite} onChange={e => setDateOverwrite(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                                                        <span className="text-slate-700 font-medium">Actualizar existentes</span>
                                                    </label>
                                                </div>

                                                {importError && (
                                                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                                                        <AlertCircle size={14} /> {importError}
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => void handleImportSelected()}
                                                    disabled={importing || selectedFixtures.size === 0}
                                                    className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black uppercase text-sm hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                                                >
                                                    {importing
                                                        ? <><Loader2 size={16} className="animate-spin" /> Importando {selectedFixtures.size} partido{selectedFixtures.size !== 1 ? 's' : ''}…</>
                                                        : <><Download size={16} /> Importar {selectedFixtures.size} seleccionado{selectedFixtures.size !== 1 ? 's' : ''}</>
                                                    }
                                                </button>
                                            </div>
                                        )}

                                        {!searchingDate && fixtureResults.length === 0 && fixtureDate && !dateError && (
                                            <p className="text-center text-sm text-slate-400 py-4">Busca una fecha para ver los partidos disponibles</p>
                                        )}
                                    </div>
                                )}

                                {/* ── Team mode ── */}
                                {mode === 'team' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-600">Busca un equipo por nombre, selecciónalo y carga sus partidos para una temporada. Ideal para encontrar amistosos de selecciones como Colombia.</p>

                                        {usage && (
                                            <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                                                <Info size={13} className="shrink-0 mt-0.5 text-slate-400" />
                                                <p>Buscar equipo consume <strong>1 request</strong>. Cargar sus partidos consume <strong>1 request adicional</strong>. Quedan: <strong>{usage.requests.available}</strong>.</p>
                                            </div>
                                        )}

                                        {/* Team search input */}
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Shield size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Nombre del equipo (ej: Colombia, Argentina…)"
                                                    value={teamQuery}
                                                    onChange={(e) => setTeamQuery(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && void handleSearchTeam()}
                                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                                />
                                            </div>
                                            <button
                                                onClick={() => void handleSearchTeam()}
                                                disabled={searchingTeam || !teamQuery.trim()}
                                                className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-900 text-sm font-bold hover:bg-amber-500 disabled:opacity-50 transition-colors"
                                            >
                                                {searchingTeam ? <Loader2 size={16} className="animate-spin" /> : 'Buscar'}
                                            </button>
                                        </div>

                                        {teamError && (
                                            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                                                <AlertCircle size={14} /> {teamError}
                                            </div>
                                        )}

                                        {searchingTeam && (
                                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                                                <Loader2 size={16} className="animate-spin" /> Buscando equipos…
                                            </div>
                                        )}

                                        {/* Team results list */}
                                        {!searchingTeam && teamResults.length > 0 && !selectedTeam && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{teamResults.length} equipo{teamResults.length !== 1 ? 's' : ''} encontrado{teamResults.length !== 1 ? 's' : ''}</p>
                                                <div className="space-y-1.5 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                                    {teamResults.map((team) => (
                                                        <button
                                                            key={team.id}
                                                            onClick={() => void handleLoadTeamFixtures(team)}
                                                            className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all text-left group"
                                                        >
                                                            {team.logo ? (
                                                                <img src={team.logo} alt={team.name} className="w-9 h-9 object-contain shrink-0" />
                                                            ) : (
                                                                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                                                    <Shield size={16} className="text-slate-400" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-black text-slate-900 truncate">{team.name}</p>
                                                                <p className="text-[10px] text-slate-400">
                                                                    {team.country && <span>{team.country} · </span>}
                                                                    {team.national ? <span className="text-blue-600 font-bold">Selección Nacional</span> : 'Club'}
                                                                    {team.code && <span className="ml-1 text-slate-300">· {team.code}</span>}
                                                                </p>
                                                            </div>
                                                            <ArrowRight size={14} className="text-slate-300 group-hover:text-amber-500 transition-colors shrink-0" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Selected team + season + fixtures */}
                                        {selectedTeam && (
                                            <div className="space-y-3">
                                                {/* Selected team header */}
                                                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                                                    {selectedTeam.logo ? (
                                                        <img src={selectedTeam.logo} alt={selectedTeam.name} className="w-10 h-10 object-contain shrink-0" />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                                            <Shield size={18} className="text-slate-400" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-slate-900">{selectedTeam.name}</p>
                                                        <p className="text-[10px] text-slate-500">{selectedTeam.country} · {selectedTeam.national ? 'Selección Nacional' : 'Club'}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => { setSelectedTeam(null); setTeamFixtures([]); setSelectedFixtures(new Set()); }}
                                                        className="text-slate-400 hover:text-slate-600 transition-colors"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>

                                                {/* Season selector */}
                                                <div className="flex items-center gap-3">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest shrink-0">Temporada</label>
                                                    <input
                                                        type="number"
                                                        value={teamSeason}
                                                        onChange={(e) => setTeamSeason(Number(e.target.value))}
                                                        min={2018}
                                                        max={2030}
                                                        className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                    />
                                                    <button
                                                        onClick={() => void handleLoadTeamFixtures(selectedTeam)}
                                                        disabled={loadingTeamFixtures}
                                                        className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 disabled:opacity-50 transition-colors"
                                                    >
                                                        {loadingTeamFixtures ? <Loader2 size={13} className="animate-spin" /> : 'Cargar'}
                                                    </button>
                                                </div>

                                                {loadingTeamFixtures && (
                                                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                                                        <Loader2 size={16} className="animate-spin" /> Cargando partidos de {selectedTeam.name}…
                                                    </div>
                                                )}

                                                {!loadingTeamFixtures && teamFixtures.length > 0 && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{teamFixtures.length} partidos temporada {teamSeason}</p>
                                                            <button
                                                                onClick={() => setSelectedFixtures(
                                                                    selectedFixtures.size === teamFixtures.filter(isFixtureSelectable).length
                                                                        ? new Set()
                                                                        : new Set(teamFixtures.filter(isFixtureSelectable).map(f => f.fixtureId))
                                                                )}
                                                                className="text-[10px] font-bold text-amber-600 hover:text-amber-700"
                                                            >
                                                                {selectedFixtures.size > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                                            </button>
                                                        </div>

                                                        <div className="space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                                            {teamFixtures.map((f) => (
                                                                <label
                                                                    key={f.fixtureId}
                                                                    className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                                                                        f.alreadyImported && !dateOverwrite
                                                                            ? 'border-lime-200 bg-lime-50/50 opacity-70'
                                                                            : selectedFixtures.has(f.fixtureId)
                                                                            ? 'border-slate-900 bg-slate-50'
                                                                            : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
                                                                    }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedFixtures.has(f.fixtureId)}
                                                                        disabled={!isFixtureSelectable(f)}
                                                                        onChange={() => toggleFixture(f.fixtureId)}
                                                                        className="w-4 h-4 accent-amber-500 shrink-0"
                                                                    />
                                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                        {f.homeTeam.logo && <img src={f.homeTeam.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
                                                                        <span className="text-xs font-bold text-slate-800 truncate">{f.homeTeam.name}</span>
                                                                        <span className="text-xs text-slate-400 shrink-0">
                                                                            {f.homeScore != null ? `${f.homeScore} - ${f.awayScore}` : 'vs'}
                                                                        </span>
                                                                        <span className="text-xs font-bold text-slate-800 truncate">{f.awayTeam.name}</span>
                                                                        {f.awayTeam.logo && <img src={f.awayTeam.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
                                                                    </div>
                                                                    <div className="shrink-0 text-right">
                                                                        <p className="text-[10px] text-slate-400 truncate max-w-[100px]">{f.league.name}</p>
                                                                        {f.alreadyImported
                                                                            ? <span className="text-[10px] font-black text-lime-600">{dateOverwrite ? 'Reimportar / actualizar' : 'Ya importado'}</span>
                                                                            : <span className="text-[10px] text-slate-400">{new Date(f.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}</span>
                                                                        }
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>

                                                        {/* Options */}
                                                        <div className="flex gap-4 text-sm">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input type="checkbox" checked={dateCreateTeams} onChange={e => setDateCreateTeams(e.target.checked)} className="w-4 h-4 accent-lime-500" />
                                                                <span className="text-slate-700 font-medium">Crear equipos</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input type="checkbox" checked={dateOverwrite} onChange={e => setDateOverwrite(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                                                                <span className="text-slate-700 font-medium">Actualizar existentes</span>
                                                            </label>
                                                        </div>

                                                        {importError && (
                                                            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                                                                <AlertCircle size={14} /> {importError}
                                                            </div>
                                                        )}

                                                        <button
                                                            onClick={() => void handleImportSelected()}
                                                            disabled={importing || selectedFixtures.size === 0}
                                                            className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black uppercase text-sm hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                                                        >
                                                            {importing
                                                                ? <><Loader2 size={16} className="animate-spin" /> Importando {selectedFixtures.size} partido{selectedFixtures.size !== 1 ? 's' : ''}…</>
                                                                : <><Download size={16} /> Importar {selectedFixtures.size} seleccionado{selectedFixtures.size !== 1 ? 's' : ''}</>
                                                            }
                                                        </button>
                                                    </div>
                                                )}

                                                {!loadingTeamFixtures && teamFixtures.length === 0 && !teamError && (
                                                    <p className="text-center text-sm text-slate-400 py-4">No se encontraron partidos para {selectedTeam.name} en {teamSeason}. Prueba otra temporada.</p>
                                                )}
                                            </div>
                                        )}

                                        {!searchingTeam && teamResults.length === 0 && !teamQuery && (
                                            <p className="text-center text-sm text-slate-400 py-4">Escribe el nombre de un equipo para comenzar</p>
                                        )}
                                    </div>
                                )}

                                {/* ── ID mode ── */}
                                {mode === 'id' && (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                                            <Info size={13} className="shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-bold mb-1">¿Cómo obtener el ID del fixture?</p>
                                                <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
                                                    <li>Ve a <strong>api-football.com</strong> → Products → Fixtures</li>
                                                    <li>Busca el partido por fecha o equipo</li>
                                                    <li>El ID aparece en la URL o en la respuesta JSON como <code className="bg-blue-100 px-1 rounded">fixture.id</code></li>
                                                    <li>Pega el ID aquí y haz clic en Buscar</li>
                                                </ol>
                                                <p className="mt-1.5 text-blue-500">Puedes ingresar múltiples IDs separados por coma o espacio.</p>
                                            </div>
                                        </div>

                                        {usage && (
                                            <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                                                <Zap size={13} className="shrink-0 mt-0.5 text-amber-500" />
                                                <p>Cada ID consume <strong>1 request</strong> para previsualizar. Quedan: <strong>{usage.requests.available}</strong>.</p>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">ID(s) de fixture en API-Football</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Ej: 1208138, 1208139"
                                                    value={fixtureIdInput}
                                                    onChange={(e) => setFixtureIdInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && void handlePreviewByIds()}
                                                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                />
                                                <button
                                                    onClick={() => void handlePreviewByIds()}
                                                    disabled={previewingIds || !fixtureIdInput.trim()}
                                                    className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-900 text-sm font-bold hover:bg-amber-500 disabled:opacity-50 transition-colors"
                                                >
                                                    {previewingIds ? <Loader2 size={16} className="animate-spin" /> : 'Buscar'}
                                                </button>
                                            </div>
                                        </div>

                                        {idError && (
                                            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                                                <AlertCircle size={14} /> {idError}
                                            </div>
                                        )}

                                        {previewingIds && (
                                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                                                <Loader2 size={16} className="animate-spin" /> Consultando API-Football…
                                            </div>
                                        )}

                                        {!previewingIds && idFixtures.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{idFixtures.length} fixture{idFixtures.length !== 1 ? 's' : ''} encontrado{idFixtures.length !== 1 ? 's' : ''}</p>
                                                    <button
                                                        onClick={() => setSelectedFixtures(
                                                            selectedFixtures.size === idFixtures.filter(isFixtureSelectable).length
                                                                ? new Set()
                                                                : new Set(idFixtures.filter(isFixtureSelectable).map(f => f.fixtureId))
                                                        )}
                                                        className="text-[10px] font-bold text-amber-600 hover:text-amber-700"
                                                    >
                                                        {selectedFixtures.size > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                                    </button>
                                                </div>

                                                <div className="space-y-2">
                                                    {idFixtures.map((f) => (
                                                        <label
                                                            key={f.fixtureId}
                                                            className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                                                                f.alreadyImported && !dateOverwrite
                                                                    ? 'border-lime-200 bg-lime-50/50 opacity-70'
                                                                    : selectedFixtures.has(f.fixtureId)
                                                                    ? 'border-slate-900 bg-slate-50'
                                                                    : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedFixtures.has(f.fixtureId)}
                                                                disabled={!isFixtureSelectable(f)}
                                                                onChange={() => toggleFixture(f.fixtureId)}
                                                                className="w-4 h-4 accent-amber-500 shrink-0"
                                                            />
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                {f.homeTeam.logo && <img src={f.homeTeam.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
                                                                <span className="text-xs font-bold text-slate-800 truncate">{f.homeTeam.name}</span>
                                                                <span className="text-xs text-slate-400 shrink-0">vs</span>
                                                                <span className="text-xs font-bold text-slate-800 truncate">{f.awayTeam.name}</span>
                                                                {f.awayTeam.logo && <img src={f.awayTeam.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
                                                            </div>
                                                            <div className="shrink-0 text-right">
                                                                <p className="text-[10px] text-slate-500 font-mono">ID: {f.fixtureId}</p>
                                                                <p className="text-[10px] text-slate-400">{new Date(f.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                                {f.alreadyImported && <span className="text-[10px] font-black text-lime-600">{dateOverwrite ? 'Reimportar / actualizar' : 'Ya importado'}</span>}
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>

                                                <div className="flex gap-4 text-sm">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={dateCreateTeams} onChange={e => setDateCreateTeams(e.target.checked)} className="w-4 h-4 accent-lime-500" />
                                                        <span className="text-slate-700 font-medium">Crear equipos</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={dateOverwrite} onChange={e => setDateOverwrite(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                                                        <span className="text-slate-700 font-medium">Actualizar existentes</span>
                                                    </label>
                                                </div>

                                                {importError && (
                                                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                                                        <AlertCircle size={14} /> {importError}
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => void handleImportSelected()}
                                                    disabled={importing || selectedFixtures.size === 0}
                                                    className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black uppercase text-sm hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                                                >
                                                    {importing
                                                        ? <><Loader2 size={16} className="animate-spin" /> Importando…</>
                                                        : <><Download size={16} /> Importar {selectedFixtures.size} seleccionado{selectedFixtures.size !== 1 ? 's' : ''}</>
                                                    }
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── League mode ── */}
                                {mode === 'league' && (<>

                                {/* Rate limit info */}
                                {usage && (
                                    <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                                        <Info size={13} className="shrink-0 mt-0.5 text-slate-400" />
                                        <p>
                                            Cada búsqueda consume <strong>1 request</strong>, la vista previa consume <strong>2</strong> y la importación consume <strong>2–3</strong>.
                                            Hoy llevas <strong>{usage.requests.used}/{usage.requests.limit}</strong> — quedan <strong>{usage.requests.available}</strong>.
                                        </p>
                                    </div>
                                )}

                                <p className="text-sm text-slate-600">
                                    Busca por nombre <span className="text-slate-400">o directamente por</span> <strong>ID numérico</strong> de la liga (más preciso).
                                </p>

                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Nombre (ej: World Cup) o ID (ej: 10, 239, 1)…"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="País"
                                        value={searchCountry}
                                        onChange={(e) => setSearchCountry(e.target.value)}
                                        className="w-28 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                    <button
                                        onClick={() => void handleSearch()}
                                        disabled={searching || !searchQuery.trim()}
                                        className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-900 text-sm font-bold hover:bg-amber-500 disabled:opacity-50 transition-colors"
                                    >
                                        {searching ? <Loader2 size={16} className="animate-spin" /> : 'Buscar'}
                                    </button>
                                </div>

                                {searchError && (
                                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                                        <AlertCircle size={14} /> {searchError}
                                    </div>
                                )}

                                {/* Results */}
                                {searching && (
                                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                                        <Loader2 size={16} className="animate-spin" /> Consultando API-Football…
                                    </div>
                                )}

                                {!searching && searchResults.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                            {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} · consumió 1 request
                                            {/^\d+$/.test(searchQuery.trim()) && ' (búsqueda por ID)'}
                                        </p>
                                        {searchResults.map((league) => (
                                            <button
                                                key={league.id}
                                                onClick={() => handleSelectLeague(league)}
                                                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all text-left group"
                                            >
                                                {league.logoUrl ? (
                                                    <img src={league.logoUrl} alt={league.name} className="w-10 h-10 object-contain" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                                        <Trophy size={18} className="text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-black text-slate-900 truncate">{league.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                            <Globe size={10} /> {league.country}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 uppercase">{league.type}</span>
                                                        {league.currentSeason && (
                                                            <span className="text-[10px] bg-lime-100 text-lime-700 px-1.5 py-0.5 rounded font-bold">
                                                                Temporada activa: {league.currentSeason}
                                                            </span>
                                                        )}
                                                        {league.seasons.length > 0 && (
                                                            <span className="text-[10px] text-slate-400">{league.seasons.length} temporadas disponibles</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-300 group-hover:text-amber-500 transition-colors shrink-0">ID: {league.id}</span>
                                                <ArrowRight size={14} className="text-slate-300 group-hover:text-amber-500 transition-colors shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && !searchError && (
                                    <p className="text-center text-sm text-slate-400 py-6">Sin resultados para "{searchQuery}"</p>
                                )}

                                {/* Popular leagues quicklinks — trigger real search */}
                                {!searching && searchResults.length === 0 && mode === 'league' && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Accesos rápidos</p>
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2 text-xs text-blue-700 mb-3">
                                            <Info size={13} className="shrink-0 mt-0.5" />
                                            <p>
                                                <strong>¿Mundial vs Amistosos?</strong> El torneo <strong>FIFA World Cup</strong> (ID 1) solo tiene los partidos oficiales.
                                                Los <strong>Amistosos Internacionales</strong> (ID 10) contienen los partidos preparatorios donde juega Colombia
                                                y otros seleccionados — estos son los que debes importar si quieres los amistosos del ciclo mundialista.
                                            </p>
                                        </div>
                                        {POPULAR_LEAGUES.map((item) => (
                                            <button
                                                key={item.query}
                                                onClick={() => handleQuickSearch(item.query)}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-amber-300 hover:bg-amber-50/30 transition-all text-left"
                                            >
                                                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                                                    <Search size={14} className="text-amber-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-800">{item.label}</p>
                                                    <p className="text-[10px] text-slate-400 truncate">{item.country} · {item.note}</p>
                                                </div>
                                                <ArrowRight size={13} className="text-slate-300 shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                                </>)}
                            </motion.div>
                        )}

                        {/* ── Step 1: Season + Options ── */}
                        {step === 1 && selectedLeague && (
                            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                                {/* Selected league */}
                                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    {selectedLeague.logoUrl ? (
                                        <img src={selectedLeague.logoUrl} alt={selectedLeague.name} className="w-12 h-12 object-contain" />
                                    ) : (
                                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                                            <Trophy size={22} />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-black text-slate-900">{selectedLeague.name}</p>
                                        <p className="text-xs text-slate-500">{selectedLeague.country} · {selectedLeague.type} · ID: {selectedLeague.id}</p>
                                        {usage && (
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                La vista previa consumirá 2 requests · quedan {usage.requests.available}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Season selector */}
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Temporada</label>
                                    {selectedLeague.seasons.length > 0 ? (
                                        <div className="flex gap-2 flex-wrap">
                                            {selectedLeague.seasons.slice(0, 8).map((y) => (
                                                <button
                                                    key={y}
                                                    onClick={() => setSeason(y)}
                                                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${season === y ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
                                                >
                                                    {y}
                                                    {y === selectedLeague.currentSeason && (
                                                        <span className="ml-1.5 text-[9px] bg-lime-400 text-slate-900 rounded px-1 font-black">ACTIVA</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-xs text-slate-500">Ingresa el año de la temporada manualmente:</p>
                                            <input
                                                type="number"
                                                value={season}
                                                onChange={(e) => setSeason(Number(e.target.value))}
                                                min={2000}
                                                max={2030}
                                                className="w-32 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                placeholder="Año"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Options */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Opciones de importación</p>

                                    <label className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={createTeams}
                                            onChange={(e) => setCreateTeams(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 accent-lime-500"
                                        />
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                                <Users size={14} className="text-lime-600" /> Crear equipos automáticamente
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">Si un equipo no existe en la BD, lo crea con nombre, código, bandera y ID de API. Consume 1 request adicional.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={overwriteExisting}
                                            onChange={(e) => setOverwriteExisting(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 accent-amber-500"
                                        />
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                                <Zap size={14} className="text-amber-500" /> Actualizar partidos existentes
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">Si un partido ya existe (por ID externo), actualiza su fecha, resultado, estado y sede.</p>
                                        </div>
                                    </label>
                                </div>

                                {previewError && (
                                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                                        <AlertCircle size={14} /> {previewError}
                                    </div>
                                )}

                                <button
                                    onClick={() => void loadPreview()}
                                    disabled={loadingPreview}
                                    className="w-full py-3 rounded-2xl bg-amber-400 text-slate-900 font-black uppercase text-sm hover:bg-amber-500 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                                >
                                    {loadingPreview ? <><Loader2 size={16} className="animate-spin" /> Consultando API-Football…</> : <><ArrowRight size={16} /> Ver vista previa</>}
                                </button>
                            </motion.div>
                        )}

                        {/* ── Step 2: Preview ── */}
                        {step === 2 && preview && (
                            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Fixtures', value: preview.totalFixtures, color: 'bg-slate-900 text-white', icon: Trophy },
                                        { label: 'Equipos nuevos', value: preview.newTeamsCount, color: 'bg-lime-50 text-lime-800', icon: Shield },
                                        { label: 'Ya importados', value: preview.existingFixturesCount, color: 'bg-amber-50 text-amber-800', icon: Download },
                                        { label: 'Jornadas/Rondas', value: preview.rounds.length, color: 'bg-blue-50 text-blue-800', icon: Users },
                                    ].map(({ label, value, color, icon: Icon }) => (
                                        <div key={label} className={`${color} rounded-2xl p-4 space-y-1`}>
                                            <Icon size={16} className="opacity-60" />
                                            <p className="text-2xl font-black">{value}</p>
                                            <p className="text-[10px] font-bold uppercase opacity-60">{label}</p>
                                        </div>
                                    ))}
                                </div>

                                {usage && (
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                                        <Zap size={13} className="text-amber-500 shrink-0" />
                                        <p>La importación consumirá <strong>{createTeams ? '3' : '2'} requests</strong>. Quedan disponibles: <strong>{usage.requests.available}</strong>.</p>
                                    </div>
                                )}

                                {/* Rounds */}
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Rondas / Jornadas ({preview.rounds.length})</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {preview.rounds.map((r) => (
                                            <span key={r} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">{r}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* Teams */}
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Equipos ({preview.teams.length})</p>
                                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                        {(showAllTeams ? preview.teams : preview.teams.slice(0, 16)).map((t) => (
                                            <div key={t.id} className={`flex items-center gap-2 p-2 rounded-xl border text-xs ${t.alreadyExists ? 'border-lime-200 bg-lime-50/50' : 'border-slate-200 bg-white'}`}>
                                                {t.logo ? (
                                                    <img src={t.logo} alt={t.name} className="w-5 h-5 object-contain shrink-0" />
                                                ) : (
                                                    <div className="w-5 h-5 bg-slate-200 rounded shrink-0" />
                                                )}
                                                <span className="font-bold text-slate-700 truncate">{t.name}</span>
                                                {t.alreadyExists && <Check size={10} className="text-lime-600 shrink-0" />}
                                            </div>
                                        ))}
                                    </div>
                                    {preview.teams.length > 16 && (
                                        <button onClick={() => setShowAllTeams(!showAllTeams)} className="mt-2 text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">
                                            <ChevronDown size={12} className={showAllTeams ? 'rotate-180' : ''} />
                                            {showAllTeams ? 'Ver menos' : `Ver todos (${preview.teams.length})`}
                                        </button>
                                    )}
                                </div>

                                {preview.totalFixtures === 0 && (
                                    <div className="flex items-start gap-2 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold mb-1">No hay fixtures para la temporada {season}</p>
                                            <p className="text-rose-700">Esta combinación liga/temporada no tiene partidos en API-Football. Posibles causas:</p>
                                            <ul className="mt-1 space-y-0.5 text-rose-700 list-disc list-inside">
                                                <li>La temporada seleccionada aún no tiene partidos programados</li>
                                                <li>La liga {preview.league.id} puede ser de clubes, no de selecciones nacionales</li>
                                                <li>Para amistosos de selecciones, prueba buscar por equipo (ej: "Colombia") en vez de liga</li>
                                            </ul>
                                            {preview.league.seasons.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="font-bold text-rose-800">Temporadas con datos disponibles:</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {preview.league.seasons.slice(0, 10).map((y) => (
                                                            <button
                                                                key={y}
                                                                onClick={() => { setSeason(y); setStep(1); }}
                                                                className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-700 font-bold hover:bg-rose-100 transition-colors"
                                                            >
                                                                {y}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {preview.existingFixturesCount > 0 && !overwriteExisting && (
                                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                        <p>{preview.existingFixturesCount} partidos ya existen y serán omitidos. Activa "Actualizar existentes" si quieres sobreescribirlos.</p>
                                    </div>
                                )}

                                <button
                                    onClick={() => void handleImport()}
                                    disabled={importing || preview.totalFixtures === 0}
                                    className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black uppercase text-sm hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                                >
                                    {importing ? <><Loader2 size={16} className="animate-spin" /> Importando…</> : <><Download size={16} /> Confirmar importación</>}
                                </button>

                                {importError && (
                                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                                        <AlertCircle size={14} /> {importError}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ── Step 3: Result ── */}
                        {step === 3 && importResult && (
                            <motion.div key="s3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 text-center">
                                <div className="w-16 h-16 bg-lime-100 rounded-full flex items-center justify-center mx-auto">
                                    <Check size={32} className="text-lime-600" strokeWidth={3} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase">{importResult.tournamentName}</h3>
                                    <p className="text-sm text-slate-500 mt-1">Importación completada · Temporada {season}</p>
                                    {usage && (
                                        <p className="text-[10px] text-slate-400 mt-1">Requests restantes hoy: {usage.requests.available}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
                                    {[
                                        { label: 'Partidos importados', value: importResult.fixturesImported, color: 'bg-lime-50 text-lime-800' },
                                        { label: 'Partidos actualizados', value: importResult.fixturesUpdated, color: 'bg-blue-50 text-blue-800' },
                                        { label: 'Equipos creados', value: importResult.teamsCreated, color: 'bg-amber-50 text-amber-800' },
                                        { label: 'Equipos enlazados', value: importResult.teamsLinked, color: 'bg-purple-50 text-purple-800' },
                                        { label: 'Omitidos', value: importResult.skipped, color: 'bg-slate-100 text-slate-600' },
                                        { label: 'Errores', value: importResult.errors.length, color: importResult.errors.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-400' },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} className={`${color} rounded-2xl p-4`}>
                                            <p className="text-2xl font-black">{value}</p>
                                            <p className="text-[10px] font-bold uppercase mt-1 opacity-70">{label}</p>
                                        </div>
                                    ))}
                                </div>

                                {importResult.errors.length > 0 && (
                                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-left space-y-1">
                                        <p className="text-xs font-black uppercase text-rose-700">{importResult.errors.length} advertencias</p>
                                        <div className="max-h-32 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin' }}>
                                            {importResult.errors.map((e, i) => (
                                                <p key={i} className="text-xs text-rose-600">{e}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                        Cerrar
                                    </button>
                                    <button onClick={() => setStep(4)} className="flex-1 py-3 rounded-2xl bg-violet-600 text-white text-sm font-black uppercase hover:bg-violet-700 transition-colors flex items-center justify-center gap-2">
                                        <FlaskConical size={16} /> Generar datos de prueba
                                    </button>
                                    <button onClick={() => { onImported(); onClose(); }} className="flex-1 py-3 rounded-2xl bg-lime-400 text-slate-900 text-sm font-black uppercase hover:bg-lime-500 transition-colors">
                                        Ver partidos
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Step 4: Seed test data ── */}
                        {step === 4 && (
                            <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                                
                                {/* Info banner */}
                                <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
                                    <FlaskConical size={13} className="shrink-0 mt-0.5" />
                                    <p>Genera pronósticos de prueba para <strong>todos los participantes activos</strong> de las pollas seleccionadas. Útil para probar el sistema sin ingresar manualmente cada predicción. <strong>Solo crea pronósticos nuevos</strong> (no sobreescribe existentes).</p>
                                </div>

                                {/* League selector */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pollas (selecciona una o varias)</label>
                                        <button
                                            onClick={handleCreateTestLeagues}
                                            disabled={creatingLeagues}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {creatingLeagues ? (
                                                <>
                                                    <Loader2 size={12} className="animate-spin" /> Creando...
                                                </>
                                            ) : (
                                                <>
                                                    <Plus size={12} /> Crear pollas de prueba
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    {loadingLeagues ? (
                                        <div className="flex items-center gap-2 py-4 text-sm text-slate-400 justify-center">
                                            <Loader2 size={14} className="animate-spin" /> Cargando pollas…
                                        </div>
                                    ) : leagues.length === 0 ? (
                                        <p className="text-xs text-slate-500 py-3 text-center">No hay pollas disponibles</p>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] text-slate-500">{leagues.length} pollas disponibles</p>
                                                <button
                                                    onClick={() => setSelectedLeagueIds(
                                                        selectedLeagueIds.size === leagues.length
                                                            ? new Set()
                                                            : new Set(leagues.map(l => l.id))
                                                    )}
                                                    className="text-[10px] font-bold text-violet-600 hover:text-violet-700"
                                                >
                                                    {selectedLeagueIds.size === leagues.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                                                </button>
                                            </div>
                                            <div className="space-y-1.5 max-h-52 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                                {leagues.map(league => (
                                                    <label
                                                        key={league.id}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedLeagueIds.has(league.id) ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-violet-200'}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLeagueIds.has(league.id)}
                                                            onChange={() => toggleLeague(league.id)}
                                                            className="w-4 h-4 accent-violet-500 shrink-0"
                                                        />
                                                        <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                                                            <Trophy size={12} className="text-violet-600" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-900 truncate">{league.name}</p>
                                                            <p className="text-[10px] text-slate-400 capitalize">
                                                                {league.status.toLowerCase()}
                                                                {league.baseFee && league.baseFee > 0 && <> · ${league.baseFee.toLocaleString('es-CO')} COP</>}
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Strategy selector */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Estrategia de pronósticos</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: 'realistic', label: 'Realista', desc: '40% empates, distribución FIFA' },
                                            { value: 'random', label: 'Aleatorio', desc: 'Scores completamente random' },
                                            { value: 'conservative', label: 'Conservador', desc: 'Mayoría empates y 0-0, 1-1' },
                                            { value: 'home_bias', label: 'Favorece local', desc: 'Equipo local gana más' },
                                        ].map(({ value, label, desc }) => (
                                            <button
                                                key={value}
                                                onClick={() => setSeedStrategy(value as any)}
                                                className={`p-3 rounded-xl border text-left transition-all ${seedStrategy === value ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-violet-200'}`}
                                            >
                                                <p className="text-sm font-bold text-slate-900">{label}</p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Payment simulation */}
                                <label className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={simulatePayments}
                                        onChange={(e) => setSimulatePayments(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 accent-lime-500"
                                    />
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                            <Zap size={14} className="text-lime-600" /> Simular pagos
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">Crea registros de pago con estado CONFIRMED para cada participante en pollas con cuota base (baseFee). Útil para probar flujos de pago sin transacciones reales.</p>
                                    </div>
                                </label>

                                {/* Progress indicator */}
                                <AnimatePresence>
                                    {seedProgress && seeding && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 bg-violet-50 border border-violet-300 rounded-2xl space-y-3"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Loader2 size={16} className="animate-spin text-violet-600" />
                                                <p className="text-sm font-bold text-slate-900">{seedProgress.message}</p>
                                            </div>
                                            
                                            {/* Progress bar */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-600 font-medium">Progreso general</span>
                                                    <span className="text-violet-600 font-black">{Math.round(seedProgress.progress)}%</span>
                                                </div>
                                                <div className="w-full h-2.5 bg-violet-100 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${seedProgress.progress}%` }}
                                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                                        className="h-full bg-gradient-to-r from-violet-500 to-violet-600 rounded-full"
                                                    />
                                                </div>
                                            </div>

                                            {/* Current league and member progress */}
                                            {seedProgress.currentLeague && (
                                                <div className="flex items-center justify-between text-xs bg-white rounded-lg p-2.5 border border-violet-200">
                                                    <div className="flex items-center gap-2">
                                                        <Trophy size={12} className="text-violet-600" />
                                                        <span className="font-bold text-slate-700">{seedProgress.currentLeague}</span>
                                                    </div>
                                                    {seedProgress.memberProgress && (
                                                        <span className="text-slate-500 font-medium">{seedProgress.memberProgress}</span>
                                                    )}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Error */}
                                {seedError && (
                                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                                        <AlertCircle size={14} /> {seedError}
                                    </div>
                                )}

                                {/* Result */}
                                <AnimatePresence>
                                    {seedResult && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 bg-lime-50 border border-lime-300 rounded-2xl space-y-3"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-lime-400 rounded-full flex items-center justify-center">
                                                    <Check size={14} strokeWidth={3} className="text-slate-900" />
                                                </div>
                                                <p className="text-sm font-black text-slate-900">¡Pronósticos generados!</p>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="bg-white rounded-xl p-3 border border-lime-200 text-center">
                                                    <p className="text-2xl font-black text-lime-600">{seedResult.totalCreated}</p>
                                                    <p className="text-slate-500 mt-0.5">creados</p>
                                                </div>
                                                <div className="bg-white rounded-xl p-3 border border-lime-200 text-center">
                                                    <p className="text-2xl font-black text-slate-400">{seedResult.totalSkipped}</p>
                                                    <p className="text-slate-500 mt-0.5">omitidos</p>
                                                </div>
                                                <div className="bg-white rounded-xl p-3 border border-lime-200 text-center">
                                                    <p className="text-2xl font-black text-amber-600">{seedResult.totalPayments}</p>
                                                    <p className="text-slate-500 mt-0.5">pagos</p>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                {seedResult.leagues.map((lg, i) => (
                                                    <div key={i} className="flex items-center justify-between text-[10px] bg-white rounded-lg p-2 border border-lime-200">
                                                        <span className="font-bold text-slate-700">{lg.name}</span>
                                                        <span className="text-slate-500">{lg.members} participantes · {lg.created} pronósticos · {lg.payments} pagos</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-slate-500 text-center">
                                                Estrategia: <strong className="capitalize">{seedResult.strategy.replace('_', ' ')}</strong> · {seedResult.matches} partidos
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setStep(3)}
                                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                                        aria-label="Volver al paso anterior"
                                    >
                                        <ArrowLeft size={16} /> Volver
                                    </button>
                                    <button
                                        onClick={() => void handleGenerateSeed()}
                                        disabled={seeding || selectedLeagueIds.size === 0}
                                        className="flex-1 py-3 rounded-2xl bg-violet-600 text-white font-black uppercase text-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20 hover:shadow-xl hover:shadow-violet-600/30"
                                        aria-label="Generar pronósticos de prueba"
                                    >
                                        {seeding ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" /> Generando…
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={16} /> Generar pronósticos
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => { onImported(); onClose(); }}
                                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-lime-400 text-slate-900 text-sm font-black uppercase hover:bg-lime-500 transition-all shadow-lg shadow-lime-400/20 hover:shadow-xl hover:shadow-lime-400/30"
                                        aria-label="Finalizar y cerrar"
                                    >
                                        <CheckCircle2 size={16} /> Finalizar
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer nav (steps 1-2) */}
                {step > 0 && step < 3 && (
                    <div className="px-6 pb-6 shrink-0 flex justify-between">
                        <button
                            onClick={() => setStep((s) => Math.max(0, s - 1))}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            <ArrowLeft size={14} /> Atrás
                        </button>
                    </div>
                )}
            </motion.div>

            {/* Modal para crear pollas de prueba */}
            <CreateTestLeaguesModal
                open={showCreateTestModal}
                onClose={() => setShowCreateTestModal(false)}
                onSuccess={handleTestLeaguesSuccess}
            />
        </div>
    );
};

export default TournamentImportModal;
