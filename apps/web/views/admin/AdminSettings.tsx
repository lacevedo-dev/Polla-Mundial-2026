import React from 'react';
import { Shield, Database, Key, Users, Trophy, Target, Swords, CreditCard, BarChart3, Brain, Eye, EyeOff, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { request } from '../../api';

const PERMISSIONS_MATRIX = [
    { role: 'USER', label: 'Usuario', color: 'text-slate-600', permissions: {
        dashboard: true, predictions: true, leagues: true, ranking: true,
        adminDashboard: false, adminUsers: false, adminLeagues: false, adminMatches: false, adminPlans: false,
    }},
    { role: 'ADMIN', label: 'Admin (Liga)', color: 'text-blue-600', permissions: {
        dashboard: true, predictions: true, leagues: true, ranking: true,
        adminDashboard: false, adminUsers: false, adminLeagues: false, adminMatches: false, adminPlans: false,
    }},
    { role: 'SUPERADMIN', label: 'Super Admin', color: 'text-amber-600', permissions: {
        dashboard: true, predictions: true, leagues: true, ranking: true,
        adminDashboard: true, adminUsers: true, adminLeagues: true, adminMatches: true, adminPlans: true,
    }},
];

const PERMISSION_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
    dashboard: { label: 'Dashboard', icon: BarChart3 },
    predictions: { label: 'Pronósticos', icon: Target },
    leagues: { label: 'Pollas', icon: Trophy },
    ranking: { label: 'Ranking', icon: Users },
    adminDashboard: { label: 'Panel Admin', icon: Shield },
    adminUsers: { label: 'Gestión Usuarios', icon: Users },
    adminLeagues: { label: 'Gestión Pollas', icon: Trophy },
    adminMatches: { label: 'Gestión Partidos', icon: Swords },
    adminPlans: { label: 'Gestión Planes', icon: CreditCard },
};

const DEFAULT_PROMPT = `Eres un analista experto del Mundial FIFA 2026 con acceso a estadísticas reales de los equipos.
Dado un partido de fútbol, devuelve SOLO un objeto JSON válido con esta estructura exacta:
{
  "homeWin": <número entero 0-100>,
  "draw": <número entero 0-100>,
  "awayWin": <número entero 0-100>,
  "homeForm": ["W","D","L","W","W"],
  "awayForm": ["L","W","D","W","L"],
  "scores": ["2-1","1-1","0-2"],
  "smartPick": "<recomendación táctica concisa, ej: 'Local gana', 'Empate sin goles', 'Visitante anota', 'Local +1.5 goles'. Máximo 35 caracteres.>",
  "insight": "<análisis táctico general en español, máximo 100 caracteres, SIN nombres de equipos>",
  "personalInsight": "<análisis personalizado específico: menciona los equipos por nombre, cita datos reales, forma actual, resultados recientes y contexto del encuentro. Máximo 220 caracteres. NO uses frases genéricas.>"
}
Reglas: homeWin + draw + awayWin = 100. scores tiene 3 elementos [más_probable, equilibrado, sorpresa]. homeForm y awayForm basados en resultados reales recientes.
Responde ÚNICAMENTE con el JSON.`;

interface AiConfigForm {
    provider: 'anthropic' | 'openai';
    apiKey: string;
    model: string;
    systemPrompt: string;
}

const AdminSettings: React.FC = () => {
    const { user } = useAuthStore();
    const [aiConfig, setAiConfig] = React.useState<AiConfigForm>({
        provider: 'anthropic',
        apiKey: '',
        model: 'claude-haiku-4-5-20251001',
        systemPrompt: DEFAULT_PROMPT,
    });
    const [aiLoading, setAiLoading] = React.useState(false);
    const [aiSaving, setAiSaving] = React.useState(false);
    const [aiStatus, setAiStatus] = React.useState<'idle' | 'saved' | 'error'>('idle');
    const [showApiKey, setShowApiKey] = React.useState(false);
    const [resetStatus, setResetStatus] = React.useState<'idle' | 'resetting' | 'done' | 'error'>('idle');
    const [lastReset, setLastReset] = React.useState<string | null>(null);

    React.useEffect(() => {
        setAiLoading(true);
        request<AiConfigForm>('/admin/settings/ai')
            .then((data) => {
                setAiConfig((prev) => ({
                    ...prev,
                    ...data,
                    systemPrompt: data.systemPrompt || DEFAULT_PROMPT,
                }));
            })
            .catch(() => {})
            .finally(() => setAiLoading(false));
    }, []);

    const handleResetCredits = async () => {
        setResetStatus('resetting');
        try {
            const res = await request<{ ok: boolean; resetAt: string }>('/admin/settings/credits/reset', { method: 'POST' });
            setLastReset(res.resetAt);
            setResetStatus('done');
            setTimeout(() => setResetStatus('idle'), 3000);
        } catch {
            setResetStatus('error');
            setTimeout(() => setResetStatus('idle'), 3000);
        }
    };

    const handleSaveAi = async () => {
        setAiSaving(true);
        setAiStatus('idle');
        try {
            await request('/admin/settings/ai', {
                method: 'PATCH',
                body: JSON.stringify(aiConfig),
            });
            setAiStatus('saved');
        } catch {
            setAiStatus('error');
        } finally {
            setAiSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">Configuración del Sistema</h1>
                <p className="text-sm text-slate-500 mt-1">Información del sistema, roles y permisos</p>
            </div>

            {/* System Info */}
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                        <Database size={18} className="text-amber-600" />
                    </div>
                    <p className="font-black text-slate-900">Información del Sistema</p>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {[
                        { label: 'Aplicación', value: 'Polla 2026' },
                        { label: 'Versión', value: '1.0.0' },
                        { label: 'Entorno', value: import.meta.env.MODE },
                        { label: 'API URL', value: import.meta.env.VITE_API_URL ?? 'localhost:3004' },
                        { label: 'Usuario Admin', value: user?.name ?? '—' },
                        { label: 'Rol', value: user?.systemRole ?? 'SUPERADMIN' },
                    ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5 break-all">{value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Roles & Permissions Matrix */}
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Shield size={18} className="text-blue-600" />
                    </div>
                    <p className="font-black text-slate-900">Roles y Permisos</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left py-2 pr-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-48">
                                    Permiso
                                </th>
                                {PERMISSIONS_MATRIX.map((r) => (
                                    <th key={r.role} className="text-center py-2 px-3">
                                        <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${r.color}`}>
                                            {r.label}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {Object.entries(PERMISSION_LABELS).map(([key, { label, icon: Icon }]) => (
                                <tr key={key} className="hover:bg-slate-50">
                                    <td className="py-2.5 pr-4">
                                        <div className="flex items-center gap-2">
                                            <Icon size={14} className="text-slate-400" />
                                            <span className="text-sm text-slate-700 font-medium">{label}</span>
                                        </div>
                                    </td>
                                    {PERMISSIONS_MATRIX.map((r) => (
                                        <td key={r.role} className="py-2.5 px-3 text-center">
                                            {(r.permissions as any)[key] ? (
                                                <span className="inline-flex w-5 h-5 rounded-full bg-lime-100 items-center justify-center text-lime-600 text-xs font-black">✓</span>
                                            ) : (
                                                <span className="inline-flex w-5 h-5 rounded-full bg-slate-100 items-center justify-center text-slate-300 text-xs">—</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Credits Management */}
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-lime-100 rounded-xl flex items-center justify-center">
                        <BarChart3 size={18} className="text-lime-700" />
                    </div>
                    <div>
                        <p className="font-black text-slate-900">Gestión de Créditos IA</p>
                        <p className="text-xs text-slate-400">Controla los créditos Smart Insights de todos los usuarios</p>
                    </div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3">
                    <div className="text-xs text-slate-600 space-y-1">
                        <p className="font-bold text-slate-800">¿Cómo funcionan los créditos?</p>
                        <p>• Cada usuario consume un crédito al ver el análisis IA de un partido.</p>
                        <p>• Los límites por plan se configuran en <span className="font-bold">Admin → Planes</span>.</p>
                        <p>• Cambiar el límite de un plan <span className="font-bold">resetea automáticamente</span> los créditos de esos usuarios (próxima vez que carguen la app).</p>
                        <p>• El botón de abajo resetea todos los créditos sin importar el plan.</p>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <div>
                            {lastReset && (
                                <p className="text-[9px] text-slate-400">
                                    Último reset: {new Date(lastReset).toLocaleString('es-CO')}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleResetCredits}
                            disabled={resetStatus === 'resetting'}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all disabled:opacity-50 ${
                                resetStatus === 'done' ? 'bg-lime-400 text-slate-900' :
                                resetStatus === 'error' ? 'bg-rose-100 text-rose-700' :
                                'bg-amber-400 text-slate-900 hover:bg-amber-300'
                            }`}
                        >
                            <RefreshCw size={13} className={resetStatus === 'resetting' ? 'animate-spin' : ''} />
                            {resetStatus === 'resetting' ? 'Reseteando...' :
                             resetStatus === 'done' ? 'Créditos reseteados' :
                             resetStatus === 'error' ? 'Error al resetear' :
                             'Resetear todos los créditos'}
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Configuration */}
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100">
                            <Brain size={18} className="text-purple-600" />
                        </div>
                        <div>
                            <p className="font-black text-slate-900">Smart Insights — Configuración IA</p>
                            <p className="text-xs text-slate-400">API key y prompt para el análisis de partidos</p>
                        </div>
                    </div>
                    {aiStatus === 'saved' && (
                        <span className="flex items-center gap-1.5 text-xs font-black text-lime-600">
                            <CheckCircle2 size={14} /> Guardado
                        </span>
                    )}
                    {aiStatus === 'error' && (
                        <span className="flex items-center gap-1.5 text-xs font-black text-rose-600">
                            <AlertCircle size={14} /> Error al guardar
                        </span>
                    )}
                </div>

                {aiLoading ? (
                    <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
                ) : (
                    <div className="space-y-4">
                        {/* Provider + Model row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Proveedor
                                </label>
                                <select
                                    value={aiConfig.provider}
                                    onChange={(e) => {
                                        const p = e.target.value as AiConfigForm['provider'];
                                        setAiConfig((prev) => ({
                                            ...prev,
                                            provider: p,
                                            model: p === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001',
                                        }));
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                    <option value="anthropic">Anthropic (Claude)</option>
                                    <option value="openai">OpenAI (GPT)</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Modelo
                                </label>
                                <input
                                    type="text"
                                    value={aiConfig.model}
                                    onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                                    placeholder={aiConfig.provider === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001'}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>
                        </div>

                        {/* API Key */}
                        <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                API Key
                            </label>
                            <div className="relative">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={aiConfig.apiKey}
                                    onChange={(e) => setAiConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                                    placeholder={aiConfig.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            <p className="mt-1 text-[9px] text-slate-400">
                                La key se almacena cifrada. Al editar, ingresa la nueva key completa.
                            </p>
                        </div>

                        {/* System Prompt */}
                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    System Prompt
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setAiConfig((prev) => ({ ...prev, systemPrompt: DEFAULT_PROMPT }))}
                                    className="text-[9px] font-black uppercase tracking-wider text-amber-600 hover:underline"
                                >
                                    Restaurar predeterminado
                                </button>
                            </div>
                            <textarea
                                rows={8}
                                value={aiConfig.systemPrompt}
                                onChange={(e) => setAiConfig((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <p className="mt-1 text-[9px] text-slate-400">
                                El prompt instruye al modelo qué estructura JSON retornar. Modifícalo con precaución.
                            </p>
                        </div>

                        <button
                            onClick={handleSaveAi}
                            disabled={aiSaving}
                            className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-900 transition-all hover:bg-amber-300 disabled:opacity-50"
                        >
                            <Save size={14} />
                            {aiSaving ? 'Guardando...' : 'Guardar configuración IA'}
                        </button>
                    </div>
                )}
            </div>

            {/* JWT Info */}
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Key size={18} className="text-slate-600" />
                    </div>
                    <p className="font-black text-slate-900">Sesión Activa</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-24">ID</span>
                        <span className="text-xs font-mono text-slate-600">{user?.id ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-24">Email</span>
                        <span className="text-sm text-slate-700">{user?.email ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-24">Username</span>
                        <span className="text-sm text-slate-700">@{user?.username ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-24">System Role</span>
                        <span className="text-sm font-black text-amber-600">{user?.systemRole ?? 'SUPERADMIN'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
