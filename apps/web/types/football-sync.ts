// === TIPOS DE MONITOREO DE FOOTBALL SYNC ===

export interface FootballSyncLog {
  id: string;
  type: string;
  status: string;
  matchId?: string;
  externalId?: string;
  message: string;
  details?: string;
  requestsUsed: number;
  matchesUpdated: number;
  duration?: number;
  error?: string;
  triggeredBy?: string;
  createdAt: string;
  match?: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    matchDate: string;
  };
}

export interface FootballSyncConfig {
  id: string;
  enabled: boolean;
  minSyncInterval: number;
  maxSyncInterval: number;
  dailyRequestLimit: number;
  alertThreshold: number;
  autoSyncEnabled: boolean;
  peakHoursSyncEnabled: boolean;
  emergencyModeThreshold: number;
  notifyOnError: boolean;
  notifyOnLimit: boolean;
  updatedBy?: string;
  updatedAt: string;
  createdAt: string;
}

export interface FootballSyncAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  details?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface FootballMatchLinkCandidate {
  fixtureId: string;
  kickoff: string;
  status: string;
  leagueName: string;
  round?: string;
  venue?: string;
  homeTeam: string;
  awayTeam: string;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  reasons: string[];
}

export interface MonitoringDashboard {
  status: {
    isEnabled: boolean;
    isEmergencyMode: boolean;
    lastSyncAt?: string;
    nextSyncIn: number;
  };
  readiness: {
    apiKeyConfigured: boolean;
    autoSyncEnabled: boolean;
    requestsRemaining: number;
    todayMatchesTotal: number;
    linkedMatchesToday: number;
    unlinkedMatchesToday: number;
    blockers: string[];
    unlinkedMatchesPreview: Array<{
      id: string;
      homeTeam: string;
      awayTeam: string;
      matchDate: string;
    }>;
  };
  todayStats: {
    requestsUsed: number;
    requestsLimit: number;
    requestsPercentage: number;
    matchesSynced: number;
    successfulSyncs: number;
    failedSyncs: number;
    averageDuration: number;
  };
  recentLogs: FootballSyncLog[];
  activeAlerts: FootballSyncAlert[];
  syncChart: {
    labels: string[];
    requestsUsed: number[];
    matchesUpdated: number[];
  };
}

export interface SyncHistoryFilter {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  matchId?: string;
  startDate?: string;
  endDate?: string;
}

export interface SyncHistoryResponse {
  logs: FootballSyncLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    totalRequestsUsed: number;
    totalMatchesUpdated: number;
  };
}

export interface AlertsFilter {
  page?: number;
  limit?: number;
  type?: string;
  severity?: string;
  resolved?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface AlertsResponse {
  alerts: FootballSyncAlert[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalAlerts: number;
    unresolvedAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
  };
}

export interface UpdateConfig {
  enabled?: boolean;
  minSyncInterval?: number;
  maxSyncInterval?: number;
  dailyRequestLimit?: number;
  alertThreshold?: number;
  autoSyncEnabled?: boolean;
  peakHoursSyncEnabled?: boolean;
  emergencyModeThreshold?: number;
  notifyOnError?: boolean;
  notifyOnLimit?: boolean;
}

export interface SyncStats {
  period: 'today' | 'week' | 'month';
  totalSyncs: number;
  successRate: number;
  averageRequestsPerDay: number;
  averageDuration: number;
  mostActiveHours: Array<{ hour: number; count: number }>;
  syncsByType: Array<{ type: string; count: number }>;
  syncsByStatus: Array<{ status: string; count: number }>;
  dailyBreakdown: Array<{
    date: string;
    syncs: number;
    requests: number;
    matches: number;
    success: number;
    failed: number;
  }>;
}

// === HELPERS ===

export const SyncStatusColors: Record<string, string> = {
  SUCCESS: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PARTIAL: 'bg-amber-100 text-amber-700 border-amber-200',
  FAILED: 'bg-rose-100 text-rose-700 border-rose-200',
  SKIPPED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const SyncTypeLabels: Record<string, string> = {
  MANUAL_SYNC: 'Manual',
  AUTO_SYNC: 'Automática',
  CRON_SYNC: 'Programada',
  MATCH_SYNC: 'Por Partido',
  DAILY_PLAN: 'Plan Diario',
  EMERGENCY_SYNC: 'Emergencia',
  TEST_SYNC: 'Prueba',
};

export const SyncTypeColors: Record<string, string> = {
  MANUAL_SYNC: 'bg-blue-100 text-blue-700 border-blue-200',
  AUTO_SYNC: 'bg-lime-100 text-lime-700 border-lime-200',
  CRON_SYNC: 'bg-purple-100 text-purple-700 border-purple-200',
  MATCH_SYNC: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  DAILY_PLAN: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  EMERGENCY_SYNC: 'bg-rose-100 text-rose-700 border-rose-200',
  TEST_SYNC: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const AlertSeverityColors: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-700 border-blue-200',
  WARNING: 'bg-amber-100 text-amber-700 border-amber-200',
  ERROR: 'bg-orange-100 text-orange-700 border-orange-200',
  CRITICAL: 'bg-rose-100 text-rose-700 border-rose-200',
};

export const AlertTypeLabels: Record<string, string> = {
  RATE_LIMIT_WARNING: 'Advertencia de Límite',
  RATE_LIMIT_EXCEEDED: 'Límite Excedido',
  SYNC_FAILURE: 'Fallo de Sincronización',
  API_ERROR: 'Error de API',
  CONFIGURATION_CHANGE: 'Cambio de Configuración',
  EMERGENCY_MODE: 'Modo de Emergencia',
  NO_MATCHES_UPDATED: 'Sin Partidos Actualizados',
};

export const SyncHistoryTypeOptions = [
  { value: 'AUTO_SYNC', label: 'Automática' },
  { value: 'MANUAL_SYNC', label: 'Manual' },
  { value: 'MATCH_SYNC', label: 'Partido único' },
] as const;
