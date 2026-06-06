import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, Lock, Globe, ChevronRight, Search } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request } from '../api';

interface League {
    id: string;
    name: string;
    description: string | null;
    participantsCount: number;
    isPublic: boolean;
    isMember: boolean;
}

export default function Pollas() {
    const [leagues, setLeagues] = useState<League[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        request<League[]>('/corp/leagues')
            .then(setLeagues)
            .catch(() => setLeagues([]))
            .finally(() => setLoading(false));
    }, []);

    const filtered = leagues.filter((l) =>
        l.name.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <CorpLayout>
            <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Pollas</h1>
                    <p className="text-slate-500 text-sm mt-1">Compite con tus compañeros</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-5">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar polla..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary, #f59e0b)', borderTopColor: 'transparent' }} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <Trophy size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No hay pollas disponibles</p>
                    <p className="text-sm mt-1">El administrador debe crear pollas para tu organización</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((league) => (
                        <div
                            key={league.id}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-all"
                        >
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 12%, white)' }}>
                                <Trophy size={20} style={{ color: 'var(--color-primary, #f59e0b)' }} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-black text-slate-900 text-sm truncate">{league.name}</span>
                                    {league.isPublic ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                                            <Globe size={9} /> Pública
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                            <Lock size={9} /> Privada
                                        </span>
                                    )}
                                    {league.isMember && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, white)', color: 'var(--color-primary, #f59e0b)' }}>
                                            Participando
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                                    <Users size={11} />
                                    {league.participantsCount} participante{league.participantsCount !== 1 ? 's' : ''}
                                </div>
                                {league.description && (
                                    <p className="text-xs text-slate-400 mt-0.5 truncate">{league.description}</p>
                                )}
                            </div>

                            <Link to={`/pollas/${league.id}`} className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-colors" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 12%, white)', color: 'var(--color-primary, #f59e0b)' }}>
                                Ver <ChevronRight size={13} />
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </CorpLayout>
    );
}
