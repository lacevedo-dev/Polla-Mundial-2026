import React from 'react';

interface PersonalStatsProps {
  aciertos: number;
  errores: number;
  racha: number;
  promedioPorcentaje: number;
  loading: boolean;
}

const Skeleton: React.FC = () => (
  <div className="flex gap-6">
    <div className="flex-1">
      <div className="mb-2 h-4 w-20 animate-pulse rounded bg-slate-200" />
      <div className="h-16 w-full animate-pulse rounded bg-slate-200" />
    </div>
    <div className="flex-1">
      <div className="mb-2 h-4 w-20 animate-pulse rounded bg-slate-200" />
      <div className="h-40 w-full animate-pulse rounded bg-slate-200" />
    </div>
  </div>
);

export const PersonalStats: React.FC<PersonalStatsProps> = ({
  aciertos,
  errores,
  racha,
  promedioPorcentaje,
  loading,
}) => {
  if (loading) {
    return <Skeleton />;
  }

  const total = aciertos + errores;
  const aciertosPercent = total > 0 ? (aciertos / total) * 100 : 0;
  const erroresPercent = 100 - aciertosPercent;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-black text-slate-900">Tus Estadísticas</h2>

      <div className="flex gap-8">
        {/* Left: Racha */}
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 p-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-600">
            Racha Actual
          </p>
          <div className="text-6xl font-black text-amber-900">{racha}</div>
          <p className="mt-2 text-xs text-amber-700">en línea</p>
        </div>

        {/* Right: Stats Grid */}
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-lime-200 bg-lime-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-lime-600">
                Aciertos
              </p>
              <p className="mt-2 text-2xl font-black text-lime-900">
                {aciertos}
              </p>
              <p className="mt-1 text-xs text-lime-700">
                {aciertosPercent.toFixed(0)}%
              </p>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-rose-600">
                Errores
              </p>
              <p className="mt-2 text-2xl font-black text-rose-900">
                {errores}
              </p>
              <p className="mt-1 text-xs text-rose-700">
                {erroresPercent.toFixed(0)}%
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Promedio de Aciertos
            </p>
            <p className="mt-2 text-2xl font-black text-blue-900">
              {promedioPorcentaje.toFixed(1)}%
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-200">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                style={{ width: `${Math.min(promedioPorcentaje, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Info */}
      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-500">
          Total de predicciones: <span className="font-bold text-slate-900">{total}</span>
        </p>
      </div>
    </div>
  );
};
