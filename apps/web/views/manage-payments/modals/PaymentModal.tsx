import React, { useState } from 'react';
import { Check, Hash, Loader2, X } from 'lucide-react';
import { Button, Input, Badge, Card } from '../../../components/UI';
import { PaymentMethodGrid } from '../components/PaymentMethodGrid';
import { ModalOverlay } from '../components/ModalOverlay';
import { categoryLabel, fmtCurrency } from '../utils';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import type { ObligationRecord } from '../types';

const PaymentModal: React.FC<{
    userObs: ObligationRecord[];
    userName: string;
    userAvatar?: string | null;
    onClose: () => void;
    onSubmit: (obligationIds: string[], method: string, reference: string) => Promise<void>;
}> = ({ userObs, userName, userAvatar, onClose, onSubmit }) => {
    const pending = userObs.filter((o) => o.status === 'PENDING_PAYMENT');
    const [selectedIds, setSelectedIds] = useState<string[]>(pending.map((o) => o.id));
    const [method, setMethod] = useState('Efectivo');
    const [reference, setReference] = useState('');
    const [saving, setSaving] = useState(false);

    const currency = userObs[0]?.currency ?? 'COP';
    const totalAmount = pending
        .filter((o) => selectedIds.includes(o.id))
        .reduce((s, o) => s + o.totalAmount, 0);

    const toggle = (id: string) =>
        setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

    const handleSubmit = async () => {
        if (selectedIds.length === 0) return;
        setSaving(true);
        await onSubmit(selectedIds, method, reference);
        setSaving(false);
    };

    return (
        <ModalOverlay>
            <Card className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border-0 overflow-hidden max-h-[90vh] flex flex-col p-0">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <UserAvatar name={userName} src={userAvatar} className="w-10 h-10 rounded-xl" textClassName="text-xs" />
                        <div>
                            <h3 className="text-lg font-black uppercase">Confirmar Pago</h3>
                            <p className="text-xs text-slate-400">{userName}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'thin' }}>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Obligaciones pendientes</p>
                        {pending.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">No hay obligaciones pendientes.</p>
                        ) : pending.map((o) => {
                            const selected = selectedIds.includes(o.id);
                            return (
                                <div
                                    key={o.id}
                                    onClick={() => toggle(o.id)}
                                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${selected ? 'bg-lime-50 border-lime-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selected ? 'bg-lime-500 border-lime-500 text-white' : 'border-slate-300'}`}>
                                            {selected && <Check size={12} strokeWidth={4} />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">{o.referenceLabel}</p>
                                            <p className="text-[10px] text-slate-400 uppercase">
                                                {categoryLabel(o.category)}{o.multiplier > 1 ? ` × ${o.multiplier}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-slate-900">{fmtCurrency(o.totalAmount, currency)}</span>
                                </div>
                            );
                        })}
                        {userObs.filter((o) => o.status === 'PAID').map((o) => (
                            <div key={o.id} className="p-3 rounded-xl border flex items-center justify-between opacity-50 pointer-events-none bg-slate-50 border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded border bg-lime-500 border-lime-500 text-white flex items-center justify-center">
                                        <Check size={12} strokeWidth={4} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">{o.referenceLabel}</p>
                                        <p className="text-[10px] text-slate-400 uppercase">{categoryLabel(o.category)}</p>
                                    </div>
                                </div>
                                <Badge color="bg-lime-100 text-lime-600 text-[9px]">PAGADO</Badge>
                            </div>
                        ))}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <span className="text-xs font-black uppercase text-slate-500">Total a confirmar</span>
                            <span className="text-2xl font-black font-brand text-slate-900">{fmtCurrency(totalAmount, currency)}</span>
                        </div>
                        <PaymentMethodGrid method={method} onMethodChange={setMethod} />
                        <Input
                            placeholder="Referencia / comprobante (opcional)"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="h-9 text-xs"
                            leftIcon={<Hash size={12} />}
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 shrink-0">
                    <Button
                        variant="secondary"
                        className="w-full h-12 rounded-xl font-black uppercase text-xs"
                        onClick={() => void handleSubmit()}
                        disabled={totalAmount === 0 || selectedIds.length === 0 || saving}
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirmar pago · ${fmtCurrency(totalAmount, currency)}`}
                    </Button>
                </div>
            </Card>
        </ModalOverlay>
    );
};

export default PaymentModal;
