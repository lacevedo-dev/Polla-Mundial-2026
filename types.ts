
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

export interface UserRanking {
  position: number;
  name: string;
  points: number;
  avatar: string;
  trend: 'up' | 'down' | 'stable';
}

export type AppView = 'landing' | 'dashboard' | 'predictions' | 'ranking' | 'design-system' | 'before-after' | 'login' | 'register' | 'help' | 'email-verification' | 'checkout' | 'create-league';
