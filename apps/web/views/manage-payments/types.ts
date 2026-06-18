export type ReminderChannel = 'whatsapp_group' | 'whatsapp_personal' | 'email' | 'sms' | 'push';
export type TemplateKey = 'friendly' | 'formal' | 'urgent' | 'ai' | 'custom';
export type PaymentFilter = 'all' | 'debtors' | 'expired' | 'solvents';

/** Obligation record as returned by GET /leagues/:id/payments */
export interface ObligationRecord {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string | null;
    category: string;
    referenceLabel: string;
    unitAmount: number;
    multiplier: number;
    totalAmount: number;
    currency: string;
    status: 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'CANCELLED';
    deadlineAt: string;
    paidAt?: string | null;
    createdAt: string;
}

export interface UserSummary {
    id: string;
    name: string;
    avatar?: string | null;
}

export interface PaymentAggregates {
    paid: number;
    pending: number;
    hasExpired: boolean;
    isFullyPaid: boolean;
    percentage: number;
}

export interface PaymentConcept {
    id: string;
    label: string;
    category: string;
    amount: number;
}
