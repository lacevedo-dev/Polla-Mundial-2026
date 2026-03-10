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
    <div role="region" aria-label="Ligas del usuario">
      <h2 className="mb-4 text-xl font-black text-slate-900">
        Tus Ligas
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ligas.map((liga) => {
          const safeMaxPuntos = liga.maxPuntos > 0 ? liga.maxPuntos : 1;
          const safeTusPuntos = typeof liga.tusPuntos === 'number' ? liga.tusPuntos : 0;
          const safePosicion = typeof liga.posicion === 'number' ? liga.posicion : 0;
          const safeParticipantes = typeof liga.participantes === 'number' ? liga.participantes : 0;
          const safeNombre = typeof liga.nombre === 'string' ? liga.nombre : String(liga.nombre ?? '');
          const progressPercent = Math.min((safeTusPuntos / safeMaxPuntos) * 100, 100);

          return (
            <div
              key={liga.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-lime-600"
              role="article"
              aria-label={`Liga ${safeNombre}, posición ${safePosicion}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex-1 font-black text-slate-900">
                  {safeNombre}
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${getPositionColor(
                    safePosicion
                  )}`}
                  aria-label={`Posición ${safePosicion} de ${safeParticipantes}`}
                >
                  <span aria-hidden="true">{getMedalEmoji(safePosicion)}</span>
                  {safePosicion === 1
                    ? '1st'
                    : safePosicion === 2
                      ? '2nd'
                      : safePosicion === 3
                        ? '3rd'
                        : `${safePosicion}th`}
                </span>
              </div>

              <div className="mb-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Puntos
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-lime-700" aria-live="polite">
                    {safeTusPuntos}
                  </span>
                  <span className="text-sm text-slate-500">
                    / {liga.maxPuntos}
                  </span>
                </div>
              </div>

              <div className="mb-3 space-y-2">
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progreso: ${Math.round(progressPercent)}%`}
                >
                  <div
                    className="h-full bg-gradient-to-r from-lime-500 to-lime-600 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {Math.round(progressPercent)}% completado
                </p>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {safeParticipantes} participante{safeParticipantes !== 1 ? 's' : ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
