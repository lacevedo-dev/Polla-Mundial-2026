import React from 'react';
import { Wallet } from 'lucide-react';
import { PAYMENT_METHODS } from '../constants';

export const MethodIcon: React.FC<{ method: string; size?: number }> = ({ method, size = 14 }) => {
    const m = PAYMENT_METHODS.find((p) => p.id === method);
    if (!m) return <Wallet size={size} className="text-slate-400" />;
    return <m.Icon size={size} className={m.color} />;
};
