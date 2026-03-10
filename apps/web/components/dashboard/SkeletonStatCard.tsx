import React from 'react';

/**
 * Skeleton loader for StatCard component
 * Shows animated placeholder while data is loading
 */
export const SkeletonStatCard: React.FC = () => (
  <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-start gap-4">
    <div className="flex-1">
      <div className="h-4 w-20 bg-slate-200 rounded animate-pulse mb-3" />
      <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
    </div>
    <div className="h-6 w-6 bg-slate-200 rounded animate-pulse" />
  </div>
);
