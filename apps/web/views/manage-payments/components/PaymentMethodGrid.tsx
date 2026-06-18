import React from 'react';
import { PAYMENT_METHODS } from '../constants';

export const PaymentMethodGrid: React.FC<{
    method: string;
    onMethodChange: (method: string) => void;
    variant?: 'default' | 'compact';
}> = ({ method, onMethodChange, variant = 'default' }) => (
    <div className="grid grid-cols-2 gap-2">
        {PAYMENT_METHODS.map((m) => {
            const selected = method === m.id;
            const base = variant === 'compact'
                ? `flex items-center gap-2 p-2.5 rounded-xl border transition-all ${selected ? 'border-lime-400 bg-lime-50 ring-1 ring-lime-400' : 'border-slate-200 hover:bg-slate-50'}`
                : `flex items-center gap-2 p-2.5 rounded-xl border transition-all ${selected ? 'bg-white border-lime-400 ring-1 ring-lime-400 shadow-sm' : 'bg-slate-100 border-transparent hover:bg-slate-200'}`;
            return (
                <button key={m.id} type="button" onClick={() => onMethodChange(m.id)} className={base}>
                    <m.Icon size={variant === 'compact' ? 14 : 16} className={m.color} />
                    <span className={`text-[10px] font-black uppercase ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
                        {m.label}
                    </span>
                </button>
            );
        })}
    </div>
);
