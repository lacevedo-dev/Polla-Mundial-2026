import React from 'react';
import { Team } from './types';

export function Flag({ team, size = 'sm' }: {
    team: Pick<Team, 'name' | 'shortCode' | 'flagUrl'>;
    size?: 'sm' | 'lg';
}) {
    const abbr = (team.shortCode ?? team.name.slice(0, 3)).toUpperCase();
    const cls = size === 'lg'
        ? 'w-11 h-8 rounded-md border border-slate-200 object-cover shadow-sm'
        : 'w-7 h-5 object-cover rounded border border-slate-200';
    const fallback = size === 'lg'
        ? 'w-11 h-8 rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500'
        : 'w-7 h-5 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500';
    return team.flagUrl
        ? <img src={team.flagUrl} alt={abbr} className={cls} />
        : <div className={fallback}>{abbr.slice(0, 2)}</div>;
}
