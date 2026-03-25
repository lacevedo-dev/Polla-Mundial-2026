import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    AlignJustify,
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Bell,
    CheckCircle2,
    ChevronDown,
    Clock,
    Coins,
    Copy,
    Eye,
    EyeOff,
    Globe,
    ListChecks,
    Lock,
    Mail,
    MessageCircle,
    Minus,
    Phone,
    Plus,
    Send,
    Settings,
    Share2,
    Sparkles,
    TrendingUp,
    Trash2,
    Trophy,
    UserPlus,
    Users,
    X,
    Zap,
} from 'lucide-react';
import { request } from '../api';
import { resolveApiAssetUrl } from '../api';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore, type MatchViewModel } from '../stores/prediction.store';
import { useDashboardStore } from '../stores/dashboard.store';
import { useAuthStore } from '../stores/auth.store';
import { ErrorBanner } from '../components/dashboard/ErrorBanner';

/* ─── helpers ─────────────────────────────────────────────────── */

function formatCurrency(amount?: number | null, currency = 'COP'): string {
    if (!amount) return 'Gratis';
    try {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${currency} ${amount}`;
    }
}

function safeText(value?: string | null, fallback = 'Sin datos'): string {
    return value?.trim() || fallback;
}

const ADMIN_COMMISSION = 0.1;

function calcPrizes(baseFee: number | null | undefined, memberCount: number | undefined, currency = 'COP') {
    const raw = (baseFee ?? 0) * (memberCount ?? 0);
    const net = Math.round(raw * (1 - ADMIN_COMMISSION));
    const commission = raw - net;
    const fmt = (n: number) => (n > 0 ? formatCurrency(n, currency) : '—');
    return {
        raw, net, commission,
        first: Math.round(net * 0.6),
        second: Math.round(net * 0.3),
        third: Math.round(net * 0.1),
        fmt,
    };
}

const fade = (delay = 0) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: 'easeOut' as const, delay },
});

function getClosePredictionMinutes(closePredictionMinutes?: number | null): number {
    if (typeof closePredictionMinutes !== 'number' || !Number.isFinite(closePredictionMinutes)) {
        return 15;
    }

    return Math.max(0, closePredictionMinutes);
}

function getPredictionCloseTime(matchDate: string, closePredictionMinutes?: number | null): number {
    return new Date(matchDate).getTime() - getClosePredictionMinutes(closePredictionMinutes) * 60_000;
}

function isPredictionWindowClosed(
    matchDate: string,
    closePredictionMinutes?: number | null,
    now = Date.now(),
): boolean {
    return now > getPredictionCloseTime(matchDate, closePredictionMinutes);
}

function summarizeCloseTime(
    matchDate: string,
    closePredictionMinutes?: number | null,
    now = Date.now(),
): string {
    const diffMs = getPredictionCloseTime(matchDate, closePredictionMinutes) - now;

    if (!Number.isFinite(diffMs) || diffMs <= 0) {
        return 'Cerrado';
    }

    const totalMinutes = Math.round(diffMs / 60_000);

    if (totalMinutes < 60) {
        return `${totalMinutes} min`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

function formatMatchTime(date: string): string {
    return new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(date));
}

/* ─── Invite Modal ─────────────────────────────────────────────── */

type InviteChannel = 'whatsapp' | 'sms' | 'email' | 'push';
type InviteTone = 'amigable' | 'retador' | 'formal';

interface InviteFriend {
    id: string;
    name: string;
    phone: string;
    email: string;
    channels: InviteChannel[];
}

const INVITE_TEMPLATES: Record<InviteChannel, Record<InviteTone, string>> = {
    whatsapp: {
        amigable: '¡Hola {nombre}! 👋 Te invito a mi polla mundialista \'{liga}\'. Demuestra cuánto sabes de fútbol. Únete aquí: {link}',
        retador: '¡{nombre}! ⚽ ¿Te atreves a competir? Únete a \'{liga}\' y demuestra que eres el mejor del Mundial 2026. {link}',
        formal: 'Estimado/a {nombre}, le extiendo una invitación a participar en la polla deportiva \'{liga}\'. Acceda mediante: {link}',
    },
    sms: {
        amigable: '{nombre}, únete a mi polla \'{liga}\' del Mundial 2026. Link: {link}',
        retador: '{nombre} ⚽ ¿Te atreves? Únete a \'{liga}\' y demuéstralo. {link}',
        formal: 'Estimado {nombre}, le invito a \'{liga}\' del Mundial 2026. Acceda: {link}',
    },
    email: {
        amigable: 'Hola {nombre},\n\nTe invito a participar en la polla \'{liga}\' para el Mundial 2026. ¡Habrá premios y mucha diversión!\n\nÚnete aquí: {link}',
        retador: 'Hola {nombre},\n\n¿Crees que puedes ganarme? Únete a \'{liga}\' y demuéstralo. El Mundial 2026 se viene con todo.\n\nÚnete: {link}',
        formal: 'Estimado/a {nombre},\n\nEs un placer extenderle una invitación para participar en la polla deportiva \'{liga}\' con motivo del Mundial 2026.\n\nPara unirse, acceda al siguiente enlace: {link}\n\nQuedo a su disposición para cualquier consulta.',
    },
    push: {
        amigable: '¡{nombre}, te invitan a la polla \'{liga}\'! 🏆 Únete y demuestra cuánto sabes de fútbol.',
        retador: '¡{nombre}! ⚽ ¿Te atreves a competir en \'{liga}\'? El desafío del Mundial 2026 te espera.',
        formal: '{nombre}, tiene una invitación pendiente para unirse a la polla \'{liga}\' del Mundial 2026.',
    },
};

function autoChannels(phone: string, email: string): InviteChannel[] {
    const ch: InviteChannel[] = [];
    if (phone.trim()) { ch.push('whatsapp', 'sms'); }
    if (email.trim()) { ch.push('email'); }
    return ch.length ? ch : ['whatsapp'];
    // 'push' excluded intentionally — must be enabled manually per friend
}

function parseBulkText(raw: string): InviteFriend[] {
    const entries = raw.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
    return entries.reduce<InviteFriend[]>((acc, entry) => {
        const emailMatch = entry.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        const phoneMatch = entry.match(/\b(3\d{9}|\+57\d{10}|\d{7,10})\b/);
        const namePart = entry
            .replace(/<[^>]*>/g, '')
            .replace(emailMatch?.[0] ?? '', '')
            .replace(phoneMatch?.[0] ?? '', '')
            .trim()
            .replace(/[,;]+$/, '')
            .trim();
        if (!namePart && !emailMatch && !phoneMatch) return acc;
        const phone = phoneMatch?.[0] ?? '';
        const email = emailMatch?.[0] ?? '';
        acc.push({
            id: `${Date.now()}-${Math.random()}`,
            name: namePart || 'Invitado',
            phone,
            email,
            channels: autoChannels(phone, email),
        });
        return acc;
    }, []);
}

const CHANNEL_META: Record<InviteChannel, { label: string; color: string; Icon: React.FC<{ size?: number; className?: string }> }> = {
    whatsapp: { label: 'WhatsApp', color: 'bg-[#25D366] text-white', Icon: ({ size, className }) => <MessageCircle size={size} className={className} /> },
    sms: { label: 'SMS', color: 'bg-sky-400 text-white', Icon: ({ size, className }) => <Phone size={size} className={className} /> },
    email: { label: 'Email', color: 'bg-lime-400 text-slate-950', Icon: ({ size, className }) => <Mail size={size} className={className} /> },
    push: { label: 'Notif.', color: 'bg-violet-500 text-white', Icon: ({ size, className }) => <Bell size={size} className={className} /> },
};

const InviteModal: React.FC<{
    open: boolean;
    onClose: () => void;
    code?: string;
    leagueName?: string;
}> = ({ open, onClose, code, leagueName }) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // ── Screen 1 state ──
    const [screen, setScreen] = useState<'invite' | 'customize'>('invite');
    const [tab, setTab] = useState<'one' | 'bulk'>('one');
    const [friends, setFriends] = useState<InviteFriend[]>([]);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [codeCopied, setCodeCopied] = useState(false);

    // ── Screen 2 state ──
    const [msgChannel, setMsgChannel] = useState<InviteChannel>('whatsapp');
    const [tone, setTone] = useState<InviteTone>('amigable');
    const [msgText, setMsgText] = useState('');
    const [emailPreview, setEmailPreview] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const link = `https://polla.agildesarrollo.com.co/join/${code ?? ''}`;
    const activeChannels = [...new Set(friends.flatMap((f) => f.channels))] as InviteChannel[];

    // Sync template when channel/tone changes in customize screen
    React.useEffect(() => {
        if (screen === 'customize') {
            setMsgText(INVITE_TEMPLATES[msgChannel][tone]);
        }
    }, [msgChannel, tone, screen]);

    // Reset screen when modal closes
    React.useEffect(() => {
        if (!open) { setScreen('invite'); setSent(false); }
    }, [open]);

    // ── Screen 1 handlers ──
    const handleCopyCode = () => {
        if (!code) return;
        void navigator.clipboard.writeText(code).then(() => {
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        });
    };

    const handleWhatsAppShare = () => {
        const text = encodeURIComponent(`¡Únete a mi polla "${leagueName}"! 🏆\nCódigo: *${code}*\n${link}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    const handleNativeShare = () => {
        const text = `¡Únete a la polla "${leagueName}"! Código: ${code}`;
        if (navigator.share) {
            void navigator.share({ title: leagueName, text, url: link });
        } else {
            void navigator.clipboard.writeText(`${text}\n${link}`);
        }
    };

    const handleAddOne = () => {
        if (!name.trim()) return;
        setFriends((prev) => [...prev, {
            id: Date.now().toString(),
            name: name.trim(), phone: phone.trim(), email: email.trim(),
            channels: autoChannels(phone, email),
        }]);
        setName(''); setPhone(''); setEmail('');
    };

    const handleBulkProcess = () => {
        const parsed = parseBulkText(bulkText);
        if (parsed.length) { setFriends((prev) => [...prev, ...parsed]); setBulkText(''); }
    };

    const handleRemoveFriend = (id: string) => setFriends((prev) => prev.filter((f) => f.id !== id));

    const toggleFriendChannel = (friendId: string, ch: InviteChannel) => {
        setFriends((prev) => prev.map((f) => {
            if (f.id !== friendId) return f;
            const has = f.channels.includes(ch);
            const next = has ? f.channels.filter((c) => c !== ch) : [...f.channels, ch];
            return { ...f, channels: next.length ? next : f.channels }; // keep at least 1
        }));
    };

    const openCustomize = () => {
        const ch = activeChannels[0] ?? 'whatsapp';
        setMsgChannel(ch);
        setMsgText(INVITE_TEMPLATES[ch][tone]);
        setEmailPreview(false);
        setScreen('customize');
    };

    // ── Screen 2 handlers ──
    const insertVar = (variable: string) => {
        const ta = textareaRef.current;
        if (!ta) { setMsgText((p) => p + variable); return; }
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const next = msgText.slice(0, start) + variable + msgText.slice(end);
        setMsgText(next);
        requestAnimationFrame(() => {
            ta.setSelectionRange(start + variable.length, start + variable.length);
            ta.focus();
        });
    };

    const handleImproveWithAI = async () => {
        setAiLoading(true);
        try {
            const result = await request<{ message: string }>('/ai/improve-message', {
                method: 'POST',
                body: JSON.stringify({ message: msgText, tone, channel: msgChannel, leagueName }),
            });
            setMsgText(result.message);
        } catch {
            // Endpoint not implemented yet — apply local enhancement
            const enhanced = msgText + (msgChannel === 'whatsapp' ? ' 🎉' : '');
            setMsgText(enhanced);
        } finally {
            setAiLoading(false);
        }
    };

    const resolveMsg = (f: InviteFriend) =>
        msgText
            .replace(/\{nombre\}/g, f.name)
            .replace(/\{liga\}/g, leagueName ?? '')
            .replace(/\{link\}/g, link);

    const handleSendInvitations = () => {
        const targets = friends.filter((f) => f.channels.includes(msgChannel));
        if (!targets.length) return;

        if (msgChannel === 'whatsapp') {
            targets.forEach((f, i) => {
                const msg = encodeURIComponent(resolveMsg(f));
                const num = f.phone.replace(/\D/g, '');
                const url = num ? `https://wa.me/${num}?text=${msg}` : `https://wa.me/?text=${msg}`;
                setTimeout(() => window.open(url, '_blank'), i * 600);
            });
        } else if (msgChannel === 'sms') {
            const f = targets[0];
            const msg = encodeURIComponent(resolveMsg(f));
            window.open(`sms:${f.phone}?body=${msg}`);
        } else if (msgChannel === 'email') {
            const emails = targets.map((f) => f.email).filter(Boolean).join(',');
            const subject = encodeURIComponent(`Invitación a la polla ${leagueName ?? ''}`);
            const body = encodeURIComponent(
                targets.length === 1
                    ? resolveMsg(targets[0])
                    : msgText.replace(/\{nombre\}/g, 'amigo/a').replace(/\{liga\}/g, leagueName ?? '').replace(/\{link\}/g, link),
            );
            window.open(`mailto:${emails}?subject=${subject}&body=${body}`);
        } else if (msgChannel === 'push') {
            // Request browser notification permission and send via backend
            void (async () => {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        // Try backend push endpoint; fallback to local browser notification
                        try {
                            await request('/notifications/invite', {
                                method: 'POST',
                                body: JSON.stringify({
                                    userIds: targets.map((f) => f.id),
                                    message: msgText.replace(/\{liga\}/g, leagueName ?? '').replace(/\{link\}/g, link),
                                    leagueCode: code,
                                }),
                            });
                        } catch {
                            // Backend not available — show local notification as preview
                            targets.forEach((f) => {
                                new Notification(`Invitación a ${leagueName ?? 'la polla'}`, {
                                    body: resolveMsg(f),
                                    icon: '/favicon.ico',
                                });
                            });
                        }
                    }
                } catch {
                    // Notifications not supported
                }
            })();
        }

        setSent(true);
        setTimeout(() => setSent(false), 3000);
    };

    const emailHtml = msgText
        .replace(/\{nombre\}/g, '<strong>[nombre]</strong>')
        .replace(/\{liga\}/g, `<em>${leagueName ?? '[liga]'}</em>`)
        .replace(/\{link\}/g, `<a href="${link}" style="color:#84cc16">${link}</a>`)
        .replace(/\n/g, '<br/>');

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 10 }}
                        transition={{ duration: 0.26, ease: 'easeOut' as const }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4"
                    >
                        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                            <AnimatePresence mode="wait">

                                {/* ══ SCREEN 1: INVITE ══ */}
                                {screen === 'invite' && (
                                    <motion.div key="s-invite" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex flex-col overflow-hidden">
                                        {/* Header */}
                                        <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0">
                                            <div className="w-10 h-10 rounded-2xl bg-slate-950 flex items-center justify-center shrink-0">
                                                <UserPlus size={18} className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h2 className="text-[12px] font-black uppercase tracking-[0.22em] text-slate-900">Agregar amigos</h2>
                                                <p className="text-[11px] text-slate-400 mt-0.5">{friends.length} Invitados</p>
                                            </div>
                                            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                                <X size={15} />
                                            </button>
                                        </div>

                                        <div className="px-5 pb-5 space-y-4 overflow-y-auto">
                                            {/* Access card */}
                                            <div className="rounded-2xl bg-slate-900 px-4 py-3.5 flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-lime-500 mb-1">Acceso rápido</p>
                                                    <p className="text-[17px] font-black text-white tracking-widest leading-tight truncate">
                                                        {leagueName?.toUpperCase() || '——'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button onClick={handleCopyCode} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors" title="Copiar código">
                                                        {codeCopied ? <CheckCircle2 size={15} className="text-lime-400" /> : <Copy size={15} />}
                                                    </button>
                                                    <button onClick={handleWhatsAppShare} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#25D366] text-white hover:opacity-90 transition-opacity" title="WhatsApp">
                                                        <MessageCircle size={15} />
                                                    </button>
                                                    <button onClick={handleNativeShare} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors" title="Compartir">
                                                        <Share2 size={15} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Add manually */}
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-2.5">Agregar manualmente</p>
                                                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-3">
                                                    {(['one', 'bulk'] as const).map((t) => (
                                                        <button key={t} onClick={() => setTab(t)}
                                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                        >
                                                            {t === 'one' ? <><UserPlus size={11} /> Uno a uno</> : <><AlignJustify size={11} /> Lista rápida</>}
                                                        </button>
                                                    ))}
                                                </div>

                                                <AnimatePresence mode="wait">
                                                    {tab === 'one' ? (
                                                        <motion.div key="t-one" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="space-y-2">
                                                            <div className="relative">
                                                                <UserPlus size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddOne()} placeholder="Nombre del Amigo *" className="w-full pl-8 pr-3 py-2.5 text-[12px] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-400 placeholder:text-slate-400" />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="relative">
                                                                    <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Celular" className="w-full pl-8 pr-3 py-2.5 text-[12px] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-400 placeholder:text-slate-400" />
                                                                </div>
                                                                <div className="relative">
                                                                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full pl-8 pr-3 py-2.5 text-[12px] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-400 placeholder:text-slate-400" />
                                                                </div>
                                                            </div>
                                                            <button onClick={handleAddOne} disabled={!name.trim()} className="w-full py-2.5 rounded-xl bg-lime-400 text-slate-950 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-lime-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                                                + Agregar a la lista
                                                            </button>
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div key="t-bulk" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="space-y-2">
                                                            <div className="relative">
                                                                <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="Ejemplo: Juan Perez <juan@mail.com>; Maria 3001234567" rows={4} className="w-full px-3 py-2.5 pb-7 text-[12px] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-400 placeholder:text-slate-400 resize-none" />
                                                                <span className="absolute bottom-3 right-3 text-[9px] text-slate-400 pointer-events-none">Soporta Outlook CSV y Texto</span>
                                                            </div>
                                                            <button onClick={handleBulkProcess} disabled={!bulkText.trim()} className="w-full py-2.5 rounded-xl bg-lime-400 text-slate-950 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-lime-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                                                <AlignJustify size={12} /> Procesar lista
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Send list */}
                                            <AnimatePresence>
                                                {friends.length > 0 && (
                                                    <motion.div key="fl" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Lista de envío ({friends.length})</p>
                                                            <button onClick={() => setFriends([])} className="text-[9px] font-black uppercase tracking-[0.15em] text-rose-400 hover:text-rose-600 transition-colors">Borrar todo</button>
                                                        </div>
                                                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                                            {friends.map((f) => (
                                                                <div key={f.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                                                                    <div className="w-6 h-6 rounded-full bg-lime-100 flex items-center justify-center text-[10px] font-black text-lime-700 shrink-0">
                                                                        {f.name[0]?.toUpperCase()}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[11px] font-bold text-slate-800 truncate">{f.name}</p>
                                                                        <p className="text-[9px] text-slate-400 truncate">{[f.phone, f.email].filter(Boolean).join(' · ') || '—'}</p>
                                                                    </div>
                                                                    {/* Channel toggles */}
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        {(['whatsapp', 'sms', 'email', 'push'] as InviteChannel[]).map((ch) => {
                                                                            const { Icon, color } = CHANNEL_META[ch];
                                                                            const active = f.channels.includes(ch);
                                                                            const canUse = ch === 'push' ? true : ch === 'email' ? !!f.email : !!f.phone;
                                                                            if (!canUse) return null;
                                                                            return (
                                                                                <button key={ch} onClick={() => toggleFriendChannel(f.id, ch)} title={CHANNEL_META[ch].label}
                                                                                    className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors ${active ? color : 'bg-slate-200 text-slate-400'}`}
                                                                                >
                                                                                    <Icon size={10} />
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    <button onClick={() => handleRemoveFriend(f.id)} className="text-slate-300 hover:text-rose-400 transition-colors shrink-0 ml-1">
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Personalizar mensaje */}
                                            <button onClick={openCustomize} className="w-full py-3 rounded-2xl bg-lime-400 text-slate-950 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-lime-500 transition-colors flex items-center justify-center gap-2">
                                                Personalizar mensaje <Send size={13} />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* ══ SCREEN 2: CUSTOMIZE ══ */}
                                {screen === 'customize' && (
                                    <motion.div key="s-custom" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="flex flex-col overflow-hidden">
                                        {/* Header */}
                                        <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0">
                                            <div className="w-10 h-10 rounded-2xl bg-slate-950 flex items-center justify-center shrink-0">
                                                <UserPlus size={18} className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h2 className="text-[12px] font-black uppercase tracking-[0.22em] text-slate-900">Personalizar</h2>
                                                <p className="text-[11px] text-slate-400 mt-0.5">{friends.length} Invitados</p>
                                            </div>
                                            <button onClick={() => setScreen('invite')} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                                                <ArrowLeft size={15} />
                                            </button>
                                        </div>

                                        <div className="px-5 pb-5 space-y-4 overflow-y-auto">
                                            {/* Channel tabs */}
                                            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                                {(['whatsapp', 'sms', 'email', 'push'] as InviteChannel[]).filter((ch) =>
                                                    activeChannels.length === 0 || activeChannels.includes(ch)
                                                ).map((ch) => {
                                                    const { label, Icon } = CHANNEL_META[ch];
                                                    return (
                                                        <button key={ch} onClick={() => setMsgChannel(ch)}
                                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.12em] transition-all ${msgChannel === ch ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            <Icon size={11} /> {label}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Template selector */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Plantilla</p>
                                                    <button onClick={() => void handleImproveWithAI()} disabled={aiLoading}
                                                        className="flex items-center gap-1 text-[9px] font-black text-violet-500 hover:text-violet-700 transition-colors disabled:opacity-60"
                                                    >
                                                        {aiLoading ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="inline-block"><Sparkles size={11} /></motion.span> : <Sparkles size={11} />}
                                                        Mejorar con IA
                                                    </button>
                                                </div>
                                                <div className="flex gap-2">
                                                    {(['amigable', 'retador', 'formal'] as InviteTone[]).map((t) => (
                                                        <button key={t} onClick={() => setTone(t)}
                                                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black capitalize transition-all ${tone === t ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                                        >
                                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Message editor */}
                                            {msgChannel === 'email' && (
                                                <div className="flex gap-2">
                                                    {(['texto', 'preview'] as const).map((v) => (
                                                        <button key={v} onClick={() => setEmailPreview(v === 'preview')}
                                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all ${(v === 'preview') === emailPreview ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-500'}`}
                                                        >
                                                            {v === 'texto' ? 'Texto' : 'Vista previa'}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {msgChannel === 'push' && (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 rounded-xl border border-violet-100">
                                                    <Bell size={12} className="text-violet-500 shrink-0" />
                                                    <p className="text-[10px] text-violet-600">Notificación push en la app · se enviará a los usuarios que tengan la app abierta o permisos activos.</p>
                                                </div>
                                            )}

                                            {msgChannel === 'email' && emailPreview ? (
                                                <div className="rounded-xl border border-slate-200 p-3 text-[12px] text-slate-700 leading-relaxed min-h-[120px] bg-slate-50"
                                                    dangerouslySetInnerHTML={{ __html: emailHtml }}
                                                />
                                            ) : (
                                                <div className="relative">
                                                    <textarea
                                                        ref={textareaRef}
                                                        value={msgText}
                                                        onChange={(e) => setMsgText(e.target.value)}
                                                        rows={msgChannel === 'email' ? 6 : 4}
                                                        className="w-full px-3 py-2.5 text-[12px] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
                                                    />
                                                </div>
                                            )}

                                            {/* Variable chips */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {['{nombre}', '{liga}', '{link}'].map((v) => (
                                                    <button key={v} onClick={() => insertVar(v)}
                                                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-mono text-slate-600 hover:bg-slate-200 transition-colors"
                                                    >
                                                        {v}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Footer actions */}
                                            <div className="flex gap-3 pt-1">
                                                <button onClick={() => setScreen('invite')} className="w-10 h-10 flex items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors shrink-0">
                                                    <ArrowLeft size={16} />
                                                </button>
                                                <button onClick={handleSendInvitations} disabled={friends.length === 0}
                                                    className="flex-1 py-2.5 rounded-2xl bg-lime-400 text-slate-950 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-lime-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    {sent ? <><CheckCircle2 size={13} /> Enviado</> : <>Enviar invitaciones <Send size={13} /></>}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

/* ─── League Config Modal ──────────────────────────────────────── */

interface LeagueFullResponse {
    id: string;
    name: string;
    description?: string | null;
    privacy?: 'PUBLIC' | 'PRIVATE';
    maxParticipants?: number | null;
    includeBaseFee?: boolean;
    baseFee?: number | null;
    currency?: string | null;
    adminFeePercent?: number;
    includeStageFees?: boolean;
    closePredictionMinutes?: number | null;
    primaryTournamentId?: string | null;
    primaryTournament?: { id: string; name: string; season: number; logoUrl?: string } | null;
    members?: Array<{
        role: 'ADMIN' | 'PLAYER';
        status: string;
        user?: { id?: string; name?: string | null; username?: string | null; avatar?: string | null };
    }>;
    stageFees?: Array<{ id: string; type: string; label: string; amount: number; active: boolean }>;
    distributions?: Array<{ id: string; category: string; position: number; label: string; percentage: number; active: boolean }>;
    _count?: { members?: number };
}

interface StageFeeLocal { type: 'MATCH' | 'ROUND' | 'PHASE'; label: string; amount: number; active: boolean }
interface DistLocal { position: number; percentage: number }

const STAGE_DEFAULTS: StageFeeLocal[] = [
    { type: 'MATCH', label: 'Partido', amount: 2000, active: false },
    { type: 'ROUND', label: 'Ronda', amount: 5000, active: false },
    { type: 'PHASE', label: 'Fase', amount: 10000, active: false },
];

function defaultDist(count: number): DistLocal[] {
    const presets: Record<number, number[]> = {
        1: [100], 2: [65, 35], 3: [60, 30, 10], 4: [50, 25, 15, 10], 5: [45, 25, 15, 10, 5],
    };
    const pcts = presets[count] ?? Array(count).fill(Math.floor(100 / count));
    return pcts.map((p, i) => ({ position: i + 1, percentage: p }));
}

function fmtCOP(n: number) {
    try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n); }
    catch { return `$${n.toLocaleString('es-CO')}`; }
}

const LeagueConfigModal: React.FC<{
    open: boolean;
    onClose: () => void;
    leagueId?: string;
    memberCount?: number;
    onSaved?: () => void;
    onInvite?: () => void;
}> = ({ open, onClose, leagueId, memberCount = 0, onSaved, onInvite }) => {
    const [tab, setTab] = useState<'details' | 'prizes' | 'participants'>('details');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // ── Details ──
    const [lName, setLName] = useState('');
    const [desc, setDesc] = useState('');
    const [privacy, setPrivacy] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
    const [includeBaseFee, setIncludeBaseFee] = useState(true);
    const [baseFee, setBaseFee] = useState(0);
    const [includeStageFees, setIncludeStageFees] = useState(false);
    const [stageFees, setStageFees] = useState<StageFeeLocal[]>(STAGE_DEFAULTS);

    // ── Prizes ──
    const [adminPct, setAdminPct] = useState(10);
    const [prizeTab, setPrizeTab] = useState<'GENERAL' | 'MATCH' | 'ROUND' | 'PHASE'>('GENERAL');
    const [positions, setPositions] = useState(3);
    const [dists, setDists] = useState<Record<string, DistLocal[]>>({ GENERAL: defaultDist(3) });

    // ── Derived: which prize categories exist — reactive to current stageFees state ──
    const availablePrizeTabs = useMemo<Array<'GENERAL' | 'MATCH' | 'ROUND' | 'PHASE'>>(() => {
        const tabs: Array<'GENERAL' | 'MATCH' | 'ROUND' | 'PHASE'> = ['GENERAL'];
        if (includeStageFees) {
            if (stageFees.some((sf) => sf.type === 'MATCH' && sf.active)) tabs.push('MATCH');
            if (stageFees.some((sf) => sf.type === 'ROUND' && sf.active)) tabs.push('ROUND');
            if (stageFees.some((sf) => sf.type === 'PHASE' && sf.active)) tabs.push('PHASE');
        }
        return tabs;
    }, [includeStageFees, stageFees]);

    // ── Tournament ──
    const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
    const [tournaments, setTournaments] = useState<Array<{ id: string; name: string; country?: string; season: number; active: boolean }>>([]);
    const [tournamentsLoaded, setTournamentsLoaded] = useState(false);

    // ── Participants ──
    const [maxPart, setMaxPart] = useState(50);
    const [members, setMembers] = useState<LeagueFullResponse['members']>([]);
    const [removingId, setRemovingId] = useState<string | null>(null);

    // ── Load on open ──
    useEffect(() => {
        if (!open || !leagueId) return;
        setLoading(true);
        request<LeagueFullResponse>(`/leagues/${leagueId}`)
            .then((data) => {
                setLName(data.name ?? '');
                setDesc(data.description ?? '');
                setPrivacy(data.privacy ?? 'PRIVATE');
                setIncludeBaseFee(data.includeBaseFee ?? true);
                setBaseFee(data.baseFee ?? 0);
                const hasStage = data.includeStageFees ?? false;
                setIncludeStageFees(hasStage);
                setAdminPct(data.adminFeePercent ?? 10);
                setMaxPart(data.maxParticipants ?? 50);
                setMembers(data.members ?? []);
                setSelectedTournamentId(data.primaryTournamentId ?? '');

                // Stage fees — only show rows for types that were configured
                if (data.stageFees?.length) {
                    setStageFees(STAGE_DEFAULTS.map((def) => {
                        const found = data.stageFees!.find((sf) => sf.type === def.type);
                        return found ? { ...def, amount: found.amount, active: found.active } : { ...def, active: false };
                    }));
                } else {
                    setStageFees(STAGE_DEFAULTS.map((d) => ({ ...d, active: false })));
                }

                setPrizeTab('GENERAL');

                // Load distributions per category
                const newDists: Record<string, DistLocal[]> = {};
                for (const cat of ['GENERAL', 'MATCH', 'ROUND', 'PHASE']) {
                    const catRows = data.distributions?.filter((d) => d.category === cat) ?? [];
                    if (catRows.length) {
                        newDists[cat] = catRows.map((d) => ({ position: d.position, percentage: d.percentage }));
                    } else {
                        newDists[cat] = defaultDist(cat === 'GENERAL' ? 3 : 1);
                    }
                }
                setDists(newDists);
                setPositions((newDists['GENERAL'] ?? defaultDist(3)).length);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [open, leagueId]);

    // Cargar lista de torneos disponibles al abrir el modal
    useEffect(() => {
        if (!open || tournamentsLoaded) return;
        request<Array<{ id: string; name: string; country?: string; season: number; active: boolean }>>('/leagues/tournaments')
            .then((data) => { setTournaments(data); setTournamentsLoaded(true); })
            .catch(() => setTournamentsLoaded(true));
    }, [open, tournamentsLoaded]);

    // If active prizeTab becomes unavailable (user deactivated that fee), reset to GENERAL
    useEffect(() => {
        if (!availablePrizeTabs.includes(prizeTab)) {
            setPrizeTab('GENERAL');
        }
    }, [availablePrizeTabs, prizeTab]);

    // Sync positions counter → only affects the active prizeTab's distribution
    useEffect(() => {
        setDists((prev) => ({ ...prev, [prizeTab]: defaultDist(positions) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [positions]);

    // Sync positions counter when switching prize tabs
    useEffect(() => {
        const tabDist = dists[prizeTab];
        if (tabDist) setPositions(tabDist.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prizeTab]);

    const currentDist = dists[prizeTab] ?? defaultDist(positions);
    const totalPct = currentDist.reduce((s, d) => s + d.percentage, 0);
    // Pool is based on the fee for the active prize category
    const tabFee = prizeTab === 'GENERAL'
        ? baseFee
        : (stageFees.find((sf) => sf.type === prizeTab)?.amount ?? 0);
    const grossPool = tabFee * memberCount;
    const adminCut = Math.round(grossPool * adminPct / 100);
    const netPool = grossPool - adminCut;
    const poolLabel = prizeTab === 'GENERAL' ? 'Fondo general'
        : prizeTab === 'MATCH' ? 'Fondo por partido'
        : prizeTab === 'ROUND' ? 'Fondo por ronda'
        : 'Fondo por fase';

    const handleSaveDetails = async () => {
        if (!leagueId) return;
        setSaving(true);
        try {
            await request(`/leagues/${leagueId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    name: lName.trim() || undefined,
                    description: desc.trim() || undefined,
                    privacy,
                    includeBaseFee,
                    baseFee: includeBaseFee ? baseFee : undefined,
                    includeStageFees,
                    stageFees: includeStageFees ? stageFees.map((sf) => ({
                        type: sf.type, label: sf.label, amount: sf.amount, active: sf.active,
                    })) : undefined,
                }),
            });
            // Guardar torneo (no bloquea si la migración aún no está aplicada)
            await request(`/leagues/${leagueId}/tournament`, {
                method: 'PATCH',
                body: JSON.stringify({ tournamentId: selectedTournamentId || null }),
            }).catch(() => {});
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            onSaved?.();
        } catch { /* show nothing – form keeps state */ }
        finally { setSaving(false); }
    };

    const handleSavePrizes = async () => {
        if (!leagueId) return;
        setSaving(true);
        try {
            await request(`/leagues/${leagueId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    adminFeePercent: adminPct,
                    distributions: Object.entries(dists).flatMap(([cat, catDists]) =>
                        catDists.map((d) => ({
                            category: cat,
                            position: d.position,
                            label: `${d.position}° Puesto`,
                            percentage: d.percentage,
                            active: true,
                        })),
                    ),
                }),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            onSaved?.();
        } catch { }
        finally { setSaving(false); }
    };

    const handleSaveParticipants = async () => {
        if (!leagueId) return;
        setSaving(true);
        try {
            await request(`/leagues/${leagueId}`, {
                method: 'PATCH',
                body: JSON.stringify({ maxParticipants: maxPart }),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            onSaved?.();
        } catch { }
        finally { setSaving(false); }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!leagueId) return;
        setRemovingId(userId);
        try {
            await request(`/leagues/${leagueId}/members/${userId}`, { method: 'DELETE' });
            setMembers((prev) => prev?.filter((m) => m.user?.id !== userId));
        } catch { }
        finally { setRemovingId(null); }
    };

    const activeMemberCount = members?.filter((m) => m.status === 'ACTIVE').length ?? 0;

    const inputCls = 'w-full px-4 py-3 text-[13px] font-medium rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-500 transition-all placeholder:text-slate-400 text-slate-900 bg-white';

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 10 }} transition={{ duration: 0.26, ease: 'easeOut' as const }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4"
                    >
                        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                            {/* Header */}
                            <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0">
                                <div className="w-10 h-10 rounded-2xl bg-slate-950 flex items-center justify-center shrink-0">
                                    <Settings size={18} className="text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-[12px] font-black uppercase tracking-[0.22em] text-slate-900">Configuración</h2>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Administra tu liga</p>
                                </div>
                                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 px-5 pb-3 shrink-0">
                                {(['details', 'prizes', 'participants'] as const).map((t) => (
                                    <button key={t} onClick={() => setTab(t)}
                                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all ${tab === t ? 'bg-slate-950 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {t === 'details' ? 'Detalles' : t === 'prizes' ? 'Premios' : 'Participantes'}
                                    </button>
                                ))}
                            </div>

                            {loading ? (
                                <div className="flex-1 flex items-center justify-center py-12">
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                        <Settings size={24} className="text-slate-300" />
                                    </motion.div>
                                </div>
                            ) : (
                                <AnimatePresence mode="wait">

                                    {/* ══ DETALLES ══ */}
                                    {tab === 'details' && (
                                        <motion.div key="t-det" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}
                                            className="flex-1 overflow-y-auto px-5 pb-5 space-y-4"
                                        >
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1.5">Nombre de la liga</p>
                                                <input value={lName} onChange={(e) => setLName(e.target.value)} className={inputCls} placeholder="Nombre de la liga" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1.5">Descripción</p>
                                                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Describe tu liga..." />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1.5">Privacidad</p>
                                                <div className="flex gap-2">
                                                    {(['PRIVATE', 'PUBLIC'] as const).map((p) => (
                                                        <button key={p} onClick={() => setPrivacy(p)}
                                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black transition-all ${privacy === p ? 'bg-slate-950 text-white' : 'border border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                                        >
                                                            {p === 'PRIVATE' ? <Lock size={12} /> : <Globe size={12} />}
                                                            {p === 'PRIVATE' ? 'Privada' : 'Pública'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Torneo vinculado */}
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1.5">Torneo</p>
                                                {!tournamentsLoaded ? (
                                                    <div className={`${inputCls} text-slate-400 text-xs cursor-default`}>Cargando torneos...</div>
                                                ) : tournaments.length === 0 ? (
                                                    <div className={`${inputCls} text-slate-400 text-xs cursor-default`}>Sin torneos importados en el sistema</div>
                                                ) : (
                                                    <div className="relative">
                                                        <Trophy size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        <select
                                                            value={selectedTournamentId}
                                                            onChange={(e) => setSelectedTournamentId(e.target.value)}
                                                            className="w-full appearance-none pl-9 pr-8 py-3 text-[13px] font-medium rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-lime-500 transition-all text-slate-900 bg-white"
                                                        >
                                                            <option value="">Sin torneo</option>
                                                            {tournaments.map((t) => (
                                                                <option key={t.id} value={t.id}>
                                                                    {t.name}{t.season ? ` ${t.season}` : ''}{t.country ? ` — ${t.country}` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Configuración financiera */}
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-2">Configuración financiera</p>
                                                <div className={`rounded-2xl border-2 p-3.5 space-y-3 ${includeBaseFee ? 'border-lime-400' : 'border-slate-200'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Coins size={13} className="text-slate-500" />
                                                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-700">Cuota general</span>
                                                        </div>
                                                        <button onClick={() => setIncludeBaseFee((v) => !v)}
                                                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${includeBaseFee ? 'bg-lime-400 text-slate-950' : 'border-2 border-slate-200'}`}
                                                        >
                                                            {includeBaseFee && <CheckCircle2 size={12} />}
                                                        </button>
                                                    </div>
                                                    {includeBaseFee && (
                                                        <div className="flex items-center gap-2 border border-slate-300 rounded-2xl px-3 py-3 bg-white focus-within:ring-2 focus-within:ring-lime-400 focus-within:border-lime-500 transition-all">
                                                            <span className="text-[12px] font-bold text-slate-400 shrink-0">$</span>
                                                            <input type="number" value={baseFee} onChange={(e) => setBaseFee(Number(e.target.value))} className="flex-1 text-[13px] font-medium text-slate-900 outline-none bg-transparent" placeholder="0" />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className={`rounded-2xl border-2 p-3.5 space-y-2 mt-2 ${includeStageFees ? 'border-lime-400' : 'border-slate-200'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Clock size={13} className="text-slate-500" />
                                                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-700">Costos por etapa</span>
                                                        </div>
                                                        <button onClick={() => setIncludeStageFees((v) => !v)}
                                                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${includeStageFees ? 'bg-lime-400 text-slate-950' : 'border-2 border-slate-200'}`}
                                                        >
                                                            {includeStageFees && <CheckCircle2 size={12} />}
                                                        </button>
                                                    </div>
                                                    {includeStageFees && stageFees.map((sf, idx) => (
                                                        <div key={sf.type} className="flex items-center gap-2">
                                                            <button onClick={() => setStageFees((prev) => prev.map((s, i) => i === idx ? { ...s, active: !s.active } : s))}
                                                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${sf.active ? 'bg-lime-400 text-slate-950' : 'border-2 border-slate-200'}`}
                                                            >
                                                                {sf.active && <CheckCircle2 size={10} />}
                                                            </button>
                                                            <span className="text-[11px] font-bold text-slate-600 w-14 shrink-0">{sf.label}</span>
                                                            <div className={`flex items-center gap-1.5 flex-1 border rounded-xl px-2 py-1.5 bg-white focus-within:ring-2 focus-within:ring-lime-400 focus-within:border-lime-500 transition-all ${sf.active ? 'border-slate-300' : 'border-slate-200 opacity-60'}`}>
                                                                <span className="text-[11px] font-bold text-slate-400 shrink-0">$</span>
                                                                <input type="number" value={sf.amount}
                                                                    onChange={(e) => setStageFees((prev) => prev.map((s, i) => i === idx ? { ...s, amount: Number(e.target.value) } : s))}
                                                                    className="flex-1 text-[12px] font-medium text-right text-slate-900 outline-none bg-transparent"
                                                                    disabled={!sf.active}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <button onClick={() => void handleSaveDetails()} disabled={saving}
                                                className="w-full py-3.5 rounded-2xl bg-slate-950 text-white text-[10px] font-black uppercase tracking-[0.22em] hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {saved ? <><CheckCircle2 size={14} className="text-lime-400" /> Guardado</> : saving ? 'Guardando...' : 'Guardar cambios'}
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* ══ PREMIOS ══ */}
                                    {tab === 'prizes' && (
                                        <motion.div key="t-pri" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}
                                            className="flex-1 overflow-y-auto px-5 pb-5 space-y-4"
                                        >
                                            {/* Admin % slider */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">% Admin</p>
                                                    <span className="text-[13px] font-black text-lime-600">{adminPct}%</span>
                                                </div>
                                                <input type="range" min={0} max={50} value={adminPct} onChange={(e) => setAdminPct(Number(e.target.value))}
                                                    className="w-full accent-lime-400" />
                                            </div>

                                            {/* Prize category tabs */}
                                            {availablePrizeTabs.length > 1 && (
                                                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                                    {availablePrizeTabs.map((pt) => (
                                                        <button key={pt} onClick={() => setPrizeTab(pt)}
                                                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.12em] transition-all ${prizeTab === pt ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            {pt === 'MATCH' ? 'Partido' : pt === 'ROUND' ? 'Ronda' : pt === 'PHASE' ? 'Fase' : 'General'}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Positions counter */}
                                            <div className={`rounded-2xl border-2 p-3.5 ${true ? 'border-lime-400' : 'border-slate-200'}`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={13} className="text-slate-500" />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-700">Puestos a premiar</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => setPositions((p) => Math.max(1, p - 1))} className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="text-[15px] font-black text-slate-900 w-5 text-center">{positions}</span>
                                                        <button onClick={() => setPositions((p) => Math.min(10, p + 1))} className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Distribution rows */}
                                            <div className="space-y-2.5">
                                                {currentDist.map((d, idx) => {
                                                    const prizeAmt = Math.round(netPool * d.percentage / (100 - adminPct || 1));
                                                    return (
                                                        <div key={d.position} className="flex items-center gap-3">
                                                            <span className="text-[11px] font-black text-slate-500 w-16 shrink-0">{d.position}° Puesto</span>
                                                            <div className="flex items-center border border-slate-300 rounded-xl focus-within:ring-2 focus-within:ring-lime-400 focus-within:border-lime-500 transition-all bg-white overflow-hidden flex-1">
                                                                <input type="number" value={d.percentage} min={0} max={100}
                                                                    onChange={(e) => setDists((prev) => ({
                                                                        ...prev,
                                                                        [prizeTab]: (prev[prizeTab] ?? []).map((x, i) => i === idx ? { ...x, percentage: Number(e.target.value) } : x),
                                                                    }))}
                                                                    className="w-12 text-center px-2 py-2 text-[12px] font-medium outline-none bg-transparent text-slate-900"
                                                                />
                                                                <span className="text-[11px] text-slate-400 pr-2">%</span>
                                                            </div>
                                                            <span className="text-[12px] font-black text-lime-600 shrink-0 min-w-[4rem] text-right">
                                                                {netPool > 0 ? fmtCOP(prizeAmt) : '—'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Summary bar */}
                                            <div className="rounded-2xl bg-slate-950 p-4 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">{poolLabel}</p>
                                                        <p className="text-[18px] font-black text-white mt-0.5">{grossPool > 0 ? fmtCOP(grossPool) : '—'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-rose-400">Admin ({adminPct}%)</p>
                                                        <p className="text-[14px] font-black text-rose-300 mt-0.5">{adminCut > 0 ? fmtCOP(adminCut) : '—'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Bolsa neta</p>
                                                    <p className="text-[13px] font-black text-lime-400">{netPool > 0 ? fmtCOP(netPool) : '—'}</p>
                                                </div>
                                            </div>
                                            {totalPct !== 100 - adminPct && totalPct > 0 && (
                                                <p className="text-[10px] text-amber-500 text-center">Los porcentajes suman {totalPct}% (deberían ser {100 - adminPct}%)</p>
                                            )}

                                            <button onClick={() => void handleSavePrizes()} disabled={saving}
                                                className="w-full py-3.5 rounded-2xl bg-slate-950 text-white text-[10px] font-black uppercase tracking-[0.22em] hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {saved ? <><CheckCircle2 size={14} className="text-lime-400" /> Guardado</> : saving ? 'Guardando...' : 'Confirmar premios'}
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* ══ PARTICIPANTES ══ */}
                                    {tab === 'participants' && (
                                        <motion.div key="t-par" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}
                                            className="flex-1 overflow-y-auto px-5 pb-5 space-y-4"
                                        >
                                            {/* Max participants */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Cupos máximos</p>
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => setMaxPart((p) => Math.max(activeMemberCount || 2, p - 1))} className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="text-[15px] font-black text-slate-900 w-8 text-center">{maxPart}</span>
                                                        <button onClick={() => setMaxPart((p) => p + 1)} className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-lime-400 rounded-full transition-all" style={{ width: `${Math.min(100, (activeMemberCount / maxPart) * 100)}%` }} />
                                                </div>
                                                <div className="flex justify-between mt-1">
                                                    <span className="text-[9px] text-slate-400">Ocupados: {activeMemberCount}</span>
                                                    <span className="text-[9px] text-slate-400">Límite plan: {maxPart}</span>
                                                </div>
                                            </div>

                                            <button onClick={() => { onClose(); onInvite?.(); }}
                                                className="w-full py-3 rounded-2xl bg-lime-400 text-slate-950 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-lime-500 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <UserPlus size={14} /> Invitar participantes
                                            </button>

                                            {/* Members list */}
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 mb-2">Lista de jugadores</p>
                                                <div className="space-y-2">
                                                    {members?.map((m, idx) => {
                                                        const isAdmin = m.role === 'ADMIN';
                                                        const uid = m.user?.id ?? `m-${idx}`;
                                                        const displayName = m.user?.name?.trim() || m.user?.username?.trim() || 'Miembro';
                                                        const avatar = resolveApiAssetUrl(m.user?.avatar);
                                                        return (
                                                            <div key={uid} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-2xl">
                                                                {avatar ? (
                                                                    <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0">
                                                                        {displayName[0]?.toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className="text-[12px] font-bold text-slate-800 truncate">{displayName.toUpperCase()}</p>
                                                                        {isAdmin && <span className="text-amber-400 text-[10px]">👑</span>}
                                                                    </div>
                                                                    <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${m.status === 'ACTIVE' ? 'text-lime-500' : 'text-slate-400'}`}>
                                                                        {m.status === 'ACTIVE' ? 'Activo' : 'Pendiente'}
                                                                    </p>
                                                                </div>
                                                                {!isAdmin && m.user?.id && (
                                                                    <button onClick={() => void handleRemoveMember(m.user!.id!)} disabled={removingId === m.user?.id}
                                                                        className="w-7 h-7 flex items-center justify-center rounded-xl text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-colors shrink-0"
                                                                    >
                                                                        {removingId === m.user?.id
                                                                            ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}><Settings size={13} /></motion.span>
                                                                            : <Trash2 size={13} />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <button onClick={() => void handleSaveParticipants().then(onClose)} disabled={saving}
                                                className="w-full py-3.5 rounded-2xl bg-slate-950 text-white text-[10px] font-black uppercase tracking-[0.22em] hover:bg-slate-800 transition-colors disabled:opacity-50"
                                            >
                                                Cerrar
                                            </button>
                                        </motion.div>
                                    )}

                                </AnimatePresence>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

/* ─── Dashboard ────────────────────────────────────────────────── */

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const leagueLoading = useLeagueStore((state) => state.isLoading);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const fetchLeagueDetails = useLeagueStore((state) => state.fetchLeagueDetails);
    const setActiveLeague = useLeagueStore((state) => state.setActiveLeague);
    const matches = usePredictionStore((state) => state.matches);
    const leaderboard = usePredictionStore((state) => state.leaderboard);
    const savePrediction = usePredictionStore((state) => state.savePrediction);
    const fetchLeagueMatches = usePredictionStore((state) => state.fetchLeagueMatches);
    const fetchLeaderboard = usePredictionStore((state) => state.fetchLeaderboard);
    const resetLeagueData = usePredictionStore((state) => state.resetLeagueData);
    const stats = useDashboardStore((state) => state.stats);
    const predictions = useDashboardStore((state) => state.predictions);
    const dashboardLoading = useDashboardStore((state) => state.loading);
    const dashboardError = useDashboardStore((state) => state.error);
    const fetchDashboardData = useDashboardStore((state) => state.fetchDashboardData);

    const [error, setError] = useState<string | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const [spectatorMode, setSpectatorMode] = useState(false);
    const [leagueDropOpen, setLeagueDropOpen] = useState(false);
    const [quickPreds, setQuickPreds] = useState<Record<string, { home: string; away: string }>>({});
    const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
    const [scoringTab, setScoringTab] = useState<'resultado' | 'bonos' | 'desempate'>('resultado');
    const [currentTime, setCurrentTime] = useState(() => Date.now());

    const isLoading = leagueLoading || dashboardLoading;
    const isRealAdmin = activeLeague?.role === 'ADMIN' || isSuperAdmin();
    const isAdmin = isRealAdmin && !spectatorMode;

    const upcomingMatches = useMemo(() => matches.filter((m) => m.status === 'open').slice(0, 3), [matches]);
    const nextUnsaved = useMemo(() => matches.find((m) => m.status === 'open' && !m.saved), [matches]);
    const topPlayers = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

    // My position in leaderboard
    const myEntry = useMemo(
        () => leaderboard.find((p) => p.id === user?.id || p.username === user?.username),
        [leaderboard, user],
    );

    // Last correct prediction
    const lastHit = useMemo(
        () => predictions?.find((p) => p.acierto),
        [predictions],
    );

    const prizes = useMemo(() => calcPrizes(
        activeLeague?.settings.baseFee,
        activeLeague?.stats.memberCount,
        activeLeague?.settings.currency ?? 'COP',
    ), [activeLeague]);

    const memberCount = activeLeague?.stats.memberCount ?? 0;
    const maxParticipants = activeLeague?.settings.maxParticipants ?? 0;
    const occupancyPct = maxParticipants > 0 ? Math.min(100, Math.round((memberCount / maxParticipants) * 100)) : 0;

    const buildLeagueLabel = useCallback((league: {
        name: string;
        code?: string;
        stats?: { memberCount?: number; points?: number };
    }) => {
        const suffix: string[] = [];
        if (league.code) suffix.push(`Código ${league.code}`);
        if (typeof league.stats?.memberCount === 'number') suffix.push(`${league.stats.memberCount} participantes`);
        if (typeof league.stats?.points === 'number' && league.stats.points > 0) suffix.push(`${league.stats.points} pts`);
        return suffix.length > 0 ? `${league.name} · ${suffix.join(' · ')}` : league.name;
    }, []);

    const buildLeagueMeta = useCallback((league?: {
        code?: string;
        stats?: { memberCount?: number; points?: number };
    } | null) => {
        if (!league) return [] as string[];
        const meta: string[] = [];
        if (league.code) meta.push(`Código ${league.code}`);
        if (typeof league.stats?.memberCount === 'number') meta.push(`${league.stats.memberCount} participantes`);
        if (typeof league.stats?.points === 'number' && league.stats.points > 0) meta.push(`${league.stats.points} pts`);
        return meta;
    }, []);

    const getQuickDraft = useCallback((match: MatchViewModel) => {
        const draft = quickPreds[match.id];
        return {
            home: draft?.home ?? match.prediction.home ?? '',
            away: draft?.away ?? match.prediction.away ?? '',
        };
    }, [quickPreds]);

    const handleDashboardRetry = useCallback(() => {
        void fetchDashboardData(true);
    }, [fetchDashboardData]);

    useEffect(() => {
        if (user) void fetchDashboardData().catch(() => {});
    }, [user, fetchDashboardData]);

    useEffect(() => {
        if (myLeagues.length > 0) return;
        void fetchMyLeagues().catch((e) => {
            setError(e instanceof Error ? e.message : 'No fue posible cargar tus ligas.');
        });
    }, [fetchMyLeagues, myLeagues.length]);

    useEffect(() => {
        const interval = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!activeLeague?.id) { resetLeagueData(); return; }
        setError(null);
        void Promise.all([
            fetchLeagueDetails(activeLeague.id),
            fetchLeagueMatches(activeLeague.id),
            fetchLeaderboard(activeLeague.id),
        ]).catch((e) => {
            setError(e instanceof Error ? e.message : 'No fue posible cargar la liga activa.');
        });
    }, [activeLeague?.id, fetchLeagueDetails, fetchLeagueMatches, fetchLeaderboard, resetLeagueData]);

    const handleQuickSave = async (match: MatchViewModel) => {
        if (!activeLeague?.id) return;
        const pred = getQuickDraft(match);
        const home = parseInt(pred?.home ?? '0', 10);
        const away = parseInt(pred?.away ?? '0', 10);
        if (isNaN(home) || isNaN(away)) return;
        if (isPredictionWindowClosed(match.date, activeLeague?.settings?.closePredictionMinutes, currentTime)) {
            setError('La ventana para cambiar este pronóstico ya cerró.');
            return;
        }

        setSavingMatchId(match.id);
        try {
            await savePrediction(activeLeague.id, match.id, home, away);
            await fetchLeagueMatches(activeLeague.id);
            setQuickPreds((p) => { const n = { ...p }; delete n[match.id]; return n; });
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No fue posible guardar el pronóstico.');
        } finally {
            setSavingMatchId(null);
        }
    };

    /* ── Empty state ── */
    if (!isLoading && myLeagues.length === 0 && !error) {
        return (
            <motion.div {...fade()} className="space-y-5">
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                    <motion.div
                        animate={{ y: [0, -6, 0] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-lime-100 text-lime-600"
                    >
                        <Trophy size={28} />
                    </motion.div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Aún no tienes ligas</h1>
                    <p className="mx-auto mt-3 max-w-xs text-sm text-slate-500">
                        Crea tu primera polla o únete con un código para comenzar.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <button className="rounded-2xl bg-lime-400 px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-900 hover:bg-lime-500 transition-colors" onClick={() => navigate('/create-league')}>
                            Crear liga
                        </button>
                        <button className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50 transition-colors" onClick={() => navigate('/join')}>
                            Unirme con código
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="space-y-5 pb-10">

            {/* ── Spectator banner ── */}
            <AnimatePresence>
                {spectatorMode && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25, ease: 'easeOut' as const }}
                        className="flex items-center justify-between gap-4 rounded-2xl bg-violet-600 px-5 py-3"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <Eye size={16} className="text-violet-200 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">Modo espectador activo</p>
                                <p className="text-[11px] text-violet-200 hidden sm:block">Estás viendo la liga como un participante.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSpectatorMode(false)}
                            className="flex-shrink-0 rounded-xl border border-violet-400 bg-white/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white hover:bg-white/20 transition-colors"
                        >
                            Volver a admin
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Header ── */}
            <motion.header {...fade(0)} className="space-y-3">
                {/* Badge row */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Role badge */}
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                        isAdmin ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                        {isAdmin ? 'Administrador' : 'Participante'}
                    </span>

                    {/* Spectator toggle */}
                    {isRealAdmin && (
                        <button
                            onClick={() => setSpectatorMode((v) => !v)}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                                spectatorMode
                                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600'
                            }`}
                        >
                            {spectatorMode ? <><EyeOff size={11} /> Salir de espectador</> : <><Eye size={11} /> Ver como espectador</>}
                        </button>
                    )}

                    {/* Plan badge — shows the authenticated user's plan tier */}
                    {user?.plan && (
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                            user.plan === 'DIAMOND'
                                ? 'border-purple-300 bg-purple-50 text-purple-700'
                                : user.plan === 'GOLD'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}>
                            Plan {user.plan}
                        </span>
                    )}
                </div>

                {/* Title + action row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* League name dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setLeagueDropOpen((v) => !v)}
                            className="flex items-start gap-2 text-left group"
                        >
                            <div className="space-y-1">
                                <h1 className="text-3xl font-black font-brand uppercase tracking-tight text-slate-900 sm:text-4xl group-hover:text-lime-700 transition-colors leading-none">
                                    {activeLeague?.name ?? 'Sin liga'}
                                </h1>
                                {activeLeague && buildLeagueMeta(activeLeague).length > 0 ? (
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:text-[11px]">
                                        {buildLeagueMeta(activeLeague).join(' · ')}
                                    </p>
                                ) : null}
                            </div>
                            <motion.div animate={{ rotate: leagueDropOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="mt-1">
                                <ChevronDown size={20} className="text-slate-400 group-hover:text-lime-600 transition-colors" />
                            </motion.div>
                        </button>

                        <AnimatePresence>
                            {leagueDropOpen && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setLeagueDropOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                        transition={{ duration: 0.16, ease: 'easeOut' as const }}
                                        className="absolute top-full mt-2 left-0 z-30 min-w-[240px] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
                                    >
                                        {myLeagues.map((league) => (
                                            <button
                                                key={league.id}
                                                onClick={() => { setActiveLeague(league.id); setLeagueDropOpen(false); setSpectatorMode(false); }}
                                                className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${
                                                    league.id === activeLeague?.id ? 'bg-lime-50 text-lime-700' : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                {buildLeagueLabel(league)}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Header action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Quick predict button */}
                        {nextUnsaved && (
                            <button
                                onClick={() => navigate('/predictions')}
                                title="Pronosticar"
                                className="flex items-center gap-2 rounded-2xl bg-lime-400 px-3 py-2.5 sm:px-4 text-sm font-black uppercase tracking-wide text-slate-950 hover:bg-lime-500 transition-all"
                            >
                                <Zap size={15} />
                                <span className="hidden sm:inline">Pronosticar</span>
                            </button>
                        )}
                        {activeLeague?.code && (
                            <button
                                onClick={() => setInviteOpen(true)}
                                title="Invitar"
                                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 text-sm font-black uppercase tracking-wide text-slate-700 hover:border-slate-300 transition-all"
                            >
                                <Share2 size={15} />
                                <span className="hidden sm:inline">Invitar</span>
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={() => setConfigOpen(true)}
                                title="Configurar"
                                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 text-sm font-black uppercase tracking-wide text-slate-700 hover:border-slate-300 transition-all"
                            >
                                <Settings size={15} />
                                <span className="hidden sm:inline">Configurar</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Spectator sub-banner */}
                <AnimatePresence>
                    {spectatorMode && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="flex items-center justify-between gap-3 rounded-xl bg-violet-600 px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                    <Eye size={13} className="text-violet-200" />
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white">Modo espectador activo</p>
                                </div>
                                <button
                                    onClick={() => setSpectatorMode(false)}
                                    className="rounded-lg border border-violet-400 px-3 py-1 text-[10px] font-black uppercase text-white hover:bg-white/10 transition-colors"
                                >
                                    Volver
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.header>

            {/* ── Error banners ── */}
            {dashboardError && <ErrorBanner message={dashboardError} onRetry={handleDashboardRetry} dismissable />}
            {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── Main grid ── */}
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">

                {/* ── Left column ── */}
                <div className="space-y-5">
                    <AnimatePresence mode="wait">
                        {spectatorMode ? (
                            /* ── SPECTATOR: Mi desempeño ── */
                            <motion.div key="spectator-left" {...fade(0.05)} className="space-y-5">
                                {/* Performance card */}
                                <article className="rounded-[1.75rem] overflow-hidden shadow-sm">
                                    <div className="bg-gradient-to-br from-indigo-900 via-violet-900 to-slate-900 p-5 space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Mi desempeño</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Puntos acumulados</p>
                                            </div>
                                            {myEntry && (
                                                <span className="rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white">
                                                    Puesto #{myEntry.rank}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-end gap-4">
                                            <div>
                                                <p className="text-5xl font-black text-white leading-none">
                                                    {myEntry?.points ?? stats?.aciertos ?? 0}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-1">pts totales</p>
                                            </div>
                                            <motion.div
                                                animate={{ y: [0, -4, 0] }}
                                                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                                            >
                                                <TrendingUp size={48} className="text-lime-400 opacity-80" />
                                            </motion.div>
                                        </div>

                                        {lastHit && (
                                            <div className="rounded-xl bg-lime-400 px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-lg bg-lime-600 px-2 py-0.5 text-[11px] font-black text-white">
                                                        +{lastHit.tuPrediccion.includes('-') ? '5' : '2'}
                                                    </span>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-lime-800">Último acierto</p>
                                                        <p className="text-[11px] font-black text-slate-900">{lastHit.match}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </article>

                                {/* Tu próximo reto */}
                                {nextUnsaved ? (
                                    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tu próximo reto</p>
                                            <Clock size={14} className="text-slate-300" />
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-center flex-1">
                                                <p className="text-2xl font-black uppercase text-slate-900">{nextUnsaved.homeTeam?.slice(0, 3)}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{nextUnsaved.homeTeam}</p>
                                            </div>
                                            <span className="text-xs font-bold text-slate-300">vs</span>
                                            <div className="text-center flex-1">
                                                <p className="text-2xl font-black uppercase text-slate-900">{nextUnsaved.awayTeam?.slice(0, 3)}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{nextUnsaved.awayTeam}</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => navigate('/predictions')}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3 text-sm font-black uppercase tracking-wide text-slate-950 hover:bg-lime-500 transition-colors"
                                        >
                                            <Zap size={15} /> Pronosticar
                                        </button>

                                        <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
                                            <Clock size={11} />
                                            <span className="font-bold">{safeText(nextUnsaved.displayDate, nextUnsaved.date)}</span>
                                        </div>
                                    </article>
                                ) : (
                                    <article className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-center space-y-2">
                                        <CheckCircle2 size={24} className="text-lime-500 mx-auto" />
                                        <p className="text-sm font-black text-slate-700">¡Todos los pronósticos guardados!</p>
                                        <p className="text-[11px] text-slate-400">No tienes partidos pendientes.</p>
                                    </article>
                                )}

                                {/* Stats grid */}
                                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Mis estadísticas</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-xl bg-lime-50 p-3 text-center">
                                            <p className="text-xs font-black text-lime-700">Aciertos</p>
                                            <p className="text-2xl font-black text-lime-900">{stats?.aciertos || 0}</p>
                                        </div>
                                        <div className="rounded-xl bg-rose-50 p-3 text-center">
                                            <p className="text-xs font-black text-rose-700">Errores</p>
                                            <p className="text-2xl font-black text-rose-900">{stats?.errores || 0}</p>
                                        </div>
                                        <div className="rounded-xl bg-amber-50 p-3 text-center">
                                            <p className="text-xs font-black text-amber-700">Racha</p>
                                            <p className="text-2xl font-black text-amber-900">{stats?.racha || 0}</p>
                                        </div>
                                        <div className="rounded-xl bg-blue-50 p-3 text-center">
                                            <p className="text-xs font-black text-blue-700">Tasa</p>
                                            <p className="text-2xl font-black text-blue-900">{(stats?.tasa || 0).toFixed(0)}%</p>
                                        </div>
                                    </div>
                                </article>
                            </motion.div>
                        ) : (
                            /* ── ADMIN: Financial column ── */
                            <motion.div key="admin-left" {...fade(0.05)} className="space-y-5">
                                {/* Financial card */}
                                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Estado financiero</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-600">
                                                {activeLeague?.status === 'ACTIVE' ? 'En curso' : (activeLeague?.status ?? '—')}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-1">Recaudo total</p>
                                        <p className="text-3xl font-black font-brand text-slate-900 leading-none">
                                            {prizes.raw > 0 ? prizes.fmt(prizes.raw) : (activeLeague?.stats.totalPrize || '—')}
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
                                            <span className="text-slate-700">{formatCurrency(activeLeague?.settings.baseFee, activeLeague?.settings.currency)}</span>
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

                                {/* Cupos de liga */}
                                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Cupos de liga</p>
                                        <Users size={14} className="text-slate-300" />
                                    </div>
                                    <div>
                                        <div className="flex items-baseline justify-between mb-2">
                                            <span className="text-2xl font-black text-slate-900">
                                                {memberCount}
                                                {maxParticipants > 0 && <span className="text-base font-bold text-slate-400"> / {maxParticipants}</span>}
                                            </span>
                                            {maxParticipants > 0 && <span className="text-[10px] font-black text-slate-400">{occupancyPct}%</span>}
                                        </div>
                                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: maxParticipants > 0 ? `${occupancyPct}%` : '0%' }}
                                                transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' as const }}
                                                className="h-full rounded-full bg-lime-400"
                                            />
                                        </div>
                                        {maxParticipants === 0 && <p className="mt-1 text-[10px] text-slate-400">Sin límite de participantes</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        {isAdmin && (
                                            <button
                                                onClick={() => setConfigOpen(true)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50 transition-colors"
                                            >
                                                <Settings size={13} /> Configurar
                                            </button>
                                        )}
                                        {activeLeague?.code && (
                                            <button
                                                onClick={() => setInviteOpen(true)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-[11px] font-black uppercase tracking-wide text-white hover:bg-slate-800 transition-colors"
                                            >
                                                <Share2 size={13} /> Invitar
                                            </button>
                                        )}
                                    </div>
                                </article>

                                {/* Rules */}
                                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm" aria-label="Reglas de puntos">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Reglas de puntos</h2>
                                        <ListChecks className="h-4 w-4 text-slate-300" aria-hidden="true" />
                                    </div>

                                    {/* Segmented control */}
                                    <div role="tablist" aria-label="Secciones de reglas" className="flex rounded-xl bg-slate-100 p-0.5 gap-0.5 mb-4">
                                        {([
                                            { id: 'resultado', label: 'Resultado' },
                                            { id: 'bonos',     label: 'Bonos' },
                                            { id: 'desempate', label: 'Desempate' },
                                        ] as const).map((tab) => (
                                            <button
                                                key={tab.id}
                                                role="tab"
                                                aria-selected={scoringTab === tab.id}
                                                aria-controls={`scoring-panel-${tab.id}`}
                                                id={`scoring-tab-${tab.id}`}
                                                onClick={() => setScoringTab(tab.id)}
                                                className={`flex-1 rounded-[10px] py-1.5 text-[9px] font-black uppercase tracking-[0.14em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1 ${
                                                    scoringTab === tab.id
                                                        ? 'bg-white text-slate-900 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Panel: Resultado */}
                                    <div
                                        role="tabpanel"
                                        id="scoring-panel-resultado"
                                        aria-labelledby="scoring-tab-resultado"
                                        hidden={scoringTab !== 'resultado'}
                                        className="space-y-1.5"
                                    >
                                        {[
                                            { label: 'Marcador exacto',      sub: 'Ambos goles exactos',              pts: '5 pts', icon: '🎯', accent: 'border-lime-100 bg-lime-50',   text: 'text-lime-700' },
                                            { label: 'Ganador + gol',         sub: 'Resultado + un marcador correcto', pts: '3 pts', icon: '✅⚽', accent: 'border-teal-100 bg-teal-50',  text: 'text-teal-700' },
                                            { label: 'Solo ganador',          sub: 'Empate o equipo ganador',          pts: '2 pts', icon: '✅',   accent: 'border-blue-100 bg-blue-50',  text: 'text-blue-700' },
                                            { label: 'Solo gol acertado',     sub: 'Al menos un marcador exacto',      pts: '1 pt',  icon: '⚽',   accent: 'border-purple-100 bg-purple-50', text: 'text-purple-700' },
                                        ].map((r) => (
                                            <div key={r.label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${r.accent}`}>
                                                <span className="text-base leading-none shrink-0" aria-hidden="true">{r.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-800 leading-tight">{r.label}</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{r.sub}</p>
                                                </div>
                                                <span className={`text-sm font-black shrink-0 ${r.text}`}>{r.pts}</span>
                                            </div>
                                        ))}
                                        <p className="text-[9px] text-slate-400 pt-1 leading-snug">
                                            El marcador exacto (5 pts) no se suma con otros bonos. El resto es <span className="font-bold text-slate-500">aditivo</span>.
                                        </p>
                                    </div>

                                    {/* Panel: Bonos */}
                                    <div
                                        role="tabpanel"
                                        id="scoring-panel-bonos"
                                        aria-labelledby="scoring-tab-bonos"
                                        hidden={scoringTab !== 'bonos'}
                                        className="space-y-3"
                                    >
                                        {/* Predicción única */}
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1.5">Predicción única</p>
                                            <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                                                <span className="text-base leading-none shrink-0" aria-hidden="true">⭐</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-800 leading-tight">Marcador único en la liga</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">Nadie más predijo ese marcador exacto</p>
                                                </div>
                                                <span className="text-sm font-black text-amber-600 shrink-0">+5 pts</span>
                                            </div>
                                        </div>

                                        {/* Clasificados */}
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Bono clasificados</p>
                                            <p className="text-[9px] text-slate-400 leading-snug mb-1.5">
                                                Predice qué equipo clasifica en cada partido de eliminatoria.
                                                El bono se otorga si <span className="font-bold text-slate-600">todos</span> tus picks de la fase son correctos.
                                            </p>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {[
                                                    { label: 'Octavos',   pts: '8 pts', icon: '🥈' },
                                                    { label: 'Cuartos',   pts: '4 pts', icon: '🥉' },
                                                    { label: 'Semifinal', pts: '2 pts', icon: '🏅' },
                                                    { label: 'Campeón',   pts: '5 pts', icon: '🏆' },
                                                ].map((b) => (
                                                    <div key={b.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs leading-none" aria-hidden="true">{b.icon}</span>
                                                            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-600">{b.label}</span>
                                                        </div>
                                                        <span className="text-[11px] font-black text-lime-600">{b.pts}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Panel: Desempate */}
                                    <div
                                        role="tabpanel"
                                        id="scoring-panel-desempate"
                                        aria-labelledby="scoring-tab-desempate"
                                        hidden={scoringTab !== 'desempate'}
                                        className="space-y-1.5"
                                    >
                                        <p className="text-[9px] text-slate-500 leading-snug mb-2">
                                            Cuando dos participantes tienen los mismos puntos, se aplican estos criterios <span className="font-bold">en orden</span> hasta resolver el empate:
                                        </p>
                                        {[
                                            { n: '1', label: 'Puntos totales',          icon: '🏅' },
                                            { n: '2', label: 'Campeón acertado',         icon: '🏆' },
                                            { n: '3', label: 'Marcadores exactos',       icon: '🎯' },
                                            { n: '4', label: 'Ganadores acertados',      icon: '✅' },
                                            { n: '5', label: 'Goles acertados',          icon: '⚽' },
                                            { n: '6', label: 'Predicciones únicas',      icon: '⭐' },
                                        ].map((c) => (
                                            <div key={c.n} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                                <span className="text-[10px] font-black text-slate-300 w-3 shrink-0 tabular-nums">{c.n}</span>
                                                <span className="text-sm leading-none shrink-0" aria-hidden="true">{c.icon}</span>
                                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">{c.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Center column ── */}
                <div className="space-y-5">
                    {/* Prizes */}
                    <motion.article {...fade(0.08)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Premios</h2>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                                Bolsa: {prizes.net > 0 ? prizes.fmt(prizes.net) : (activeLeague?.stats.totalPrize || '—')}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: '1er puesto (60%)', width: 60, amount: prizes.first, color: 'bg-lime-400' },
                                { label: '2do puesto (30%)', width: 30, amount: prizes.second, color: 'bg-amber-400' },
                                { label: '3er puesto (10%)', width: 10, amount: prizes.third, color: 'bg-slate-400' },
                            ].map((prize) => (
                                <div key={prize.label} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{prize.label}</span>
                                        <span className="text-[11px] font-black text-lime-700">{prize.amount > 0 ? prizes.fmt(prize.amount) : '—'}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${prize.width}%` }}
                                            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' as const }}
                                            className={`h-full rounded-full ${prize.color}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.article>

                    {/* My stats (center, for non-spectator) */}
                    {!spectatorMode && (
                        <motion.article {...fade(0.12)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Mi rendimiento</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-gradient-to-br from-lime-400 to-lime-500 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-900 opacity-70">Aciertos</p>
                                    <p className="mt-1.5 text-3xl font-black text-lime-950">{stats?.aciertos || 0}</p>
                                </div>
                                <div className="rounded-2xl bg-gradient-to-br from-rose-400 to-rose-500 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-950 opacity-70">Errores</p>
                                    <p className="mt-1.5 text-3xl font-black text-rose-950">{stats?.errores || 0}</p>
                                </div>
                                <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-950 opacity-70">Racha</p>
                                    <p className="mt-1.5 text-3xl font-black text-amber-950">{stats?.racha || 0}</p>
                                </div>
                                <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white opacity-70">Tasa</p>
                                    <p className="mt-1.5 text-3xl font-black text-white">{(stats?.tasa || 0).toFixed(1)}%</p>
                                </div>
                            </div>
                        </motion.article>
                    )}

                    {/* Recent predictions */}
                    <motion.article {...fade(0.16)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Predicciones recientes</h2>
                            <Link to="/predictions" className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 hover:text-lime-600 transition-colors">
                                Ver todas
                            </Link>
                        </div>
                        {predictions && predictions.length > 0 ? (
                            <div className="space-y-2">
                                {predictions.slice(0, 3).map((p, i) => {
                                    const isPending = p.resultado === 'Pendiente' || !p.resultado;
                                    const hasPoints = p.puntos > 0;
                                    const badge = isPending
                                        ? { label: 'Pendiente', cls: 'bg-slate-100 text-slate-500' }
                                        : p.acierto
                                        ? { label: 'Exacto', cls: 'bg-lime-100 text-lime-700' }
                                        : hasPoints
                                        ? { label: `+${p.puntos} pts`, cls: 'bg-amber-100 text-amber-700' }
                                        : { label: 'Sin puntos', cls: 'bg-rose-100 text-rose-700' };
                                    return (
                                        <motion.div
                                            key={p.id}
                                            initial={{ opacity: 0, x: 8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.1 + i * 0.06 }}
                                            className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 ${
                                                isPending ? 'border-slate-100 bg-slate-50'
                                                : p.acierto ? 'border-lime-100 bg-lime-50/50'
                                                : hasPoints ? 'border-amber-100 bg-amber-50/50' : 'border-rose-100 bg-rose-50/40'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-black text-slate-900">{p.match}</p>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <span className="text-[10px] font-bold text-slate-400">Mi pronóstico: <span className="text-slate-600">{p.tuPrediccion}</span></span>
                                                    {!isPending && (
                                                        <span className="text-[10px] font-bold text-slate-400">Resultado: <span className="text-slate-600">{p.resultado}</span></span>
                                                    )}
                                                    {!isPending && (
                                                        <span className={`text-[10px] font-black ${hasPoints ? 'text-amber-600' : 'text-slate-400'}`}>
                                                            {hasPoints ? `Sumó ${p.puntos} pts` : 'No sumó puntos'}
                                                        </span>
                                                    )}
                                                    <span className="text-[9px] text-slate-300">{p.fecha}</span>
                                                </div>
                                            </div>
                                            <div className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${badge.cls}`}>
                                                {badge.label}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                                <p className="text-sm text-slate-500">Aún no haces predicciones</p>
                                <Link to="/predictions" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-sm font-bold uppercase text-slate-900 hover:bg-lime-500 transition-colors">
                                    Ir a pronósticos <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        )}
                    </motion.article>
                </div>

                {/* ── Right column ── */}
                <div className="space-y-5">
                    {/* Top ranking */}
                    <motion.article {...fade(0.08)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                                <Trophy className="h-4 w-4 text-lime-500" /> Top actual
                            </h2>
                        </div>
                        {topPlayers.length > 0 ? (
                            <div className="space-y-2">
                                {topPlayers.map((player, i) => {
                                    const prizeAmt = i === 0 ? prizes.first : i === 1 ? prizes.second : prizes.third;
                                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                                    return (
                                        <motion.div
                                            key={player.id}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.1 + i * 0.08 }}
                                            className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${i === 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}
                                        >
                                            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                                                i === 0 ? 'bg-amber-400 text-slate-950' : i === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {medal}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-black uppercase text-slate-900">{player.name}</p>
                                                <p className="text-[10px] text-slate-400">{player.points} pts</p>
                                            </div>
                                            {prizeAmt > 0 && (
                                                <span className="flex-shrink-0 text-[11px] font-black text-lime-700">{prizes.fmt(prizeAmt)}</span>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                                El ranking todavía no tiene datos.
                            </div>
                        )}
                        <button
                            onClick={() => navigate('/ranking')}
                            className="flex w-full items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-lime-600 transition-colors py-1"
                        >
                            Ver ranking completo <ArrowRight size={12} />
                        </button>
                    </motion.article>

                    {/* Próximos partidos con inputs rápidos */}
                    <motion.article {...fade(0.12)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Próximos partidos</h2>
                            <Clock size={14} className="text-slate-300" />
                        </div>

                        {upcomingMatches.length > 0 ? (
                            <div className="space-y-3">
                                {upcomingMatches.map((match, i) => {
                                    const draft = getQuickDraft(match);
                                    const canEdit = !isPredictionWindowClosed(
                                        match.date,
                                        activeLeague?.settings?.closePredictionMinutes,
                                        currentTime,
                                    );
                                    const isDirty =
                                        draft.home !== (match.prediction.home ?? '') ||
                                        draft.away !== (match.prediction.away ?? '');
                                    const hasDraftValues = draft.home !== '' && draft.away !== '';

                                    return (
                                        <motion.div
                                            key={match.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.1 + i * 0.07 }}
                                            className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 shadow-sm shadow-slate-100"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                        {safeText(match.displayDate, match.date)}
                                                    </p>
                                                    <p className="mt-1 text-xs font-black text-slate-900">{formatMatchTime(match.date)}</p>
                                                </div>
                                                <span
                                                    className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${
                                                        !canEdit
                                                            ? 'bg-slate-200 text-slate-600'
                                                            : isDirty
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : match.saved
                                                            ? 'bg-lime-100 text-lime-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                    }`}
                                                >
                                                    {!canEdit ? 'Cerrado' : isDirty ? 'Sin guardar' : match.saved ? 'Guardado' : 'Activo'}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-2">
                                                <div className="min-w-0 flex-1 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <img src={match.homeFlag} alt={`Bandera de ${match.homeTeam}`} className="h-5 w-7 rounded-md object-cover shadow-sm" />
                                                        <p className="truncate text-base font-black uppercase text-slate-900 sm:text-lg">{match.homeTeamCode}</p>
                                                    </div>
                                                    <p className="mt-1 truncate text-[10px] text-slate-400">{match.homeTeam}</p>
                                                </div>

                                                <div className="flex items-center gap-1.5 sm:gap-2">
                                                    {(['home', 'away'] as const).map((side, scoreIndex) => (
                                                        <React.Fragment key={side}>
                                                            <div className="sm:hidden">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={99}
                                                                    inputMode="numeric"
                                                                    value={side === 'home' ? draft.home : draft.away}
                                                                    onChange={(e) =>
                                                                        setQuickPreds((prev) => ({
                                                                            ...prev,
                                                                            [match.id]: {
                                                                                home: side === 'home' ? e.target.value : draft.home,
                                                                                away: side === 'away' ? e.target.value : draft.away,
                                                                            },
                                                                        }))
                                                                    }
                                                                    disabled={!canEdit || savingMatchId === match.id}
                                                                    aria-label={`Marcador ${side === 'home' ? 'local' : 'visitante'} para ${side === 'home' ? match.homeTeam : match.awayTeam}`}
                                                                    className="h-11 w-12 rounded-xl border-2 border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 disabled:opacity-60"
                                                                />
                                                            </div>
                                                            <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 py-1 shadow-sm shadow-slate-100 sm:flex">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setQuickPreds((prev) => {
                                                                            const currentValue = parseInt(side === 'home' ? draft.home || '0' : draft.away || '0', 10) || 0;
                                                                            const nextValue = Math.max(0, currentValue - 1);
                                                                            return {
                                                                                ...prev,
                                                                                [match.id]: {
                                                                                    home: side === 'home' ? String(nextValue) : draft.home,
                                                                                    away: side === 'away' ? String(nextValue) : draft.away,
                                                                                },
                                                                            };
                                                                        })
                                                                    }
                                                                    disabled={!canEdit || savingMatchId === match.id}
                                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                                                                    aria-label={`Disminuir marcador ${side === 'home' ? 'local' : 'visitante'}`}
                                                                >
                                                                    <Minus size={14} />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={99}
                                                                    inputMode="numeric"
                                                                    value={side === 'home' ? draft.home : draft.away}
                                                                    onChange={(e) =>
                                                                        setQuickPreds((prev) => ({
                                                                            ...prev,
                                                                            [match.id]: {
                                                                                home: side === 'home' ? e.target.value : draft.home,
                                                                                away: side === 'away' ? e.target.value : draft.away,
                                                                            },
                                                                        }))
                                                                    }
                                                                    disabled={!canEdit || savingMatchId === match.id}
                                                                    aria-label={`Marcador ${side === 'home' ? 'local' : 'visitante'} para ${side === 'home' ? match.homeTeam : match.awayTeam}`}
                                                                    className="h-8 w-10 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white disabled:opacity-60"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setQuickPreds((prev) => {
                                                                            const currentValue = parseInt(side === 'home' ? draft.home || '0' : draft.away || '0', 10) || 0;
                                                                            const nextValue = currentValue + 1;
                                                                            return {
                                                                                ...prev,
                                                                                [match.id]: {
                                                                                    home: side === 'home' ? String(nextValue) : draft.home,
                                                                                    away: side === 'away' ? String(nextValue) : draft.away,
                                                                                },
                                                                            };
                                                                        })
                                                                    }
                                                                    disabled={!canEdit || savingMatchId === match.id}
                                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                                                                    aria-label={`Aumentar marcador ${side === 'home' ? 'local' : 'visitante'}`}
                                                                >
                                                                    <Plus size={14} />
                                                                </button>
                                                            </div>
                                                            {scoreIndex === 0 ? <span className="text-slate-300 font-black">-</span> : null}
                                                        </React.Fragment>
                                                    ))}
                                                </div>

                                                <div className="min-w-0 flex-1 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <p className="truncate text-base font-black uppercase text-slate-900 sm:text-lg">{match.awayTeamCode}</p>
                                                        <img src={match.awayFlag} alt={`Bandera de ${match.awayTeam}`} className="h-5 w-7 rounded-md object-cover shadow-sm" />
                                                    </div>
                                                    <p className="mt-1 truncate text-[10px] text-slate-400">{match.awayTeam}</p>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3">
                                                <div className="min-w-0 flex-1 text-[10px] font-bold text-slate-500">
                                                    {isDirty ? (
                                                        <span className="text-amber-600">Cambios listos para guardar</span>
                                                    ) : match.saved ? (
                                                        <span className="text-lime-600">✓ Pronóstico actual {match.prediction.home}-{match.prediction.away}</span>
                                                    ) : canEdit ? (
                                                        <span>Ingresa tu pronóstico · cierra en {summarizeCloseTime(match.date, activeLeague?.settings?.closePredictionMinutes, currentTime)}</span>
                                                    ) : (
                                                        <span className="text-rose-500">Pronóstico cerrado 15 min antes del partido</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {canEdit ? (
                                                        <button
                                                            onClick={() => void handleQuickSave(match)}
                                                            disabled={savingMatchId === match.id || !hasDraftValues || (!isDirty && match.saved)}
                                                            className="rounded-xl bg-lime-400 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-950 transition-colors hover:bg-lime-500 disabled:opacity-60"
                                                        >
                                                            {savingMatchId === match.id ? 'Guardando...' : match.saved ? 'Actualizar' : 'Guardar'}
                                                        </button>
                                                    ) : null}
                                                    {isAdmin && (
                                                        <Link
                                                            to="/predictions"
                                                            className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                                                        >
                                                            <Settings size={11} /> Gestionar
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                                No hay partidos próximos.
                            </div>
                        )}
                    </motion.article>
                </div>
            </section>

            {/* ── Invite modal ── */}
            <InviteModal
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                code={activeLeague?.code}
                leagueName={activeLeague?.name}
            />

            {/* ── Config modal ── */}
            <LeagueConfigModal
                open={configOpen}
                onClose={() => setConfigOpen(false)}
                leagueId={activeLeague?.id}
                memberCount={activeLeague?.stats?.memberCount}
                onSaved={() => { if (activeLeague?.id) void fetchLeagueDetails(activeLeague.id); }}
                onInvite={() => setInviteOpen(true)}
            />
        </div>
    );
};

export default Dashboard;
