import React, { useState } from 'react';
import { Hash, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Button, Input, Card } from '../../../components/UI';
import { PaymentMethodGrid } from '../components/PaymentMethodGrid';
import { ModalOverlay } from '../components/ModalOverlay';
import { fmtCurrency } from '../utils';
import { UserAvatar } from '../../../components/ui/UserAvatar';

const QuickPayModal: React.FC<{
    userName: string;
    userAvatar?: string | null;
    pendingAmount: number;
    currency: string;
    onClose: () => void;
    onConfirm: (method: string, reference: string) => Promise<void>;
}> = ({ userName, userAvatar, pendingAmount, currency, onClose, onConfirm }) => {
    const [method, setMethod] = useState('Efectivo');
    const [reference, setReference] = useState('');
    const [saving, setSaving] = useState(false);

    return (
        <ModalOverlay zIndexClass="z-[110]">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' as const }}>
                <Card className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-0 overflow-hidden">
                    <div className="p-6 text-center space-y-4">
                        <UserAvatar name={userName} src={userAvatar} className="w-14 h-14 rounded-2xl mx-auto" textClassName="text-base" />
                        <div>
                            <h3 className="text-xl font-black font-brand uppercase">Pago Rápido</h3>
                            <p className="text-sm text-slate-500">{userName}</p>
                        </div>
                        <div className="bg-lime-50 rounded-2xl p-4">
                            <p className="text-[10px] font-black uppercase text-lime-700 mb-1">Total pendiente</p>
                            <p className="text-3xl font-black text-lime-700">{fmtCurrency(pendingAmount, currency)}</p>
                        </div>
                        <PaymentMethodGrid method={method} onMethodChange={setMethod} variant="compact" />
                        <Input placeholder="Referencia (opcional)" value={reference} onChange={(e) => setReference(e.target.value)} className="h-9 text-xs" leftIcon={<Hash size={12} />} />
                    </div>
                    <div className="p-4 pt-0 space-y-2">
                        <Button
                            variant="secondary"
                            className="w-full h-12 rounded-xl font-black uppercase text-xs"
                            disabled={saving}
                            onClick={async () => { setSaving(true); await onConfirm(method, reference); setSaving(false); }}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar todo'}
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase" onClick={onClose}>Cancelar</Button>
                    </div>
                </Card>
            </motion.div>
        </ModalOverlay>
    );
};

export default QuickPayModal;
