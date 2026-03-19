import { useEffect, useState } from 'react';
import { useFootballSyncStore } from '../../stores/football-sync.store';
import { SyncHistoryFilter, FootballSyncLog } from '../../types/football-sync';
import { SyncTypeLabels, SyncStatusColors, SyncTypeColors } from '../../types/football-sync';
import { Clock, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export default function FootballSyncHistory() {
  const { history, isLoading, error, fetchHistory } = useFootballSyncStore();

  const [filters, setFilters] = useState<SyncHistoryFilter>({
    page: 1,
    limit: 20,
  });

  useEffect(() => {
    fetchHistory(filters);
  }, [filters, fetchHistory]);

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleFilterChange = (key: keyof SyncHistoryFilter, value: any) => {
    setFilters({ ...filters, [key]: value, page: 1 }); // Reset to page 1 on filter change
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
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Historial de Sincronización</h1>
            <p className="text-slate-600 mt-1">Registro de todas las operaciones de sync</p>
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
                <option value="AUTO">Auto</option>
                <option value="MANUAL">Manual</option>
                <option value="SINGLE_MATCH">Partido único</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Estado</label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-2 focus:ring-lime-200 outline-none transition-all"
              >
                <option value="">Todos</option>
                <option value="SUCCESS">Exitoso</option>
                <option value="PARTIAL">Parcial</option>
                <option value="FAILED">Fallido</option>
                <option value="SKIPPED">Omitido</option>
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Hasta</label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:border-lime-500 focus:ring-2 focus:ring-lime-200 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        {history && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
            <div className="bg-white rounded-[1.75rem] p-4 border border-slate-200">
              <p className="text-sm text-slate-600 mb-1">Total</p>
              <p className="text-2xl font-bold text-slate-900">{history.summary.totalSyncs}</p>
            </div>
            <div className="bg-emerald-50 rounded-[1.75rem] p-4 border border-emerald-200">
              <p className="text-sm text-emerald-700 mb-1">Exitosos</p>
              <p className="text-2xl font-bold text-emerald-700">{history.summary.successfulSyncs}</p>
            </div>
            <div className="bg-rose-50 rounded-[1.75rem] p-4 border border-rose-200">
              <p className="text-sm text-rose-700 mb-1">Fallidos</p>
              <p className="text-2xl font-bold text-rose-700">{history.summary.failedSyncs}</p>
            </div>
            <div className="bg-blue-50 rounded-[1.75rem] p-4 border border-blue-200">
              <p className="text-sm text-blue-700 mb-1">Partidos</p>
              <p className="text-2xl font-bold text-blue-700">{history.summary.totalMatchesUpdated}</p>
            </div>
          </div>
        )}

        {/* Logs Table */}
        <div className="bg-white rounded-[1.75rem] border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : history && history.logs.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hidden sm:table-cell">
                        Mensaje
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hidden lg:table-cell">
                        Requests
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hidden lg:table-cell">
                        Partidos
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.logs.map((log: FootballSyncLog) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 lg:px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-900">
                            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span className="truncate">
                              {new Date(log.createdAt).toLocaleString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${SyncTypeColors[log.type] || 'bg-slate-100 text-slate-700'}`}>
                            {SyncTypeLabels[log.type] || log.type}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${SyncStatusColors[log.status]}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 hidden sm:table-cell">
                          <p className="text-sm text-slate-900 truncate max-w-md">{log.message}</p>
                          {log.error && (
                            <p className="text-xs text-rose-600 truncate max-w-md mt-1">{log.error}</p>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-900 hidden lg:table-cell">
                          {log.requestsUsed}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-900 hidden lg:table-cell">
                          {log.matchesUpdated}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {history.pagination.totalPages > 1 && (
                <div className="px-4 lg:px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Página {history.pagination.page} de {history.pagination.totalPages}
                    <span className="hidden sm:inline"> ({history.pagination.total} registros)</span>
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
                      disabled={filters.page === history.pagination.totalPages}
                      className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-slate-600">
              No se encontraron registros
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
