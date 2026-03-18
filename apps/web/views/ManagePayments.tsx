import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Banknote, Bell, Bot, Check, ChevronDown, Copy, Download,
    Filter, Hash, History, Landmark, Mail, MessageCircle, MessageSquare,
    MoreVertical, PieChart, Search, Send, Share2, Smartphone, Sparkles,
    Trash2, Wallet, X, CheckCircle2,
} from 'lucide-react';
import { Button, Input, Badge, Card, Checkbox } from '../components/UI';
import { useLeagueStore } from '../stores/league.store';

/* ─── types ─────────────────────────────────────────────────────── */

type PaymentStatus = 'paid' | 'pending' | 'review';
type ReminderChannel = 'whatsapp' | 'email' | 'sms' | 'push';
type TemplateKey = 'friendly' | 'formal' | 'urgent' | 'ai' | 'custom';

interface PaymentConcept {
    id: string;
    label: string;
    type: 'general' | 'phase' | 'round' | 'match';
    amount: number;
    date: string;
}

interface UserPaymentData {
    id: string;
    name: string;
    avatar?: string;
    paymentStatus: Record<string, PaymentStatus>;
}

interface PaymentTransaction {
    id: string;
    userId: string;
    conceptIds: string[];
    amount: number;
    date: string;
    method: string;
    reference?: string;
    note?: string;
}

/* ─── constants ─────────────────────────────────────────────────── */

const PAYMENT_METHODS = [
    { id: 'Efectivo', label: 'Efectivo', Icon: Banknote, color: 'text-lime-600' },
    { id: 'Nequi', label: 'Nequi', Icon: Smartphone, color: 'text-purple-600' },
    { id: 'Daviplata', label: 'Daviplata', Icon: Smartphone, color: 'text-rose-600' },
    { id: 'Bancolombia', label: 'Bancolombia', Icon: Landmark, color: 'text-slate-900' },
];

const CHANNEL_CONFIG: Record<ReminderChannel, { label: string; Icon: React.ElementType; color: string; bg: string; border: string }> = {
    whatsapp: { label: 'WhatsApp', Icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    email: { label: 'Email', Icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    sms: { label: 'SMS', Icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    push: { label: 'Push', Icon: Bell, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

const TEMPLATES: Record<'friendly' | 'formal' | 'urgent', Record<ReminderChannel, string>> = {
    friendly: {
        whatsapp: 'Hola {nombre} 👋! Te recuerdo que tienes un saldo pendiente de {deuda} en la polla {liga}. ¡Gracias!',
        email: 'Hola {nombre},\n\nTe escribimos para recordarte amablemente sobre tu saldo pendiente de {deuda} en {liga}.\n\n¡Gracias por participar!',
        sms: '{nombre}, recuerda tu pago de {deuda} en {liga}. ¡No te quedes fuera!',
        push: '👋 {nombre}, no olvides ponerte al día en {liga}.',
    },
    formal: {
        whatsapp: 'Estimado(a) {nombre}. Le informamos un saldo vencido de {deuda} en la liga {liga}. Por favor regularizar su estado.',
        email: 'Estimado/a {nombre},\n\nLe notificamos que presenta un saldo pendiente de {deuda} en la liga {liga}.\n\nAtentamente,\nLa Administración.',
        sms: 'Aviso de Cobro: {nombre}, saldo pendiente {deuda} en {liga}. Regularice hoy.',
        push: 'Aviso: Saldo pendiente de {deuda} en {liga}.',
    },
    urgent: {
        whatsapp: '🚨 {nombre}, ÚLTIMO AVISO. Tu deuda de {deuda} en {liga} debe ser pagada hoy.',
        email: 'URGENTE: {nombre}, tu participación en {liga} está en riesgo.\n\nSaldo: {deuda}\n\nRealiza el pago inmediatamente.',
        sms: 'URGENTE {nombre}: Paga {deuda} hoy en {liga} para evitar bloqueo.',
        push: '🚨 {nombre}, tu pago de {deuda} en {liga} requiere atención inmediata.',
    },
};

/* ─── localStorage helpers ──────────────────────────────────────── */

function storageKey(leagueId: string, kind: 'concepts' | 'payments' | 'txs') {
    return `mp_${kind}_${leagueId}`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function saveToStorage(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function avatarUrl(name: string, avatar?: string) {
    return avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e2e8f0&color=64748b&size=40`;
}

function fmtCurrency(n: number) {
    return `$${n.toLocaleString('es-CO')}`;
}

/* ─── sub-components ────────────────────────────────────────────── */

const MethodIcon: React.FC<{ method: string; size?: number }> = ({ method, size = 14 }) => {
    const m = PAYMENT_METHODS.find((p) => p.id === method);
    if (!m) return <Wallet size={size} className="text-slate-400" />;
    return <m.Icon size={size} className={m.color} />;
};

const StatusBadge: React.FC<{ isFullyPaid: boolean; hasReview: boolean; percentage: number }> = ({ isFullyPaid, hasReview, percentage }) => {
    if (hasReview) return <Badge color="bg-amber-100 text-amber-700 border border-amber-200">REVISIÓN</Badge>;
    if (isFullyPaid) return <Badge color="bg-lime-100 text-lime-700 border border-lime-200">AL DÍA</Badge>;
    return <Badge color="bg-slate-100 text-slate-600 border border-slate-200">{percentage > 0 ? 'PARCIAL' : 'PENDIENTE'}</Badge>;
};

/* ─── Payment Modal ─────────────────────────────────────────────── */

const PaymentModal: React.FC<{
    userId: string | null;
    users: UserPaymentData[];
    concepts: PaymentConcept[];
    selectedConceptIds: string[];
    onClose: () => void;
    onSubmit: (userId: string, conceptIds: string[], amount: number, method: string, reference: string, date: string, note: string) => void;
}> = ({ userId, users, concepts, selectedConceptIds, onClose, onSubmit }) => {
    const user = users.find((u) => u.id === userId);
    const pendingIds = useMemo(
        () => selectedConceptIds.filter((id) => user?.paymentStatus[id] !== 'paid'),
        [user, selectedConceptIds],
    );
    const [form, setForm] = useState({
        conceptIds: pendingIds,
        method: 'Efectivo',
        reference: '',
        date: new Date().toISOString().split('T')[0],
        note: '',
    });

    const amount = form.conceptIds.reduce((s, id) => s + (concepts.find((c) => c.id === id)?.amount ?? 0), 0);

    const toggleConcept = (id: string) =>
        setForm((p) => ({
            ...p,
            conceptIds: p.conceptIds.includes(id) ? p.conceptIds.filter((c) => c !== id) : [...p.conceptIds, id],
        }));

    if (!user) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border-0 overflow-hidden max-h-[90vh] flex flex-col p-0">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-lime-400 rounded-xl flex items-center justify-center text-black"><Wallet size={20} /></div>
                        <div>
                            <h3 className="text-lg font-black uppercase">Registrar Pago</h3>
                            <p className="text-xs text-slate-400">{user.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'thin' }}>
                    {/* Concepts */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Conceptos a cobrar</p>
                        {selectedConceptIds.map((id) => {
                            const concept = concepts.find((c) => c.id === id);
                            const isPaid = user.paymentStatus[id] === 'paid';
                            if (!concept) return null;
                            const selected = form.conceptIds.includes(id);
                            return (
                                <div
                                    key={id}
                                    onClick={() => !isPaid && toggleConcept(id)}
                                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${isPaid ? 'opacity-50 pointer-events-none bg-slate-50 border-slate-100' : selected ? 'bg-lime-50 border-lime-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selected ? 'bg-lime-500 border-lime-500 text-white' : 'border-slate-300'}`}>
                                            {selected && <Check size={12} strokeWidth={4} />}
                                        </div>
                                        <span className="text-xs font-bold text-slate-700">{concept.label}</span>
                                        {isPaid && <Badge color="bg-lime-100 text-lime-600">PAGADO</Badge>}
                                    </div>
                                    <span className="text-xs font-black text-slate-900">{fmtCurrency(concept.amount)}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Total + method */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <span className="text-xs font-black uppercase text-slate-500">Total</span>
                            <span className="text-2xl font-black font-brand text-slate-900">{fmtCurrency(amount)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {PAYMENT_METHODS.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setForm((p) => ({ ...p, method: m.id }))}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${form.method === m.id ? 'bg-white border-lime-400 ring-1 ring-lime-400 shadow-sm' : 'bg-slate-100 border-transparent hover:bg-slate-200'}`}
                                >
                                    <m.Icon size={16} className={m.color} />
                                    <span className={`text-[10px] font-black uppercase ${form.method === m.id ? 'text-slate-900' : 'text-slate-400'}`}>{m.label}</span>
                                </button>
                            ))}
                        </div>

                        <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="h-9 text-xs" />
                        <Input placeholder="Referencia (opcional)" value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} className="h-9 text-xs" leftIcon={<Hash size={12} />} />
                        <Input placeholder="Nota (opcional)" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} className="h-9 text-xs" />
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 shrink-0">
                    <Button
                        variant="secondary"
                        className="w-full h-12 rounded-xl font-black uppercase text-xs"
                        onClick={() => onSubmit(user.id, form.conceptIds, amount, form.method, form.reference, form.date, form.note)}
                        disabled={amount === 0 || form.conceptIds.length === 0}
                    >
                        Confirmar Pago · {fmtCurrency(amount)}
                    </Button>
                </div>
            </Card>
        </div>
    );
};

/* ─── History Modal ─────────────────────────────────────────────── */

const HistoryModal: React.FC<{
    userId: string | null;
    users: UserPaymentData[];
    transactions: PaymentTransaction[];
    concepts: PaymentConcept[];
    onClose: () => void;
}> = ({ userId, users, transactions, concepts, onClose }) => {
    const user = users.find((u) => u.id === userId);
    const txs = transactions.filter((t) => t.userId === userId);
    if (!user) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border-0 overflow-hidden max-h-[85vh] flex flex-col p-0">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <History size={20} />
                        <div>
                            <h3 className="text-lg font-black uppercase">Historial</h3>
                            <p className="text-xs text-slate-400">{user.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3" style={{ scrollbarWidth: 'thin' }}>
                    {txs.length > 0 ? txs.map((tx) => (
                        <div key={tx.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-2">
                            <div className="flex justify-between items-start">
                                <Badge color="bg-white border border-slate-200 text-slate-500">{tx.date}</Badge>
                                <span className="text-lg font-black text-lime-600">+{fmtCurrency(tx.amount)}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {tx.conceptIds.map((cid) => (
                                    <span key={cid} className="text-[9px] font-black uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                                        {concepts.find((c) => c.id === cid)?.label ?? cid}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50">
                                <MethodIcon method={tx.method} />
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{tx.method}</span>
                                {tx.reference && <span className="text-[10px] text-slate-400">· {tx.reference}</span>}
                                {tx.note && <span className="text-[10px] text-slate-400">· {tx.note}</span>}
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-10 text-slate-400 text-sm">Sin movimientos registrados.</div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 shrink-0">
                    <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase" onClick={onClose}>Cerrar</Button>
                </div>
            </Card>
        </div>
    );
};

/* ─── Quick Pay Modal ───────────────────────────────────────────── */

const QuickPayModal: React.FC<{
    userId: string | null;
    users: UserPaymentData[];
    pendingAmount: number;
    onClose: () => void;
    onConfirm: (method: string, reference: string, date: string) => void;
}> = ({ userId, users, pendingAmount, onClose, onConfirm }) => {
    const user = users.find((u) => u.id === userId);
    const [method, setMethod] = useState('Efectivo');
    const [reference, setReference] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    if (!user) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' as const }}>
                <Card className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-0 overflow-hidden">
                    <div className="p-6 text-center space-y-4">
                        <div className="w-14 h-14 bg-lime-100 rounded-full flex items-center justify-center text-lime-600 mx-auto">
                            <Banknote size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black font-brand uppercase">Pago Rápido</h3>
                            <p className="text-sm text-slate-500">{user.name}</p>
                        </div>
                        <div className="bg-lime-50 rounded-2xl p-4">
                            <p className="text-[10px] font-black uppercase text-lime-700 mb-1">Total a saldar</p>
                            <p className="text-3xl font-black text-lime-700">{fmtCurrency(pendingAmount)}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {PAYMENT_METHODS.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setMethod(m.id)}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${method === m.id ? 'border-lime-400 bg-lime-50 ring-1 ring-lime-400' : 'border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <m.Icon size={14} className={m.color} />
                                    <span className="text-[10px] font-black uppercase text-slate-700">{m.label}</span>
                                </button>
                            ))}
                        </div>

                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" />
                        <Input placeholder="Referencia (opcional)" value={reference} onChange={(e) => setReference(e.target.value)} className="h-9 text-xs" leftIcon={<Hash size={12} />} />
                    </div>

                    <div className="p-4 pt-0 space-y-2">
                        <Button variant="secondary" className="w-full h-12 rounded-xl font-black uppercase text-xs" onClick={() => onConfirm(method, reference, date)}>
                            Confirmar Pago Total
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase" onClick={onClose}>Cancelar</Button>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
};

/* ─── Bulk Pay Modal ────────────────────────────────────────────── */

const BulkPayModal: React.FC<{
    userCount: number;
    totalAmount: number;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ userCount, totalAmount, onClose, onConfirm }) => (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <Card className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-6 text-center space-y-5">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} className="text-lime-600" />
            </div>
            <div>
                <h3 className="text-xl font-black uppercase">Pago Masivo</h3>
                <p className="text-sm text-slate-500 mt-1">Se marcarán como pagados <strong>{userCount}</strong> usuarios</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total registrado</p>
                <p className="text-3xl font-black text-slate-900">{fmtCurrency(totalAmount)}</p>
            </div>
            <div className="space-y-2">
                <Button variant="secondary" className="w-full h-12 rounded-xl font-black uppercase text-xs" onClick={onConfirm}>
                    Confirmar Pago Masivo
                </Button>
                <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase" onClick={onClose}>Cancelar</Button>
            </div>
        </Card>
    </div>
);

/* ─── Reminder Modal ────────────────────────────────────────────── */

const ReminderModal: React.FC<{
    selectedUsers: UserPaymentData[];
    leagueName: string;
    onClose: () => void;
}> = ({ selectedUsers, leagueName, onClose }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [userChannels, setUserChannels] = useState<Record<string, ReminderChannel[]>>(
        Object.fromEntries(selectedUsers.map((u) => [u.id, ['whatsapp' as ReminderChannel]])),
    );
    const [activeTab, setActiveTab] = useState<ReminderChannel>('whatsapp');
    const [drafts, setDrafts] = useState<Record<ReminderChannel, string>>({
        whatsapp: TEMPLATES.friendly.whatsapp,
        email: TEMPLATES.friendly.email,
        sms: TEMPLATES.friendly.sms,
        push: TEMPLATES.friendly.push,
    });
    const [selectedTpl, setSelectedTpl] = useState<Record<ReminderChannel, TemplateKey>>({
        whatsapp: 'friendly', email: 'friendly', sms: 'friendly', push: 'friendly',
    });
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const activeChannels = useMemo(() => {
        const set = new Set<ReminderChannel>();
        Object.values(userChannels).forEach((chs) => chs.forEach((c) => set.add(c)));
        return Array.from(set);
    }, [userChannels]);

    useEffect(() => {
        if (step === 2 && activeChannels.length > 0 && !activeChannels.includes(activeTab)) {
            setActiveTab(activeChannels[0]);
        }
    }, [step, activeChannels, activeTab]);

    const toggleChannel = (uid: string, ch: ReminderChannel) =>
        setUserChannels((prev) => {
            const cur = prev[uid] ?? [];
            return { ...prev, [uid]: cur.includes(ch) ? cur.filter((c) => c !== ch) : [...cur, ch] };
        });

    const applyTemplate = (key: 'friendly' | 'formal' | 'urgent') => {
        setDrafts((p) => ({ ...p, [activeTab]: TEMPLATES[key][activeTab] }));
        setSelectedTpl((p) => ({ ...p, [activeTab]: key }));
    };

    const generateAI = () => {
        setGenerating(true);
        setTimeout(() => {
            const aiMsgs: Record<ReminderChannel, string> = {
                whatsapp: '🤖 Hola {nombre}, noté que se nos pasó la fecha de tu aporte en {liga}. ¿Podrías revisar tu saldo de {deuda}? ¡Gracias!',
                email: 'Asunto: Pequeño recordatorio de {liga}\n\nHola {nombre},\n\nNuestra IA detectó un saldo pendiente de {deuda}. Ayúdanos a mantener la competencia al día.',
                sms: 'Hola {nombre}, recordatorio amigable: saldo de {deuda} en {liga}.',
                push: '🤖 {nombre}, no olvides tu aporte pendiente en {liga}.',
            };
            setDrafts((p) => ({ ...p, [activeTab]: aiMsgs[activeTab] }));
            setSelectedTpl((p) => ({ ...p, [activeTab]: 'ai' }));
            setGenerating(false);
        }, 1500);
    };

    const handleSend = () => {
        const preview = drafts[activeTab]
            .replace('{nombre}', selectedUsers[0]?.name ?? 'Usuario')
            .replace('{liga}', leagueName)
            .replace('{deuda}', '$0');
        void navigator.clipboard.writeText(preview).then(() => {
            setCopied(true);
            setTimeout(() => { setCopied(false); onClose(); }, 1500);
        });
    };

    const insertVar = (v: string) => {
        setDrafts((p) => ({ ...p, [activeTab]: p[activeTab] + ` {${v}}` }));
        setSelectedTpl((p) => ({ ...p, [activeTab]: 'custom' }));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl border-0 overflow-hidden max-h-[90vh] flex flex-col p-0">
                {/* Header */}
                <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center"><Send size={18} /></div>
                        <div>
                            <h3 className="text-lg font-black uppercase">Enviar Recordatorio</h3>
                            <p className="text-xs text-slate-400">{selectedUsers.length} usuario{selectedUsers.length !== 1 ? 's' : ''} seleccionado{selectedUsers.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>

                {/* Steps */}
                <div className="flex border-b border-slate-100 shrink-0">
                    {(['1. Canales', '2. Mensaje'] as const).map((label, i) => (
                        <button
                            key={label}
                            onClick={() => i === 0 && setStep(1)}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${step === i + 1 ? 'border-b-2 border-indigo-500 text-indigo-700 bg-indigo-50/50' : 'text-slate-400'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ scrollbarWidth: 'thin' }}>
                    {step === 1 ? (
                        /* Step 1: Channel selection */
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selecciona canales por usuario</p>
                            {selectedUsers.map((u) => (
                                <div key={u.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <img src={avatarUrl(u.name, u.avatar)} className="w-8 h-8 rounded-lg" alt={u.name} />
                                        <p className="text-sm font-black text-slate-900">{u.name}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(Object.keys(CHANNEL_CONFIG) as ReminderChannel[]).map((ch) => {
                                            const cfg = CHANNEL_CONFIG[ch];
                                            const active = (userChannels[u.id] ?? []).includes(ch);
                                            return (
                                                <button
                                                    key={ch}
                                                    onClick={() => toggleChannel(u.id, ch)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase transition-all ${active ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                                                >
                                                    <cfg.Icon size={12} />
                                                    {cfg.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Step 2: Message editor */
                        <div className="space-y-4">
                            {/* Channel tabs */}
                            <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                {activeChannels.map((ch) => {
                                    const cfg = CHANNEL_CONFIG[ch];
                                    return (
                                        <button
                                            key={ch}
                                            onClick={() => setActiveTab(ch)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === ch ? `${cfg.bg} ${cfg.border} border ${cfg.color}` : 'text-slate-400 hover:bg-slate-50'}`}
                                        >
                                            <cfg.Icon size={12} /> {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Template buttons */}
                            <div className="flex flex-wrap gap-2">
                                {(['friendly', 'formal', 'urgent'] as const).map((key) => (
                                    <button
                                        key={key}
                                        onClick={() => applyTemplate(key)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all ${selectedTpl[activeTab] === key ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        {key === 'friendly' ? '😊 Amigable' : key === 'formal' ? '📋 Formal' : '🚨 Urgente'}
                                    </button>
                                ))}
                                <button
                                    onClick={generateAI}
                                    disabled={generating}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all ${selectedTpl[activeTab] === 'ai' ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'} disabled:opacity-60`}
                                >
                                    {generating ? <><Bot size={12} className="animate-spin" /> Generando…</> : <><Sparkles size={12} /> IA</>}
                                </button>
                            </div>

                            {/* Variables */}
                            <div className="flex flex-wrap gap-1.5">
                                <span className="text-[9px] font-black uppercase text-slate-400 mr-1">Variables:</span>
                                {['nombre', 'deuda', 'liga'].map((v) => (
                                    <button key={v} onClick={() => insertVar(v)} className="px-2 py-0.5 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                                        {`{${v}}`}
                                    </button>
                                ))}
                            </div>

                            {/* Message editor */}
                            <textarea
                                value={drafts[activeTab]}
                                onChange={(e) => { setDrafts((p) => ({ ...p, [activeTab]: e.target.value })); setSelectedTpl((p) => ({ ...p, [activeTab]: 'custom' })); }}
                                rows={6}
                                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                style={{ scrollbarWidth: 'thin' }}
                            />

                            {/* Preview */}
                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-1">
                                <p className="text-[9px] font-black uppercase text-slate-400">Preview con {selectedUsers[0]?.name ?? 'usuario'}</p>
                                <p className="text-xs text-slate-600">
                                    {drafts[activeTab]
                                        .replace('{nombre}', selectedUsers[0]?.name ?? 'Usuario')
                                        .replace('{liga}', leagueName)
                                        .replace('{deuda}', '$50.000')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 shrink-0 flex gap-2">
                    {step === 1 ? (
                        <Button
                            variant="secondary"
                            className="flex-1 h-11 font-black uppercase text-xs"
                            onClick={() => setStep(2)}
                            disabled={activeChannels.length === 0}
                        >
                            Siguiente · Editar mensaje
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" className="h-11 px-4 font-black uppercase text-xs" onClick={() => setStep(1)}>Atrás</Button>
                            <Button
                                variant="secondary"
                                className="flex-1 h-11 font-black uppercase text-xs"
                                onClick={handleSend}
                            >
                                {copied ? <><Copy size={14} /> Copiado!</> : <><Send size={14} /> Enviar recordatorio</>}
                            </Button>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
};

/* ─── Main Component ────────────────────────────────────────────── */

const ManagePayments: React.FC = () => {
    const navigate = useNavigate();
    const activeLeague = useLeagueStore((s) => s.activeLeague);
    const fetchLeagueDetails = useLeagueStore((s) => s.fetchLeagueDetails);

    const leagueId = activeLeague?.id ?? '';
    const leagueName = activeLeague?.name ?? 'Polla';
    const baseFee = activeLeague?.settings.baseFee ?? 0;
    const currency = activeLeague?.settings.currency ?? 'COP';

    /* ─ concepts (from localStorage, seeded from league fee) ─ */
    const [concepts, setConcepts] = useState<PaymentConcept[]>(() => {
        const stored = loadFromStorage<PaymentConcept[]>(storageKey(leagueId, 'concepts'), []);
        if (stored.length > 0) return stored;
        const defaults: PaymentConcept[] = [];
        if (baseFee > 0) defaults.push({ id: 'general', label: 'Cuota General', type: 'general', amount: baseFee, date: 'Inicio' });
        return defaults;
    });

    const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>(() => concepts.map((c) => c.id));
    const [conceptMenuOpen, setConceptMenuOpen] = useState(false);
    const conceptMenuRef = useRef<HTMLDivElement>(null);

    /* ─ members (from league API) ─ */
    const [users, setUsers] = useState<UserPaymentData[]>([]);

    /* ─ payment statuses (from localStorage) ─ */
    const [paymentStatuses, setPaymentStatuses] = useState<Record<string, Record<string, PaymentStatus>>>(() =>
        loadFromStorage(storageKey(leagueId, 'payments'), {}),
    );

    /* ─ transactions (from localStorage) ─ */
    const [transactions, setTransactions] = useState<PaymentTransaction[]>(() =>
        loadFromStorage(storageKey(leagueId, 'txs'), []),
    );

    /* ─ UI state ─ */
    const [filter, setFilter] = useState<'all' | 'debtors' | 'solvents' | 'review'>('all');
    const [search, setSearch] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    /* ─ modal state ─ */
    const [payModal, setPayModal] = useState<string | null>(null);      // userId
    const [histModal, setHistModal] = useState<string | null>(null);    // userId
    const [quickModal, setQuickModal] = useState<string | null>(null);  // userId
    const [bulkModal, setBulkModal] = useState(false);
    const [reminderOpen, setReminderOpen] = useState(false);

    /* ─ load members ─ */
    useEffect(() => {
        if (!leagueId) return;
        void fetchLeagueDetails(leagueId).then((league) => {
            const members = (league.members ?? []).filter((m) => m.role !== 'ADMIN');
            setUsers(members.map((m) => ({
                id: m.id,
                name: m.name,
                avatar: m.avatar,
                paymentStatus: paymentStatuses[m.id] ?? {},
            })));
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leagueId]);

    /* ─ seed default concept when baseFee becomes known ─ */
    useEffect(() => {
        if (concepts.length === 0 && baseFee > 0) {
            const def: PaymentConcept[] = [{ id: 'general', label: 'Cuota General', type: 'general', amount: baseFee, date: 'Inicio' }];
            setConcepts(def);
            setSelectedConceptIds(def.map((c) => c.id));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseFee]);

    /* ─ persist ─ */
    useEffect(() => { if (leagueId) saveToStorage(storageKey(leagueId, 'concepts'), concepts); }, [concepts, leagueId]);
    useEffect(() => { if (leagueId) saveToStorage(storageKey(leagueId, 'payments'), paymentStatuses); }, [paymentStatuses, leagueId]);
    useEffect(() => { if (leagueId) saveToStorage(storageKey(leagueId, 'txs'), transactions); }, [transactions, leagueId]);

    /* ─ close menus on outside click ─ */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (conceptMenuRef.current && !conceptMenuRef.current.contains(e.target as Node)) setConceptMenuOpen(false);
            if (!(e.target as HTMLElement).closest('.action-menu-btn')) setOpenMenuId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* ─ helpers ─ */
    const getUserWithStatus = useCallback((u: UserPaymentData): UserPaymentData => ({
        ...u,
        paymentStatus: paymentStatuses[u.id] ?? {},
    }), [paymentStatuses]);

    const getAggregates = useCallback((u: UserPaymentData) => {
        const status = paymentStatuses[u.id] ?? {};
        let paid = 0, pending = 0, hasReview = false;
        selectedConceptIds.forEach((id) => {
            const amt = concepts.find((c) => c.id === id)?.amount ?? 0;
            if (status[id] === 'paid') paid += amt;
            else pending += amt;
            if (status[id] === 'review') hasReview = true;
        });
        const total = paid + pending;
        return { paid, pending, hasReview, isFullyPaid: total > 0 && pending === 0, percentage: total > 0 ? (paid / total) * 100 : 0 };
    }, [concepts, selectedConceptIds, paymentStatuses]);

    const financials = useMemo(() => {
        let expected = 0, collected = 0;
        concepts.filter((c) => selectedConceptIds.includes(c.id)).forEach((c) => {
            users.forEach((u) => {
                expected += c.amount;
                if ((paymentStatuses[u.id] ?? {})[c.id] === 'paid') collected += c.amount;
            });
        });
        return { expected, collected, progress: expected === 0 ? 0 : Math.round((collected / expected) * 100) };
    }, [concepts, selectedConceptIds, users, paymentStatuses]);

    const filteredUsers = useMemo(() => users.filter((u) => {
        const agg = getAggregates(u);
        const matchFilter = filter === 'all' ? true : filter === 'solvents' ? agg.isFullyPaid : filter === 'review' ? agg.hasReview : !agg.isFullyPaid;
        const matchSearch = u.name.toLowerCase().includes(search.toLowerCase());
        return matchFilter && matchSearch;
    }), [users, filter, search, getAggregates]);

    /* ─ actions ─ */
    const markPaid = (userId: string, conceptIds: string[], method: string, reference: string, date: string, amount: number, note = '') => {
        setPaymentStatuses((prev) => {
            const cur = prev[userId] ?? {};
            const next = { ...cur };
            conceptIds.forEach((id) => { next[id] = 'paid'; });
            return { ...prev, [userId]: next };
        });
        setTransactions((prev) => [{
            id: Math.random().toString(36).slice(2, 9),
            userId, conceptIds, amount, date, method, reference, note,
        }, ...prev]);
    };

    const handlePaySubmit = (userId: string, cIds: string[], amount: number, method: string, reference: string, date: string, note: string) => {
        markPaid(userId, cIds, method, reference, date, amount, note);
        setPayModal(null);
    };

    const handleQuickConfirm = (method: string, reference: string, date: string) => {
        const u = users.find((u) => u.id === quickModal);
        if (!u) return;
        const pendingIds = selectedConceptIds.filter((id) => (paymentStatuses[u.id] ?? {})[id] !== 'paid');
        const amount = getAggregates(u).pending;
        markPaid(u.id, pendingIds, method, reference, date, amount, 'Pago Rápido');
        setQuickModal(null);
    };

    const handleBulkConfirm = () => {
        users.filter((u) => selectedUserIds.includes(u.id)).forEach((u) => {
            const agg = getAggregates(u);
            if (agg.pending <= 0) return;
            const pendingIds = selectedConceptIds.filter((id) => (paymentStatuses[u.id] ?? {})[id] !== 'paid');
            markPaid(u.id, pendingIds, 'Efectivo', '', new Date().toISOString().split('T')[0], agg.pending, 'Pago Masivo');
        });
        setBulkModal(false);
        setSelectedUserIds([]);
    };

    const handleReset = (userId: string) => {
        if (!window.confirm('¿Anular todos los pagos de este usuario?')) return;
        setPaymentStatuses((prev) => {
            const cur = { ...(prev[userId] ?? {}) };
            selectedConceptIds.forEach((id) => { cur[id] = 'pending'; });
            return { ...prev, [userId]: cur };
        });
        setOpenMenuId(null);
    };

    const exportCSV = () => {
        const rows = filteredUsers.map((u) => {
            const agg = getAggregates(u);
            return [u.name, agg.pending, agg.isFullyPaid ? 'Al día' : 'Pendiente'].join(',');
        });
        const csv = 'data:text/csv;charset=utf-8,' + ['Nombre,Deuda,Estado', ...rows].join('\n');
        const a = document.createElement('a');
        a.href = encodeURI(csv);
        a.download = 'reporte_pagos.csv';
        a.click();
    };

    const bulkTotal = useMemo(() => {
        return users.filter((u) => selectedUserIds.includes(u.id)).reduce((s, u) => s + getAggregates(u).pending, 0);
    }, [users, selectedUserIds, getAggregates]);

    const reminderUsers = useMemo(
        () => users.filter((u) => selectedUserIds.includes(u.id)).map(getUserWithStatus),
        [users, selectedUserIds, getUserWithStatus],
    );

    /* ─ render ─ */
    return (
        <div className="space-y-6 pb-24">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black font-brand uppercase tracking-tighter text-slate-900">{leagueName}</h1>
                            {activeLeague?.settings.plan && (
                                <Badge color="bg-amber-100 text-amber-700 border border-amber-200">{activeLeague.settings.plan}</Badge>
                            )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Gestión de Pagos · {selectedConceptIds.length} Conceptos activos
                        </p>
                    </div>
                </div>

                {/* Concept filter */}
                <div className="relative z-30" ref={conceptMenuRef}>
                    <button
                        onClick={() => setConceptMenuOpen((v) => !v)}
                        className="w-full md:w-auto bg-white border border-slate-200 shadow-sm rounded-2xl p-2.5 px-4 flex items-center justify-between gap-4 hover:border-lime-400 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-lime-100 text-lime-700 w-8 h-8 rounded-lg flex items-center justify-center"><Filter size={16} /></div>
                            <div className="text-left">
                                <p className="text-[9px] font-black uppercase text-slate-400">Conceptos</p>
                                <p className="text-xs font-black text-slate-900">{selectedConceptIds.length} Seleccionados</p>
                            </div>
                        </div>
                        <ChevronDown size={18} className={`text-slate-300 transition-transform ${conceptMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {conceptMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                transition={{ duration: 0.16, ease: 'easeOut' as const }}
                                className="absolute top-full right-0 mt-2 w-full md:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 p-2"
                            >
                                {concepts.map((c) => {
                                    const active = selectedConceptIds.includes(c.id);
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedConceptIds((prev) => active ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                                            className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors ${active ? 'bg-lime-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${active ? 'bg-lime-500 border-lime-500 text-white' : 'border-slate-300'}`}>
                                                {active && <Check size={12} strokeWidth={4} />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold uppercase text-slate-700">{c.label}</p>
                                                <p className="text-[10px] font-black text-slate-500">{fmtCurrency(c.amount)} · {c.date}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                                {concepts.length === 0 && (
                                    <p className="text-xs text-slate-400 text-center py-3">Sin conceptos. Configura la cuota base en la liga.</p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Financial summary ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Main card */}
                <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl md:col-span-2">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                        <div className="space-y-2">
                            <Badge color="bg-lime-400 text-black">RECAUDO GLOBAL</Badge>
                            <p className="text-5xl font-black font-brand tracking-tighter">{fmtCurrency(financials.collected)}</p>
                            <div className="flex items-center gap-3">
                                <div className="h-1.5 w-32 bg-white/20 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${financials.progress}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' as const }}
                                        className="h-full bg-lime-400 rounded-full"
                                    />
                                </div>
                                <p className="text-sm font-bold text-slate-400">de {fmtCurrency(financials.expected)}</p>
                            </div>
                        </div>
                        <p className="text-5xl font-black font-brand text-lime-400">{financials.progress}%</p>
                    </div>
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* Status card */}
                <Card className="p-5 flex flex-col justify-center space-y-4 border-slate-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <PieChart size={14} className="text-slate-400" />
                            <span className="text-[10px] font-black uppercase text-slate-400">Estado Usuarios</span>
                        </div>
                        <button onClick={exportCSV} className="text-[9px] font-bold text-lime-600 flex items-center gap-1 hover:text-lime-700">
                            <Download size={10} /> CSV
                        </button>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center p-3 bg-lime-50 rounded-xl border border-lime-100">
                            <span className="text-xs font-bold text-lime-800">Al día</span>
                            <span className="text-lg font-black text-lime-700">{users.filter((u) => getAggregates(u).isFullyPaid).length}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100">
                            <span className="text-xs font-bold text-rose-800">Deudores</span>
                            <span className="text-lg font-black text-rose-700">{users.filter((u) => !getAggregates(u).isFullyPaid).length}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* ── Toolbar ── */}
            <div className="space-y-3">
                <div className="flex flex-col md:flex-row justify-between gap-3 items-center">
                    {/* Filter tabs */}
                    <div className="flex p-1 bg-white border border-slate-200 rounded-xl w-full md:w-auto overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        {[
                            { id: 'all', label: 'Todos' },
                            { id: 'debtors', label: 'Deudores' },
                            { id: 'review', label: 'Revisión' },
                            { id: 'solvents', label: 'Al día' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as typeof filter)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === tab.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="w-full md:w-64">
                        <Input placeholder="Buscar..." leftIcon={<Search size={16} />} className="text-xs font-bold h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>

                {/* Bulk actions */}
                <AnimatePresence>
                    {selectedUserIds.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="flex gap-2"
                        >
                            <Button
                                variant="secondary"
                                className="flex-1 md:flex-none text-xs font-bold uppercase"
                                onClick={() => setBulkModal(true)}
                            >
                                <Banknote size={15} className="mr-2" />
                                Pago Masivo ({selectedUserIds.length})
                            </Button>
                            <Button
                                className="flex-1 md:flex-none text-xs font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white border-0"
                                onClick={() => setReminderOpen(true)}
                            >
                                <Send size={15} className="mr-2" />
                                Recordar ({selectedUserIds.length})
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Mobile list ── */}
            <div className="md:hidden space-y-3">
                {filteredUsers.length > 0 ? filteredUsers.map((u) => {
                    const agg = getAggregates(u);
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                        <motion.div
                            key={u.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`bg-white p-4 rounded-2xl border transition-all ${isSelected ? 'border-lime-500 ring-1 ring-lime-500 shadow-md' : 'border-slate-200 shadow-sm'}`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <Checkbox id={`m-${u.id}`} label="" checked={isSelected} onChange={() => setSelectedUserIds((p) => p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id])} />
                                    <img src={avatarUrl(u.name, u.avatar)} className="w-10 h-10 rounded-xl object-cover" alt={u.name} />
                                    <div>
                                        <p className="text-sm font-black text-slate-900">{u.name}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <StatusBadge isFullyPaid={agg.isFullyPaid} hasReview={agg.hasReview} percentage={agg.percentage} />
                                    {agg.pending > 0 && <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg">-{fmtCurrency(agg.pending)}</span>}
                                </div>
                            </div>

                            <div className="mb-3 space-y-1">
                                <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                                    <span>Progreso</span><span>{Math.round(agg.percentage)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${agg.isFullyPaid ? 'bg-lime-500' : 'bg-amber-400'}`} style={{ width: `${agg.percentage}%` }} />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {!agg.isFullyPaid && (
                                    <Button size="sm" className="flex-1 h-9 text-[10px] font-black uppercase" variant="primary" onClick={() => setPayModal(u.id)}>Cobrar</Button>
                                )}
                                <button onClick={() => setQuickModal(u.id)} className="w-9 h-9 bg-lime-50 rounded-xl flex items-center justify-center text-lime-600 border border-lime-100 hover:bg-lime-100 transition-colors" title="Pago rápido">
                                    <CheckCircle2 size={16} />
                                </button>
                                <button onClick={() => setHistModal(u.id)} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-50 transition-colors" title="Historial">
                                    <History size={16} />
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                                        className={`action-menu-btn w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${openMenuId === u.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                    {openMenuId === u.id && (
                                        <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                            <button onClick={() => { setSelectedUserIds([u.id]); setReminderOpen(true); setOpenMenuId(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Send size={14} /> Recordatorio</button>
                                            <div className="h-px bg-slate-100" />
                                            <button onClick={() => handleReset(u.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={14} /> Anular pagos</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                }) : (
                    <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
                        <p className="text-xs font-bold uppercase">No se encontraron resultados.</p>
                    </div>
                )}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="p-5 w-14 text-center">
                                    <Checkbox
                                        id="select-all"
                                        label=""
                                        checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                                        onChange={() => setSelectedUserIds(selectedUserIds.length === filteredUsers.length ? [] : filteredUsers.map((u) => u.id))}
                                    />
                                </th>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400">Participante</th>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 text-center">Estado</th>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 text-center">Deuda</th>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.length > 0 ? filteredUsers.map((u) => {
                                const agg = getAggregates(u);
                                const isSelected = selectedUserIds.includes(u.id);
                                return (
                                    <tr key={u.id} className={`group hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-lime-50/30' : ''}`}>
                                        <td className="p-5 text-center">
                                            <Checkbox id={`c-${u.id}`} label="" checked={isSelected} onChange={() => setSelectedUserIds((p) => p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id])} />
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-3">
                                                <img src={avatarUrl(u.name, u.avatar)} className="w-10 h-10 rounded-xl object-cover" alt={u.name} />
                                                <p className="text-sm font-black text-slate-900">{u.name}</p>
                                            </div>
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className="w-full max-w-[160px] mx-auto space-y-1.5">
                                                <div className="flex justify-center">
                                                    <StatusBadge isFullyPaid={agg.isFullyPaid} hasReview={agg.hasReview} percentage={agg.percentage} />
                                                </div>
                                                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${agg.isFullyPaid ? 'bg-lime-500' : 'bg-amber-400'}`} style={{ width: `${agg.percentage}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5 text-center">
                                            {agg.pending > 0 ? (
                                                <span className="font-mono font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-lg">-{fmtCurrency(agg.pending)}</span>
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center justify-end gap-2 action-menu-btn">
                                                <button onClick={() => setHistModal(u.id)} className="h-9 px-4 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 transition-colors">
                                                    Historial
                                                </button>
                                                {!agg.isFullyPaid && (
                                                    <>
                                                        <button onClick={() => setPayModal(u.id)} className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase hover:bg-slate-800 transition-colors">
                                                            Cobrar
                                                        </button>
                                                        <button onClick={() => setQuickModal(u.id)} className="w-9 h-9 rounded-xl bg-lime-50 text-lime-600 flex items-center justify-center hover:bg-lime-400 hover:text-black transition-all" title="Pago rápido">
                                                            <CheckCircle2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                                                        className={`action-menu-btn w-9 h-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center transition-all ${openMenuId === u.id ? 'bg-slate-100 text-slate-900' : 'bg-white hover:bg-slate-50'}`}
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {openMenuId === u.id && (
                                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                                            <button onClick={() => { setSelectedUserIds([u.id]); setReminderOpen(true); setOpenMenuId(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Send size={14} /> Recordatorio</button>
                                                            <div className="h-px bg-slate-100" />
                                                            <button onClick={() => handleReset(u.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={14} /> Anular pagos</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-400 text-sm">No se encontraron participantes</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Modals ── */}
            {payModal && (
                <PaymentModal
                    userId={payModal}
                    users={users}
                    concepts={concepts}
                    selectedConceptIds={selectedConceptIds}
                    onClose={() => setPayModal(null)}
                    onSubmit={handlePaySubmit}
                />
            )}
            {histModal && (
                <HistoryModal
                    userId={histModal}
                    users={users}
                    transactions={transactions}
                    concepts={concepts}
                    onClose={() => setHistModal(null)}
                />
            )}
            {quickModal && (
                <QuickPayModal
                    userId={quickModal}
                    users={users}
                    pendingAmount={getAggregates(users.find((u) => u.id === quickModal) ?? users[0]).pending}
                    onClose={() => setQuickModal(null)}
                    onConfirm={handleQuickConfirm}
                />
            )}
            {bulkModal && (
                <BulkPayModal
                    userCount={selectedUserIds.filter((id) => getAggregates(users.find((u) => u.id === id) ?? users[0]).pending > 0).length}
                    totalAmount={bulkTotal}
                    onClose={() => setBulkModal(false)}
                    onConfirm={handleBulkConfirm}
                />
            )}
            {reminderOpen && (
                <ReminderModal
                    selectedUsers={reminderUsers}
                    leagueName={leagueName}
                    onClose={() => { setReminderOpen(false); setSelectedUserIds([]); }}
                />
            )}
        </div>
    );
};

export default ManagePayments;
