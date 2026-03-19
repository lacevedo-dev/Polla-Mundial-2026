export interface ApiFootballFixtureTeam {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

export interface ApiFootballFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: ApiFootballFixtureTeam;
    away: ApiFootballFixtureTeam;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface ApiFootballResponse {
  get: string;
  parameters: Record<string, unknown>;
  errors: unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiFootballFixture[];
}

export interface DailySyncPlanDto {
  date: string;
  totalMatches: number;
  requestBudget: number;
  intervalMinutes: number;
  estimatedRequestsUsed: number;
  strategy: 'AGGRESSIVE' | 'BALANCED' | 'CONSERVATIVE' | 'EMERGENCY';
  hasLiveMatches: boolean;
  nextSyncIn: number; // seconds
  lastSync: string | null;
}

export interface SyncUsageDto {
  today: string;
  matches: {
    scheduled: number;
    live: number;
    finished: number;
    total: number;
  };
  requests: {
    used: number;
    available: number;
    budget: number;
    limit: number;
  };
  sync: {
    intervalMinutes: number;
    strategy: string;
    nextSyncIn: string;
    lastSync: string | null;
  };
  forecast: {
    estimatedTotal: number;
    margin: number;
    confidence: 'low' | 'medium' | 'high';
  };
}

export interface TeamCatalogBackfillResultDto {
  updated: number;
  created: number;
  skipped: number;
  warnings: string[];
}

// === DTOs DE MONITOREO ===

export interface FootballSyncLogDto {
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

export interface FootballSyncConfigDto {
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

export interface FootballSyncAlertDto {
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

export interface MonitoringDashboardDto {
  status: {
    isEnabled: boolean;
    isEmergencyMode: boolean;
    lastSyncAt?: string;
    nextSyncIn: number;
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
  recentLogs: FootballSyncLogDto[];
  activeAlerts: FootballSyncAlertDto[];
  syncChart: {
    labels: string[];
    requestsUsed: number[];
    matchesUpdated: number[];
  };
}

export interface SyncHistoryFilterDto {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  matchId?: string;
  startDate?: string;
  endDate?: string;
}

export interface SyncHistoryResponseDto {
  logs: FootballSyncLogDto[];
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

export interface AlertsFilterDto {
  page?: number;
  limit?: number;
  type?: string;
  severity?: string;
  resolved?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface AlertsResponseDto {
  alerts: FootballSyncAlertDto[];
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

export interface UpdateConfigDto {
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

export interface ResolveAlertDto {
  resolved: boolean;
  resolvedBy?: string;
}

export interface SyncStatsDto {
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
