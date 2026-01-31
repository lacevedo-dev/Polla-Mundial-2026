
export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  date: string;
  venue: string;
  prediction?: {
    home: number;
    away: number;
  };
}

export interface PrizeWinner {
  position: number;
  label: string;
  percentage: number;
  active: boolean;
}

export type StageType = 'match' | 'round' | 'phase';

export interface StageFeeInfo {
  active: boolean;
  amount: string;
}

export interface CategoryDistribution {
  winnersCount: number;
  distribution: PrizeWinner[];
}

export interface LeagueData {
  name: string;
  description: string;
  privacy: 'private' | 'public';
  logo: string | null;
  participantsCount: number;
  includeBaseFee: boolean;
  baseFeeAmount: string;
  includeStageFees: boolean;
  stageFees: {
    match: StageFeeInfo;
    round: StageFeeInfo;
    phase: StageFeeInfo;
  };
  adminFeePercent: number;
  distributions: {
    general: CategoryDistribution;
    match: CategoryDistribution;
    round: CategoryDistribution;
    phase: CategoryDistribution;
  };
  currency: string;
  plan: 'free' | 'gold' | 'diamond';
}

export type AppView = 'landing' | 'dashboard' | 'predictions' | 'ranking' | 'design-system' | 'before-after' | 'login' | 'register' | 'help' | 'email-verification' | 'checkout' | 'create-league';
