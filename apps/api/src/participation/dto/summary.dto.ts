export interface ParticipationPrizePreviewDto {
  estimatedPool?: number;
  firstPrize?: number;
  secondPrize?: number;
  thirdPrize?: number;
  adminPercent?: number;
}

export interface ParticipationSummaryItemDto {
  id: string;
  category: string;
  categoryLabel: string;
  referenceId?: string;
  referenceLabel: string;
  status: 'UNSELECTED' | 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  unitAmount: number;
  multiplier: 1 | 2 | 3;
  subtotal: number;
  currency: string;
  deadlineAt?: string;
  prizePreview?: ParticipationPrizePreviewDto;
}

export interface ParticipationSummaryDto {
  totalPending: number;
  currency: string;
  itemCount: number;
  hasPrincipalPending: boolean;
  items: ParticipationSummaryItemDto[];
}
