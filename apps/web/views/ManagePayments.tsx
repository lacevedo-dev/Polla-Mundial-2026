import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Banknote, Bell, Bot, Check, ChevronDown, Copy, Download,
    Filter, Hash, History, Landmark, Loader2, Mail, MessageCircle, MessageSquare,
    MoreVertical, PieChart, Search, Send, Share2, Smartphone, Sparkles,
    Trash2, Wallet, X, CheckCircle2,
} from 'lucide-react';
import { Button, Input, Badge, Card, Checkbox } from '../components/UI';
import { useLeagueStore } from '../stores/league.store';
import { request } from '../api';

/* ─── types ─────────────────────────────────────────────────────── */

type ReminderChannel = 'whatsapp' | 'email' | 'sms' | 'push';
type TemplateKey = 'friendly' | 'formal' | 'urgent' | 'ai' | 'custom';

/** Obligation record as returned by GET /leagues/:id/payments */
interface ObligationRecord {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string | null;
    category: string;
    referenceLabel: string;
    unitAmount: number;
    multiplier: number;
    totalAmount: number;
    currency: string;
    status: 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'CANCELLED';
    deadlineAt: string;
    paidAt?: string | null;
    createdAt: string;
}

interface UserSummary {
    id: string;
    name: string;
    avatar?: string | null;
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

/* ─── helpers ────────────────────────────────────────────────────── */

function avatarUrl(name: string, avatar?: string | null) {
    return avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e2e8f0&color=64748b&size=40`;
}

function fmtCurrency(n: number, currency = 'COP') {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n);
}

function categoryLabel(cat: string): string {
    const map: Record<string, string> = {
        PRINCIPAL: 'General', MATCH: 'Partido', GROUP: 'Grupo', ROUND: 'Ronda', PHASE: 'Fase',
    };
    return map[cat] ?? cat;
}

/* ─── sub-components ────────────────────────────────────────────── */

const MethodIcon: React.FC<{ method: string; size?: number }> = ({ method, size = 14 }) => {
    const m = PAYMENT_METHODS.find((p) => p.id === method);
    if (!m) return <Wallet size={size} className="text-slate-400" />;
    return <m.Icon size={size} className={m.color} />;
};

const StatusBadge: React.FC<{ isFullyPaid: boolean; hasExpired: boolean; percentage: number }> = ({ isFullyPaid, hasExpired, percentage }) => {
    if (hasExpired) return <Badge color="bg-rose-100 text-rose-700 border border-rose-200">VENCIDO</Badge>;
    if (isFullyPaid) return <Badge color="bg-lime-100 text-lime-700 border border-lime-200">AL DÍA</Badge>;
    return <Badge color="bg-slate-100 text-slate-600 border border-slate-200">{percentage > 0 ? 'PARCIAL' : 'PENDIENTE'}</Badge>;
};

/* ─── Payment Modal ─────────────────────────────────────────────── */

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
    const totalAmount = pending.filter((o) => selectedIds.includes(o.id)).reduce((s, o) => s + o.totalAmount, 0);

    const toggle = (id: string) =>
        setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

    const handleSubmit = async () => {
        if (selectedIds.length === 0) return;
        setSaving(true);
        await onSubmit(selectedIds, method, reference);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border-0 overflow-hidden max-h-[90vh] flex flex-col p-0">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <img src={avatarUrl(userName, userAvatar)} className="w-10 h-10 rounded-xl object-cover" alt={userName} />
                        <div>
                            <h3 className="text-lg font-black uppercase">Confirmar Pago</h3>
                            <p className="text-xs text-slate-400">{userName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'thin' }}>
                    {/* Obligations */}
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
                                            <p className="text-[10px] text-slate-400 uppercase">{categoryLabel(o.category)}{o.multiplier > 1 ? ` × ${o.multiplier}` : ''}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-slate-900">{fmtCurrency(o.totalAmount, currency)}</span>
                                </div>
                            );
                        })}
                        {/* Also show already paid ones as reference */}
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

                    {/* Method */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <span className="text-xs font-black uppercase text-slate-500">Total a confirmar</span>
                            <span className="text-2xl font-black font-brand text-slate-900">{fmtCurrency(totalAmount, currency)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {PAYMENT_METHODS.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setMethod(m.id)}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${method === m.id ? 'bg-white border-lime-400 ring-1 ring-lime-400 shadow-sm' : 'bg-slate-100 border-transparent hover:bg-slate-200'}`}
                                >
                                    <m.Icon size={16} className={m.color} />
                                    <span className={`text-[10px] font-black uppercase ${method === m.id ? 'text-slate-900' : 'text-slate-400'}`}>{m.label}</span>
                                </button>
                            ))}
                        </div>

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
        </div>
    );
};

/* ─── History Modal ─────────────────────────────────────────────── */

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border-0 overflow-hidden max-h-[85vh] flex flex-col p-0">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <img src={avatarUrl(userName, userAvatar)} className="w-10 h-10 rounded-xl object-cover" alt={userName} />
                        <div>
                            <h3 className="text-lg font-black uppercase">Historial</h3>
                            <p className="text-xs text-slate-400">{userName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3" style={{ scrollbarWidth: 'thin' }}>
                    {paidObs.length > 0 ? (
                        <>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pagos confirmados</p>
                            {paidObs.map((o) => (
                                <div key={o.id} className="p-4 rounded-2xl border border-lime-100 bg-lime-50/50 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{o.referenceLabel}</p>
                                            <p className="text-[10px] uppercase font-bold text-slate-400">{categoryLabel(o.category)}{o.multiplier > 1 ? ` × ${o.multiplier}` : ''}</p>
                                        </div>
                                        <span className="text-lg font-black text-lime-600">{fmtCurrency(o.totalAmount, currency)}</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-lime-200/50">
                                        <span className="text-[10px] text-slate-400">
                                            {o.paidAt ? new Date(o.paidAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                        </span>
                                        <button
                                            onClick={() => void onReset(o.id)}
                                            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold uppercase flex items-center gap-1"
                                        >
                                            <Trash2 size={10} /> Anular
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : null}

                    {expiredObs.length > 0 ? (
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
                    ) : null}

                    {paidObs.length === 0 && expiredObs.length === 0 && (
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' as const }}>
                <Card className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-0 overflow-hidden">
                    <div className="p-6 text-center space-y-4">
                        <img src={avatarUrl(userName, userAvatar)} className="w-14 h-14 rounded-2xl object-cover mx-auto" alt={userName} />
                        <div>
                            <h3 className="text-xl font-black font-brand uppercase">Pago Rápido</h3>
                            <p className="text-sm text-slate-500">{userName}</p>
                        </div>
                        <div className="bg-lime-50 rounded-2xl p-4">
                            <p className="text-[10px] font-black uppercase text-lime-700 mb-1">Total pendiente</p>
                            <p className="text-3xl font-black text-lime-700">{fmtCurrency(pendingAmount, currency)}</p>
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
        </div>
    );
};

/* ─── Bulk Pay Modal ────────────────────────────────────────────── */

const BulkPayModal: React.FC<{
    userCount: number;
    totalAmount: number;
    currency: string;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}> = ({ userCount, totalAmount, currency, onClose, onConfirm }) => {
    const [saving, setSaving] = useState(false);
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-6 text-center space-y-5">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={28} className="text-lime-600" />
                </div>
                <div>
                    <h3 className="text-xl font-black uppercase">Pago Masivo</h3>
                    <p className="text-sm text-slate-500 mt-1">Se confirmarán todas las obligaciones de <strong>{userCount}</strong> usuario{userCount !== 1 ? 's' : ''}</p>
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
        </div>
    );
};

/* ─── Reminder Modal ────────────────────────────────────────────── */

const ReminderModal: React.FC<{
    selectedUsers: UserSummary[];
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
                        <div className="space-y-4">
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

                            <div className="flex flex-wrap gap-1.5">
                                <span className="text-[9px] font-black uppercase text-slate-400 mr-1">Variables:</span>
                                {['nombre', 'deuda', 'liga'].map((v) => (
                                    <button key={v} onClick={() => insertVar(v)} className="px-2 py-0.5 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                                        {`{${v}}`}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                value={drafts[activeTab]}
                                onChange={(e) => { setDrafts((p) => ({ ...p, [activeTab]: e.target.value })); setSelectedTpl((p) => ({ ...p, [activeTab]: 'custom' })); }}
                                rows={6}
                                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                style={{ scrollbarWidth: 'thin' }}
                            />

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

    const leagueId = activeLeague?.id ?? '';
    const leagueName = activeLeague?.name ?? 'Polla';

    /* ─ backend state ─ */
    const [obligations, setObligations] = useState<ObligationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /* ─ concept filter ─ */
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    const [conceptMenuOpen, setConceptMenuOpen] = useState(false);
    const conceptMenuRef = useRef<HTMLDivElement>(null);

    /* ─ UI state ─ */
    const [filter, setFilter] = useState<'all' | 'debtors' | 'expired' | 'solvents'>('all');
    const [search, setSearch] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    /* ─ modal state ─ */
    const [payModal, setPayModal] = useState<string | null>(null);
    const [histModal, setHistModal] = useState<string | null>(null);
    const [quickModal, setQuickModal] = useState<string | null>(null);
    const [bulkModal, setBulkModal] = useState(false);
    const [reminderOpen, setReminderOpen] = useState(false);

    /* ─ load from backend ─ */
    const loadObligations = useCallback(async () => {
        if (!leagueId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await request<ObligationRecord[]>(`/leagues/${leagueId}/payments`);
            setObligations(data);
        } catch (e) {
            setError('No se pudieron cargar los pagos. Verifica que eres administrador de la polla.');
        } finally {
            setLoading(false);
        }
    }, [leagueId]);

    useEffect(() => { void loadObligations(); }, [loadObligations]);

    /* ─ derived: unique concepts from obligations ─ */
    const concepts = useMemo(() => {
        const seen = new Map<string, { label: string; category: string; amount: number }>();
        obligations.forEach((o) => {
            if (!seen.has(o.referenceLabel)) {
                seen.set(o.referenceLabel, { label: o.referenceLabel, category: o.category, amount: o.unitAmount });
            }
        });
        return Array.from(seen.entries()).map(([id, v]) => ({ id, ...v }));
    }, [obligations]);

    /* ─ auto-select all concepts on first load ─ */
    useEffect(() => {
        if (concepts.length > 0 && selectedLabels.length === 0) {
            setSelectedLabels(concepts.map((c) => c.id));
        }
    }, [concepts, selectedLabels.length]);

    /* ─ derived: unique users ─ */
    const users = useMemo<UserSummary[]>(() => {
        const seen = new Map<string, UserSummary>();
        obligations.forEach((o) => {
            if (!seen.has(o.userId)) {
                seen.set(o.userId, { id: o.userId, name: o.userName, avatar: o.userAvatar });
            }
        });
        return Array.from(seen.values());
    }, [obligations]);

    /* ─ helpers ─ */
    const getUserObs = useCallback((userId: string) =>
        obligations.filter((o) => o.userId === userId && selectedLabels.includes(o.referenceLabel)),
    [obligations, selectedLabels]);

    const getAggregates = useCallback((userId: string) => {
        const obs = getUserObs(userId);
        const paid = obs.filter((o) => o.status === 'PAID').reduce((s, o) => s + o.totalAmount, 0);
        const pending = obs.filter((o) => o.status === 'PENDING_PAYMENT').reduce((s, o) => s + o.totalAmount, 0);
        const hasExpired = obs.some((o) => o.status === 'EXPIRED' || o.status === 'CANCELLED');
        const total = paid + pending;
        return {
            paid, pending, hasExpired,
            isFullyPaid: total > 0 && pending === 0 && !hasExpired,
            percentage: total > 0 ? Math.round((paid / total) * 100) : 0,
        };
    }, [getUserObs]);

    const currency = obligations[0]?.currency ?? 'COP';

    const financials = useMemo(() => {
        let expected = 0, collected = 0;
        users.forEach((u) => {
            const agg = getAggregates(u.id);
            expected += agg.paid + agg.pending;
            collected += agg.paid;
        });
        return { expected, collected, progress: expected === 0 ? 0 : Math.round((collected / expected) * 100) };
    }, [users, getAggregates]);

    const filteredUsers = useMemo(() => users.filter((u) => {
        const agg = getAggregates(u.id);
        const matchFilter =
            filter === 'all' ? true :
            filter === 'solvents' ? agg.isFullyPaid :
            filter === 'expired' ? agg.hasExpired :
            agg.pending > 0;
        const matchSearch = u.name.toLowerCase().includes(search.toLowerCase());
        return matchFilter && matchSearch;
    }), [users, filter, search, getAggregates]);

    /* ─ close menus on outside click ─ */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (conceptMenuRef.current && !conceptMenuRef.current.contains(e.target as Node)) setConceptMenuOpen(false);
            if (!(e.target as HTMLElement).closest('.action-menu-btn')) setOpenMenuId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* ─ actions ─ */
    const confirmObligations = async (obligationIds: string[], method: string, reference: string) => {
        for (const id of obligationIds) {
            await request(`/leagues/${leagueId}/payments/${id}/confirm`, {
                method: 'POST',
                body: JSON.stringify({ method, reference }),
            });
        }
        await loadObligations();
        setPayModal(null);
    };

    const quickConfirm = async (userId: string, method: string, reference: string) => {
        const pendingIds = getUserObs(userId)
            .filter((o) => o.status === 'PENDING_PAYMENT')
            .map((o) => o.id);
        await confirmObligations(pendingIds, method, reference);
        setQuickModal(null);
    };

    const resetObligation = async (obligationId: string) => {
        await request(`/leagues/${leagueId}/payments/${obligationId}/reset`, { method: 'POST' });
        await loadObligations();
    };

    const bulkConfirm = async () => {
        for (const userId of selectedUserIds) {
            const pendingIds = getUserObs(userId)
                .filter((o) => o.status === 'PENDING_PAYMENT')
                .map((o) => o.id);
            for (const id of pendingIds) {
                await request(`/leagues/${leagueId}/payments/${id}/confirm`, {
                    method: 'POST',
                    body: JSON.stringify({ method: 'Efectivo' }),
                });
            }
        }
        await loadObligations();
        setBulkModal(false);
        setSelectedUserIds([]);
    };

    const exportCSV = () => {
        const rows = filteredUsers.map((u) => {
            const agg = getAggregates(u.id);
            return [u.name, agg.pending, agg.isFullyPaid ? 'Al día' : 'Pendiente'].join(',');
        });
        const csv = 'data:text/csv;charset=utf-8,' + ['Nombre,Deuda,Estado', ...rows].join('\n');
        const a = document.createElement('a');
        a.href = encodeURI(csv);
        a.download = 'reporte_pagos.csv';
        a.click();
    };

    const bulkTotal = useMemo(() =>
        selectedUserIds.reduce((s, uid) => s + getAggregates(uid).pending, 0),
    [selectedUserIds, getAggregates]);

    const reminderUsers = useMemo(() =>
        users.filter((u) => selectedUserIds.includes(u.id)),
    [users, selectedUserIds]);

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
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Gestión de Pagos · {obligations.length} obligaciones
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
                                <p className="text-xs font-black text-slate-900">{selectedLabels.length} Seleccionados</p>
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
                                {concepts.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-3">Sin datos de participación registrados.</p>
                                ) : concepts.map((c) => {
                                    const active = selectedLabels.includes(c.id);
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedLabels((prev) => active ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                                            className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors ${active ? 'bg-lime-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${active ? 'bg-lime-500 border-lime-500 text-white' : 'border-slate-300'}`}>
                                                {active && <Check size={12} strokeWidth={4} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold uppercase text-slate-700 truncate">{c.label}</p>
                                                <p className="text-[10px] font-black text-slate-500">{categoryLabel(c.category)} · {fmtCurrency(c.amount, currency)}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Loading / Error ── */}
            {loading && (
                <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm font-bold">Cargando pagos...</span>
                </div>
            )}

            {error && !loading && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2">
                    <p className="text-sm font-bold text-rose-700">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => void loadObligations()}>Reintentar</Button>
                </div>
            )}

            {!loading && !error && obligations.length === 0 && (
                <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center space-y-2">
                    <p className="text-slate-400 text-sm font-bold uppercase">Sin datos de participación</p>
                    <p className="text-slate-400 text-xs">Los participantes aún no han seleccionado opciones de participación desde la vista de pronósticos.</p>
                </div>
            )}

            {!loading && !error && obligations.length > 0 && (
                <>
                    {/* ── Financial summary ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl md:col-span-2">
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                                <div className="space-y-2">
                                    <Badge color="bg-lime-400 text-black">RECAUDO GLOBAL</Badge>
                                    <p className="text-5xl font-black font-brand tracking-tighter">{fmtCurrency(financials.collected, currency)}</p>
                                    <div className="flex items-center gap-3">
                                        <div className="h-1.5 w-32 bg-white/20 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${financials.progress}%` }}
                                                transition={{ duration: 1, ease: 'easeOut' as const }}
                                                className="h-full bg-lime-400 rounded-full"
                                            />
                                        </div>
                                        <p className="text-sm font-bold text-slate-400">de {fmtCurrency(financials.expected, currency)}</p>
                                    </div>
                                </div>
                                <p className="text-5xl font-black font-brand text-lime-400">{financials.progress}%</p>
                            </div>
                            <div className="absolute -top-10 -right-10 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />
                        </div>

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
                                    <span className="text-lg font-black text-lime-700">{users.filter((u) => getAggregates(u.id).isFullyPaid).length}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100">
                                    <span className="text-xs font-bold text-rose-800">Con deuda</span>
                                    <span className="text-lg font-black text-rose-700">{users.filter((u) => getAggregates(u.id).pending > 0).length}</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* ── Toolbar ── */}
                    <div className="space-y-3">
                        <div className="flex flex-col md:flex-row justify-between gap-3 items-center">
                            <div className="flex p-1 bg-white border border-slate-200 rounded-xl w-full md:w-auto overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                {[
                                    { id: 'all', label: 'Todos' },
                                    { id: 'debtors', label: 'Con deuda' },
                                    { id: 'expired', label: 'Vencidos' },
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
                                        Confirmar masivo ({selectedUserIds.length})
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
                            const agg = getAggregates(u.id);
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
                                            <StatusBadge isFullyPaid={agg.isFullyPaid} hasExpired={agg.hasExpired} percentage={agg.percentage} />
                                            {agg.pending > 0 && <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg">-{fmtCurrency(agg.pending, currency)}</span>}
                                        </div>
                                    </div>

                                    <div className="mb-3 space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                                            <span>Progreso</span><span>{agg.percentage}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${agg.isFullyPaid ? 'bg-lime-500' : 'bg-amber-400'}`} style={{ width: `${agg.percentage}%` }} />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {!agg.isFullyPaid && (
                                            <Button size="sm" className="flex-1 h-9 text-[10px] font-black uppercase" variant="primary" onClick={() => setPayModal(u.id)}>Cobrar</Button>
                                        )}
                                        {agg.pending > 0 && (
                                            <button onClick={() => setQuickModal(u.id)} className="w-9 h-9 bg-lime-50 rounded-xl flex items-center justify-center text-lime-600 border border-lime-100 hover:bg-lime-100 transition-colors" title="Pago rápido">
                                                <CheckCircle2 size={16} />
                                            </button>
                                        )}
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
                                                    <button onClick={() => setHistModal(u.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><History size={14} /> Ver historial</button>
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
                                        const agg = getAggregates(u.id);
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
                                                            <StatusBadge isFullyPaid={agg.isFullyPaid} hasExpired={agg.hasExpired} percentage={agg.percentage} />
                                                        </div>
                                                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${agg.isFullyPaid ? 'bg-lime-500' : 'bg-amber-400'}`} style={{ width: `${agg.percentage}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-center">
                                                    {agg.pending > 0 ? (
                                                        <span className="font-mono font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-lg">-{fmtCurrency(agg.pending, currency)}</span>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex items-center justify-end gap-2 action-menu-btn">
                                                        <button onClick={() => setHistModal(u.id)} className="h-9 px-4 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 transition-colors">
                                                            Historial
                                                        </button>
                                                        {agg.pending > 0 && (
                                                            <>
                                                                <button onClick={() => setPayModal(u.id)} className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase hover:bg-slate-800 transition-colors">
                                                                    Cobrar
                                                                </button>
                                                                <button onClick={() => setQuickModal(u.id)} className="w-9 h-9 rounded-xl bg-lime-50 text-lime-600 flex items-center justify-center hover:bg-lime-400 hover:text-black transition-all" title="Confirmar todo">
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
                                                                    <button onClick={() => { setHistModal(u.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><History size={14} /> Ver historial</button>
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
                </>
            )}

            {/* ── Modals ── */}
            {payModal && (
                <PaymentModal
                    userObs={getUserObs(payModal)}
                    userName={users.find((u) => u.id === payModal)?.name ?? ''}
                    userAvatar={users.find((u) => u.id === payModal)?.avatar}
                    onClose={() => setPayModal(null)}
                    onSubmit={confirmObligations}
                />
            )}
            {histModal && (
                <HistoryModal
                    userObs={getUserObs(histModal)}
                    userName={users.find((u) => u.id === histModal)?.name ?? ''}
                    userAvatar={users.find((u) => u.id === histModal)?.avatar}
                    onClose={() => setHistModal(null)}
                    onReset={async (id) => { await resetObligation(id); }}
                />
            )}
            {quickModal && (
                <QuickPayModal
                    userName={users.find((u) => u.id === quickModal)?.name ?? ''}
                    userAvatar={users.find((u) => u.id === quickModal)?.avatar}
                    pendingAmount={getAggregates(quickModal).pending}
                    currency={currency}
                    onClose={() => setQuickModal(null)}
                    onConfirm={(method, ref) => quickConfirm(quickModal, method, ref)}
                />
            )}
            {bulkModal && (
                <BulkPayModal
                    userCount={selectedUserIds.filter((id) => getAggregates(id).pending > 0).length}
                    totalAmount={bulkTotal}
                    currency={currency}
                    onClose={() => setBulkModal(false)}
                    onConfirm={bulkConfirm}
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
