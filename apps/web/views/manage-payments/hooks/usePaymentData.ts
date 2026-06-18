import { useCallback, useMemo } from 'react';
import type { ObligationRecord, PaymentAggregates, PaymentConcept, PaymentFilter, UserSummary } from '../types';

export function usePaymentData(
    obligations: ObligationRecord[],
    selectedLabels: string[],
    filter: PaymentFilter,
    search: string,
) {
    const concepts = useMemo<PaymentConcept[]>(() => {
        const seen = new Map<string, PaymentConcept>();
        obligations.forEach((o) => {
            if (!seen.has(o.referenceLabel)) {
                seen.set(o.referenceLabel, {
                    id: o.referenceLabel,
                    label: o.referenceLabel,
                    category: o.category,
                    amount: o.unitAmount,
                });
            }
        });
        return Array.from(seen.values());
    }, [obligations]);

    const users = useMemo<UserSummary[]>(() => {
        const seen = new Map<string, UserSummary>();
        obligations.forEach((o) => {
            if (!seen.has(o.userId)) {
                seen.set(o.userId, { id: o.userId, name: o.userName, avatar: o.userAvatar });
            }
        });
        return Array.from(seen.values());
    }, [obligations]);

    const currency = obligations[0]?.currency ?? 'COP';

    const getUserObs = useCallback(
        (userId: string) =>
            obligations.filter((o) => o.userId === userId && selectedLabels.includes(o.referenceLabel)),
        [obligations, selectedLabels],
    );

    const getAggregates = useCallback((userId: string): PaymentAggregates => {
        const obs = getUserObs(userId);
        const paid = obs.filter((o) => o.status === 'PAID').reduce((s, o) => s + o.totalAmount, 0);
        const pending = obs.filter((o) => o.status === 'PENDING_PAYMENT').reduce((s, o) => s + o.totalAmount, 0);
        const hasExpired = obs.some((o) => o.status === 'EXPIRED' || o.status === 'CANCELLED');
        const total = paid + pending;
        return {
            paid,
            pending,
            hasExpired,
            isFullyPaid: total > 0 && pending === 0 && !hasExpired,
            percentage: total > 0 ? Math.round((paid / total) * 100) : 0,
        };
    }, [getUserObs]);

    const financials = useMemo(() => {
        let expected = 0;
        let collected = 0;
        users.forEach((u) => {
            const agg = getAggregates(u.id);
            expected += agg.paid + agg.pending;
            collected += agg.paid;
        });
        return {
            expected,
            collected,
            progress: expected === 0 ? 0 : Math.round((collected / expected) * 100),
        };
    }, [users, getAggregates]);

    const filteredUsers = useMemo(
        () => users.filter((u) => {
            const agg = getAggregates(u.id);
            const matchFilter =
                filter === 'all' ? true :
                filter === 'solvents' ? agg.isFullyPaid :
                filter === 'expired' ? agg.hasExpired :
                agg.pending > 0;
            const matchSearch = u.name.toLowerCase().includes(search.toLowerCase());
            return matchFilter && matchSearch;
        }),
        [users, filter, search, getAggregates],
    );

    return {
        concepts,
        users,
        currency,
        getUserObs,
        getAggregates,
        financials,
        filteredUsers,
    };
}
