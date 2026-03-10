import React from 'react';

/**
 * Skeleton loader for RecentPredictions component
 * Shows animated placeholder while prediction data is loading
 */
export const SkeletonPrediction: React.FC = () => (
  <div className="space-y-4">
    <div className="h-6 w-48 animate-pulse rounded bg-slate-200 mb-4" />
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-slate-100 py-4 last:border-0"
        >
          <div className="flex-1">
            <div className="mb-2 h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="h-6 w-6 animate-pulse rounded-full bg-slate-200" />
        </div>
      ))}
    </div>
  </div>
);
