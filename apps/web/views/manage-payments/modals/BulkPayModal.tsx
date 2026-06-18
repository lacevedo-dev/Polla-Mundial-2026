import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button, Card } from '../../../components/UI';
import { ModalOverlay } from '../components/ModalOverlay';
import { fmtCurrency } from '../utils';

const BulkPayModal: React.FC<{
    userCount: number;
    totalAmount: number;
    currency: string;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}> = ({ userCount, totalAmount, currency, onClose, onConfirm }) => {
    const [saving, setSaving] = useState(false);

    return (
        <ModalOverlay zIndexClass="z-[110]">
            <Card className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-6 text-center space-y-5">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={28} className="text-lime-600" />
                </div>
                <div>
                    <h3 className="text-xl font-black uppercase">Pago Masivo</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Se confirmarán todas las obligaciones de <strong>{userCount}</strong> usuario{userCount !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total a confirmar</p>
                    <p className="text-3xl font-black text-slate-900">{fmtCurrency(totalAmount, currency)}</p>
                </div>
                <div className="space-y-2">
                    <Button
                        variant="secondary"
                        className="w-full h-12 rounded-xl font-black uppercase text-xs"
                        disabled={saving}
                        onClick={async () => { setSaving(true); await onConfirm(); setSaving(false); }}
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar pago masivo'}
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase" onClick={onClose}>Cancelar</Button>
                </div>
            </Card>
        </ModalOverlay>
    );
};

export default BulkPayModal;
