import React from 'react';
import { Check, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RecentPrediction } from '../../stores/dashboard.store';

interface RecentPredictionsProps {
  predictions: RecentPrediction[];
  loading: boolean;
}

const SkeletonItem: React.FC = () => (
  <div className="flex items-center justify-between border-b border-slate-100 py-4 last:border-0">
    <div className="flex-1">
      <div className="mb-2 h-4 w-32 animate-pulse rounded bg-slate-200" />
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
    </div>
    <div className="h-6 w-6 animate-pulse rounded-full bg-slate-200" />
  </div>
);

export const RecentPredictions: React.FC<RecentPredictionsProps> = ({
  predictions,
  loading,
}) => {
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('es-CO', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-900">
          Predicciones Recientes
        </h2>
        <div>
          {[1, 2, 3].map((i) => (
            <SkeletonItem key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-900">
          Predicciones Recientes
        </h2>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="mb-4 text-sm text-slate-500">
            Aún no haces predicciones
          </p>
          <Link
            to="/predictions"
            className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-sm font-bold uppercase text-slate-900 transition-all duration-200 hover:bg-lime-500"
          >
            Ir a pronósticos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Show only the 5 most recent predictions
  const displayedPredictions = predictions.slice(0, 5);

  return (
    <div className="space-y-4" role="region" aria-label="Predicciones recientes">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900">
          Predicciones Recientes
        </h2>
        {predictions.length > 5 && (
          <Link
            to="/predictions"
            className="inline-flex items-center gap-1 text-sm font-bold uppercase text-lime-700 transition-colors duration-200 hover:text-lime-800 focus:ring-2 focus:ring-offset-2 focus:ring-lime-600 rounded focus:outline-none"
          >
            Ver todas
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="space-y-1">
        {displayedPredictions.map((prediction, index) => {
          // Ensure all rendered values are primitives to prevent React #185
          const matchLabel = typeof prediction.match === 'string' ? prediction.match : String(prediction.match ?? '');
          const tuPrediccionLabel = typeof prediction.tuPrediccion === 'string' ? prediction.tuPrediccion : String(prediction.tuPrediccion ?? '');
          const resultadoLabel = typeof prediction.resultado === 'string' ? prediction.resultado : String(prediction.resultado ?? '');
          const fechaLabel = typeof prediction.fecha === 'string' ? prediction.fecha : String(prediction.fecha ?? '');
          const aciertoFlag = Boolean(prediction.acierto);

          return (
          <div
            key={prediction.id}
            className={`flex items-center justify-between px-4 py-3 transition-colors duration-200 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-lime-600 rounded ${
              index !== displayedPredictions.length - 1
                ? 'border-b border-slate-100'
                : ''
            }`}
            role="article"
            aria-label={`Predicción: ${matchLabel}, tu pronóstico ${tuPrediccionLabel}, resultado ${resultadoLabel}, ${aciertoFlag ? 'acierto' : 'error'}`}
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900 truncate">
                {matchLabel}
              </h3>
              <div className="mt-1 text-xs text-slate-500">
                <span className="inline-block">
                  Tu pronóstico:{' '}
                  <span className="font-bold text-slate-700">
                    {tuPrediccionLabel}
                  </span>
                </span>
                <span className="mx-2 text-slate-300">•</span>
                <span className="inline-block">
                  Resultado:{' '}
                  <span className="font-bold text-slate-700">
                    {resultadoLabel}
                  </span>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(fechaLabel)}
              </p>
            </div>

            <div className="ml-3 flex-shrink-0">
              {aciertoFlag ? (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-100"
                  title="Acierto"
                  aria-label="Predicción correcta"
                >
                  <Check className="h-5 w-5 text-lime-700" aria-hidden="true" />
                </div>
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100"
                  title="Error"
                  aria-label="Predicción incorrecta"
                >
                  <X className="h-5 w-5 text-rose-700" aria-hidden="true" />
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {predictions.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <Link
            to="/predictions"
            className="block rounded-lg bg-slate-50 px-4 py-2 text-center text-sm font-bold uppercase text-slate-700 transition-colors duration-200 hover:bg-slate-100"
          >
            Ver todas las predicciones
          </Link>
        </div>
      )}
    </div>
  );
};
