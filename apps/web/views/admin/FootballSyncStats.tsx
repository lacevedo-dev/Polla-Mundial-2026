import { useEffect, useState } from 'react';
import { useFootballSyncStore } from '../../stores/football-sync.store';
import { SyncTypeLabels, SyncStatusColors, SyncTypeColors } from '../../types/football-sync';
import { BarChart3, Clock, TrendingUp, Activity } from 'lucide-react';

type Period = 'today' | 'week' | 'month';

export default function FootballSyncStats() {
  const { stats, isLoading, error, fetchStats } = useFootballSyncStore();
  const [period, setPeriod] = useState<Period>('today');

  useEffect(() => {
    fetchStats(period);
  }, [period, fetchStats]);

  if (error) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6">
        <p className="text-rose-700 font-medium">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-brand uppercase tracking-tight leading-tight">Estadísticas de Sync</h1>
            <p className="text-xs text-slate-400 mt-1">Métricas y análisis de rendimiento</p>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2 bg-white rounded-[1.75rem] p-1 border border-slate-200 w-fit">
            <button
              onClick={() => setPeriod('today')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                period === 'today'
                  ? 'bg-lime-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                period === 'week'
                  ? 'bg-lime-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                period === 'month'
                  ? 'bg-lime-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Mes
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-white rounded-[1.75rem] border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div className="bg-white rounded-[1.75rem] p-4 lg:p-6 border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-sm text-slate-600">Total Syncs</p>
                </div>
                <p className="text-2xl lg:text-3xl font-bold text-slate-900">{stats.totalSyncs}</p>
              </div>

              <div className="bg-white rounded-[1.75rem] p-4 lg:p-6 border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-sm text-slate-600">Tasa Éxito</p>
                </div>
                <p className="text-2xl lg:text-3xl font-bold text-emerald-600">{stats.successRate.toFixed(1)}%</p>
              </div>

              <div className="bg-white rounded-[1.75rem] p-4 lg:p-6 border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <Activity className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-sm text-slate-600">Requests/Día</p>
                </div>
                <p className="text-2xl lg:text-3xl font-bold text-slate-900">{stats.averageRequestsPerDay.toFixed(0)}</p>
              </div>

              <div className="bg-white rounded-[1.75rem] p-4 lg:p-6 border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 rounded-xl">
                    <Clock className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-sm text-slate-600">Duración Avg</p>
                </div>
                <p className="text-2xl lg:text-3xl font-bold text-slate-900">{stats.averageDuration.toFixed(0)}ms</p>
              </div>
            </div>

            {/* Syncs by Type */}
            <div className="bg-white rounded-[1.75rem] p-4 lg:p-6 border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Sincronizaciones por Tipo</h2>
              <div className="space-y-3">
                {stats.syncsByType.map((item) => {
                  const total = stats.totalSyncs;
                  const percentage = total > 0 ? (item.count / total) * 100 : 0;

                  return (
                    <div key={item.type}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${SyncTypeColors[item.type] || 'bg-slate-100 text-slate-700'}`}>
                            {SyncTypeLabels[item.type] || item.type}
                          </span>
                          <span className="text-sm text-slate-600">{item.count} syncs</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-lime-500 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Syncs by Status */}
            <div className="bg-white rounded-[1.75rem] p-4 lg:p-6 border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Sincronizaciones por Estado</h2>
              <div className="space-y-3">
                {stats.syncsByStatus.map((item) => {
                  const total = stats.totalSyncs;
                  const percentage = total > 0 ? (item.count / total) * 100 : 0;

                  return (
                    <div key={item.status}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${SyncStatusColors[item.status]}`}>
                            {item.status}
                          </span>
                          <span className="text-sm text-slate-600">{item.count} syncs</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            item.status === 'SUCCESS' ? 'bg-emerald-500' :
                            item.status === 'PARTIAL' ? 'bg-amber-500' :
                            item.status === 'FAILED' ? 'bg-rose-500' :
                            'bg-slate-400'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Most Active Hours */}
            <div className="bg-white rounded-[1.75rem] p-4 lg:p-6 border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Horas de Mayor Actividad</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {stats.mostActiveHours.slice(0, 6).map((item, index) => (
                  <div key={item.hour} className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-sm text-slate-600 mb-1">{item.hour}:00h</div>
                    <div className="text-xl font-bold text-slate-900">{item.count}</div>
                    <div className="text-xs text-slate-500 mt-1">syncs</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Breakdown */}
            <div className="bg-white rounded-[1.75rem] p-4 lg:p-6 border border-slate-200 overflow-x-auto">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Desglose Diario</h2>
              <table className="w-full min-w-[600px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Syncs
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Requests
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Partidos
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Exitosos
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Fallidos
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.dailyBreakdown.map((day) => {
                    const successRate = day.syncs > 0 ? (day.success / day.syncs) * 100 : 0;

                    return (
                      <tr key={day.date} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          {new Date(day.date).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">{day.syncs}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{day.requests}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{day.matches}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-emerald-700 font-medium">{day.success}</span>
                            <span className="text-xs text-slate-500">({successRate.toFixed(0)}%)</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-rose-700 font-medium">{day.failed}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-[1.75rem] p-8 border border-slate-200 text-center">
            <p className="text-slate-600">No hay datos estadísticos disponibles</p>
          </div>
        )}
    </div>
  );
}
