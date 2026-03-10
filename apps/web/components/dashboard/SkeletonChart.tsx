import React from 'react';

/**
 * Skeleton loader for PerformanceChart component
 * Shows animated placeholder while chart data is loading
 */
export const SkeletonChart: React.FC = () => (
  <div className="space-y-4">
    <div>
      <div className="h-6 w-32 animate-pulse rounded bg-slate-200 mb-2" />
      <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
    </div>
    <div className="h-80 w-full animate-pulse rounded bg-slate-200" />
  </div>
);
