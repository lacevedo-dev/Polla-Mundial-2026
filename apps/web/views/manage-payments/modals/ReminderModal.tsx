import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Send, Sparkles, X } from 'lucide-react';
import { Button, Card } from '../../../components/UI';
import { ApiError, request } from '../../../api';
import { ALL_REMINDER_CHANNELS, CHANNEL_CONFIG, REMINDER_TEMPLATES } from '../constants';
import { ModalOverlay } from '../components/ModalOverlay';
import { avatarUrl, fmtCurrency } from '../utils';
import type { ReminderChannel, TemplateKey, UserSummary } from '../types';

const ReminderModal: React.FC<{
    leagueId: string;
    selectedUsers: UserSummary[];
    leagueName: string;
    userDebts: Record<string, number>;
    currency: string;
    onClose: () => void;
}> = ({ leagueId, selectedUsers, leagueName, userDebts, currency, onClose }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [userChannels, setUserChannels] = useState<Record<string, ReminderChannel[]>>(
        Object.fromEntries(selectedUsers.map((u) => [u.id, ['whatsapp_group' as ReminderChannel]])),
    );
    const [activeTab, setActiveTab] = useState<ReminderChannel>('whatsapp_group');
    const [drafts, setDrafts] = useState<Record<ReminderChannel, string>>({
        whatsapp_group: REMINDER_TEMPLATES.friendly.whatsapp_group,
        whatsapp_personal: REMINDER_TEMPLATES.friendly.whatsapp_personal,
        email: REMINDER_TEMPLATES.friendly.email,
        sms: REMINDER_TEMPLATES.friendly.sms,
        push: REMINDER_TEMPLATES.friendly.push,
    });
    const [selectedTpl, setSelectedTpl] = useState<Record<ReminderChannel, TemplateKey>>({
        whatsapp_group: 'friendly', whatsapp_personal: 'friendly', email: 'friendly', sms: 'friendly', push: 'friendly',
    });
    const [generating, setGenerating] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [apiSupportsReminders, setApiSupportsReminders] = useState<boolean | null>(null);
    /** all = todos los canales marcados en paso 1; single = solo el tab activo */
    const [sendMode, setSendMode] = useState<'all' | 'single'>('all');

    useEffect(() => {
        let cancelled = false;
        request<{ capabilities?: { paymentReminders?: boolean } }>('/health/live')
            .then((health) => {
                if (!cancelled) {
                    setApiSupportsReminders(health.capabilities?.paymentReminders === true);
                }
            })
            .catch(() => {
                if (!cancelled) setApiSupportsReminders(false);
            });
        return () => { cancelled = true; };
    }, []);

    const fmtDebt = (userId: string) => fmtCurrency(userDebts[userId] ?? 0, currency);

    const sendChannelCount = useMemo(() => {
        if (sendMode === 'single') {
            return selectedUsers.filter((u) => (userChannels[u.id] ?? []).includes(activeTab)).length;
        }
        return selectedUsers.reduce((n, u) => n + (userChannels[u.id]?.length ?? 0), 0);
    }, [sendMode, activeTab, selectedUsers, userChannels]);

    const allUsersHaveAllChannels = useMemo(
        () => selectedUsers.every((u) => {
            const chs = userChannels[u.id] ?? [];
            return ALL_REMINDER_CHANNELS.every((c) => chs.includes(c));
        }),
        [selectedUsers, userChannels],
    );

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

    const setAllChannelsForUser = (uid: string, selectAll: boolean) =>
        setUserChannels((prev) => ({
            ...prev,
            [uid]: selectAll ? [...ALL_REMINDER_CHANNELS] : [],
        }));

    const setAllChannelsGlobal = (selectAll: boolean) =>
        setUserChannels(Object.fromEntries(
            selectedUsers.map((u) => [u.id, selectAll ? [...ALL_REMINDER_CHANNELS] : []]),
        ));

    const applyTemplate = (key: 'friendly' | 'formal' | 'urgent') => {
        setDrafts((p) => ({ ...p, [activeTab]: REMINDER_TEMPLATES[key][activeTab] }));
        setSelectedTpl((p) => ({ ...p, [activeTab]: key }));
    };

    const generateAI = () => {
        setGenerating(true);
        setTimeout(() => {
            const aiMsgs: Record<ReminderChannel, string> = {
                whatsapp_group: '🤖 Recordatorio amigable: hay pagos pendientes en {liga}. Revisa tu saldo y mantente al día.',
                whatsapp_personal: '🤖 Hola {nombre}, noté que se nos pasó la fecha de tu aporte en {liga}. ¿Podrías revisar tu saldo de {deuda}? ¡Gracias!',
                email: 'Asunto: Pequeño recordatorio de {liga}\n\nHola {nombre},\n\nNuestra IA detectó un saldo pendiente de {deuda}. Ayúdanos a mantener la competencia al día.',
                sms: 'Hola {nombre}, recordatorio amigable: saldo de {deuda} en {liga}.',
                push: '🤖 {nombre}, no olvides tu aporte pendiente en {liga}.',
            };
            setDrafts((p) => ({ ...p, [activeTab]: aiMsgs[activeTab] }));
            setSelectedTpl((p) => ({ ...p, [activeTab]: 'ai' }));
            setGenerating(false);
        }, 1500);
    };

    const handleSend = async () => {
        setSending(true);
        setSendError(null);
        const channelsToSend = sendMode === 'single' ? [activeTab] : null;
        try {
            const res = await request<{ ok: boolean; errors?: string[] }>(`/leagues/${leagueId}/payments/reminders`, {
                method: 'POST',
                body: JSON.stringify({
                    recipients: selectedUsers.map((u) => {
                        const selected = userChannels[u.id] ?? [];
                        const channels = channelsToSend
                            ? channelsToSend.filter((c) => selected.includes(c))
                            : selected;
                        return { userId: u.id, channels };
                    }),
                    messages: drafts,
                }),
            });
            if (!res.ok && res.errors?.length) {
                setSendError(res.errors.slice(0, 3).join(' · '));
                return;
            }
            setSent(true);
            setTimeout(() => { setSent(false); onClose(); }, 1500);
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                setSendError('El API en producción no tiene el endpoint de recordatorios. Redespliega la app polla-api en Dokploy desde main y vuelve a intentar.');
                setApiSupportsReminders(false);
            } else if (err instanceof ApiError && err.message) {
                setSendError(err.message);
            } else {
                setSendError('No se pudo enviar el recordatorio. Verifica tu conexión e intenta de nuevo.');
            }
        } finally {
            setSending(false);
        }
    };

    const previewMessage = (ch: ReminderChannel, user = selectedUsers[0]) =>
        drafts[ch]
            .replace('{nombre}', user?.name ?? 'Usuario')
            .replace('{liga}', leagueName)
            .replace('{deuda}', fmtDebt(user?.id ?? ''));

    const insertVar = (v: string) => {
        setDrafts((p) => ({ ...p, [activeTab]: p[activeTab] + ` {${v}}` }));
        setSelectedTpl((p) => ({ ...p, [activeTab]: 'custom' }));
    };

    return (
        <ModalOverlay>
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
                    {apiSupportsReminders === false && (
                        <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                            El API desplegado aún no soporta envío de recordatorios. Redespliega <strong>polla-api</strong> en Dokploy (rama main); las migraciones se aplican al arrancar el contenedor.
                        </p>
                    )}
                    {step === 1 ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selecciona canales por usuario</p>
                                <button
                                    type="button"
                                    onClick={() => setAllChannelsGlobal(!allUsersHaveAllChannels)}
                                    className="text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                                >
                                    {allUsersHaveAllChannels ? 'Quitar todos' : 'Todos los canales'}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                                Marca los canales por usuario o usa <strong className="text-slate-700">Todos los canales</strong>. En el siguiente paso puedes enviar por todos o solo por uno.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAllChannelsGlobal(true)}
                                    className={`text-[10px] font-black uppercase px-3 py-2 rounded-xl border transition-colors ${allUsersHaveAllChannels ? 'bg-indigo-600 text-white border-indigo-600' : 'border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                                >
                                    Todos los canales
                                </button>
                                {ALL_REMINDER_CHANNELS.map((ch) => {
                                    const cfg = CHANNEL_CONFIG[ch];
                                    const allUsersHaveCh = selectedUsers.every((u) => (userChannels[u.id] ?? []).includes(ch));
                                    return (
                                        <button
                                            key={ch}
                                            type="button"
                                            onClick={() => setUserChannels(Object.fromEntries(
                                                selectedUsers.map((u) => [u.id, [ch]]),
                                            ))}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${allUsersHaveCh && !allUsersHaveAllChannels ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <cfg.Icon size={12} /> Solo {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedUsers.map((u) => {
                                const userHasAll = ALL_REMINDER_CHANNELS.every((c) => (userChannels[u.id] ?? []).includes(c));
                                return (
                                <div key={u.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img src={avatarUrl(u.name, u.avatar)} className="w-8 h-8 rounded-lg shrink-0" alt={u.name} />
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-slate-900 truncate">{u.name}</p>
                                                <p className="text-[10px] font-bold text-rose-600">{fmtDebt(u.id)} pendiente</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAllChannelsForUser(u.id, !userHasAll)}
                                            className="text-[9px] font-black uppercase px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-white shrink-0"
                                        >
                                            {userHasAll ? 'Quitar' : 'Todos'}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {ALL_REMINDER_CHANNELS.map((ch) => {
                                            const cfg = CHANNEL_CONFIG[ch];
                                            const active = (userChannels[u.id] ?? []).includes(ch);
                                            return (
                                                <button
                                                    key={ch}
                                                    type="button"
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
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Modo de envío</p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSendMode('all')}
                                        className={`flex-1 min-w-[140px] px-3 py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${sendMode === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-white'}`}
                                    >
                                        Todos los canales ({activeChannels.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSendMode('single')}
                                        className={`flex-1 min-w-[140px] px-3 py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${sendMode === 'single' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-white'}`}
                                    >
                                        Solo {CHANNEL_CONFIG[activeTab].label}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed">
                                    {sendMode === 'all'
                                        ? `Se enviará por ${activeChannels.map((c) => CHANNEL_CONFIG[c].label).join(', ')} a quien tenga cada canal activo.`
                                        : `Solo se enviará por ${CHANNEL_CONFIG[activeTab].label} a los usuarios que lo tengan marcado en Canales.`}
                                </p>
                            </div>

                            <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                {(sendMode === 'all' ? activeChannels : ALL_REMINDER_CHANNELS.filter((c) => activeChannels.includes(c) || c === activeTab)).map((ch) => {
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
                                <p className="text-[9px] font-black uppercase text-slate-400">
                                    Preview {activeTab === 'whatsapp_group' ? '(mensaje al grupo)' : `con ${selectedUsers[0]?.name ?? 'usuario'}`}
                                </p>
                                <p className="text-xs text-slate-600 whitespace-pre-wrap">
                                    {activeTab === 'whatsapp_group' && selectedUsers.length > 1
                                        ? [
                                            previewMessage('whatsapp_group'),
                                            ...selectedUsers.map((u) => `• ${u.name}: ${fmtDebt(u.id)}`),
                                        ].join('\n')
                                        : previewMessage(activeTab)}
                                </p>
                            </div>
                            {sendError && (
                                <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">{sendError}</p>
                            )}
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
                                disabled={sending || sendChannelCount === 0 || apiSupportsReminders === false}
                            >
                                {sending ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> :
                                    sent ? <><CheckCircle2 size={14} /> ¡Enviado!</> :
                                    sendMode === 'all'
                                        ? <><Send size={14} /> Enviar · {activeChannels.length} canal{activeChannels.length !== 1 ? 'es' : ''}</>
                                        : <><Send size={14} /> Enviar · {CHANNEL_CONFIG[activeTab].label}</>}
                            </Button>
                        </>
                    )}
                </div>
            </Card>
        </ModalOverlay>
    );
};

export default ReminderModal;
