import React, { useEffect, useState } from 'react';
import { Medal, Trophy, Search } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { useAuthStore } from '../stores/auth.store';
import { request } from '../api';

interface RankingEntry {
    rank: number;
    userId: string;
    name: string;
    points: number;
    exactPredictions: number;
    leagues: string[];
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Ranking() {
    const currentUser = useAuthStore((s) => s.user);
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

    const myEntry = entries.find((e) => e.userId === currentUser?.id);

    return (
        <CorpLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-black text-slate-900">Ranking</h1>
                <p className="text-slate-500 text-sm mt-1">Clasificación general de tu organización</p>
            </div>

            {/* My position card */}
            {myEntry && (
                <div className="bg-gradient-to-r from-amber-400 to-amber-500 rounded-2xl p-4 mb-5 flex items-center gap-4 text-white shadow-lg shadow-amber-200">
                    <div className="text-3xl font-black">#{myEntry.rank}</div>
                    <div className="flex-1">
                        <p className="font-black text-sm">Tu posición</p>
                        <p className="text-amber-100 text-xs">{myEntry.points} puntos · {myEntry.exactPredictions} exactos</p>
                    </div>
                    <Trophy size={28} className="text-amber-200" />
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
                <div className="grid grid-cols-[2rem_1fr_auto_auto] gap-3 px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-50">
                    <span>#</span>
                    <span>Participante</span>
                    <span className="text-right">Puntos</span>
                    <span className="text-right hidden sm:block">Exactos</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-7 h-7 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                        <Medal size={32} className="mx-auto mb-2 opacity-30" />
                        Sin datos aún
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map((entry) => {
                            const isMe = entry.userId === currentUser?.id;
                            return (
                                <div
                                    key={entry.userId}
                                    className={`grid grid-cols-[2rem_1fr_auto_auto] gap-3 px-4 py-3 items-center ${isMe ? 'bg-amber-50' : 'hover:bg-slate-50'} transition-colors`}
                                >
                                    <div className="text-sm font-black text-slate-500">
                                        {MEDAL[entry.rank] ?? entry.rank}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`font-bold text-sm truncate ${isMe ? 'text-amber-700' : 'text-slate-800'}`}>
                                            {entry.name}{isMe && <span className="ml-1 text-[10px] font-black text-amber-500">(tú)</span>}
                                        </p>
                                        <p className="text-xs text-slate-400">{entry.leagues.length} polla(s)</p>
                                    </div>
                                    <div className={`text-sm font-black text-right ${isMe ? 'text-amber-700' : 'text-slate-900'}`}>
                                        {entry.points}
                                    </div>
                                    <div className="text-xs text-slate-500 text-right hidden sm:block">
                                        {entry.exactPredictions} 🎯
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </CorpLayout>
    );
}
