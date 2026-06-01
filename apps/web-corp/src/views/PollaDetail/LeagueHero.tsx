import React from 'react';
import { LeagueDetail } from './types';

export function LeagueHero({ league }: { league: LeagueDetail }) {
    return (
        <div
            className="rounded-2xl p-5 text-white shadow-md"
            style={{
                background: 'linear-gradient(135deg, var(--color-primary, #f59e0b), color-mix(in srgb, var(--color-primary, #f59e0b) 55%, #1e293b))',
            }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Polla</p>
            <h1 className="text-2xl font-black">{league.name}</h1>
            {league.description && (
                <p className="text-sm text-white/70 mt-1">{league.description}</p>
            )}
            <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                    { label: 'Mis puntos', value: league.myPoints },
                    { label: 'Mi posición', value: `#${league.myRank}` },
                    { label: 'Participantes', value: `${league.participantsCount}/${league.maxParticipants}` },
                ].map(({ label, value }) => (
                    <div key={label} className="bg-white/15 rounded-xl p-3 text-center">
                        <p className="text-lg font-black">{value}</p>
                        <p className="text-[10px] text-white/70 font-medium mt-0.5">{label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
