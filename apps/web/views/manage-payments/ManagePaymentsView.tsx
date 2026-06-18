import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Banknote, Check, ChevronDown, CheckCircle2, Download, Filter, History,
    Loader2, MoreVertical, PieChart, Search, Send,
} from 'lucide-react';
import { Button, Input, Card, Checkbox } from '../../components/UI';
import { request } from '../../api';
import { useLeagueStore } from '../../stores/league.store';
import { StatusBadge } from './components/StatusBadge';
import { usePaymentObligations } from './hooks/usePaymentObligations';
import { usePaymentData } from './hooks/usePaymentData';
import {
    LazyBulkPayModal,
    LazyHistoryModal,
    LazyPaymentModal,
    LazyQuickPayModal,
    LazyReminderModal,
} from './modals/lazy';
import { avatarUrl, categoryLabel, fmtCurrency } from './utils';
import type { PaymentFilter } from './types';

const ManagePaymentsView: React.FC = () => {
    const navigate = useNavigate();
    const activeLeague = useLeagueStore((s) => s.activeLeague);
    const leagueId = activeLeague?.id ?? '';
    const leagueName = activeLeague?.name ?? 'Polla';

    const {
        obligations,
        error,
        loading,
        loadingMessage,
        leaguesBootstrapped,
        loadObligations,
    } = usePaymentObligations(leagueId);

    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    const [conceptMenuOpen, setConceptMenuOpen] = useState(false);
    const conceptMenuRef = useRef<HTMLDivElement>(null);

    const [filter, setFilter] = useState<PaymentFilter>('all');
    const [search, setSearch] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const [payModal, setPayModal] = useState<string | null>(null);
    const [histModal, setHistModal] = useState<string | null>(null);
    const [quickModal, setQuickModal] = useState<string | null>(null);
    const [bulkModal, setBulkModal] = useState(false);
    const [reminderOpen, setReminderOpen] = useState(false);

    const {
        concepts,
        users,
        currency,
        getUserObs,
        getAggregates,
        financials,
        filteredUsers,
    } = usePaymentData(obligations, selectedLabels, filter, search);

    useEffect(() => {
        if (concepts.length > 0 && selectedLabels.length === 0) {
            setSelectedLabels(concepts.map((c) => c.id));
        }
    }, [concepts, selectedLabels.length]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (conceptMenuRef.current && !conceptMenuRef.current.contains(e.target as Node)) {
                setConceptMenuOpen(false);
            }
            if (!(e.target as HTMLElement).closest('.action-menu-btn')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const confirmObligations = async (obligationIds: string[], method: string, reference: string) => {
        for (const id of obligationIds) {
            await request(`/leagues/${leagueId}/payments/${id}/confirm`, {
                method: 'POST',
                body: JSON.stringify({ method, reference }),
            });
        }
        await loadObligations();
        setPayModal(null);
    };

    const quickConfirm = async (userId: string, method: string, reference: string) => {
        const pendingIds = getUserObs(userId)
            .filter((o) => o.status === 'PENDING_PAYMENT')
            .map((o) => o.id);
        await confirmObligations(pendingIds, method, reference);
        setQuickModal(null);
    };

    const resetObligation = async (obligationId: string) => {
        await request(`/leagues/${leagueId}/payments/${obligationId}/reset`, { method: 'POST' });
        await loadObligations();
    };

    const bulkConfirm = async () => {
        for (const userId of selectedUserIds) {
            const pendingIds = getUserObs(userId)
                .filter((o) => o.status === 'PENDING_PAYMENT')
                .map((o) => o.id);
            for (const id of pendingIds) {
                await request(`/leagues/${leagueId}/payments/${id}/confirm`, {
                    method: 'POST',
                    body: JSON.stringify({ method: 'Efectivo' }),
                });
            }
        }
        await loadObligations();
        setBulkModal(false);
        setSelectedUserIds([]);
    };

    const exportCSV = () => {
        const rows = filteredUsers.map((u) => {
            const agg = getAggregates(u.id);
            return [u.name, agg.pending, agg.isFullyPaid ? 'Al día' : 'Pendiente'].join(',');
        });
        const csv = 'data:text/csv;charset=utf-8,' + ['Nombre,Deuda,Estado', ...rows].join('\n');
        const a = document.createElement('a');
        a.href = encodeURI(csv);
        a.download = 'reporte_pagos.csv';
        a.click();
    };

    const bulkTotal = useMemo(
        () => selectedUserIds.reduce((s, uid) => s + getAggregates(uid).pending, 0),
        [selectedUserIds, getAggregates],
    );

    const reminderUsers = useMemo(
        () => users.filter((u) => selectedUserIds.includes(u.id)),
        [users, selectedUserIds],
    );

    const reminderUserDebts = useMemo(
        () => Object.fromEntries(reminderUsers.map((u) => [u.id, getAggregates(u.id).pending])),
        [reminderUsers, getAggregates],
    );

    const findUser = (id: string) => users.find((u) => u.id === id);

    return (
        <div className="space-y-6 pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black font-brand uppercase tracking-tighter text-slate-900">{leagueName}</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Gestión de Pagos · {obligations.length} obligaciones
                        </p>
                    </div>
                </div>

                <div className="relative z-30" ref={conceptMenuRef}>
                    <button
                        type="button"
                        onClick={() => setConceptMenuOpen((v) => !v)}
                        className="w-full md:w-auto bg-white border border-slate-200 shadow-sm rounded-2xl p-2.5 px-4 flex items-center justify-between gap-4 hover:border-lime-400 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-lime-100 text-lime-700 w-8 h-8 rounded-lg flex items-center justify-center"><Filter size={16} /></div>
                            <div className="text-left">
                                <p className="text-[9px] font-black uppercase text-slate-400">Conceptos</p>
                                <p className="text-xs font-black text-slate-900">{selectedLabels.length} Seleccionados</p>
                            </div>
                        </div>
                        <ChevronDown size={18} className={`text-slate-300 transition-transform ${conceptMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {conceptMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                transition={{ duration: 0.16, ease: 'easeOut' as const }}
                                className="absolute top-full right-0 mt-2 w-full md:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 p-2"
                            >
                                {concepts.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-3">Sin datos de participación registrados.</p>
                                ) : concepts.map((c) => {
                                    const active = selectedLabels.includes(c.id);
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setSelectedLabels((prev) => active ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                                            className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors ${active ? 'bg-lime-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${active ? 'bg-lime-500 border-lime-500 text-white' : 'border-slate-300'}`}>
                                                {active && <Check size={12} strokeWidth={4} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold uppercase text-slate-700 truncate">{c.label}</p>
                                                <p className="text-[10px] font-black text-slate-500">{categoryLabel(c.category)} · {fmtCurrency(c.amount, currency)}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm font-bold">{loadingMessage}</span>
                </div>
            )}

            {!loading && leaguesBootstrapped && !leagueId && !error && (
                <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center space-y-3">
                    <p className="text-slate-500 text-sm font-bold">No hay polla activa</p>
                    <Button variant="outline" size="sm" onClick={() => navigate('/my-leagues')}>Ir a Mis Pollas</Button>
                </div>
            )}

            {error && !loading && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2">
                    <p className="text-sm font-bold text-rose-700">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => void loadObligations()}>Reintentar</Button>
                </div>
            )}

            {!loading && !error && obligations.length === 0 && (
                <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center space-y-2">
                    <p className="text-slate-400 text-sm font-bold uppercase">Sin datos de participación</p>
                    <p className="text-slate-400 text-xs">Los participantes aún no han seleccionado opciones de participación desde la vista de pronósticos.</p>
                </div>
            )}

            {!loading && !error && obligations.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl md:col-span-2">
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                                <div className="space-y-2">
                                    <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-lime-400 text-black px-2 py-0.5 rounded">RECAUDO GLOBAL</span>
                                    <p className="text-5xl font-black font-brand tracking-tighter">{fmtCurrency(financials.collected, currency)}</p>
                                    <div className="flex items-center gap-3">
                                        <div className="h-1.5 w-32 bg-white/20 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${financials.progress}%` }}
                                                transition={{ duration: 1, ease: 'easeOut' as const }}
                                                className="h-full bg-lime-400 rounded-full"
                                            />
                                        </div>
                                        <p className="text-sm font-bold text-slate-400">de {fmtCurrency(financials.expected, currency)}</p>
                                    </div>
                                </div>
                                <p className="text-5xl font-black font-brand text-lime-400">{financials.progress}%</p>
                            </div>
                            <div className="absolute -top-10 -right-10 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />
                        </div>

                        <Card className="p-5 flex flex-col justify-center space-y-4 border-slate-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PieChart size={14} className="text-slate-400" />
                                    <span className="text-[10px] font-black uppercase text-slate-400">Estado Usuarios</span>
                                </div>
                                <button type="button" onClick={exportCSV} className="text-[9px] font-bold text-lime-600 flex items-center gap-1 hover:text-lime-700">
                                    <Download size={10} /> CSV
                                </button>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center p-3 bg-lime-50 rounded-xl border border-lime-100">
                                    <span className="text-xs font-bold text-lime-800">Al día</span>
                                    <span className="text-lg font-black text-lime-700">{users.filter((u) => getAggregates(u.id).isFullyPaid).length}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100">
                                    <span className="text-xs font-bold text-rose-800">Con deuda</span>
                                    <span className="text-lg font-black text-rose-700">{users.filter((u) => getAggregates(u.id).pending > 0).length}</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-col md:flex-row justify-between gap-3 items-center">
                            <div className="flex p-1 bg-white border border-slate-200 rounded-xl w-full md:w-auto overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                {([
                                    { id: 'all', label: 'Todos' },
                                    { id: 'debtors', label: 'Con deuda' },
                                    { id: 'expired', label: 'Vencidos' },
                                    { id: 'solvents', label: 'Al día' },
                                ] as const).map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setFilter(tab.id)}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === tab.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <div className="w-full md:w-64">
                                <Input placeholder="Buscar..." leftIcon={<Search size={16} />} className="text-xs font-bold h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                        </div>

                        <AnimatePresence>
                            {selectedUserIds.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex gap-2"
                                >
                                    <Button variant="secondary" className="flex-1 md:flex-none text-xs font-bold uppercase" onClick={() => setBulkModal(true)}>
                                        <Banknote size={15} className="mr-2" />
                                        Confirmar masivo ({selectedUserIds.length})
                                    </Button>
                                    <Button className="flex-1 md:flex-none text-xs font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white border-0" onClick={() => setReminderOpen(true)}>
                                        <Send size={15} className="mr-2" />
                                        Recordar ({selectedUserIds.length})
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Mobile list */}
                    <div className="md:hidden space-y-3">
                        {filteredUsers.length > 0 ? filteredUsers.map((u) => {
                            const agg = getAggregates(u.id);
                            const isSelected = selectedUserIds.includes(u.id);
                            return (
                                <motion.div
                                    key={u.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`bg-white p-4 rounded-2xl border transition-all ${isSelected ? 'border-lime-500 ring-1 ring-lime-500 shadow-md' : 'border-slate-200 shadow-sm'}`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <Checkbox id={`m-${u.id}`} label="" checked={isSelected} onChange={() => setSelectedUserIds((p) => p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id])} />
                                            <img src={avatarUrl(u.name, u.avatar)} className="w-10 h-10 rounded-xl object-cover" alt={u.name} />
                                            <p className="text-sm font-black text-slate-900">{u.name}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <StatusBadge isFullyPaid={agg.isFullyPaid} hasExpired={agg.hasExpired} percentage={agg.percentage} />
                                            {agg.pending > 0 && <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg">-{fmtCurrency(agg.pending, currency)}</span>}
                                        </div>
                                    </div>
                                    <div className="mb-3 space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                                            <span>Progreso</span><span>{agg.percentage}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${agg.isFullyPaid ? 'bg-lime-500' : 'bg-amber-400'}`} style={{ width: `${agg.percentage}%` }} />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {!agg.isFullyPaid && (
                                            <Button size="sm" className="flex-1 h-9 text-[10px] font-black uppercase" variant="primary" onClick={() => setPayModal(u.id)}>Cobrar</Button>
                                        )}
                                        {agg.pending > 0 && (
                                            <button type="button" onClick={() => setQuickModal(u.id)} className="w-9 h-9 bg-lime-50 rounded-xl flex items-center justify-center text-lime-600 border border-lime-100 hover:bg-lime-100 transition-colors" title="Pago rápido">
                                                <CheckCircle2 size={16} />
                                            </button>
                                        )}
                                        <button type="button" onClick={() => setHistModal(u.id)} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-50 transition-colors" title="Historial">
                                            <History size={16} />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        }) : (
                            <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
                                <p className="text-xs font-bold uppercase">No se encontraron resultados.</p>
                            </div>
                        )}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="p-5 w-14 text-center">
                                            <Checkbox
                                                id="select-all"
                                                label=""
                                                checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                                                onChange={() => setSelectedUserIds(selectedUserIds.length === filteredUsers.length ? [] : filteredUsers.map((u) => u.id))}
                                            />
                                        </th>
                                        <th className="p-5 text-[10px] font-black uppercase text-slate-400">Participante</th>
                                        <th className="p-5 text-[10px] font-black uppercase text-slate-400 text-center">Estado</th>
                                        <th className="p-5 text-[10px] font-black uppercase text-slate-400 text-center">Deuda</th>
                                        <th className="p-5 text-[10px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.length > 0 ? filteredUsers.map((u) => {
                                        const agg = getAggregates(u.id);
                                        const isSelected = selectedUserIds.includes(u.id);
                                        return (
                                            <tr key={u.id} className={`group hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-lime-50/30' : ''}`}>
                                                <td className="p-5 text-center">
                                                    <Checkbox id={`c-${u.id}`} label="" checked={isSelected} onChange={() => setSelectedUserIds((p) => p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id])} />
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex items-center gap-3">
                                                        <img src={avatarUrl(u.name, u.avatar)} className="w-10 h-10 rounded-xl object-cover" alt={u.name} />
                                                        <p className="text-sm font-black text-slate-900">{u.name}</p>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-center">
                                                    <div className="w-full max-w-[160px] mx-auto space-y-1.5">
                                                        <div className="flex justify-center">
                                                            <StatusBadge isFullyPaid={agg.isFullyPaid} hasExpired={agg.hasExpired} percentage={agg.percentage} />
                                                        </div>
                                                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${agg.isFullyPaid ? 'bg-lime-500' : 'bg-amber-400'}`} style={{ width: `${agg.percentage}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-center">
                                                    {agg.pending > 0 ? (
                                                        <span className="font-mono font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-lg">-{fmtCurrency(agg.pending, currency)}</span>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex items-center justify-end gap-2 action-menu-btn">
                                                        <button type="button" onClick={() => setHistModal(u.id)} className="h-9 px-4 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 transition-colors">
                                                            Historial
                                                        </button>
                                                        {agg.pending > 0 && (
                                                            <>
                                                                <button type="button" onClick={() => setPayModal(u.id)} className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase hover:bg-slate-800 transition-colors">
                                                                    Cobrar
                                                                </button>
                                                                <button type="button" onClick={() => setQuickModal(u.id)} className="w-9 h-9 rounded-xl bg-lime-50 text-lime-600 flex items-center justify-center hover:bg-lime-400 hover:text-black transition-all" title="Confirmar todo">
                                                                    <CheckCircle2 size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                                                                className={`action-menu-btn w-9 h-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center transition-all ${openMenuId === u.id ? 'bg-slate-100 text-slate-900' : 'bg-white hover:bg-slate-50'}`}
                                                            >
                                                                <MoreVertical size={16} />
                                                            </button>
                                                            {openMenuId === u.id && (
                                                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                                                    <button type="button" onClick={() => { setSelectedUserIds([u.id]); setReminderOpen(true); setOpenMenuId(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Send size={14} /> Recordatorio</button>
                                                                    <div className="h-px bg-slate-100" />
                                                                    <button type="button" onClick={() => { setHistModal(u.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><History size={14} /> Ver historial</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={5} className="p-12 text-center text-slate-400 text-sm">No se encontraron participantes</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <Suspense fallback={null}>
                {payModal && (
                    <LazyPaymentModal
                        userObs={getUserObs(payModal)}
                        userName={findUser(payModal)?.name ?? ''}
                        userAvatar={findUser(payModal)?.avatar}
                        onClose={() => setPayModal(null)}
                        onSubmit={confirmObligations}
                    />
                )}
                {histModal && (
                    <LazyHistoryModal
                        userObs={getUserObs(histModal)}
                        userName={findUser(histModal)?.name ?? ''}
                        userAvatar={findUser(histModal)?.avatar}
                        onClose={() => setHistModal(null)}
                        onReset={resetObligation}
                    />
                )}
                {quickModal && (
                    <LazyQuickPayModal
                        userName={findUser(quickModal)?.name ?? ''}
                        userAvatar={findUser(quickModal)?.avatar}
                        pendingAmount={getAggregates(quickModal).pending}
                        currency={currency}
                        onClose={() => setQuickModal(null)}
                        onConfirm={(method, ref) => quickConfirm(quickModal, method, ref)}
                    />
                )}
                {bulkModal && (
                    <LazyBulkPayModal
                        userCount={selectedUserIds.filter((id) => getAggregates(id).pending > 0).length}
                        totalAmount={bulkTotal}
                        currency={currency}
                        onClose={() => setBulkModal(false)}
                        onConfirm={bulkConfirm}
                    />
                )}
                {reminderOpen && (
                    <LazyReminderModal
                        leagueId={leagueId}
                        selectedUsers={reminderUsers}
                        leagueName={leagueName}
                        userDebts={reminderUserDebts}
                        currency={currency}
                        onClose={() => { setReminderOpen(false); setSelectedUserIds([]); }}
                    />
                )}
            </Suspense>
        </div>
    );
};

export default ManagePaymentsView;
