import React from 'react';
import { Trash2, X } from 'lucide-react';
import { Button, Badge, Card } from '../../../components/UI';
import { ModalOverlay } from '../components/ModalOverlay';
import { categoryLabel, fmtCurrency } from '../utils';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import type { ObligationRecord } from '../types';

const HistoryModal: React.FC<{
    userObs: ObligationRecord[];
    userName: string;
    userAvatar?: string | null;
    onClose: () => void;
    onReset: (obligationId: string) => Promise<void>;
}> = ({ userObs, userName, userAvatar, onClose, onReset }) => {
    const currency = userObs[0]?.currency ?? 'COP';
    const paidObs = userObs.filter((o) => o.status === 'PAID');
    const expiredObs = userObs.filter((o) => o.status === 'EXPIRED' || o.status === 'CANCELLED');

    return (
        <ModalOverlay>
            <Card className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border-0 overflow-hidden max-h-[85vh] flex flex-col p-0">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <UserAvatar name={userName} src={userAvatar} className="w-10 h-10 rounded-xl" textClassName="text-xs" />
                        <div>
                            <h3 className="text-lg font-black uppercase">Historial</h3>
                            <p className="text-xs text-slate-400">{userName}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3" style={{ scrollbarWidth: 'thin' }}>
                    {paidObs.length > 0 && (
                        <>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pagos confirmados</p>
                            {paidObs.map((o) => (
                                <div key={o.id} className="p-4 rounded-2xl border border-lime-100 bg-lime-50/50 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{o.referenceLabel}</p>
                                            <p className="text-[10px] uppercase font-bold text-slate-400">
                                                {categoryLabel(o.category)}{o.multiplier > 1 ? ` × ${o.multiplier}` : ''}
                                            </p>
                                        </div>
                                        <span className="text-lg font-black text-lime-600">{fmtCurrency(o.totalAmount, currency)}</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-lime-200/50">
                                        <span className="text-[10px] text-slate-400">
                                            {o.paidAt ? new Date(o.paidAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => void onReset(o.id)}
                                            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold uppercase flex items-center gap-1"
                                        >
                                            <Trash2 size={10} /> Anular
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {expiredObs.length > 0 && (
                        <>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mt-4">Vencidas / Canceladas</p>
                            {expiredObs.map((o) => (
                                <div key={o.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 opacity-60 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-bold text-slate-700">{o.referenceLabel}</p>
                                        <span className="text-sm font-black text-slate-400">{fmtCurrency(o.totalAmount, currency)}</span>
                                    </div>
                                    <Badge color="bg-rose-100 text-rose-600 text-[9px]">{o.status}</Badge>
                                </div>
                            ))}
                        </>
                    )}

                    {paidObs.length === 0 && expiredObs.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-sm">Sin movimientos registrados.</div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 shrink-0">
                    <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase" onClick={onClose}>Cerrar</Button>
                </div>
            </Card>
        </ModalOverlay>
    );
};

export default HistoryModal;
