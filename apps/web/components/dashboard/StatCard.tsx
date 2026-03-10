import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: number;
  color?: 'lime' | 'amber' | 'blue' | 'rose';
  loading?: boolean;
}

const colorClasses = {
  lime: {
    bg: 'bg-lime-50',
    border: 'border-lime-200',
    text: 'text-lime-700',
    number: 'text-lime-900',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    number: 'text-amber-900',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    number: 'text-blue-900',
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    number: 'text-rose-900',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  color = 'blue',
  loading = false,
}) => {
  const colors = colorClasses[color];

  if (loading) {
    return (
      <div
        className={`
          p-5 rounded-xl border ${colors.bg} ${colors.border}
          flex justify-between items-start gap-4
        `}
        role="status"
        aria-live="polite"
        aria-label={`Cargando ${label}`}
      >
        <div className="flex-1">
          <div className="h-4 w-20 bg-slate-200 rounded animate-pulse mb-3" />
          <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
        {icon && <div className="text-slate-300" aria-hidden="true">{icon}</div>}
      </div>
    );
  }

  return (
    <div
      className={`
        p-5 rounded-xl border ${colors.bg} ${colors.border}
        flex justify-between items-start gap-4
        transition-all duration-200 hover:shadow-md
        focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-${color}-600
      `}
      role="region"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex-1">
        <p className={`text-xs uppercase font-semibold ${colors.text} mb-2`}>
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <div
            className={`text-3xl font-black ${colors.number}`}
            aria-live="polite"
          >
            {value}
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? (
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="text-xs font-semibold" aria-label={`Tendencia: ${trend >= 0 ? 'positiva' : 'negativa'} ${Math.abs(trend)}`}>
                {trend >= 0 ? '+' : ''}{trend}
              </span>
            </div>
          )}
        </div>
      </div>
      {icon && <div className={colors.text} aria-hidden="true">{icon}</div>}
    </div>
  );
};
