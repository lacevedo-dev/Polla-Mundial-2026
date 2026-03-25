import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Ban, Check, Star, Trash2, Trophy } from 'lucide-react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { useAdminLeaguesStore } from '../../stores/admin.leagues.store';
import StatusBadge from '../../components/admin/StatusBadge';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import { request } from '../../api';

interface AvailableTournament {
    id: string;
    name: string;
    logoUrl?: string;
    season: number;
    country?: string;
    active: boolean;
}

interface ScoringRule {
    id: string;
    ruleType: string;
    points: number;
    description?: string;
}

const RULE_LABELS: Record<string, string> = {
    EXACT_SCORE:       'Marcador exacto',
    CORRECT_WINNER:    'Ganador / empate correcto',
    TEAM_GOALS:        'Gol acertado (al menos un equipo)',
    UNIQUE_PREDICTION: 'Predicción única en la liga',
    PHASE_BONUS_R32:   'Bono clasificados — Fase 32',
    PHASE_BONUS_R16:   'Bono clasificados — Octavos',
    PHASE_BONUS_QF:    'Bono clasificados — Cuartos de final',
    PHASE_BONUS_SF:    'Bono clasificados — Semifinal',
    PHASE_BONUS_FINAL: 'Bono Campeón — Final',
    CORRECT_DIFF:      'Diferencia de goles correcta (obsoleto)',
};

const STATUSES = ['SETUP', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED'];

const DetailSkeleton: React.FC = () => (
    <div className="space-y-5 animate-pulse">
        <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-xl bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-7 w-48 bg-slate-200 rounded-xl" />
                <div className="flex gap-2">
                    <div className="h-5 w-20 bg-slate-100 rounded-full" />
                    <div className="h-5 w-16 bg-slate-100 rounded-full" />
                    <div className="h-5 w-24 bg-slate-100 rounded-full" />
                </div>
            </div>
        </div>
        <div className="h-12 w-full sm:w-80 bg-slate-100 rounded-xl" />
        <div className="h-64 rounded-[2rem] bg-slate-100" />
    </div>
);

const AdminLeagueDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const {
        selectedLeague, members, leagueTournaments, isLoading, isSaving, error,
        fetchLeague, fetchLeagueMembers, fetchLeagueTournaments,
        updateLeague, addLeagueTournament, removeLeagueTournament, setPrimaryTournament, banMember,
    } = useAdminLeaguesStore();
    const [tournamentsError, setTournamentsError] = React.useState<string | null>(null);

    const [status, setStatus] = React.useState('');
    const [confirmBan, setConfirmBan] = React.useState<{ userId: string; name: string } | null>(null);
    const [isDirty, setIsDirty] = React.useState(false);
    const [allTournaments, setAllTournaments] = React.useState<AvailableTournament[]>([]);
    const [loadingTournaments, setLoadingTournaments] = React.useState(false);

    const [scoringRules, setScoringRules] = React.useState<ScoringRule[]>([]);
    const [rulesEdited, setRulesEdited] = React.useState<Record<string, number>>({});
    const [savingRules, setSavingRules] = React.useState(false);

    React.useEffect(() => {
        if (id) {
            fetchLeague(id);
            fetchLeagueMembers(id);
            setTournamentsError(null);
            fetchLeagueTournaments(id).catch((e: any) =>
                setTournamentsError(e?.message ?? 'Error al cargar torneos')
            );
        }
    }, [id, fetchLeague, fetchLeagueMembers, fetchLeagueTournaments]);

    React.useEffect(() => {
        if (!id) return;
        request<ScoringRule[]>(`/admin/leagues/${id}/scoring-rules`)
            .then((rules) => { setScoringRules(rules); setRulesEdited({}); })
            .catch(() => null);
    }, [id]);

    React.useEffect(() => {
        setLoadingTournaments(true);
        request<AvailableTournament[]>('/admin/football/tournaments')
            .then(setAllTournaments)
            .catch(() => null)
            .finally(() => setLoadingTournaments(false));
    }, []);

    React.useEffect(() => {
        if (selectedLeague) setStatus(selectedLeague.status);
    }, [selectedLeague]);

    const handleSave = async () => {
        if (!id) return;
        await updateLeague(id, { status });
        setIsDirty(false);
    };

    const handleSaveRules = async () => {
        if (!id || Object.keys(rulesEdited).length === 0) return;
        setSavingRules(true);
        try {
            const rules = Object.entries(rulesEdited).map(([ruleType, points]) => ({ ruleType, points }));
            const updated = await request<ScoringRule[]>(`/admin/leagues/${id}/scoring-rules`, {
                method: 'PATCH',
                body: JSON.stringify({ rules }),
            });
            setScoringRules(updated);
            setRulesEdited({});
        } finally {
            setSavingRules(false);
        }
    };

    if (isLoading && !selectedLeague) return <DetailSkeleton />;

    if (!selectedLeague) {
        return <div className="text-center py-16 text-slate-400">Polla no encontrada</div>;
    }

    const tabs = [
        { value: 'info', label: 'Información' },
        { value: 'tournaments', label: 'Torneos', count: leagueTournaments.length || undefined },
        { value: 'members', label: 'Miembros', count: members.length || undefined },
        { value: 'rules', label: 'Reglas' },
    ];

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start gap-3">
                <button
                    onClick={() => navigate('/admin/leagues')}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex-shrink-0 mt-0.5"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-brand uppercase tracking-tight leading-tight truncate">
                        {selectedLeague.name}
                    </h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <StatusBadge status={selectedLeague.status} size="md" />
                        <StatusBadge status={selectedLeague.plan} size="md" />
                        <span className="text-xs text-slate-400 font-mono">{selectedLeague.code}</span>
                        {leagueTournaments.length > 0 ? (
                            <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg uppercase tracking-wide">
                                <Trophy size={10} />
                                {leagueTournaments.find(t => t.isPrimary)?.name ?? `${leagueTournaments.length} torneo(s)`}
                            </span>
                        ) : (
                            <span className="text-[10px] text-slate-400 border border-dashed border-slate-300 px-2 py-0.5 rounded-lg">Sin torneo</span>
                        )}
                    </div>
                </div>
            </div>

            <TabsPrimitive.Root defaultValue="info">
                <TabsPrimitive.List className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-full sm:w-fit overflow-x-auto">
                    {tabs.map((tab) => (
                        <TabsPrimitive.Trigger
                            key={tab.value}
                            value={tab.value}
                            className="flex-1 sm:flex-none whitespace-nowrap flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-slate-200 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 text-[9px] font-black px-1">
                                    {tab.count}
                                </span>
                            )}
                        </TabsPrimitive.Trigger>
                    ))}
                </TabsPrimitive.List>

                {/* INFO TAB */}
                <TabsPrimitive.Content value="info">
                    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            {[
                                { label: 'Descripción', value: selectedLeague.description ?? '—' },
                                { label: 'Privacidad', value: <StatusBadge status={selectedLeague.privacy} size="md" /> },
                                { label: 'Moneda', value: selectedLeague.currency },
                                { label: 'Miembros', value: `${(selectedLeague as any)._count?.members ?? 0}` },
                                { label: 'Pronósticos', value: `${(selectedLeague as any)._count?.predictions ?? 0}` },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">{label}</p>
                                    <div className="text-sm font-bold text-slate-800">{value}</div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">Cambiar Estado</p>
                            <div className="flex gap-2 flex-wrap">
                                {STATUSES.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => { setStatus(s); setIsDirty(true); }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                            status === s
                                                ? 'bg-amber-400 border-amber-400 text-slate-950'
                                                : 'border-slate-200 text-slate-600 hover:border-amber-300'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            {isDirty && (
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="mt-3 px-5 py-2 bg-amber-400 text-slate-950 font-bold rounded-xl text-sm hover:bg-amber-500 disabled:opacity-60 transition-all"
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                            )}
                        </div>
                    </div>
                </TabsPrimitive.Content>

                {/* TOURNAMENTS TAB */}
                <TabsPrimitive.Content value="tournaments">
                    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
                        {tournamentsError && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                <strong>Error al cargar torneos:</strong> {tournamentsError}
                                <p className="mt-1 text-xs text-rose-500">Es posible que la migración de base de datos no se haya aplicado.</p>
                            </div>
                        )}

                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3">Torneos vinculados</p>
                            {leagueTournaments.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                                    <Trophy size={28} className="opacity-40" />
                                    <p className="text-sm">Sin torneos vinculados. Agrega uno abajo.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {leagueTournaments.map((t) => (
                                        <div key={t.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${t.isPrimary ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
                                            {t.logoUrl ? (
                                                <img src={t.logoUrl} alt={t.name} className="w-8 h-8 object-contain shrink-0" />
                                            ) : (
                                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                                    <Trophy size={14} className="text-slate-400" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{t.name}</p>
                                                    {t.isPrimary && (
                                                        <span className="text-[10px] bg-amber-400 text-slate-900 font-black px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">Principal</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400">{t.country} · Temporada {t.season}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {!t.isPrimary && (
                                                    <button
                                                        onClick={() => id && void setPrimaryTournament(id, t.id)}
                                                        disabled={isSaving}
                                                        title="Establecer como principal"
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-all"
                                                    >
                                                        <Star size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => id && void removeLeagueTournament(id, t.id)}
                                                    disabled={isSaving}
                                                    title="Desvincular torneo"
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                                <Star size={10} className="text-amber-500" />
                                El torneo <strong>Principal</strong> determina qué partidos generan sugerencia de participación
                            </p>
                        </div>

                        <div className="border-t border-slate-100 pt-5">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3">Agregar torneo</p>
                            {loadingTournaments ? (
                                <p className="text-sm text-slate-400">Cargando torneos disponibles…</p>
                            ) : allTournaments.length === 0 ? (
                                <p className="text-sm text-slate-400">No hay torneos importados. Ve a la sección de partidos para importar torneos.</p>
                            ) : (
                                <div className="space-y-1.5 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                    {allTournaments
                                        .filter(t => !leagueTournaments.some(lt => lt.id === t.id))
                                        .map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => id && void addLeagueTournament(id, t.id)}
                                                disabled={isSaving}
                                                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all text-left group"
                                            >
                                                {t.logoUrl ? (
                                                    <img src={t.logoUrl} alt={t.name} className="w-8 h-8 object-contain shrink-0" />
                                                ) : (
                                                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                                        <Trophy size={14} className="text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{t.name}</p>
                                                    <p className="text-[10px] text-slate-400">{t.country} · Temporada {t.season}</p>
                                                </div>
                                                <Check size={14} className="text-slate-200 group-hover:text-amber-500 transition-colors shrink-0" />
                                            </button>
                                        ))
                                    }
                                    {allTournaments.filter(t => !leagueTournaments.some(lt => lt.id === t.id)).length === 0 && (
                                        <p className="text-sm text-slate-400 py-3 text-center">Todos los torneos ya están vinculados.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </TabsPrimitive.Content>

                {/* RULES TAB */}
                <TabsPrimitive.Content value="rules">
                    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Puntuación</p>
                                <p className="text-sm text-slate-500 mt-0.5">Los cambios aplican al próximo cálculo de puntos.</p>
                            </div>
                            {Object.keys(rulesEdited).length > 0 && (
                                <button
                                    onClick={handleSaveRules}
                                    disabled={savingRules}
                                    className="px-5 py-2 bg-amber-400 text-slate-950 font-bold rounded-xl text-sm hover:bg-amber-500 disabled:opacity-60 transition-all"
                                >
                                    {savingRules ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                            )}
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-slate-100">
                            <div className="grid grid-cols-[1fr_80px] gap-4 px-4 py-2 bg-slate-50 border-b border-slate-100">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Regla</p>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 text-right">Puntos</p>
                            </div>
                            {scoringRules.map((rule) => {
                                const currentPoints = rulesEdited[rule.ruleType] ?? rule.points;
                                const isChanged = rulesEdited[rule.ruleType] !== undefined;
                                return (
                                    <div key={rule.id} className="grid grid-cols-[1fr_80px] gap-4 px-4 py-3 items-center border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50">
                                        <div>
                                            <p className={`text-sm font-bold ${rule.ruleType === 'CORRECT_DIFF' ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                                                {RULE_LABELS[rule.ruleType] ?? rule.ruleType}
                                            </p>
                                            {rule.description && rule.description !== RULE_LABELS[rule.ruleType] && (
                                                <p className="text-[10px] text-slate-400 mt-0.5">{rule.description}</p>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            min={0}
                                            max={50}
                                            value={currentPoints}
                                            onChange={(e) => setRulesEdited((prev) => ({ ...prev, [rule.ruleType]: Number(e.target.value) }))}
                                            disabled={rule.ruleType === 'CORRECT_DIFF'}
                                            className={`w-full rounded-xl border px-2 py-1.5 text-right text-sm font-black transition-all outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-30 disabled:cursor-not-allowed ${
                                                isChanged ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-900'
                                            }`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        {scoringRules.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-4">Cargando reglas...</p>
                        )}
                    </div>
                </TabsPrimitive.Content>

                {/* MEMBERS TAB */}
                <TabsPrimitive.Content value="members">
                    {members.length === 0 ? (
                        <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm shadow-sm">
                            Sin miembros en esta polla
                        </div>
                    ) : (
                        <>
                            {/* Mobile cards */}
                            <div className="md:hidden space-y-2">
                                {members.map((member) => (
                                    <div key={member.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
                                        <img
                                            src={member.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user.name)}&background=e2e8f0&color=64748b`}
                                            className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                                            alt={member.user.name}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{member.user.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                <StatusBadge status={member.role} />
                                                <StatusBadge status={member.status} />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setConfirmBan({ userId: member.user.id, name: member.user.name })}
                                            disabled={member.status === 'BANNED'}
                                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all disabled:opacity-30"
                                        >
                                            <Ban size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop table */}
                            <div className="hidden md:block rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Miembro</p>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Rol</p>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado</p>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Acción</p>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {members.map((member) => (
                                        <div key={member.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 items-center hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <img
                                                    src={member.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user.name)}&background=e2e8f0&color=64748b`}
                                                    className="w-7 h-7 rounded-full flex-shrink-0 object-cover"
                                                    alt={member.user.name}
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{member.user.name}</p>
                                                    <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
                                                </div>
                                            </div>
                                            <StatusBadge status={member.role} />
                                            <StatusBadge status={member.status} />
                                            <button
                                                onClick={() => setConfirmBan({ userId: member.user.id, name: member.user.name })}
                                                disabled={member.status === 'BANNED'}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all disabled:opacity-30"
                                            >
                                                <Ban size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </TabsPrimitive.Content>
            </TabsPrimitive.Root>

            <ConfirmDialog
                open={!!confirmBan}
                onOpenChange={(v) => { if (!v) setConfirmBan(null); }}
                title="Banear miembro"
                description={`¿Banear a "${confirmBan?.name}" de esta polla?`}
                confirmLabel="Banear"
                isLoading={isSaving}
                onConfirm={async () => {
                    if (id && confirmBan) {
                        await banMember(id, confirmBan.userId);
                        setConfirmBan(null);
                    }
                }}
            />
        </div>
    );
};

export default AdminLeagueDetail;
