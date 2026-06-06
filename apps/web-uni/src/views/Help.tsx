import React from 'react';
import {
    Trophy, TrendingUp, CheckCircle2, Calendar, Zap,
    Bell, BellOff, Shield, Target, HelpCircle, Download,
} from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useTenantStore } from '../stores/tenant.store';
import { CorpLayout } from '../layouts/CorpLayout';
import { generateHelpPDF } from '../utils/generateHelpPDF';

type Tab = 'points' | 'rules' | 'notifications';

const Help: React.FC = () => {
    const [activeTab, setActiveTab] = React.useState<Tab>('points');
    const tenant = useTenantStore((s) => s.tenant);
    const { supported, permission, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications();

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'tu organización';
    const primaryColor = 'var(--color-primary, #f59e0b)';
    const primaryHex = tenant?.branding?.primaryColor ?? '#f59e0b';

    const tabs: { id: Tab; label: string; icon: React.FC<{ size?: number }> }[] = [
        { id: 'points', label: 'Sistema de Puntos', icon: TrendingUp },
        { id: 'rules', label: 'Reglas del Juego', icon: Shield },
        { id: 'notifications', label: 'Notificaciones', icon: Bell },
    ];

    return (
        <CorpLayout>
        <div className="space-y-8 pb-24 md:pb-8">

            {/* Hero */}
            <section
                className="relative overflow-hidden rounded-2xl text-white p-8 md:p-12 shadow-xl"
                style={{ background: `linear-gradient(135deg, #0f172a 0%, color-mix(in srgb, var(--color-primary, #f59e0b) 40%, #0f172a) 100%)` }}
            >
                <div className="relative z-10 max-w-xl">
                    <div
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4"
                        style={{ backgroundColor: primaryColor, color: '#000' }}
                    >
                        <HelpCircle size={12} />
                        Guía {orgName}
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black leading-tight uppercase tracking-tighter mb-3">
                        TODO LO QUE<br />
                        <span style={{ color: primaryColor }}>NECESITAS SABER</span>
                    </h1>
                    <p className="text-slate-300 text-base leading-relaxed mb-6">
                        Aprende cómo funciona el sistema de puntos, las reglas del torneo y activa notificaciones para no perderte nada.
                    </p>
                    <button
                        onClick={() => generateHelpPDF(orgName, primaryHex)}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:opacity-90 active:scale-95"
                        style={{ backgroundColor: primaryColor, color: '#000' }}
                    >
                        <Download size={15} />
                        Descargar Guía PDF
                    </button>
                </div>
                <div className="absolute top-1/2 -right-12 -translate-y-1/2 opacity-10 hidden lg:block">
                    <Trophy size={300} strokeWidth={0.5} />
                </div>
            </section>

            {/* Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${
                            activeTab === id
                                ? 'bg-white text-black shadow-md border border-slate-100'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Icon size={14} />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>

            {/* ── Tab: Sistema de Puntos ── */}
            {activeTab === 'points' && (
                <div className="space-y-6">
                    <div className="text-center max-w-xl mx-auto space-y-2">
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
                            Sistema de Puntuación
                        </h2>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Cada partido vale hasta <strong className="text-slate-800">5 puntos base</strong>.
                            Los puntos por ganador y gol se suman entre sí; el marcador exacto es independiente.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Marcador exacto */}
                        <div className="rounded-2xl border-2 border-lime-200 bg-lime-50 p-6 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🎯</span>
                                    <span className="text-sm font-black uppercase tracking-wide text-lime-800">Marcador exacto</span>
                                </div>
                                <span className="text-3xl font-black text-lime-700">5</span>
                            </div>
                            <p className="text-sm text-lime-700 leading-relaxed">
                                Predijiste los goles de ambos equipos con exactitud.
                            </p>
                            <div className="rounded-xl bg-lime-100 px-3 py-2 text-xs text-lime-700 italic">
                                Predijiste <strong>2‑1</strong> y el partido terminó <strong>2‑1</strong> → 5 pts
                            </div>
                            <p className="text-[10px] text-lime-600 font-semibold">
                                ⚠️ No se acumula con ganador ni gol — es independiente.
                            </p>
                        </div>

                        {/* Ganador */}
                        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">✅</span>
                                    <span className="text-sm font-black uppercase tracking-wide text-blue-800">Ganador acertado</span>
                                </div>
                                <span className="text-3xl font-black text-blue-700">2</span>
                            </div>
                            <p className="text-sm text-blue-700 leading-relaxed">
                                Acertaste quién ganó el partido (o que terminaría en empate).
                            </p>
                            <div className="rounded-xl bg-blue-100 px-3 py-2 text-xs text-blue-700 italic">
                                Predijiste <strong>2‑0</strong> y el resultado fue <strong>3‑1</strong> → 2 pts
                            </div>
                        </div>

                        {/* Gol acertado */}
                        <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-6 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">⚽</span>
                                    <span className="text-sm font-black uppercase tracking-wide text-purple-800">Gol acertado</span>
                                </div>
                                <span className="text-3xl font-black text-purple-700">1</span>
                            </div>
                            <p className="text-sm text-purple-700 leading-relaxed">
                                Al menos uno de los dos marcadores coincide exactamente.
                            </p>
                            <div className="rounded-xl bg-purple-100 px-3 py-2 text-xs text-purple-700 italic">
                                Predijiste <strong>1‑2</strong> y el resultado fue <strong>1‑0</strong> → 1 pt
                            </div>
                        </div>

                        {/* Combinaciones */}
                        <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-6 space-y-3">
                            <div className="flex items-center gap-3 mb-1">
                                <Zap size={20} className="text-teal-600 shrink-0" />
                                <span className="text-sm font-black uppercase tracking-wide text-teal-800">Combinaciones</span>
                            </div>
                            <p className="text-xs text-teal-700 leading-relaxed">
                                Ganador y gol se <strong>suman</strong>. Hasta 3 pts combinados por partido.
                            </p>
                            <div className="space-y-2 pt-1">
                                {[
                                    { combo: 'Ganador + gol acertado', total: '3 pts', color: 'text-teal-700' },
                                    { combo: 'Solo ganador',           total: '2 pts', color: 'text-blue-700' },
                                    { combo: 'Solo gol acertado',      total: '1 pt',  color: 'text-purple-700' },
                                    { combo: 'Ninguno acertado',       total: '0 pts', color: 'text-slate-400' },
                                ].map((c) => (
                                    <div key={c.combo} className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600">{c.combo}</span>
                                        <span className={`text-xs font-black ${c.color}`}>{c.total}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tabla resumen */}
                    <div className="bg-slate-900 text-white p-8 rounded-2xl relative overflow-hidden shadow-xl">
                        <Target size={120} className="absolute -bottom-6 -right-6 opacity-10" />
                        <div className="relative z-10 max-w-lg space-y-4">
                            <h3 className="text-xl font-black uppercase tracking-tight">Resumen rápido</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Marcador exacto', pts: '5 pts', icon: '🎯' },
                                    { label: 'Ganador correcto', pts: '2 pts', icon: '✅' },
                                    { label: 'Gol acertado', pts: '1 pt', icon: '⚽' },
                                    { label: 'Máximo sin exacto', pts: '3 pts', icon: '⚡' },
                                ].map((r) => (
                                    <div key={r.label} className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
                                        <span className="text-xl">{r.icon}</span>
                                        <div>
                                            <p className="text-xs text-slate-400">{r.label}</p>
                                            <p className="text-sm font-black" style={{ color: primaryColor }}>{r.pts}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tab: Reglas del Juego ── */}
            {activeTab === 'rules' && (
                <div className="space-y-6">
                    <div className="text-center max-w-xl mx-auto space-y-2">
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
                            Reglas del Torneo
                        </h2>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Cómo funcionan los pronósticos, cierres y resultados en {orgName}.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, white)' }}>
                                <Calendar size={20} style={{ color: primaryColor }} />
                            </div>
                            <h3 className="font-black text-slate-900">Cierre de Pronósticos</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Los pronósticos se bloquean <strong className="text-slate-700">15 minutos antes</strong> del inicio de cada partido. No se permiten cambios una vez cerrada la ventana.
                            </p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, white)' }}>
                                <CheckCircle2 size={20} style={{ color: primaryColor }} />
                            </div>
                            <h3 className="font-black text-slate-900">Resultados Oficiales</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Se consideran los goles a los <strong className="text-slate-700">90 minutos + tiempo adicional</strong>. En rondas eliminatorias se incluye prórroga pero no penales.
                            </p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, white)' }}>
                                <Trophy size={20} style={{ color: primaryColor }} />
                            </div>
                            <h3 className="font-black text-slate-900">Ranking</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                La clasificación se actualiza automáticamente después de cada partido. En caso de empate en puntos, se ordena por mayor cantidad de predicciones exactas.
                            </p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, white)' }}>
                                <Shield size={20} style={{ color: primaryColor }} />
                            </div>
                            <h3 className="font-black text-slate-900">Fair Play</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Los pronósticos son confidenciales hasta el cierre de la ventana. Nadie puede ver los pronósticos de otros jugadores antes del inicio del partido.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-900 text-white p-8 rounded-2xl space-y-4">
                        <h3 className="text-lg font-black uppercase tracking-tight">Garantías de transparencia</h3>
                        <ul className="space-y-3">
                            {[
                                'Todos los pronósticos se registran con timestamp al momento del envío',
                                'No se pueden modificar pronósticos después del cierre',
                                'Los puntos se calculan automáticamente sin intervención manual',
                                'El ranking es en tiempo real y visible para todos los participantes',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: primaryColor }} />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* ── Tab: Notificaciones ── */}
            {activeTab === 'notifications' && (
                <div className="space-y-6 max-w-lg mx-auto">
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
                            Notificaciones Push
                        </h2>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Recibe avisos en tu dispositivo para no perderte ningún partido ni resultado.
                        </p>
                    </div>

                    {/* Toggle principal */}
                    {!supported || permission === 'denied' ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-3">
                            <div className="flex items-center gap-3">
                                <BellOff size={20} className="text-amber-600 shrink-0" />
                                <div>
                                    <p className="font-bold text-amber-800 text-sm">
                                        {!supported ? 'Notificaciones no disponibles' : 'Notificaciones bloqueadas'}
                                    </p>
                                    <p className="text-xs text-amber-600 mt-0.5">
                                        {!supported
                                            ? 'Tu navegador no soporta notificaciones push.'
                                            : 'Debes habilitarlas en la configuración de tu navegador para este sitio.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {error && (
                                <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                                    {error}
                                </div>
                            )}
                            <button
                                onClick={subscribed ? unsubscribe : subscribe}
                                disabled={loading}
                                className={`w-full flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all ${
                                    subscribed
                                        ? 'bg-green-50 border-green-200 text-green-800'
                                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                } ${loading ? 'opacity-60 pointer-events-none' : ''}`}
                            >
                                {subscribed ? (
                                    <Bell size={22} className="shrink-0 text-green-600" />
                                ) : (
                                    <BellOff size={22} className="shrink-0 text-slate-400" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm">
                                        {loading ? 'Procesando...' : subscribed ? 'Notificaciones activas' : 'Activar notificaciones'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {subscribed
                                            ? 'Recibirás avisos de partidos, cierres y resultados'
                                            : 'Avisos de partidos, cierres y resultados en tu móvil'}
                                    </p>
                                </div>
                                <span
                                    className={`ml-auto inline-block h-6 w-11 rounded-full transition-colors shrink-0`}
                                    style={{ backgroundColor: subscribed ? primaryColor : '#e2e8f0' }}
                                />
                            </button>
                        </div>
                    )}

                    {/* Qué notificaciones recibirás */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                            Tipos de avisos
                        </h3>
                        <ul className="space-y-3">
                            {[
                                { icon: '⏰', title: 'Recordatorio de partido', desc: '1 hora antes del inicio' },
                                { icon: '⚠️', title: 'Cierre de pronósticos', desc: '15 minutos antes del inicio' },
                                { icon: '✅', title: 'Resultado disponible', desc: 'Al terminar el partido' },
                                { icon: '🎯', title: 'Predicción exacta', desc: 'Cuando aciertas el marcador exacto' },
                            ].map((n) => (
                                <li key={n.title} className="flex items-start gap-3">
                                    <span className="text-xl shrink-0">{n.icon}</span>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{n.title}</p>
                                        <p className="text-xs text-slate-500">{n.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <p className="text-center text-xs text-slate-400 px-4">
                        Las notificaciones funcionan incluso con el navegador cerrado.
                        Puedes desactivarlas en cualquier momento.
                    </p>
                </div>
            )}
        </div>
        </CorpLayout>
    );
};

export default Help;
