import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Clock, Database, TrendingUp, Zap, Settings, History, Bell, BarChart3 } from 'lucide-react';
import { useFootballSyncStore } from '../../stores/football-sync.store';
import AdminStatCard from '../../components/admin/AdminStatCard';
import { SyncStatusColors, AlertSeverityColors } from '../../types/football-sync';

const FootballSyncDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { dashboard, isLoading, error, fetchDashboard } = useFootballSyncStore();

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (isLoading && !dashboard) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-[1.75rem] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <p className="font-bold">Error al cargar dashboard</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={fetchDashboard} className="mt-3 text-sm font-bold underline">
          Reintentar
        </button>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatNextSync = (seconds: number) => {
    if (seconds <= 0) return 'Ahora';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">
            Football Sync
          </h1>
          <p className="text-sm text-slate-500 mt-1">Monitoreo de sincronización con API-Football</p>
        </div>

        {/* Status Badge */}
        <div className={`px-4 py-2 rounded-full text-xs font-bold w-fit ${
          dashboard?.status.isEmergencyMode
            ? 'bg-rose-100 text-rose-700 border border-rose-200'
            : dashboard?.status.isEnabled
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
        }`}>
          {dashboard?.status.isEmergencyMode ? '🚨 EMERGENCIA' : dashboard?.status.isEnabled ? '✓ Activo' : '⏸ Pausado'}
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/admin/football-sync/config')}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-[1.75rem] hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium text-slate-700"
        >
          <Settings className="w-4 h-4" />
          <span>Configuración</span>
        </button>

        <button
          onClick={() => navigate('/admin/football-sync/history')}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-[1.75rem] hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium text-slate-700"
        >
          <History className="w-4 h-4" />
          <span>Historial</span>
        </button>

        <button
          onClick={() => navigate('/admin/football-sync/alerts')}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-[1.75rem] hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium text-slate-700"
        >
          <Bell className="w-4 h-4" />
          <span>Alertas</span>
          {dashboard && dashboard.activeAlerts.length > 0 && (
            <span className="px-2 py-0.5 bg-rose-600 text-white text-xs rounded-full font-bold">
              {dashboard.activeAlerts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/admin/football-sync/stats')}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-[1.75rem] hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium text-slate-700"
        >
          <BarChart3 className="w-4 h-4" />
          <span>Estadísticas</span>
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStatCard
          label="Requests Hoy"
          value={`${dashboard?.todayStats.requestsUsed ?? 0}/${dashboard?.todayStats.requestsLimit ?? 100}`}
          icon={Database}
          trend={`${dashboard?.todayStats.requestsPercentage.toFixed(0) ?? 0}% usado`}
          color={
            (dashboard?.todayStats.requestsPercentage ?? 0) > 90
              ? 'rose'
              : (dashboard?.todayStats.requestsPercentage ?? 0) > 75
                ? 'amber'
                : 'lime'
          }
        />

        <AdminStatCard
          label="Partidos Sync"
          value={dashboard?.todayStats.matchesSynced.toString() ?? '0'}
          icon={Activity}
          trend="Hoy"
          color="blue"
        />

        <AdminStatCard
          label="Tasa de Éxito"
          value={`${dashboard?.todayStats.successfulSyncs ?? 0}/${
            (dashboard?.todayStats.successfulSyncs ?? 0) + (dashboard?.todayStats.failedSyncs ?? 0)
          }`}
          icon={TrendingUp}
          trend={`${dashboard?.todayStats.failedSyncs ?? 0} fallos`}
          color={
            (dashboard?.todayStats.failedSyncs ?? 0) > 0 ? 'amber' : 'lime'
          }
        />

        <AdminStatCard
          label="Próxima Sync"
          value={formatNextSync(dashboard?.status.nextSyncIn ?? 0)}
          icon={Clock}
          trend={`⚡ ${formatDuration(dashboard?.todayStats.averageDuration ?? 0)} prom.`}
          color="purple"
        />
      </div>

      {/* Alertas Activas - Mobile Optimized */}
      {dashboard && dashboard.activeAlerts.length > 0 && (
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="p-4 border-b border-amber-200 bg-amber-100/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
              <h2 className="font-bold text-amber-900">
                {dashboard.activeAlerts.length} Alerta{dashboard.activeAlerts.length > 1 ? 's' : ''} Activa{dashboard.activeAlerts.length > 1 ? 's' : ''}
              </h2>
            </div>
          </div>

          <div className="divide-y divide-amber-200">
            {dashboard.activeAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="p-4 hover:bg-amber-100/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    AlertSeverityColors[alert.severity] || 'bg-slate-100 text-slate-600'
                  }`}>
                    {alert.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {alert.message}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(alert.createdAt).toLocaleString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {dashboard.activeAlerts.length > 5 && (
            <div className="p-3 bg-amber-100/30 text-center">
              <a href="/admin/football-sync/alerts" className="text-xs font-bold text-amber-700 hover:underline">
                Ver todas las alertas ({dashboard.activeAlerts.length})
              </a>
            </div>
          )}
        </div>
      )}

      {/* Recent Logs - Mobile Optimized */}
      <div className="rounded-[1.75rem] border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-bold text-slate-900">Sincronizaciones Recientes</h2>
          <p className="text-xs text-slate-500 mt-0.5">Últimas 10 operaciones</p>
        </div>

        <div className="divide-y divide-slate-200">
          {dashboard?.recentLogs.slice(0, 10).map((log) => (
            <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  SyncStatusColors[log.status] || 'bg-slate-100 text-slate-600'
                }`}>
                  {log.status}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {log.message}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                    <span>{log.type.replace(/_/g, ' ')}</span>
                    {log.matchesUpdated > 0 && (
                      <span>• {log.matchesUpdated} partidos</span>
                    )}
                    {log.requestsUsed > 0 && (
                      <span>• {log.requestsUsed} req</span>
                    )}
                    {log.duration && (
                      <span>• {formatDuration(log.duration)}</span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(log.createdAt).toLocaleString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {log.error && (
                <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg">
                  <p className="text-xs text-rose-700 font-mono truncate">{log.error}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 bg-slate-50 text-center border-t border-slate-200">
          <a href="/admin/football-sync/history" className="text-xs font-bold text-slate-700 hover:underline">
            Ver historial completo
          </a>
        </div>
      </div>

      {/* Quick Actions - Mobile Optimized */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href="/admin/football-sync/config"
          className="p-4 rounded-[1.75rem] border-2 border-slate-200 bg-white hover:border-lime-500 hover:bg-lime-50 transition-all text-center"
        >
          <Zap className="w-6 h-6 mx-auto mb-2 text-slate-700" />
          <p className="font-bold text-sm text-slate-900">Configuración</p>
          <p className="text-xs text-slate-500 mt-1">Ajustar parámetros</p>
        </a>

        <a
          href="/admin/football-sync/stats"
          className="p-4 rounded-[1.75rem] border-2 border-slate-200 bg-white hover:border-lime-500 hover:bg-lime-50 transition-all text-center"
        >
          <TrendingUp className="w-6 h-6 mx-auto mb-2 text-slate-700" />
          <p className="font-bold text-sm text-slate-900">Estadísticas</p>
          <p className="text-xs text-slate-500 mt-1">Ver métricas</p>
        </a>
      </div>
    </div>
  );
};

export default FootballSyncDashboard;
