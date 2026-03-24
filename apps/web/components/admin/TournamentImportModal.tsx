import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown,
    Download, Globe, Info, Loader2, Search, Shield, Trophy, Users, X, Zap,
} from 'lucide-react';
import { request } from '../../api';

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
}

interface UsageInfo {
    requests: { used: number; limit: number; available: number };
}

interface Props {
    onClose: () => void;
    onImported: () => void;
}

const STEP_LABELS = ['Buscar liga', 'Temporada', 'Vista previa', 'Importar'];

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

    // Step 0: Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchCountry, setSearchCountry] = useState('');
    const [searchResults, setSearchResults] = useState<LeagueSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [selectedLeague, setSelectedLeague] = useState<LeagueSearchResult | null>(null);

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

    /* ─ load usage on mount ─ */
    useEffect(() => {
        request<UsageInfo>('/admin/football/usage').then(setUsage).catch(() => null);
    }, []);

    /* ─ reload usage after each API-consuming action ─ */
    const refreshUsage = useCallback(() => {
        request<UsageInfo>('/admin/football/usage').then(setUsage).catch(() => null);
    }, []);

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
        } catch (e: any) {
            setImportError(e?.message ?? 'Error al importar');
        } finally {
            setImporting(false);
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
                                {!searching && searchResults.length === 0 && (
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
                                    <button onClick={() => { onImported(); onClose(); }} className="flex-1 py-3 rounded-2xl bg-lime-400 text-slate-900 text-sm font-black uppercase hover:bg-lime-500 transition-colors">
                                        Ver partidos
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
        </div>
    );
};

export default TournamentImportModal;
