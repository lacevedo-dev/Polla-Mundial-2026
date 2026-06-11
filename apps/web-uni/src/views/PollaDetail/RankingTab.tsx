import React from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { TopRankEntry } from './types';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const RANKING_LIMIT = 50;

export function RankingTab({ topRanking }: { topRanking: TopRankEntry[] }) {
    const limitedRanking = topRanking.slice(0, RANKING_LIMIT);

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-50">
                <h2 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <Star size={14} className="text-slate-400" /> Clasificación
                </h2>
                {topRanking.length > RANKING_LIMIT && (
                    <p className="text-[10px] text-slate-400 mt-1">Mostrando top {RANKING_LIMIT}</p>
                )}
            </div>

            {limitedRanking.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Sin puntuaciones aún</div>
            ) : (
                <div className="divide-y divide-slate-50">
                    {limitedRanking.map((entry) => (
                        <div
                            key={entry.userId}
                            className="flex items-center gap-3 px-4 py-3"
                            style={entry.isMe ? { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 8%, white)' } : undefined}>
                            <span className="text-base w-8 text-center shrink-0 font-bold text-slate-400">
                                {MEDAL[entry.rank] ?? `#${entry.rank}`}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                {entry.avatar
                                    ? <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                                    : <span className="text-xs font-black text-slate-400">{entry.name.charAt(0)}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate"
                                    style={entry.isMe ? { color: 'var(--color-primary, #f59e0b)' } : { color: '#1e293b' }}>
                                    {entry.name}
                                    {entry.isMe && <span className="text-xs opacity-60 ml-1">(tú)</span>}
                                </p>
                                {entry.username && <p className="text-[10px] text-slate-400">@{entry.username}</p>}
                            </div>
                            <span className="text-sm font-black text-slate-700 shrink-0">{entry.totalPoints} pts</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="border-t border-slate-50 px-4 py-3 text-center">
                <Link
                    to="/ranking"
                    className="text-xs font-bold hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--color-primary, #f59e0b)' }}>
                    Ver ranking global →
                </Link>
            </div>
        </div>
    );
}
