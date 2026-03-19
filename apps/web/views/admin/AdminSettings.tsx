import React from 'react';
import { Shield, Database, Key, Users, Trophy, Target, Swords, CreditCard, BarChart3, Brain, Eye, EyeOff, Save, CheckCircle2, AlertCircle, Plus, X, RotateCcw } from 'lucide-react';
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

const MODEL_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
    anthropic: [
        { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — rápido · bajo costo' },
        { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanceado' },
        { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 — máxima calidad' },
    ],
    openai: [
        { value: 'gpt-5.4', label: 'GPT-5.4 — más capaz · última generación' },
        { value: 'gpt-5-mini', label: 'GPT-5 Mini — rápido · bajo costo' },
        { value: 'gpt-4.1', label: 'GPT-4.1 — balanceado' },
        { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini — económico' },
    ],
};

interface AiConfigForm {
    provider: 'anthropic' | 'openai';
    apiKeys: string[];
    activeKeyIndex: number;
    model: string;
    systemPrompt: string;
}

const AdminSettings: React.FC = () => {
    const { user } = useAuthStore();
    const [aiConfig, setAiConfig] = React.useState<AiConfigForm>({
        provider: 'anthropic',
        apiKeys: [],
        activeKeyIndex: 0,
        model: 'claude-haiku-4-5-20251001',
        systemPrompt: DEFAULT_PROMPT,
    });
    const [aiLoading, setAiLoading] = React.useState(false);
    const [aiSaving, setAiSaving] = React.useState(false);
    const [aiStatus, setAiStatus] = React.useState<'idle' | 'saved' | 'error'>('idle');
    const [showNewKey, setShowNewKey] = React.useState(false);
    const [newKeyInput, setNewKeyInput] = React.useState('');
    const [addingKey, setAddingKey] = React.useState(false);
    React.useEffect(() => {
        setAiLoading(true);
        request<any>('/admin/settings/ai')
            .then((data) => {
                setAiConfig((prev) => ({
                    ...prev,
                    provider: data.provider ?? prev.provider,
                    apiKeys: Array.isArray(data.apiKeys) ? data.apiKeys : prev.apiKeys,
                    activeKeyIndex: data.activeKeyIndex ?? 0,
                    model: data.model ?? prev.model,
                    systemPrompt: data.systemPrompt || DEFAULT_PROMPT,
                }));
            })
            .catch(() => {})
            .finally(() => setAiLoading(false));
    }, []);


    const [aiSaveError, setAiSaveError] = React.useState<string | null>(null);

    const handleSaveAi = async (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        if (aiConfig.apiKeys.length === 0) {
            setAiSaveError('Agrega al menos una API key antes de guardar.');
            setAiStatus('error');
            setTimeout(() => { setAiStatus('idle'); setAiSaveError(null); }, 4000);
            return;
        }
        setAiSaving(true);
        setAiStatus('idle');
        setAiSaveError(null);
        try {
            await request('/admin/settings/ai', {
                method: 'PATCH',
                body: JSON.stringify(aiConfig),
            });
            setAiStatus('saved');
            // Reload to get freshly masked keys from the server
            const refreshed = await request<any>('/admin/settings/ai');
            setAiConfig((prev) => ({
                ...prev,
                apiKeys: Array.isArray(refreshed.apiKeys) ? refreshed.apiKeys : prev.apiKeys,
                activeKeyIndex: refreshed.activeKeyIndex ?? prev.activeKeyIndex,
            }));
            setTimeout(() => setAiStatus('idle'), 3000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error al guardar la configuración';
            setAiSaveError(msg);
            setAiStatus('error');
            setTimeout(() => { setAiStatus('idle'); setAiSaveError(null); }, 5000);
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
                        <p className="text-xs text-slate-400">Información sobre los créditos Smart Insights</p>
                    </div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                    <div className="text-xs text-slate-600 space-y-1">
                        <p className="font-bold text-slate-800">¿Cómo funcionan los créditos?</p>
                        <p>• Cada usuario consume un crédito al ver el análisis IA de un partido.</p>
                        <p>• Los límites por plan se configuran en <span className="font-bold">Admin → Planes</span>.</p>
                        <p>• Cambiar el límite de un plan <span className="font-bold">resetea automáticamente</span> los créditos de esos usuarios (próxima vez que carguen la app).</p>
                        <p>• Para resetear los créditos de un usuario específico, ve a <span className="font-bold">Admin → Usuarios</span> y usa el botón <span className="font-bold">⟳</span> en la fila del usuario.</p>
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
                            <AlertCircle size={14} /> {aiSaveError ?? 'Error al guardar'}
                        </span>
                    )}
                </div>

                {aiLoading ? (
                    <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
                ) : (
                    <form className="space-y-4" onSubmit={handleSaveAi}>
                        {/* Provider + Model row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                            model: MODEL_OPTIONS[p]?.[0]?.value ?? '',
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
                                <select
                                    value={aiConfig.model}
                                    onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                    {(MODEL_OPTIONS[aiConfig.provider] ?? []).map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* API Keys — rotation */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    API Keys — Rotación automática
                                </label>
                                <span className="flex items-center gap-1 text-[9px] text-slate-400">
                                    <RotateCcw size={10} />
                                    {aiConfig.apiKeys.length} key{aiConfig.apiKeys.length !== 1 ? 's' : ''} configurada{aiConfig.apiKeys.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Keys list */}
                            <div className="space-y-1.5">
                                {aiConfig.apiKeys.length === 0 && !addingKey && (
                                    <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                                        Sin keys configuradas. Agrega al menos una.
                                    </div>
                                )}
                                {aiConfig.apiKeys.map((key, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                                            idx === aiConfig.activeKeyIndex
                                                ? 'border-lime-200 bg-lime-50'
                                                : 'border-slate-200 bg-slate-50'
                                        }`}
                                    >
                                        <Key size={12} className="shrink-0 text-slate-400" />
                                        <span className="flex-1 font-mono text-xs text-slate-600">{key}</span>
                                        {idx === aiConfig.activeKeyIndex && (
                                            <span className="rounded-full bg-lime-200 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-lime-800">
                                                Activa
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            title="Eliminar key"
                                            onClick={() => {
                                                const next = aiConfig.apiKeys.filter((_, i) => i !== idx);
                                                setAiConfig((prev) => ({
                                                    ...prev,
                                                    apiKeys: next,
                                                    activeKeyIndex: Math.min(prev.activeKeyIndex, Math.max(0, next.length - 1)),
                                                }));
                                            }}
                                            className="ml-1 rounded-lg p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add new key */}
                            {addingKey ? (
                                <div className="mt-2 flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type={showNewKey ? 'text' : 'password'}
                                            name="ai-api-key"
                                            value={newKeyInput}
                                            onChange={(e) => setNewKeyInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newKeyInput.trim()) {
                                                    setAiConfig((prev) => ({ ...prev, apiKeys: [...prev.apiKeys, newKeyInput.trim()] }));
                                                    setNewKeyInput('');
                                                    setAddingKey(false);
                                                }
                                                if (e.key === 'Escape') { setAddingKey(false); setNewKeyInput(''); }
                                            }}
                                            placeholder={aiConfig.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                            autoComplete="new-password"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewKey((v) => !v)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showNewKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (newKeyInput.trim()) {
                                                setAiConfig((prev) => ({ ...prev, apiKeys: [...prev.apiKeys, newKeyInput.trim()] }));
                                                setNewKeyInput('');
                                                setAddingKey(false);
                                            }
                                        }}
                                        className="rounded-xl bg-lime-400 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-900 hover:bg-lime-300"
                                    >
                                        Añadir
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setAddingKey(false); setNewKeyInput(''); }}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setAddingKey(true)}
                                    className="mt-2 flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50"
                                >
                                    <Plus size={12} /> Agregar API Key
                                </button>
                            )}

                            <p className="mt-1.5 text-[9px] text-slate-400">
                                Si una key alcanza su límite de tasa o cuota, el sistema rota automáticamente a la siguiente.
                                La key activa se actualiza en la BD tras cada rotación.
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
                            type="submit"
                            disabled={aiSaving}
                            className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-900 transition-all hover:bg-amber-300 disabled:opacity-50"
                        >
                            <Save size={14} />
                            {aiSaving ? 'Guardando...' : 'Guardar configuración IA'}
                        </button>
                    </form>
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
