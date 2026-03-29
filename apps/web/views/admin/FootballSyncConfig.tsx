import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, Play, Pause, AlertCircle } from 'lucide-react';
import { useFootballSyncStore } from '../../stores/football-sync.store';
import type { UpdateConfig } from '../../types/football-sync';

const FootballSyncConfig: React.FC = () => {
  const { config, isLoading, error, fetchConfig, updateConfig, resetConfig, pauseSync, resumeSync } = useFootballSyncStore();
  const [formData, setFormData] = useState<UpdateConfig>({});
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (config) {
      setFormData({
        enabled: config.enabled,
        minSyncInterval: config.minSyncInterval,
        maxSyncInterval: config.maxSyncInterval,
        dailyRequestLimit: config.dailyRequestLimit,
        alertThreshold: config.alertThreshold,
        autoSyncEnabled: config.autoSyncEnabled,
        eventSyncEnabled: config.eventSyncEnabled,
        peakHoursSyncEnabled: config.peakHoursSyncEnabled,
        emergencyModeThreshold: config.emergencyModeThreshold,
        notifyOnError: config.notifyOnError,
        notifyOnLimit: config.notifyOnLimit,
      });
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateConfig(formData);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      // Error handled by store
    }
  };

  const handleReset = async () => {
    if (confirm('¿Resetear configuración a valores por defecto?')) {
      try {
        await resetConfig();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch (err) {
        // Error handled by store
      }
    }
  };

  const handleToggleSync = async () => {
    try {
      if (config?.autoSyncEnabled) {
        await pauseSync();
      } else {
        await resumeSync();
      }
    } catch (err) {
      // Error handled by store
    }
  };

  if (isLoading && !config) {
    return <div className="animate-pulse space-y-4">
      {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-[1.75rem]" />)}
    </div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900 font-brand uppercase">Configuración</h1>
        <p className="text-sm text-slate-500 mt-1">Ajustes del sistema de sincronización</p>
      </div>

      {error && (
        <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-4 text-rose-700">
          <AlertCircle className="w-5 h-5 inline mr-2" />
          {error}
        </div>
      )}

      {showSuccess && (
        <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          ✓ Configuración actualizada
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleToggleSync}
          disabled={isLoading}
          className={`flex-1 px-6 py-3 rounded-[1.75rem] font-bold text-sm transition-all ${
            config?.autoSyncEnabled
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          {config?.autoSyncEnabled ? <Pause className="w-4 h-4 inline mr-2" /> : <Play className="w-4 h-4 inline mr-2" />}
          {config?.autoSyncEnabled ? 'Pausar Sync' : 'Reanudar Sync'}
        </button>
        <button
          onClick={handleReset}
          disabled={isLoading}
          className="px-6 py-3 rounded-[1.75rem] border-2 border-slate-300 hover:border-slate-400 font-bold text-sm transition-all"
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Resetear
        </button>
      </div>

      {/* Config Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Intervalos */}
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
          <h3 className="font-bold text-slate-900 mb-4">Intervalos de Sincronización</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mínimo (minutos)
              </label>
              <input
                type="number"
                min="1"
                value={formData.minSyncInterval ?? ''}
                onChange={(e) => setFormData({ ...formData, minSyncInterval: parseInt(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Máximo (minutos)
              </label>
              <input
                type="number"
                min="1"
                value={formData.maxSyncInterval ?? ''}
                onChange={(e) => setFormData({ ...formData, maxSyncInterval: parseInt(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
              />
            </div>
          </div>
        </div>

        {/* Límites */}
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
          <h3 className="font-bold text-slate-900 mb-4">Límites y Umbrales</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Límite Diario Requests
              </label>
              <input
                type="number"
                min="10"
                value={formData.dailyRequestLimit ?? ''}
                onChange={(e) => setFormData({ ...formData, dailyRequestLimit: parseInt(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Umbral de Alerta (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.alertThreshold ?? ''}
                onChange={(e) => setFormData({ ...formData, alertThreshold: parseInt(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modo Emergencia (requests restantes)
              </label>
              <input
                type="number"
                min="1"
                value={formData.emergencyModeThreshold ?? ''}
                onChange={(e) => setFormData({ ...formData, emergencyModeThreshold: parseInt(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
              />
            </div>
          </div>
        </div>

        {/* Opciones */}
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-bold text-slate-900 mb-4">Opciones</h3>
          {[
            { key: 'enabled', label: 'Sistema Habilitado' },
            { key: 'autoSyncEnabled', label: 'Sincronización Automática' },
            { key: 'eventSyncEnabled', label: 'Consultas de Eventos (goles/tarjetas)' },
            { key: 'peakHoursSyncEnabled', label: 'Sync en Horas Pico' },
            { key: 'notifyOnError', label: 'Notificar Errores' },
            { key: 'notifyOnLimit', label: 'Notificar Límites' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData[key as keyof UpdateConfig] as boolean ?? false}
                onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-lime-600 focus:ring-lime-500"
              />
              <span className="text-sm font-medium text-slate-700">{label}</span>
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-6 py-3 bg-lime-600 hover:bg-lime-700 text-white rounded-[1.75rem] font-bold transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4 inline mr-2" />
          Guardar Cambios
        </button>
      </form>
    </div>
  );
};

export default FootballSyncConfig;
