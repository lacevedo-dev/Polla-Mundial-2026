import React from 'react';

/**
 * Skeleton loader for LeaguesOverview component
 * Shows animated placeholder while league data is loading
 */
export const SkeletonLeague: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-4 h-6 w-32 animate-pulse rounded bg-slate-200" />
    <div className="mb-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
    <div className="mb-4 h-4 w-24 animate-pulse rounded bg-slate-200" />
    <div className="h-2 w-full animate-pulse rounded-full bg-slate-200" />
  </div>
);
