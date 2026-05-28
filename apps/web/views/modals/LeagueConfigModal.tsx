import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    CheckCircle2,
    ChevronDown,
    Clock,
    Coins,
    Globe,
    Lock,
    Minus,
    Plus,
    Settings,
    Trash2,
    Trophy,
    UserPlus,
    X,
} from 'lucide-react';
import { request, resolveApiAssetUrl } from '../../api';

/* ─── Types ──────────────────────────────────────────────────────── */

interface LeagueFullResponse {
    id: string;
    name: string;
    description?: string | null;
    privacy?: 'PUBLIC' | 'PRIVATE';
    maxParticipants?: number | null;
    includeBaseFee?: boolean;
    baseFee?: number | null;
    currency?: string | null;
    adminFeePercent?: number;
    includeStageFees?: boolean;
    closePredictionMinutes?: number | null;
    primaryTournamentId?: string | null;
    primaryTournament?: { id: string; name: string; season: number; logoUrl?: string } | null;
    members?: Array<{
        role: 'ADMIN' | 'PLAYER';
        status: string;
        user?: { id?: string; name?: string | null; username?: string | null; avatar?: string | null };
    }>;
    stageFees?: Array<{ id: string; type: string; label: string; amount: number; active: boolean }>;
    distributions?: Array<{ id: string; category: string; position: number; label: string; percentage: number; active: boolean }>;
    _count?: { members?: number };
}

interface StageFeeLocal { type: 'MATCH' | 'ROUND' | 'PHASE'; label: string; amount: number; active: boolean }
interface DistLocal { position: number; percentage: number }

/* ─── Constants ──────────────────────────────────────────────────── */

const STAGE_DEFAULTS: StageFeeLocal[] = [
    { type: 'MATCH', label: 'Partido', amount: 2000, active: false },
    { type: 'ROUND', label: 'Ronda', amount: 5000, active: false },
    { type: 'PHASE', label: 'Fase', amount: 10000, active: false },
];

/* ─── Helpers ────────────────────────────────────────────────────── */

function defaultDist(count: number): DistLocal[] {
    const presets: Record<number, number[]> = {
        1: [100], 2: [65, 35], 3: [60, 30, 10], 4: [50, 25, 15, 10], 5: [45, 25, 15, 10, 5],
    };
    const pcts = presets[count] ?? Array(count).fill(Math.floor(100 / count));
    return pcts.map((p, i) => ({ position: i + 1, percentage: p }));
}

function fmtCOP(n: number): string {
    try {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    } catch {
        return `$${n.toLocaleString('es-CO')}`;
    }
}

/* ─── Component ──────────────────────────────────────────────────── */

interface LeagueConfigModalProps {
    open: boolean;
    onClose: () => void;
    leagueId?: string;
    memberCount?: number;
    onSaved?: () => void;
    onInvite?: () => void;
}

const LeagueConfigModal: React.FC<LeagueConfigModalProps> = ({
    open, onClose, leagueId, memberCount = 0, onSaved, onInvite,
}) => {
    const [tab, setTab] = useState<'details' | 'prizes' | 'participants'>('details');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // ── Details ──
    const [lName, setLName] = useState('');
    const [desc, setDesc] = useState('');
    const [privacy, setPrivacy] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
    const [includeBaseFee, setIncludeBaseFee] = useState(true);
    const [baseFee, setBaseFee] = useState(0);
    const [includeStageFees, setIncludeStageFees] = useState(false);
    const [stageFees, setStageFees] = useState<StageFeeLocal[]>(STAGE_DEFAULTS);

    // ── Prizes ──
    const [adminPct, setAdminPct] = useState(10);
    const [prizeTab, setPrizeTab] = useState<'GENERAL' | 'MATCH' | 'ROUND' | 'PHASE'>('GENERAL');
    const [positions, setPositions] = useState(3);
    const [dists, setDists] = useState<Record<string, DistLocal[]>>({ GENERAL: defaultDist(3) });

    const availablePrizeTabs = useMemo<Array<'GENERAL' | 'MATCH' | 'ROUND' | 'PHASE'>>(() => {
        const tabs: Array<'GENERAL' | 'MATCH' | 'ROUND' | 'PHASE'> = ['GENERAL'];
        if (includeStageFees) {
            if (stageFees.some((sf) => sf.type === 'MATCH' && sf.active)) tabs.push('MATCH');
            if (stageFees.some((sf) => sf.type === 'ROUND' && sf.active)) tabs.push('ROUND');
            if (stageFees.some((sf) => sf.type === 'PHASE' && sf.active)) tabs.push('PHASE');
        }
        return tabs;
    }, [includeStageFees, stageFees]);

    // ── Tournament ──
    const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
    const [tournaments, setTournaments] = useState<Array<{ id: string; name: string; country?: string; season: number; active: boolean }>>([]);
    const [tournamentsLoaded, setTournamentsLoaded] = useState(false);

    // ── Participants ──
    const [maxPart, setMaxPart] = useState(50);
    const [members, setMembers] = useState<LeagueFullResponse['members']>([]);
    const [removingId, setRemovingId] = useState<string | null>(null);

    // ── Load on open ──
    useEffect(() => {
        if (!open || !leagueId) return;
        setLoading(true);
        request<LeagueFullResponse>(`/leagues/${leagueId}`)
            .then((data) => {
                setLName(data.name ?? '');
                setDesc(data.description ?? '');
                setPrivacy(data.privacy ?? 'PRIVATE');
                setIncludeBaseFee(data.includeBaseFee ?? true);
                setBaseFee(data.baseFee ?? 0);
                const hasStage = data.includeStageFees ?? false;
                setIncludeStageFees(hasStage);
                setAdminPct(data.adminFeePercent ?? 10);
                setMaxPart(data.maxParticipants ?? 50);
                setMembers(data.members ?? []);
                setSelectedTournamentId(data.primaryTournamentId ?? '');

                if (data.stageFees?.length) {
                    setStageFees(STAGE_DEFAULTS.map((def) => {
                        const found = data.stageFees!.find((sf) => sf.type === def.type);
                        return found ? { ...def, amount: found.amount, active: found.active } : { ...def, active: false };
                    }));
                } else {
                    setStageFees(STAGE_DEFAULTS.map((d) => ({ ...d, active: false })));
                }

                setPrizeTab('GENERAL');

                const newDists: Record<string, DistLocal[]> = {};
                for (const cat of ['GENERAL', 'MATCH', 'ROUND', 'PHASE']) {
                    const catRows = data.distributions?.filter((d) => d.category === cat) ?? [];
                    if (catRows.length) {
                        newDists[cat] = catRows.map((d) => ({ position: d.position, percentage: d.percentage }));
                    } else {
                        newDists[cat] = defaultDist(cat === 'GENERAL' ? 3 : 1);
                    }
                }
                setDists(newDists);
                setPositions((newDists['GENERAL'] ?? defaultDist(3)).length);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [open, leagueId]);

    useEffect(() => {
        if (!open || tournamentsLoaded) return;
        request<Array<{ id: string; name: string; country?: string; season: number; active: boolean }>>('/leagues/tournaments')
            .then((data) => { setTournaments(data); setTournamentsLoaded(true); })
            .catch(() => setTournamentsLoaded(true));
    }, [open, tournamentsLoaded]);

    useEffect(() => {
        if (!availablePrizeTabs.includes(prizeTab)) setPrizeTab('GENERAL');
    }, [availablePrizeTabs, prizeTab]);

    useEffect(() => {
        setDists((prev) => ({ ...prev, [prizeTab]: defaultDist(positions) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [positions]);

    useEffect(() => {
        const tabDist = dists[prizeTab];
        if (tabDist) setPositions(tabDist.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prizeTab]);

    const currentDist = dists[prizeTab] ?? defaultDist(positions);
    const totalPct = currentDist.reduce((s, d) => s + d.percentage, 0);
    const tabFee = prizeTab === 'GENERAL'
        ? baseFee
        : (stageFees.find((sf) => sf.type === prizeTab)?.amount ?? 0);
    const grossPool = tabFee * memberCount;
    const adminCut = Math.round(grossPool * adminPct / 100);
    const netPool = grossPool - adminCut;
    const poolLabel = prizeTab === 'GENERAL' ? 'Fondo general'
        : prizeTab === 'MATCH' ? 'Fondo por partido'
        : prizeTab === 'ROUND' ? 'Fondo por ronda'
        : 'Fondo por fase';

    const activeMemberCount = members?.filter((m) => m.status === 'ACTIVE').length ?? 0;
    const inputCls = 'w-full px-4 py-3 text-[13px] font-medium rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-500 transition-all placeholder:text-slate-400 text-slate-900 bg-white';

    const handleSaveDetails = async () => {
        if (!leagueId) return;
        setSaving(true);
        try {
            await request(`/leagues/${leagueId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    name: lName.trim() || undefined,
                    description: desc.trim() || undefined,
                    privacy,
                    includeBaseFee,
                    baseFee: includeBaseFee ? baseFee : undefined,
                    includeStageFees,
                    stageFees: includeStageFees ? stageFees.map((sf) => ({
                        type: sf.type, label: sf.label, amount: sf.amount, active: sf.active,
                    })) : undefined,
                }),
            });
            await request(`/leagues/${leagueId}/tournament`, {
                method: 'PATCH',
                body: JSON.stringify({ tournamentId: selectedTournamentId || null }),
            }).catch(() => {});
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            onSaved?.();
        } catch { }
        finally { setSaving(false); }
    };

    const handleSavePrizes = async () => {
        if (!leagueId) return;
        setSaving(true);
        try {
            await request(`/leagues/${leagueId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    adminFeePercent: adminPct,
                    distributions: Object.entries(dists).flatMap(([cat, catDists]) =>
                        catDists.map((d) => ({
                            category: cat,
                            position: d.position,
                            label: `${d.position}° Puesto`,
                            percentage: d.percentage,
                            active: true,
                        })),
                    ),
                }),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            onSaved?.();
        } catch { }
        finally { setSaving(false); }
    };

    const handleSaveParticipants = async () => {
        if (!leagueId) return;
        setSaving(true);
        try {
            await request(`/leagues/${leagueId}`, {
                method: 'PATCH',
                body: JSON.stringify({ maxParticipants: maxPart }),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            onSaved?.();
        } catch { }
        finally { setSaving(false); }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!leagueId) return;
        setRemovingId(userId);
        try {
            await request(`/leagues/${leagueId}/members/${userId}`, { method: 'DELETE' });
            setMembers((prev) => prev?.filter((m) => m.user?.id !== userId));
        } catch { }
        finally { setRemovingId(null); }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 10 }}
                        transition={{ duration: 0.26, ease: 'easeOut' as const }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4"
                    >
                        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                            {/* Header */}
                            <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0">
                                <div className="w-10 h-10 rounded-2xl bg-slate-950 flex items-center justify-center shrink-0">
                                    <Settings size={18} className="text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-[12px] font-black uppercase tracking-[0.22em] text-slate-900">Configuración</h2>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Administra tu liga</p>
                                </div>
                                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 px-5 pb-3 shrink-0">
                                {(['details', 'prizes', 'participants'] as const).map((t) => (
                                    <button key={t} onClick={() => setTab(t)}
                                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all ${tab === t ? 'bg-slate-950 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {t === 'details' ? 'Detalles' : t === 'prizes' ? 'Premios' : 'Participantes'}
                                    </button>
                                ))}
                            </div>

                            {loading ? (
                                <div className="flex-1 flex items-center justify-center py-12">
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                        <Settings size={24} className="text-slate-300" />
                                    </motion.div>
                                </div>
                            ) : (
                                <AnimatePresence mode="wait">

                                    {/* ══ DETALLES ══ */}
                                    {tab === 'details' && (
                                        <motion.div key="t-det"
                                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.15 }}
                                            className="flex-1 overflow-y-auto px-5 pb-5 space-y-4"
                                        >
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1.5">Nombre de la liga</p>
                                                <input value={lName} onChange={(e) => setLName(e.target.value)} className={inputCls} placeholder="Nombre de la liga" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1.5">Descripción</p>
                                                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Describe tu liga..." />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1.5">Privacidad</p>
                                                <div className="flex gap-2">
                                                    {(['PRIVATE', 'PUBLIC'] as const).map((p) => (
                                                        <button key={p} onClick={() => setPrivacy(p)}
                                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black transition-all ${privacy === p ? 'bg-slate-950 text-white' : 'border border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                                        >
                                                            {p === 'PRIVATE' ? <Lock size={12} /> : <Globe size={12} />}
                                                            {p === 'PRIVATE' ? 'Privada' : 'Pública'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Torneo vinculado */}
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1.5">Torneo</p>
                                                {!tournamentsLoaded ? (
                                                    <div className={`${inputCls} text-slate-400 text-xs cursor-default`}>Cargando torneos...</div>
                                                ) : tournaments.length === 0 ? (
                                                    <div className={`${inputCls} text-slate-400 text-xs cursor-default`}>Sin torneos importados en el sistema</div>
                                                ) : (
                                                    <div className="relative">
                                                        <Trophy size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        <select
                                                            value={selectedTournamentId}
                                                            onChange={(e) => setSelectedTournamentId(e.target.value)}
                                                            className="w-full appearance-none pl-9 pr-8 py-3 text-[13px] font-medium rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-500 transition-all text-slate-900 bg-white"
                                                        >
                                                            <option value="">Sin torneo</option>
                                                            {tournaments.map((t) => (
                                                                <option key={t.id} value={t.id}>
                                                                    {t.name}{t.season ? ` ${t.season}` : ''}{t.country ? ` — ${t.country}` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Configuración financiera */}
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-2">Configuración financiera</p>
                                                <div className={`rounded-2xl border-2 p-3.5 space-y-3 ${includeBaseFee ? 'border-lime-400' : 'border-slate-200'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Coins size={13} className="text-slate-500" />
                                                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-700">Cuota general</span>
                                                        </div>
                                                        <button onClick={() => setIncludeBaseFee((v) => !v)}
                                                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${includeBaseFee ? 'bg-lime-400 text-slate-950' : 'border-2 border-slate-200'}`}
                                                        >
                                                            {includeBaseFee && <CheckCircle2 size={12} />}
                                                        </button>
                                                    </div>
                                                    {includeBaseFee && (
                                                        <div className="flex items-center gap-2 border border-slate-300 rounded-2xl px-3 py-3 bg-white focus-within:ring-2 focus-within:ring-lime-400 focus-within:border-lime-500 transition-all">
                                                            <span className="text-[12px] font-bold text-slate-400 shrink-0">$</span>
                                                            <input type="number" value={baseFee} onChange={(e) => setBaseFee(Number(e.target.value))} className="flex-1 text-[13px] font-medium text-slate-900 outline-none bg-transparent" placeholder="0" />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className={`rounded-2xl border-2 p-3.5 space-y-2 mt-2 ${includeStageFees ? 'border-lime-400' : 'border-slate-200'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Clock size={13} className="text-slate-500" />
                                                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-700">Costos por etapa</span>
                                                        </div>
                                                        <button onClick={() => setIncludeStageFees((v) => !v)}
                                                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${includeStageFees ? 'bg-lime-400 text-slate-950' : 'border-2 border-slate-200'}`}
                                                        >
                                                            {includeStageFees && <CheckCircle2 size={12} />}
                                                        </button>
                                                    </div>
                                                    {includeStageFees && stageFees.map((sf, idx) => (
                                                        <div key={sf.type} className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => setStageFees((prev) => prev.map((s, i) => i === idx ? { ...s, active: !s.active } : s))}
                                                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${sf.active ? 'bg-lime-400 text-slate-950' : 'border-2 border-slate-200'}`}
                                                            >
                                                                {sf.active && <CheckCircle2 size={10} />}
                                                            </button>
                                                            <span className="text-[11px] font-bold text-slate-600 w-14 shrink-0">{sf.label}</span>
                                                            <div className={`flex items-center gap-1.5 flex-1 border rounded-xl px-2 py-1.5 bg-white focus-within:ring-2 focus-within:ring-lime-400 focus-within:border-lime-500 transition-all ${sf.active ? 'border-slate-300' : 'border-slate-200 opacity-60'}`}>
                                                                <span className="text-[11px] font-bold text-slate-400 shrink-0">$</span>
                                                                <input type="number" value={sf.amount}
                                                                    onChange={(e) => setStageFees((prev) => prev.map((s, i) => i === idx ? { ...s, amount: Number(e.target.value) } : s))}
                                                                    className="flex-1 text-[12px] font-medium text-right text-slate-900 outline-none bg-transparent"
                                                                    disabled={!sf.active}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <button onClick={() => void handleSaveDetails()} disabled={saving}
                                                className="w-full py-3.5 rounded-2xl bg-slate-950 text-white text-[10px] font-black uppercase tracking-[0.22em] hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {saved ? <><CheckCircle2 size={14} className="text-lime-400" /> Guardado</> : saving ? 'Guardando...' : 'Guardar cambios'}
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* ══ PREMIOS ══ */}
                                    {tab === 'prizes' && (
                                        <motion.div key="t-pri"
                                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.15 }}
                                            className="flex-1 overflow-y-auto px-5 pb-5 space-y-4"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">% Admin</p>
                                                    <span className="text-[13px] font-black text-lime-600">{adminPct}%</span>
                                                </div>
                                                <input type="range" min={0} max={50} value={adminPct} onChange={(e) => setAdminPct(Number(e.target.value))} className="w-full accent-lime-400" />
                                            </div>

                                            {availablePrizeTabs.length > 1 && (
                                                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                                    {availablePrizeTabs.map((pt) => (
                                                        <button key={pt} onClick={() => setPrizeTab(pt)}
                                                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.12em] transition-all ${prizeTab === pt ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            {pt === 'MATCH' ? 'Partido' : pt === 'ROUND' ? 'Ronda' : pt === 'PHASE' ? 'Fase' : 'General'}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="rounded-2xl border-2 border-lime-400 p-3.5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={13} className="text-slate-500" />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-700">Puestos a premiar</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => setPositions((p) => Math.max(1, p - 1))} className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="text-[15px] font-black text-slate-900 w-5 text-center">{positions}</span>
                                                        <button onClick={() => setPositions((p) => Math.min(10, p + 1))} className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2.5">
                                                {currentDist.map((d, idx) => {
                                                    const prizeAmt = Math.round(netPool * d.percentage / (100 - adminPct || 1));
                                                    return (
                                                        <div key={d.position} className="flex items-center gap-3">
                                                            <span className="text-[11px] font-black text-slate-500 w-16 shrink-0">{d.position}° Puesto</span>
                                                            <div className="flex items-center border border-slate-300 rounded-xl focus-within:ring-2 focus-within:ring-lime-400 focus-within:border-lime-500 transition-all bg-white overflow-hidden flex-1">
                                                                <input type="number" value={d.percentage} min={0} max={100}
                                                                    onChange={(e) => setDists((prev) => ({
                                                                        ...prev,
                                                                        [prizeTab]: (prev[prizeTab] ?? []).map((x, i) => i === idx ? { ...x, percentage: Number(e.target.value) } : x),
                                                                    }))}
                                                                    className="w-12 text-center px-2 py-2 text-[12px] font-medium outline-none bg-transparent text-slate-900"
                                                                />
                                                                <span className="text-[11px] text-slate-400 pr-2">%</span>
                                                            </div>
                                                            <span className="text-[12px] font-black text-lime-600 shrink-0 min-w-[4rem] text-right">
                                                                {netPool > 0 ? fmtCOP(prizeAmt) : '—'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="rounded-2xl bg-slate-950 p-4 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">{poolLabel}</p>
                                                        <p className="text-[18px] font-black text-white mt-0.5">{grossPool > 0 ? fmtCOP(grossPool) : '—'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-rose-400">Admin ({adminPct}%)</p>
                                                        <p className="text-[14px] font-black text-rose-300 mt-0.5">{adminCut > 0 ? fmtCOP(adminCut) : '—'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Bolsa neta</p>
                                                    <p className="text-[13px] font-black text-lime-400">{netPool > 0 ? fmtCOP(netPool) : '—'}</p>
                                                </div>
                                            </div>

                                            {totalPct !== 100 - adminPct && totalPct > 0 && (
                                                <p className="text-[10px] text-amber-500 text-center">
                                                    Los porcentajes suman {totalPct}% (deberían ser {100 - adminPct}%)
                                                </p>
                                            )}

                                            <button onClick={() => void handleSavePrizes()} disabled={saving}
                                                className="w-full py-3.5 rounded-2xl bg-slate-950 text-white text-[10px] font-black uppercase tracking-[0.22em] hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {saved ? <><CheckCircle2 size={14} className="text-lime-400" /> Guardado</> : saving ? 'Guardando...' : 'Confirmar premios'}
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* ══ PARTICIPANTES ══ */}
                                    {tab === 'participants' && (
                                        <motion.div key="t-par"
                                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.15 }}
                                            className="flex-1 overflow-y-auto px-5 pb-5 space-y-4"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Cupos máximos</p>
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => setMaxPart((p) => Math.max(activeMemberCount || 2, p - 1))} className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="text-[15px] font-black text-slate-900 w-8 text-center">{maxPart}</span>
                                                        <button onClick={() => setMaxPart((p) => p + 1)} className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-lime-400 rounded-full transition-all" style={{ width: `${Math.min(100, (activeMemberCount / maxPart) * 100)}%` }} />
                                                </div>
                                                <div className="flex justify-between mt-1">
                                                    <span className="text-[9px] text-slate-400">Ocupados: {activeMemberCount}</span>
                                                    <span className="text-[9px] text-slate-400">Límite plan: {maxPart}</span>
                                                </div>
                                            </div>

                                            <button onClick={() => { onClose(); onInvite?.(); }}
                                                className="w-full py-3 rounded-2xl bg-lime-400 text-slate-950 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-lime-500 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <UserPlus size={14} /> Invitar participantes
                                            </button>

                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-2">Lista de jugadores</p>
                                                <div className="space-y-2">
                                                    {members?.map((m, idx) => {
                                                        const isAdmin = m.role === 'ADMIN';
                                                        const uid = m.user?.id ?? `m-${idx}`;
                                                        const displayName = m.user?.name?.trim() || m.user?.username?.trim() || 'Miembro';
                                                        const avatar = resolveApiAssetUrl(m.user?.avatar);
                                                        return (
                                                            <div key={uid} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-2xl">
                                                                {avatar ? (
                                                                    <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0">
                                                                        {displayName[0]?.toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className="text-[12px] font-bold text-slate-800 truncate">{displayName.toUpperCase()}</p>
                                                                        {isAdmin && <span className="text-amber-400 text-[10px]">👑</span>}
                                                                    </div>
                                                                    <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${m.status === 'ACTIVE' ? 'text-lime-500' : 'text-slate-400'}`}>
                                                                        {m.status === 'ACTIVE' ? 'Activo' : 'Pendiente'}
                                                                    </p>
                                                                </div>
                                                                {!isAdmin && m.user?.id && (
                                                                    <button
                                                                        onClick={() => void handleRemoveMember(m.user!.id!)}
                                                                        disabled={removingId === m.user?.id}
                                                                        className="w-7 h-7 flex items-center justify-center rounded-xl text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-colors shrink-0"
                                                                    >
                                                                        {removingId === m.user?.id
                                                                            ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}><Settings size={13} /></motion.span>
                                                                            : <Trash2 size={13} />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <button onClick={() => void handleSaveParticipants().then(onClose)} disabled={saving}
                                                className="w-full py-3.5 rounded-2xl bg-slate-950 text-white text-[10px] font-black uppercase tracking-[0.22em] hover:bg-slate-800 transition-colors disabled:opacity-50"
                                            >
                                                Cerrar
                                            </button>
                                        </motion.div>
                                    )}

                                </AnimatePresence>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default LeagueConfigModal;
