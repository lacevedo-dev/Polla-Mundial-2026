
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
  primaryTournamentId?: string;
  tournamentIds?: string[];
  matchIds?: string[];
}

// ─── Corporate Tenant Types ───────────────────────────────────────────────────

export type TenantStatus = 'PENDING_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
export type TenantPlanTier = 'STARTER' | 'BUSINESS' | 'ENTERPRISE';
export type TenantRole = 'OWNER' | 'ADMIN' | 'PLAYER';
export type TenantMemberStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';
export type TenantBillingModel = 'FLAT_MONTHLY' | 'PER_USER' | 'ANNUAL' | 'CUSTOM';

export interface TenantBranding {
  id: string;
  tenantId: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  heroImageUrl: string | null;
  companyDisplayName: string | null;
  customCss: string | null;
  emailHeaderHtml: string | null;
  emailFooterHtml: string | null;
  emailInviteTemplate: string | null;
}

export interface TenantConfig {
  id: string;
  tenantId: string;
  enablePayments: boolean;
  enableAiInsights: boolean;
  enablePublicLeagues: boolean;
  enableUserSelfRegister: boolean;
  requireInvitation: boolean;
  enableEmailNotif: boolean;
  enablePushNotif: boolean;
  enableStageFees: boolean;
}

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  status: TenantStatus;
  planTier: TenantPlanTier;
  customDomain: string | null;
  maxUsers: number;
  maxLeagues: number;
  branding: TenantBranding | null;
  config: TenantConfig | null;
  memberCount?: number;
  myRole?: TenantRole;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  status: TenantMemberStatus;
  invitedAt: string;
  joinedAt: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    username: string;
    avatar: string | null;
  };
}
