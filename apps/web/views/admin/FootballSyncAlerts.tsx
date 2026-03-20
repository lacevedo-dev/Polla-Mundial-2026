import { useEffect, useState } from 'react';
import { useFootballSyncStore } from '../../stores/football-sync.store';
import { AlertsFilter, FootballSyncAlert } from '../../types/football-sync';
import { AlertSeverityColors, AlertTypeLabels } from '../../types/football-sync';
import { AlertTriangle, CheckCircle, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export default function FootballSyncAlerts() {
  const { alerts, isLoading, error, fetchAlerts, resolveAlert } = useFootballSyncStore();

  const [filters, setFilters] = useState<AlertsFilter>({
    page: 1,
    limit: 20,
    resolved: false, // Default: show only unresolved
  });

  useEffect(() => {
    fetchAlerts(filters);
  }, [filters, fetchAlerts]);

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleFilterChange = (key: keyof AlertsFilter, value: any) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handleResolve = async (alertId: string) => {
    await resolveAlert(alertId);
    fetchAlerts(filters); // Refresh list
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-rose-50 border border-rose-200 rounded-[1.75rem] p-6">
            <p className="text-rose-700 font-medium">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Alertas del Sistema</h1>
            <p className="text-slate-600 mt-1">Notificaciones y advertencias de sincronización</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-[1.75rem] p-4 lg:p-6 border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Filtros</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tipo</label>
              <select
                value={filters.type || ''}
                onChange={(e) => handleFilterChange('type', e.target.value || undefined)}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-2 focus:ring-lime-200 outline-none transition-all"
              >
                <option value="">Todos</option>
                <option value="RATE_LIMIT">Límite de rate</option>
                <option value="SYNC_FAILURE">Fallo de sync</option>
                <option value="EMERGENCY_MODE">Modo emergencia</option>
                <option value="API_ERROR">Error API</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Severidad</label>
              <select
                value={filters.severity || ''}
                onChange={(e) => handleFilterChange('severity', e.target.value || undefined)}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-2 focus:ring-lime-200 outline-none transition-all"
              >
                <option value="">Todas</option>
                <option value="CRITICAL">Crítica</option>
                <option value="WARNING">Advertencia</option>
                <option value="INFO">Info</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Estado</label>
              <select
                value={filters.resolved === undefined ? '' : filters.resolved ? 'resolved' : 'unresolved'}
                onChange={(e) => handleFilterChange('resolved', e.target.value === '' ? undefined : e.target.value === 'resolved')}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-2 focus:ring-lime-200 outline-none transition-all"
              >
                <option value="">Todas</option>
                <option value="unresolved">Sin resolver</option>
                <option value="resolved">Resueltas</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Desde</label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-2 focus:ring-lime-200 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        {alerts && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
            <div className="bg-white rounded-[1.75rem] p-4 border border-slate-200">
              <p className="text-sm text-slate-600 mb-1">Total</p>
              <p className="text-2xl font-bold text-slate-900">{alerts.summary.totalAlerts}</p>
            </div>
            <div className="bg-rose-50 rounded-[1.75rem] p-4 border border-rose-200">
              <p className="text-sm text-rose-700 mb-1">Críticas</p>
              <p className="text-2xl font-bold text-rose-700">{alerts.summary.criticalAlerts}</p>
            </div>
            <div className="bg-amber-50 rounded-[1.75rem] p-4 border border-amber-200">
              <p className="text-sm text-amber-700 mb-1">Advertencias</p>
              <p className="text-2xl font-bold text-amber-700">{alerts.summary.warningAlerts}</p>
            </div>
            <div className="bg-blue-50 rounded-[1.75rem] p-4 border border-blue-200">
              <p className="text-sm text-blue-700 mb-1">Sin resolver</p>
              <p className="text-2xl font-bold text-blue-700">{alerts.summary.unresolvedAlerts}</p>
            </div>
          </div>
        )}

        {/* Alerts List */}
        <div className="bg-white rounded-[1.75rem] border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : alerts && alerts.alerts.length > 0 ? (
            <>
              <div className="divide-y divide-slate-100">
                {alerts.alerts.map((alert: FootballSyncAlert) => (
                  <div
                    key={alert.id}
                    className={`p-4 lg:p-6 hover:bg-slate-50 transition-colors ${
                      alert.resolved ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      {/* Alert Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                          {alert.severity === 'CRITICAL' ? (
                            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                          ) : alert.severity === 'WARNING' ? (
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${AlertSeverityColors[alert.severity]}`}>
                                {alert.severity}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                {AlertTypeLabels[alert.type] || alert.type}
                              </span>
                              {alert.resolved && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Resuelta
                                </span>
                              )}
                            </div>

                            <h3 className="font-semibold text-slate-900 mb-1">{alert.message}</h3>

                            {alert.details && (
                              <p className="text-sm text-slate-600 break-words">{alert.details}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                              <span>
                                {new Date(alert.createdAt).toLocaleString('es-ES')}
                              </span>
                              {alert.resolved && alert.resolvedAt && (
                                <span>
                                  Resuelta: {new Date(alert.resolvedAt).toLocaleString('es-ES')}
                                </span>
                              )}
                              {alert.resolvedBy && (
                                <span>Por: {alert.resolvedBy}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {!alert.resolved && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium whitespace-nowrap"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Marcar como resuelta
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {alerts.pagination.totalPages > 1 && (
                <div className="px-4 lg:px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Página {alerts.pagination.page} de {alerts.pagination.totalPages}
                    <span className="hidden sm:inline"> ({alerts.pagination.total} alertas)</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(filters.page! - 1)}
                      disabled={filters.page === 1}
                      className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handlePageChange(filters.page! + 1)}
                      disabled={filters.page === alerts.pagination.totalPages}
                      className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No hay alertas</p>
              <p className="text-sm text-slate-500 mt-1">Todo está funcionando correctamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

