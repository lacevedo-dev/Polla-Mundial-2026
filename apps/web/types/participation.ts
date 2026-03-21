export type ParticipationCategory = 'PRINCIPAL' | 'MATCH' | 'GROUP' | 'ROUND' | 'PHASE';
export type ParticipationStatus =
  | 'UNSELECTED'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELLED';
export type ParticipationMultiplier = 1 | 2 | 3;

export interface ParticipationPrizePreview {
  estimatedPool?: number;
  firstPrize?: number;
  secondPrize?: number;
  thirdPrize?: number;
  adminPercent?: number;
}

export interface ParticipationCategoryOption {
  category: ParticipationCategory;
  categoryLabel: string;
  referenceId?: string;
  referenceLabel: string;
  unitAmount: number;
  currency: string;
  deadlineAt?: string;
  enabled: boolean;
  prizePreview?: ParticipationPrizePreview;
  status?: ParticipationStatus;
  multiplier?: ParticipationMultiplier;
}

export interface ParticipationSelectionDraft {
  category: ParticipationCategory;
  referenceId?: string;
  multiplier: ParticipationMultiplier;
  subtotal: number;
}

export interface MatchParticipationDraft {
  matchId?: string;
  selections: ParticipationSelectionDraft[];
  total: number;
  dirty: boolean;
}

export interface ParticipationSummaryItem {
  id: string;
  category: ParticipationCategory;
  categoryLabel: string;
  referenceId?: string;
  referenceLabel: string;
  status: ParticipationStatus;
  unitAmount: number;
  multiplier: ParticipationMultiplier;
  subtotal: number;
  currency: string;
  deadlineAt?: string;
  prizePreview?: ParticipationPrizePreview;
}

export interface ParticipationSummaryBar {
  totalPending: number;
  currency: string;
  itemCount: number;
  hasPrincipalPending: boolean;
  items: ParticipationSummaryItem[];
}

export interface ParticipationOptionsBatch {
  summary: ParticipationSummaryBar;
  optionsByMatch: Record<string, ParticipationCategoryOption[]>;
}

export const ParticipationStatusColors: Record<ParticipationStatus, string> = {
  UNSELECTED: 'bg-slate-100 text-slate-500 border-slate-200',
  PENDING_PAYMENT: 'bg-rose-100 text-rose-700 border-rose-200',
  PAID: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  EXPIRED: 'bg-amber-100 text-amber-700 border-amber-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const ParticipationCategoryLabels: Record<ParticipationCategory, string> = {
  PRINCIPAL: 'Polla principal',
  MATCH: 'Por partido',
  GROUP: 'Por grupo',
  ROUND: 'Por ronda',
  PHASE: 'Por fase',
};
