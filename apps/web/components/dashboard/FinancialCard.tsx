import React from 'react';
import { Coins } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, ADMIN_COMMISSION } from '../../utils/dashboard';

interface FinancialCardProps {
    leagueStatus?: string;
    totalPrizeLabel?: string;
    prizes: {
        raw: number;
        net: number;
        commission: number;
        fmt: (n: number) => string;
    };
    baseFee?: number | null;
    currency?: string | null;
    isAdmin: boolean;
}

const FinancialCard: React.FC<FinancialCardProps> = ({
    leagueStatus,
    totalPrizeLabel,
    prizes,
    baseFee,
    currency,
    isAdmin,
}) => {
    const navigate = useNavigate();

    return (
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Estado financiero</p>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-600">
                        {leagueStatus === 'ACTIVE' ? 'En curso' : (leagueStatus ?? '—')}
                    </span>
                </div>
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-1">Recaudo total</p>
                <p className="text-3xl font-black font-brand text-slate-900 leading-none">
                    {prizes.raw > 0 ? prizes.fmt(prizes.raw) : (totalPrizeLabel || '—')}
                </p>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500">Bolsa premios (neto)</span>
                    <span className="text-lime-600 font-black">{prizes.net > 0 ? prizes.fmt(prizes.net) : '—'}</span>
                </div>
                {prizes.commission > 0 && (
                    <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Comisión admin ({Math.round(ADMIN_COMMISSION * 100)}%)</span>
                        <span className="text-rose-500 font-black">{prizes.fmt(prizes.commission)}</span>
                    </div>
                )}
                <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500">Cuota base</span>
                    <span className="text-slate-700">{formatCurrency(baseFee, currency ?? 'COP')}</span>
                </div>
            </div>
            {isAdmin && (
                <button
                    onClick={() => navigate('/manage-payments')}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 text-[10px] font-black uppercase tracking-[0.2em] text-slate-950 hover:bg-lime-500 transition-colors"
                >
                    <Coins size={14} /> Gestionar pagos
                </button>
            )}
        </article>
    );
};

export default FinancialCard;
