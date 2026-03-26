import React, { useEffect, useState } from 'react';
import { Activity, Bell, CheckCircle2, Clock, MessageSquare, Phone, RefreshCw, Send, Smartphone, XCircle } from 'lucide-react';
import { request } from '../../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChannelInfo {
  enabled: boolean;
  description: string;
  subscriberCount?: number;
  usersWithPhone?: number;
}

interface SchedulerDef {
  id: string;
  name: string;
  cron: string;
  description: string;
  notifType: string;
  icon: string;
  audience: string;
  channels: string[];
}

interface AutomationStatus {
  channels: {
    inApp: ChannelInfo;
    push: ChannelInfo;
    whatsapp: ChannelInfo;
    sms: ChannelInfo;
    email: ChannelInfo;
  };
  schedulers: SchedulerDef[];
  stats: {
    notifLast24h: number;
    pushSubscribers: number;
    usersWithPhone: number;
  };
}

interface NotifRecord {
  id: string;
  type: string;
  title: string;
  body: string;
  sentAt: string;
  user: { name: string; email: string };
}

interface AutomationHistory {
  countByType: Record<string, number>;
  recent: NotifRecord[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  MATCH_REMINDER: 'Recordatorio',
  PREDICTION_CLOSED: 'Cierre predicción',
  RESULT_PUBLISHED: 'Resultado',
};

const TYPE_COLORS: Record<string, string> = {
  MATCH_REMINDER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PREDICTION_CLOSED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  RESULT_PUBLISHED: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
};

const CHANNEL_META: Record<string, { label: string; icon: React.ReactNode }> = {
  inApp: { label: 'In-App', icon: <Bell size={14} /> },
  push: { label: 'Push', icon: <Smartphone size={14} /> },
  whatsapp: { label: 'WhatsApp', icon: <MessageSquare size={14} /> },
  sms: { label: 'SMS', icon: <Phone size={14} /> },
  email: { label: 'Email', icon: <Send size={14} /> },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ─── Components ───────────────────────────────────────────────────────────────

function ChannelCard({ id, info }: { id: string; info: ChannelInfo }) {
  const meta = CHANNEL_META[id];
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${info.enabled ? 'border-slate-700 bg-slate-800/60' : 'border-slate-800 bg-slate-900/40 opacity-60'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <span className="text-slate-400">{meta?.icon}</span>
          {meta?.label ?? id}
        </div>
        {info.enabled
          ? <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-lime-400"><CheckCircle2 size={12} /> Activo</span>
          : <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500"><XCircle size={12} /> Inactivo</span>
        }
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{info.description}</p>
    </div>
  );
}

function SchedulerCard({ s, channelStatus }: { s: SchedulerDef; channelStatus: AutomationStatus['channels'] }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{s.icon}</span>
          <div>
            <p className="text-sm font-semibold text-slate-100">{s.name}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mt-0.5">
              {TYPE_LABELS[s.notifType] ?? s.notifType}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-lime-400 shrink-0">
          <Activity size={12} /> En ejecución
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Clock size={12} className="shrink-0" />
        <span>{s.description}</span>
      </div>

      <div className="text-xs text-slate-400">
        <span className="font-semibold text-slate-300">Audiencia: </span>{s.audience}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-700">
        {s.channels.map(ch => {
          const chInfo = (channelStatus as any)[ch] as ChannelInfo | undefined;
          const meta = CHANNEL_META[ch];
          const active = chInfo?.enabled ?? false;
          return (
            <span
              key={ch}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest
                ${active ? 'bg-lime-500/10 text-lime-400 border-lime-500/20' : 'bg-slate-700/50 text-slate-500 border-slate-700 line-through'}`}
            >
              {meta?.icon}{meta?.label ?? ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function AdminAutomation() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [history, setHistory] = useState<AutomationHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'schedulers' | 'history'>('schedulers');

  const load = async () => {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        request<AutomationStatus>('/admin/automation/status'),
        request<AutomationHistory>('/admin/automation/history'),
      ]);
      setStatus(s);
      setHistory(h);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-100">Procesos Automáticos</h1>
          <p className="text-sm text-slate-400 mt-1">Estado de schedulers, canales de notificación e historial</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Notif. últimas 24h', value: status.stats.notifLast24h, icon: <Bell size={16} /> },
            { label: 'Dispositivos Push', value: status.stats.pushSubscribers, icon: <Smartphone size={16} /> },
            { label: 'Usuarios con teléfono', value: status.stats.usersWithPhone, icon: <Phone size={16} /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">{icon}</div>
              <div>
                <p className="text-xl font-black text-slate-100">{value.toLocaleString()}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Canales */}
      {status && (
        <div className="mb-8">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Canales configurados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Object.entries(status.channels).map(([id, info]) => (
              <ChannelCard key={id} id={id} info={info} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800">
        {(['schedulers', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors
              ${tab === t ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t === 'schedulers' ? 'Schedulers' : 'Historial 24h'}
          </button>
        ))}
      </div>

      {/* Schedulers */}
      {tab === 'schedulers' && status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {status.schedulers.map(s => (
            <SchedulerCard key={s.id} s={s} channelStatus={status.channels} />
          ))}
        </div>
      )}

      {/* History */}
      {tab === 'history' && history && (
        <div className="flex flex-col gap-4">
          {/* Counts by type */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(history.countByType).map(([type, count]) => (
              <div key={type} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${TYPE_COLORS[type] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                {TYPE_LABELS[type] ?? type}: <span className="font-black">{count}</span>
              </div>
            ))}
            {Object.keys(history.countByType).length === 0 && (
              <p className="text-sm text-slate-500">Sin notificaciones automáticas en las últimas 24h</p>
            )}
          </div>

          {/* Recent list */}
          {history.recent.length > 0 && (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 px-4 py-2 bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Tipo</span>
                <span>Mensaje</span>
                <span>Hora</span>
              </div>
              <div className="divide-y divide-slate-800">
                {history.recent.map(n => (
                  <div key={n.id} className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-start px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${TYPE_COLORS[n.type] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                    <div>
                      <p className="text-sm text-slate-200 font-medium">{n.body}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.user.name} — {n.user.email}</p>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{fmt(n.sentAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-400" />
        </div>
      )}
    </div>
  );
}
