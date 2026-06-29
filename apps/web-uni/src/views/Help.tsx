import React from 'react';
import {
    Trophy, TrendingUp, CheckCircle2, Calendar, Zap,
    Bell, BellOff, Shield, Target, HelpCircle, Download, Star,
} from 'lucide-react';
import { TIEBREAK_CRITERIA } from '@polla-2026/shared';
import { KnockoutMultiplierGuide } from '../components/help/KnockoutMultiplierGuide';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useTenantStore } from '../stores/tenant.store';
import { CorpLayout } from '../layouts/CorpLayout';
import { ScoringRulesCard } from '../components/ScoringRulesCard';
import { generateHelpPDF } from '../utils/generateHelpPDF';
import { request } from '../api';

type Tab = 'points' | 'rules' | 'notifications';

interface ScoringRule {
    ruleType: string;
    points: number;
    description?: string | null;
    active?: boolean;
}

interface PhaseBonusHelp {
    label: string;
    sub: string;
    ruleType: string;
    icon: string;
}

interface ScoringGuide {
    scoringRules: ScoringRule[];
    phaseBonuses: PhaseBonusHelp[];
    knockoutAdvance: { title: string; summary: string };
}

function getPoints(rules: ScoringRule[] | undefined, ruleType: string, fallback: number): number {
    if (!rules?.length) return fallback;
    const rule = rules.find((r) => r.ruleType === ruleType && r.active !== false);
    return rule?.points ?? fallback;
}

function fmtPts(n: number): string {
    return `${n} ${n === 1 ? 'pt' : 'pts'}`;
}

const KNOCKOUT_MULTIPLIER = 1.5;

function fmtKnockoutPts(base: number): string {
    return fmtPts(base * KNOCKOUT_MULTIPLIER);
}

const Help: React.FC = () => {
    const [activeTab, setActiveTab] = React.useState<Tab>('points');
    const [scoringGuide, setScoringGuide] = React.useState<ScoringGuide | null>(null);
    const tenant = useTenantStore((s) => s.tenant);
    const { supported, permission, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications();

    React.useEffect(() => {
        request<ScoringGuide>('/corp/help/scoring-guide')
            .then(setScoringGuide)
            .catch(() => setScoringGuide(null));
    }, []);

    const rules = scoringGuide?.scoringRules;
    const exactScore = getPoints(rules, 'EXACT_SCORE', 5);
    const correctWinner = getPoints(rules, 'CORRECT_WINNER', 2);
    const teamGoals = getPoints(rules, 'TEAM_GOALS', 1);
    const uniquePred = getPoints(rules, 'UNIQUE_PREDICTION', 5);
    const bonusR16 = getPoints(rules, 'PHASE_BONUS_R16', 8);
    const bonusQF = getPoints(rules, 'PHASE_BONUS_QF', 4);
    const bonusSF = getPoints(rules, 'PHASE_BONUS_SF', 2);
    const bonusFinal = getPoints(rules, 'PHASE_BONUS_FINAL', 5);
    const phaseBonuses = scoringGuide?.phaseBonuses ?? [
        { label: 'Octavos', sub: '16 → 8', ruleType: 'PHASE_BONUS_R16', icon: '🥈' },
        { label: 'Cuartos', sub: '8 → 4', ruleType: 'PHASE_BONUS_QF', icon: '🥉' },
        { label: 'Semifinal', sub: '4 → 2', ruleType: 'PHASE_BONUS_SF', icon: '🏅' },
        { label: 'Campeón', sub: 'El ganador', ruleType: 'PHASE_BONUS_FINAL', icon: '🏆' },
    ];
    const phaseBonusPoints: Record<string, number> = {
        PHASE_BONUS_R16: bonusR16,
        PHASE_BONUS_QF: bonusQF,
        PHASE_BONUS_SF: bonusSF,
        PHASE_BONUS_FINAL: bonusFinal,
    };

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'tu organización';
    const primaryColor = 'var(--color-primary, #f59e0b)';
    const primaryHex = tenant?.branding?.primaryColor ?? '#f59e0b';

    const tabs: { id: Tab; label: string; icon: React.FC<{ size?: number }> }[] = [
        { id: 'points', label: 'Sistema de Puntos', icon: TrendingUp },
        { id: 'rules', label: 'Reglas del Juego', icon: Shield }
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
                            En <strong className="text-slate-800">grupos</strong> cada partido vale hasta {fmtPts(exactScore)} base.
                            En <strong className="text-slate-800">eliminatorias</strong> multiplicas ×{KNOCKOUT_MULTIPLIER}
                            (ej. exacto = {fmtKnockoutPts(exactScore)}). Bonos únicos y clasificados van aparte.
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
                                <span className="text-3xl font-black text-lime-700">{exactScore}</span>
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
                                <span className="text-3xl font-black text-blue-700">{correctWinner}</span>
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
                                <span className="text-3xl font-black text-purple-700">{teamGoals}</span>
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
                                Ganador y gol se <strong>suman</strong>. Hasta {fmtPts(correctWinner + teamGoals)} combinados por partido.
                            </p>
                            <div className="space-y-2 pt-1">
                                {[
                                    { combo: 'Ganador + gol acertado', total: fmtPts(correctWinner + teamGoals), color: 'text-teal-700' },
                                    { combo: 'Solo ganador',           total: fmtPts(correctWinner), color: 'text-blue-700' },
                                    { combo: 'Solo gol acertado',      total: fmtPts(teamGoals),  color: 'text-purple-700' },
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

                    <section className="space-y-4" aria-labelledby="help-eliminatorias">
                        <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">2</span>
                            <h3 id="help-eliminatorias" className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-700">
                                Multiplicador en eliminatorias (×{KNOCKOUT_MULTIPLIER})
                            </h3>
                        </div>
                        <KnockoutMultiplierGuide />
                    </section>

                    {/* Bonos adicionales */}
                    <section className="space-y-4" aria-labelledby="help-bonos">
                        <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">3</span>
                            <h3 id="help-bonos" className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-700">
                                Bonos adicionales
                            </h3>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Independientes del ×{KNOCKOUT_MULTIPLIER} del partido: se suman cuando cumples su condición.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">⭐</span>
                                        <span className="text-sm font-black uppercase tracking-wide text-amber-800">Predicción única</span>
                                    </div>
                                    <span className="text-3xl font-black text-amber-700">+{uniquePred}</span>
                                </div>
                                <p className="text-sm text-amber-700 leading-relaxed">
                                    Si acertaste el marcador exacto <strong>y eres el único jugador de la liga</strong> que predijo ese marcador, recibes {fmtPts(uniquePred)} extra.
                                </p>
                                <div className="rounded-xl bg-amber-100 px-3 py-2 text-xs text-amber-700 italic">
                                    Solo tú predijiste <strong>2‑1</strong> y terminó <strong>2‑1</strong> → {exactScore} base + {uniquePred} único = <strong>{exactScore + uniquePred} pts</strong>
                                </div>
                            </div>

                            <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 space-y-3">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-2xl">🏆</span>
                                    <span className="text-sm font-black uppercase tracking-wide text-slate-800">Bono clasificados</span>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    En cada partido de eliminatoria, elige qué equipo clasifica a la siguiente ronda con el selector <strong className="text-slate-800">Clasifica</strong>.
                                    Si <strong className="text-slate-800">aciertas todos los picks de una fase completa</strong>, recibes el bono de esa fase.
                                </p>
                                <div className="grid grid-cols-2 gap-1.5 pt-1">
                                    {phaseBonuses.map((b) => (
                                        <div key={b.label} className="flex flex-col rounded-xl bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm">{b.icon}</span>
                                                <span className="text-sm font-black" style={{ color: primaryColor }}>
                                                    {fmtPts(phaseBonusPoints[b.ruleType] ?? 0)}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-black text-slate-700 mt-1">{b.label}</p>
                                            <p className="text-[10px] text-slate-400">{b.sub}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-500 leading-snug pt-1">
                                    Si fallas aunque sea uno de los picks de la fase, no obtienes el bono de esa ronda. En empates debes elegir manualmente quién pasa en penales.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Tabla resumen */}
                    <div className="bg-slate-900 text-white p-8 rounded-2xl relative overflow-hidden shadow-xl">
                        <Target size={120} className="absolute -bottom-6 -right-6 opacity-10" />
                        <div className="relative z-10 max-w-lg space-y-4">
                            <h3 className="text-xl font-black uppercase tracking-tight">Resumen rápido</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Marcador exacto', pts: fmtPts(exactScore), icon: '🎯' },
                                    { label: 'Ganador correcto', pts: fmtPts(correctWinner), icon: '✅' },
                                    { label: 'Gol acertado', pts: fmtPts(teamGoals), icon: '⚽' },
                                    { label: 'Máximo sin exacto', pts: fmtPts(correctWinner + teamGoals), icon: '⚡' },
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

                    {/* Desempate */}
                    <section className="space-y-4" aria-labelledby="help-desempate">
                        <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">4</span>
                            <h3 id="help-desempate" className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-700">
                                Criterio de desempate
                            </h3>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Cuando dos jugadores tienen los mismos puntos, el ranking se decide con estos criterios <strong className="text-slate-700">en orden</strong>.
                            </p>
                            <ol className="space-y-2">
                                {TIEBREAK_CRITERIA.map((criterion, index) => (
                                    <li key={criterion.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-black text-slate-600">
                                            {index + 1}
                                        </span>
                                        <span className="text-base leading-none shrink-0">{criterion.icon}</span>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wide text-slate-800">{criterion.label}</p>
                                            {criterion.id === 'champion' && (
                                                <p className="text-xs text-slate-500 mt-0.5">Predijiste correctamente al campeón (bono clasificados, fase Final).</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </section>

                    <ScoringRulesCard
                        defaultExpanded
                        defaultTab="bonos"
                        scoringRules={rules}
                        className="mt-2"
                    />
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
                                Se consideran los goles a los <strong className="text-slate-700">90 minutos + tiempo adicional</strong>. En rondas eliminatorias se incluye prórroga pero no penales. Usa <strong className="text-slate-700">Clasifica</strong> para indicar quién pasa cuando hay empate.
                            </p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, white)' }}>
                                <Trophy size={20} style={{ color: primaryColor }} />
                            </div>
                            <h3 className="font-black text-slate-900">Ranking</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                La clasificación se actualiza automáticamente después de cada partido. En empate de puntos se aplican criterios de desempate (campeón acertado, marcadores exactos, etc.).
                            </p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, white)' }}>
                                <Star size={20} style={{ color: primaryColor }} />
                            </div>
                            <h3 className="font-black text-slate-900">Clasifica en eliminatorias</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                {scoringGuide?.knockoutAdvance.summary ?? (
                                    <>
                                        En octavos, cuartos, semifinal y final debes indicar qué equipo pasa a la siguiente ronda.
                                        Si el marcador tiene ganador, se asigna automáticamente; en empate debes elegirlo manualmente (penales).
                                        Esta selección solo influye en los <strong className="text-slate-700">bonos por fase</strong>, no en los puntos del marcador.
                                    </>
                                )}
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
