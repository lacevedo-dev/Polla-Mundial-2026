import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    AlignJustify,
    ArrowLeft,
    Bell,
    CheckCircle2,
    Copy,
    Mail,
    MessageCircle,
    Phone,
    Send,
    Share2,
    Sparkles,
    UserPlus,
    X,
} from 'lucide-react';
import { request } from '../../api';
import { getInviteLink, getWhatsAppLink, shareNative } from '../../utils/url';

/* ─── Types ──────────────────────────────────────────────────────── */

type InviteChannel = 'whatsapp' | 'sms' | 'email' | 'push';
type InviteTone = 'amigable' | 'retador' | 'formal';

interface InviteFriend {
    id: string;
    name: string;
    phone: string;
    email: string;
    channels: InviteChannel[];
}

/* ─── Constants ──────────────────────────────────────────────────── */

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

const CHANNEL_META: Record<InviteChannel, { label: string; color: string; Icon: React.FC<{ size?: number; className?: string }> }> = {
    whatsapp: { label: 'WhatsApp', color: 'bg-[#25D366] text-white', Icon: ({ size, className }) => <MessageCircle size={size} className={className} /> },
    sms: { label: 'SMS', color: 'bg-sky-400 text-white', Icon: ({ size, className }) => <Phone size={size} className={className} /> },
    email: { label: 'Email', color: 'bg-lime-400 text-slate-950', Icon: ({ size, className }) => <Mail size={size} className={className} /> },
    push: { label: 'Notif.', color: 'bg-violet-500 text-white', Icon: ({ size, className }) => <Bell size={size} className={className} /> },
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function autoChannels(phone: string, email: string): InviteChannel[] {
    const ch: InviteChannel[] = [];
    if (phone.trim()) { ch.push('whatsapp', 'sms'); }
    if (email.trim()) { ch.push('email'); }
    return ch.length ? ch : ['whatsapp'];
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

/* ─── Component ──────────────────────────────────────────────────── */

interface InviteModalProps {
    open: boolean;
    onClose: () => void;
    code?: string;
    leagueName?: string;
}

const InviteModal: React.FC<InviteModalProps> = ({ open, onClose, code, leagueName }) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const [screen, setScreen] = useState<'invite' | 'customize'>('invite');
    const [tab, setTab] = useState<'one' | 'bulk'>('one');
    const [friends, setFriends] = useState<InviteFriend[]>([]);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [codeCopied, setCodeCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [msgChannel, setMsgChannel] = useState<InviteChannel>('whatsapp');
    const [tone, setTone] = useState<InviteTone>('amigable');
    const [msgText, setMsgText] = useState('');
    const [emailPreview, setEmailPreview] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const link = getInviteLink(code ?? '');
    const activeChannels = [...new Set(friends.flatMap((f) => f.channels))] as InviteChannel[];

    React.useEffect(() => {
        if (screen === 'customize') {
            setMsgText(INVITE_TEMPLATES[msgChannel][tone]);
        }
    }, [msgChannel, tone, screen]);

    React.useEffect(() => {
        if (!open) { setScreen('invite'); setSent(false); }
    }, [open]);

    const handleCopyCode = () => {
        if (!code) return;
        void navigator.clipboard.writeText(code).then(() => {
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        });
    };

    const handleCopyLink = () => {
        if (!code) return;
        void navigator.clipboard.writeText(link).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        });
    };

    const handleWhatsAppShare = () => {
        const whatsappLink = getWhatsAppLink(code ?? '', leagueName ?? '');
        window.open(whatsappLink, '_blank');
    };

    const handleNativeShare = () => {
        void shareNative(code ?? '', leagueName ?? '');
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
            return { ...f, channels: next.length ? next : f.channels };
        }));
    };

    const openCustomize = () => {
        const ch = activeChannels[0] ?? 'whatsapp';
        setMsgChannel(ch);
        setMsgText(INVITE_TEMPLATES[ch][tone]);
        setEmailPreview(false);
        setScreen('customize');
    };

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
            void (async () => {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
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
                                            {/* Invitation Code Card */}
                                            <div className="rounded-2xl bg-slate-900 px-6 py-5 space-y-3">
                                                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-lime-500">
                                                    Código de Invitación
                                                </p>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0 flex-1 overflow-hidden">
                                                        <p className="text-[12px] font-black uppercase tracking-tight text-lime-400 mb-1">
                                                            {leagueName || '——'}
                                                        </p>
                                                        <p className="text-[22px] sm:text-[26px] font-black font-mono tracking-[0.12em] text-white leading-none break-all">
                                                            {code || 'ABC123'}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col gap-2 shrink-0">
                                                        <button
                                                            onClick={handleCopyCode}
                                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
                                                            title="Copiar código"
                                                        >
                                                            {codeCopied ? <CheckCircle2 size={16} className="text-lime-400" /> : <Copy size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={handleWhatsAppShare}
                                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#25D366] text-white hover:opacity-90 transition-opacity"
                                                            title="WhatsApp"
                                                        >
                                                            <MessageCircle size={16} />
                                                        </button>
                                                        <button
                                                            onClick={handleNativeShare}
                                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
                                                            title="Compartir"
                                                        >
                                                            <Share2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 p-2.5 bg-slate-800 rounded-xl group cursor-pointer" onClick={handleCopyLink} title="Copiar link">
                                                    <span className="text-[10px] font-mono text-slate-400 truncate flex-1">{link}</span>
                                                    <button className="shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors">
                                                        {linkCopied ? <CheckCircle2 size={12} className="text-lime-400" /> : <Copy size={12} />}
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

                                            {/* Friend list */}
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

                                            <button onClick={openCustomize} className="w-full py-3 rounded-2xl bg-lime-400 text-slate-950 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-lime-500 transition-colors flex items-center justify-center gap-2">
                                                Personalizar mensaje <Send size={13} />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* ══ SCREEN 2: CUSTOMIZE ══ */}
                                {screen === 'customize' && (
                                    <motion.div key="s-custom" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="flex flex-col overflow-hidden">
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

export default InviteModal;
