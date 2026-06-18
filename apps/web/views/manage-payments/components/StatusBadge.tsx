import React from 'react';
import { Badge } from '../../../components/UI';

export const StatusBadge: React.FC<{
    isFullyPaid: boolean;
    hasExpired: boolean;
    percentage: number;
}> = ({ isFullyPaid, hasExpired, percentage }) => {
    if (hasExpired) return <Badge color="bg-rose-100 text-rose-700 border border-rose-200">VENCIDO</Badge>;
    if (isFullyPaid) return <Badge color="bg-lime-100 text-lime-700 border border-lime-200">AL DÍA</Badge>;
    return (
        <Badge color="bg-slate-100 text-slate-600 border border-slate-200">
            {percentage > 0 ? 'PARCIAL' : 'PENDIENTE'}
        </Badge>
    );
};
