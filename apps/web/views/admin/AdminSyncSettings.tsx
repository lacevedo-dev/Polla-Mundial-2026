import React, { useEffect, useState } from 'react';
import {
  Save,
  RefreshCw,
  Cpu,
  Layers,
  Database,
  Copy,
  Zap,
  BarChart2,
  Bell,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingDown,
} from 'lucide-react';
import { useFootballSyncStore } from '../../stores/football-sync.store';
import type { SyncMode, AdjustSensitivity, UpdateConfig, OptimizationSummary } from '../../types/football-sync';
import { BASE_URL } from '../../api';

// === HELPERS ===

const SYNC_MODES: { value: SyncMode; label: string; description: string; color: string }[] = [
  {
    value: 'MANUAL',
    label: 'Manual',
    description: 'Tú controlas todo. El sistema calcula los valores óptimos pero no ejecuta cambios automáticos.',
    color: 'border-slate-300 bg-slate-50 text-slate-700',
  },
  {
    value: 'SEMI_AUTO',
    label: 'Semi-Automático',
    description: 'El sistema calcula y aplica ajustes según los parámetros definidos. Puedes sobrescribir en cualquier momento.',
    color: 'border-sky-300 bg-sky-50 text-sky-700',
  },
  {
    value: 'AUTO',
    label: 'Automático',
    description: 'El sistema gestiona todo de forma autónoma y notifica cada ajuste realizado.',
    color: 'border-lime-300 bg-lime-50 text-lime-700',
  },
];

const SENSITIVITY_OPTIONS: { value: AdjustSensitivity; label: string; desc: string }[] = [
  { value: 'LOW', label: 'Conservador', desc: 'Solo ajusta en situaciones críticas (>90% de cuota o emergencias)' },
  { value: 'MEDIUM', label: 'Moderado', desc: 'Ajusta basado en métricas (>70% de cuota o cambios de 20%+)' },
  { value: 'HIGH', label: 'Agresivo', desc: 'Optimiza constantemente para máxima eficiencia' },
];

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled }) => (
  <label className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        checked ? 'bg-lime-500' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
    <div>
      <div className="text-sm font-semibold text-slate-800">{label}</div>
      {description && <div className="text-xs text-slate-500">{description}</div>}
    </div>
  </label>
);

const NumberInput: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  description?: string;
}> = ({ label, value, onChange, min = 1, max, unit, description }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-300"
      />
      {unit && <span className="text-xs text-slate-500">{unit}</span>}
    </div>
    {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
  </div>
);

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: string;
}> = ({ icon, title, subtitle, children, accent = 'bg-slate-50' }) => (
  <div className={`rounded-2xl border border-slate-100 ${accent} p-5`}>
    <div className="flex items-center gap-3 mb-4">
      <div className="rounded-xl bg-white p-2 shadow-sm border border-slate-100">{icon}</div>
      <div>
        <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

// === COMPONENTE PRINCIPAL ===

const AdminSyncSettings: React.FC = () => {
  const { config, isLoading, error, fetchConfig, updateConfig } = useFootballSyncStore();
  const [form, setForm] = useState<UpdateConfig>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<OptimizationSummary | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    fetchConfig();
    loadMetrics();
  }, [fetchConfig]);

  useEffect(() => {
    if (config) {
      setForm({
        syncMode: config.syncMode ?? 'SEMI_AUTO',
        enableSmartGrouping: config.enableSmartGrouping ?? true,
        groupingWindowMinutes: config.groupingWindowMinutes ?? 15,
        maxMatchesPerGroup: config.maxMatchesPerGroup ?? 10,
        enableResponseCache: config.enableResponseCache ?? true,
        cacheExpirationMinutes: config.cacheExpirationMinutes ?? 5,
        maxCacheSize: config.maxCacheSize ?? 100,
        enableDeduplication: config.enableDeduplication ?? true,
        minMinutesBetweenSyncs: config.minMinutesBetweenSyncs ?? 3,
        skipUnchangedMatches: config.skipUnchangedMatches ?? true,
        enableAutoAdjustment: config.enableAutoAdjustment ?? false,
        autoAdjustSensitivity: config.autoAdjustSensitivity ?? 'MEDIUM',
        maxAutoIntervalChange: config.maxAutoIntervalChange ?? 10,
        autoAdjustCooldown: config.autoAdjustCooldown ?? 30,
        freshnessEfficiencyBalance: config.freshnessEfficiencyBalance ?? 50,
        notifyOnAdjustment: config.notifyOnAdjustment ?? true,
        notifyOnAnomaly: config.notifyOnAnomaly ?? true,
        adjustmentNotificationEmail: config.adjustmentNotificationEmail,
      });
    }
  }, [config]);

  const loadMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const res = await fetch(`${BASE_URL}/admin/football/monitoring/optimization/summary`, {
        credentials: 'include',
      });
      if (res.ok) {
        setSummary(await res.json());
      }
    } catch {
      // silencioso
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // error manejado por store
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof UpdateConfig, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading && !config) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400">
        <RefreshCw size={20} className="animate-spin mr-2" />
        Cargando configuración...
      </div>
    );
  }

  const balanceLabel = (v: number) =>
    v < 30 ? 'Máxima eficiencia (menos syncs)' :
    v > 70 ? 'Máxima frescura (más syncs)' :
    'Balance óptimo';

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sistema Auto-Adaptable</h2>
          <p className="text-sm text-slate-500">
            Configura cómo el sistema optimiza las sincronizaciones según los parámetros que definas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 rounded-xl bg-lime-50 px-3 py-1.5 text-xs font-bold text-lime-700">
              <CheckCircle2 size={12} /> Guardado
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            <Save size={14} className={saving ? 'animate-pulse' : ''} />
            Guardar cambios
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Métricas de hoy */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Requests ahorrados', value: summary.today?.requestsSaved ?? 0, icon: <TrendingDown size={14} />, color: 'text-lime-700 bg-lime-50' },
            { label: 'Syncs deduplicados', value: summary.today?.duplicateSyncsAvoided ?? 0, icon: <Copy size={14} />, color: 'text-sky-700 bg-sky-50' },
            { label: 'Hit rate caché', value: `${((summary.today?.cacheHitRate ?? 0) * 100).toFixed(0)}%`, icon: <Database size={14} />, color: 'text-purple-700 bg-purple-50' },
            { label: 'Modo actual', value: form.syncMode ?? 'SEMI_AUTO', icon: <Cpu size={14} />, color: 'text-slate-700 bg-slate-100' },
          ].map((m) => (
            <div key={m.label} className={`rounded-xl ${m.color} px-4 py-3 flex items-center gap-3`}>
              <div className="opacity-70">{m.icon}</div>
              <div>
                <div className="text-xs text-current opacity-70">{m.label}</div>
                <div className="font-bold text-sm">{m.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modo de operación */}
      <SectionCard
        icon={<Cpu size={16} className="text-slate-600" />}
        title="Modo de Operación"
        subtitle="Define cómo el sistema toma decisiones de sincronización"
        accent="bg-slate-50"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {SYNC_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => set('syncMode', m.value)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                form.syncMode === m.value
                  ? `${m.color} border-current`
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-sm mb-1">{m.label}</div>
              <div className="text-xs opacity-80">{m.description}</div>
              {form.syncMode === m.value && (
                <div className="mt-2 flex items-center gap-1 text-xs font-bold">
                  <CheckCircle2 size={11} /> Activo
                </div>
              )}
            </button>
          ))}
        </div>

        {form.syncMode === 'MANUAL' && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            En modo manual, las optimizaciones siguen activas pero el sistema no cambiará automáticamente el intervalo ni la estrategia.
          </div>
        )}
      </SectionCard>

      {/* Agrupación inteligente */}
      <SectionCard
        icon={<Layers size={16} className="text-sky-600" />}
        title="Agrupación Inteligente"
        subtitle="Agrupa partidos cercanos en el tiempo en un solo sync para reducir requests"
        accent="bg-sky-50/30"
      >
        <ToggleSwitch
          checked={form.enableSmartGrouping ?? true}
          onChange={(v) => set('enableSmartGrouping', v)}
          label="Habilitar agrupación inteligente"
          description="Partidos dentro de la ventana de tiempo se sincronizan juntos"
        />
        {form.enableSmartGrouping && (
          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100">
            <NumberInput
              label="Ventana de agrupación"
              value={form.groupingWindowMinutes ?? 15}
              onChange={(v) => set('groupingWindowMinutes', v)}
              min={1}
              max={60}
              unit="minutos"
              description="Partidos dentro de este tiempo se agrupan"
            />
            <NumberInput
              label="Máx. partidos por grupo"
              value={form.maxMatchesPerGroup ?? 10}
              onChange={(v) => set('maxMatchesPerGroup', v)}
              min={2}
              max={50}
              unit="partidos"
              description="Límite de partidos por sincronización grupal"
            />
          </div>
        )}
      </SectionCard>

      {/* Caché de respuestas */}
      <SectionCard
        icon={<Database size={16} className="text-purple-600" />}
        title="Caché de Respuestas"
        subtitle="Reutiliza respuestas recientes de la API para reducir requests redundantes"
        accent="bg-purple-50/30"
      >
        <ToggleSwitch
          checked={form.enableResponseCache ?? true}
          onChange={(v) => set('enableResponseCache', v)}
          label="Habilitar caché de respuestas"
          description="Respuestas válidas se reutilizan por el tiempo configurado"
        />
        {form.enableResponseCache && (
          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100">
            <NumberInput
              label="Expiración del caché"
              value={form.cacheExpirationMinutes ?? 5}
              onChange={(v) => set('cacheExpirationMinutes', v)}
              min={1}
              max={30}
              unit="minutos"
              description="Tiempo antes de que la respuesta se considere obsoleta"
            />
            <NumberInput
              label="Tamaño máximo"
              value={form.maxCacheSize ?? 100}
              onChange={(v) => set('maxCacheSize', v)}
              min={10}
              max={1000}
              unit="entradas"
              description="Número máximo de respuestas almacenadas"
            />
          </div>
        )}
      </SectionCard>

      {/* Deduplicación */}
      <SectionCard
        icon={<Copy size={16} className="text-emerald-600" />}
        title="Deduplicación de Syncs"
        subtitle="Omite sincronizaciones redundantes cuando los datos no han cambiado"
        accent="bg-emerald-50/30"
      >
        <div className="space-y-3">
          <ToggleSwitch
            checked={form.enableDeduplication ?? true}
            onChange={(v) => set('enableDeduplication', v)}
            label="Habilitar deduplicación"
            description="Evita sincronizar el mismo partido más de lo necesario"
          />
          <ToggleSwitch
            checked={form.skipUnchangedMatches ?? true}
            onChange={(v) => set('skipUnchangedMatches', v)}
            label="Omitir partidos sin cambios"
            description="Si los datos del partido son idénticos al último sync, se omite"
            disabled={!form.enableDeduplication}
          />
          {form.enableDeduplication && (
            <div className="pt-2 border-t border-slate-100">
              <NumberInput
                label="Tiempo mínimo entre syncs"
                value={form.minMinutesBetweenSyncs ?? 3}
                onChange={(v) => set('minMinutesBetweenSyncs', v)}
                min={1}
                max={30}
                unit="minutos"
                description="Mínimo tiempo que debe pasar antes de volver a sincronizar el mismo partido"
              />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Balance frescura/eficiencia */}
      <SectionCard
        icon={<Zap size={16} className="text-amber-600" />}
        title="Balance Frescura vs. Eficiencia"
        subtitle="Ajusta el equilibrio entre datos actualizados y ahorro de requests"
        accent="bg-amber-50/30"
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Máxima eficiencia</span>
            <span className="text-xs font-bold text-amber-700">{balanceLabel(form.freshnessEfficiencyBalance ?? 50)}</span>
            <span className="text-xs text-slate-500">Máxima frescura</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={form.freshnessEfficiencyBalance ?? 50}
            onChange={(e) => set('freshnessEfficiencyBalance', Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-gradient-to-r from-lime-300 via-amber-300 to-sky-300 cursor-pointer"
          />
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-center">
            <div className="rounded-lg bg-lime-50 border border-lime-200 p-2 text-lime-700">
              <div className="font-bold">0-33</div>
              <div className="opacity-80">Ahorra ~80% requests</div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-700">
              <div className="font-bold">34-66</div>
              <div className="opacity-80">Balance óptimo</div>
            </div>
            <div className="rounded-lg bg-sky-50 border border-sky-200 p-2 text-sky-700">
              <div className="font-bold">67-100</div>
              <div className="opacity-80">Datos siempre frescos</div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Auto-ajuste */}
      <SectionCard
        icon={<BarChart2 size={16} className="text-rose-600" />}
        title="Auto-Ajuste Inteligente"
        subtitle="El sistema modifica automáticamente la estrategia según las métricas en tiempo real"
        accent="bg-rose-50/30"
      >
        <ToggleSwitch
          checked={form.enableAutoAdjustment ?? false}
          onChange={(v) => set('enableAutoAdjustment', v)}
          label="Habilitar auto-ajuste"
          description="Activa ajustes automáticos de intervalo y estrategia según condiciones del sistema"
        />
        {form.enableAutoAdjustment && (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Sensibilidad</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {SENSITIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('autoAdjustSensitivity', opt.value)}
                    className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                      form.autoAdjustSensitivity === opt.value
                        ? 'border-rose-400 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs mb-0.5">{opt.label}</div>
                    <div className="text-xs opacity-75">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberInput
                label="Cambio máximo de intervalo"
                value={form.maxAutoIntervalChange ?? 10}
                onChange={(v) => set('maxAutoIntervalChange', v)}
                min={1}
                max={30}
                unit="minutos"
                description="Límite del ajuste automático al intervalo"
              />
              <NumberInput
                label="Cooldown entre ajustes"
                value={form.autoAdjustCooldown ?? 30}
                onChange={(v) => set('autoAdjustCooldown', v)}
                min={5}
                max={120}
                unit="minutos"
                description="Tiempo de espera antes de aplicar otro ajuste"
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Notificaciones */}
      <SectionCard
        icon={<Bell size={16} className="text-indigo-600" />}
        title="Notificaciones de Ajustes"
        subtitle="Recibe alertas cuando el sistema realice ajustes automáticos"
        accent="bg-indigo-50/30"
      >
        <div className="space-y-3">
          <ToggleSwitch
            checked={form.notifyOnAdjustment ?? true}
            onChange={(v) => set('notifyOnAdjustment', v)}
            label="Notificar cada ajuste automático"
            description="Genera una alerta en el dashboard por cada ajuste realizado"
          />
          <ToggleSwitch
            checked={form.notifyOnAnomaly ?? true}
            onChange={(v) => set('notifyOnAnomaly', v)}
            label="Notificar anomalías detectadas"
            description="Alerta cuando se detectan patrones inusuales en las sincronizaciones"
          />
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Email para notificaciones (opcional)
            </label>
            <input
              type="email"
              value={form.adjustmentNotificationEmail ?? ''}
              onChange={(e) => set('adjustmentNotificationEmail', e.target.value || undefined)}
              placeholder="admin@example.com"
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
      </SectionCard>

      {/* Recomendaciones */}
      {summary && summary.recommendations.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3 text-amber-800 font-bold text-sm">
            <Clock size={14} />
            Recomendaciones del Sistema
          </div>
          <ul className="space-y-2">
            {summary.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <ChevronRight size={12} className="shrink-0 mt-0.5" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

    </form>
  );
};

export default AdminSyncSettings;
