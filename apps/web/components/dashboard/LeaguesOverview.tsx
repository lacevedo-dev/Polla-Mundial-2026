import React from 'react';
import { Trophy } from 'lucide-react';
import { DashboardLeague } from '../../stores/dashboard.store';

interface LeaguesOverviewProps {
  ligas: DashboardLeague[];
  loading: boolean;
}

const getMedalEmoji = (position: number): string => {
  switch (position) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '📍';
  }
};

const getPositionColor = (position: number): string => {
  switch (position) {
    case 1:
      return 'bg-yellow-100 text-yellow-900'; // gold
    case 2:
      return 'bg-gray-100 text-gray-900'; // silver
    case 3:
      return 'bg-orange-100 text-orange-900'; // bronze
    default:
      return 'bg-slate-100 text-slate-900';
  }
};

const SkeletonCard: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-4 h-6 w-32 animate-pulse rounded bg-slate-200" />
    <div className="mb-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
    <div className="mb-4 h-4 w-24 animate-pulse rounded bg-slate-200" />
    <div className="h-2 w-full animate-pulse rounded-full bg-slate-200" />
  </div>
);

export const LeaguesOverview: React.FC<LeaguesOverviewProps> = ({
  ligas,
  loading,
}) => {
  if (loading) {
    return (
      <div>
        <h2 className="mb-4 text-xl font-black text-slate-900">
          Tus Ligas
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (ligas.length === 0) {
    return (
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <Trophy className="h-12 w-12 text-slate-300" />
        </div>
        <h2 className="text-xl font-black text-slate-900">
          No participas en ligas
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Crea o únete a una liga para ver tu desempeño en los torneos.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-black text-slate-900">
        Tus Ligas
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ligas.map((liga) => {
          const progressPercent = (liga.tusPuntos / liga.maxPuntos) * 100;

          return (
            <div
              key={liga.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex-1 font-black text-slate-900">
                  {liga.nombre}
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${getPositionColor(
                    liga.posicion
                  )}`}
                >
                  {getMedalEmoji(liga.posicion)}
                  {liga.posicion === 1
                    ? '1st'
                    : liga.posicion === 2
                      ? '2nd'
                      : liga.posicion === 3
                        ? '3rd'
                        : `${liga.posicion}th`}
                </span>
              </div>

              <div className="mb-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Puntos
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-lime-700">
                    {liga.tusPuntos}
                  </span>
                  <span className="text-sm text-slate-500">
                    / {liga.maxPuntos}
                  </span>
                </div>
              </div>

              <div className="mb-3 space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-lime-500 to-lime-600 transition-all duration-500"
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {Math.round(progressPercent)}% completado
                </p>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {liga.participantes} participante{liga.participantes !== 1 ? 's' : ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
