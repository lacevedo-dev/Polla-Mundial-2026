export type AutomationPhase = 'PRE_MATCH' | 'LIVE' | 'POST_MATCH';

export type AutomationChannelId = 'inApp' | 'push' | 'email' | 'waGroup';

export type EscalationCheckpointId = 'T45' | 'T30' | 'T_FINAL';

export type UserMatchLeagueStatus = {
  leagueId: string;
  leagueName: string;
  hasPrediction: boolean;
};

export type UserMatchAudience = {
  userId: string;
  leagues: UserMatchLeagueStatus[];
  allComplete: boolean;
  pendingLeagueIds: string[];
  pendingLeagueNames: string[];
};

export type LivePhaseEventId =
  | 'MATCH_START'
  | 'HALFTIME'
  | 'SECOND_HALF_START'
  | 'MATCH_LIVE_END'
  | 'GOAL_IMPACT';

export type LiveMatchContext = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  matchDate: Date;
  elapsed: number | null;
};

export type GoalImpactContext = LiveMatchContext & {
  homeScore: number;
  awayScore: number;
  scoringTeam: string | null;
  scorerName?: string | null;
  minuteLabel?: string | null;
};
