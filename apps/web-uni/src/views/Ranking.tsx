import React, { useEffect, useState } from 'react';
import { Medal, Trophy, Search } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request } from '../api';

interface RankingEntry {
    rank: number;
    userId: string;
    name: string;
    username: string;
    avatar: string | null;
    totalPoints: number;
    isMe: boolean;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Ranking() {
    const [entries, setEntries] = useState<RankingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        request<RankingEntry[]>('/corp/ranking')
            .then(setEntries)
            .catch(() => setEntries([]))
            .finally(() => setLoading(false));
    }, []);

    const filtered = entries.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()),
    );

    const myEntry = entries.find((e) => e.isMe);

    return (
        <CorpLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-black text-slate-900">Ranking</h1>
                <p className="text-slate-500 text-sm mt-1">Clasificación general de tu organización</p>
            </div>

            {/* My position card */}
            {myEntry && (
                <div className="rounded-2xl p-4 mb-5 flex items-center gap-4 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, var(--color-primary, #f59e0b), color-mix(in srgb, var(--color-primary, #f59e0b) 70%, black))' }}>
                    <div className="text-3xl font-black">#{myEntry.rank}</div>
                    <div className="flex-1">
                        <p className="font-black text-sm">Tu posición</p>
                        <p className="text-white/70 text-xs">{myEntry.totalPoints} puntos acumulados</p>
                    </div>
                    <Trophy size={28} className="text-white/40" />
                </div>
            )}

            {/* Search */}
            <div className="relative mb-4">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar participante..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[2rem_1fr_auto] gap-3 px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-50">
                    <span>#</span>
                    <span>Participante</span>
                    <span className="text-right">Puntos</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-7 h-7 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary, #f59e0b)', borderTopColor: 'transparent' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                        <Medal size={32} className="mx-auto mb-2 opacity-30" />
                        Sin datos aún
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map((entry) => (
                            <div
                                key={entry.userId}
                                className={`grid grid-cols-[2rem_1fr_auto] gap-3 px-4 py-3 items-center transition-colors ${entry.isMe ? '' : 'hover:bg-slate-50'}`}
                                style={entry.isMe ? { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 8%, white)' } : {}}
                            >
                                <div className="text-sm font-black text-slate-500">
                                    {MEDAL[entry.rank] ?? entry.rank}
                                </div>
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                        {entry.avatar ? (
                                            <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs font-black text-slate-400">{entry.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm truncate" style={entry.isMe ? { color: 'var(--color-primary, #f59e0b)' } : { color: '#1e293b' }}>
                                            {entry.name}
                                            {entry.isMe && <span className="ml-1 text-[10px] font-black opacity-70">(tú)</span>}
                                        </p>
                                        {entry.username && <p className="text-[10px] text-slate-300 font-mono">@{entry.username}</p>}
                                    </div>
                                </div>
                                <div className="text-sm font-black text-right" style={entry.isMe ? { color: 'var(--color-primary, #f59e0b)' } : { color: '#0f172a' }}>
                                    {entry.totalPoints}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </CorpLayout>
    );
}
