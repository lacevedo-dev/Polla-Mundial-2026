import React from 'react';
import { LayoutGrid, CalendarDays, Search } from 'lucide-react';

interface Props {
    phaseFilter: 'ALL' | 'GROUP' | 'KNOCKOUT';
    groupFilter: string;
    groupBy: 'smart' | 'date';
    search: string;
    availableGroups: string[];
    showGroupFilter: boolean;
    onPhaseChange: (phase: 'ALL' | 'GROUP' | 'KNOCKOUT') => void;
    onGroupChange: (group: string) => void;
    onGroupByChange: (mode: 'smart' | 'date') => void;
    onSearchChange: (s: string) => void;
}

export function MatchFiltersBar({
    phaseFilter, groupFilter, groupBy, search,
    availableGroups, showGroupFilter,
    onPhaseChange, onGroupChange, onGroupByChange, onSearchChange,
}: Props) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
                {/* Sub-tabs GRUPOS | FASES */}
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-900 rounded-xl">
                    {(['GROUP', 'KNOCKOUT'] as const).map((f) => (
                        <button key={f}
                            onClick={() => { onPhaseChange(f); onGroupChange('ALL'); }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                phaseFilter === f || (f === 'GROUP' && phaseFilter === 'ALL')
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}>
                            {f === 'GROUP' ? 'Grupos' : 'Fases'}
                        </button>
                    ))}
                </div>
                {/* Smart / Date toggle */}
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg ml-auto">
                    <button onClick={() => onGroupByChange('date')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black transition-all ${groupBy === 'date' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
                        <CalendarDays size={11} /> Fecha
                    </button>
                    <button onClick={() => onGroupByChange('smart')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black transition-all ${groupBy === 'smart' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
                        <LayoutGrid size={11} /> Inteligente
                    </button>
                </div>
            </div>

            {/* Filtro letra de grupo */}
            {showGroupFilter && (
                <div className="flex items-center gap-1 flex-wrap">
                    <button onClick={() => onGroupChange('ALL')}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${groupFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        General
                    </button>
                    {availableGroups.map(g => (
                        <button key={g} onClick={() => onGroupChange(g)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${groupFilter === g ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            style={groupFilter === g ? { backgroundColor: 'var(--color-primary,#f59e0b)' } : undefined}>
                            {g}
                        </button>
                    ))}
                </div>
            )}

            {/* Buscador */}
            <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text" value={search} onChange={e => onSearchChange(e.target.value)}
                    placeholder="Buscar equipo..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-slate-300 focus:bg-white transition-colors"
                />
            </div>
        </div>
    );
}
