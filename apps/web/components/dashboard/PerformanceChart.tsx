import React, { useMemo } from 'react';
import { PerformanceWeek } from '../../stores/dashboard.store';

interface PerformanceChartProps {
  data: PerformanceWeek[];
  loading: boolean;
}

const Skeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
    <div className="h-80 w-full animate-pulse rounded bg-slate-200" />
  </div>
);

/**
 * Simple SVG-based performance chart without recharts dependency
 * Renders a line chart with points for each week
 */
export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  loading,
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        points: [],
        maxPoints: 0,
        minPoints: 0,
      };
    }

    const maxPoints = Math.max(...data.map((d) => d.points), 100);
    const minPoints = Math.min(...data.map((d) => d.points), 0);

    return { points: data, maxPoints, minPoints };
  }, [data]);

  if (loading) {
    return <Skeleton />;
  }

  if (!chartData.points || chartData.points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-lime-50 py-12">
        <p className="text-sm text-slate-500">
          No hay datos de desempeño disponibles
        </p>
      </div>
    );
  }

  const width = 100;
  const height = 320;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const range = Math.max(
    chartData.maxPoints - chartData.minPoints,
    1
  );
  const xStep = chartWidth / (chartData.points.length - 1 || 1);

  // Generate SVG path for the line
  const pathPoints = chartData.points
    .map((point, index) => {
      const x = padding.left + index * xStep;
      const normalizedY = (point.points - chartData.minPoints) / range;
      const y = padding.top + (1 - normalizedY) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  // Generate gradient area under the line
  const fillPath = [
    `M ${padding.left},${padding.top + chartHeight}`,
    `L ${pathPoints.split(' ').map((p) => p.split(',')[0]).join(',')}`,
    `L ${padding.left + chartWidth},${padding.top + chartHeight}`,
    'Z',
  ].join(' ');

  return (
    <div className="space-y-4" role="region" aria-label="Gráfico de desempeño semanal">
      <div>
        <h2 className="text-lg font-black text-slate-900">
          Desempeño por Semana
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Últimas {chartData.points.length} semanas
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-lime-50 p-6" role="img" aria-label={`Gráfico de línea mostrando desempeño sobre ${chartData.points.length} semanas`}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-max"
        >
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`grid-${i}`}
              x1={padding.left}
              x2={width - padding.right}
              y1={
                padding.top +
                (chartHeight / 4) * i
              }
              y2={
                padding.top +
                (chartHeight / 4) * i
              }
              stroke="#e2e8f0"
              strokeDasharray="2,2"
            />
          ))}

          {/* Y-axis */}
          <line
            x1={padding.left}
            x2={padding.left}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke="#cbd5e1"
            strokeWidth="2"
          />

          {/* X-axis */}
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={height - padding.bottom}
            y2={height - padding.bottom}
            stroke="#cbd5e1"
            strokeWidth="2"
          />

          {/* Y-axis labels */}
          {[0, 1, 2, 3, 4].map((i) => {
            const value = chartData.minPoints + (range / 4) * i;
            return (
              <text
                key={`y-label-${i}`}
                x={padding.left - 10}
                y={padding.top + (chartHeight / 4) * (4 - i) + 4}
                textAnchor="end"
                fontSize="12"
                fill="#94a3b8"
              >
                {Math.round(value)}
              </text>
            );
          })}

          {/* X-axis labels (week numbers) */}
          {chartData.points.map((point, index) => (
            <text
              key={`x-label-${index}`}
              x={padding.left + index * xStep}
              y={height - padding.bottom + 25}
              textAnchor="middle"
              fontSize="12"
              fill="#94a3b8"
            >
              {point.week.split('-')[1] || `W${index + 1}`}
            </text>
          ))}

          {/* Gradient definition */}
          <defs>
            <linearGradient
              id="lineGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#65a30d" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#65a30d" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Fill area under line */}
          <path
            d={fillPath}
            fill="url(#lineGradient)"
          />

          {/* Line */}
          <polyline
            points={pathPoints}
            fill="none"
            stroke="#65a30d"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {chartData.points.map((point, index) => {
            const x = padding.left + index * xStep;
            const normalizedY = (point.points - chartData.minPoints) / range;
            const y = padding.top + (1 - normalizedY) * chartHeight;

            return (
              <g key={`point-${index}`}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#65a30d"
                  stroke="#f1f5f9"
                  strokeWidth="2"
                />
                {/* Tooltip on hover */}
                <title>
                  {point.week}: {point.points} pts
                </title>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-lime-600" />
          <span className="text-xs text-slate-600">Puntos por semana</span>
        </div>
      </div>
    </div>
  );
};
