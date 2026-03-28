import React from 'react';

interface StatusBadgeProps {
    status: string;
    size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'Activo', className: 'bg-lime-100 text-lime-700' },
    SETUP: { label: 'Configuración', className: 'bg-blue-100 text-blue-700' },
    PAUSED: { label: 'Pausado', className: 'bg-amber-100 text-amber-700' },
    FINISHED: { label: 'Finalizado', className: 'bg-slate-100 text-slate-600' },
    CANCELLED: { label: 'Cancelado', className: 'bg-rose-100 text-rose-700' },
    SCHEDULED: { label: 'Programado', className: 'bg-blue-100 text-blue-700' },
    LIVE: { label: 'En vivo', className: 'bg-lime-100 text-lime-700' },
    POSTPONED: { label: 'Pospuesto', className: 'bg-amber-100 text-amber-700' },
    PENDING: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
    CONFIRMED: { label: 'Confirmado', className: 'bg-lime-100 text-lime-700' },
    REJECTED: { label: 'Rechazado', className: 'bg-rose-100 text-rose-700' },
    BANNED: { label: 'Baneado', className: 'bg-rose-100 text-rose-700' },
    INACTIVE: { label: 'Inactivo', className: 'bg-slate-100 text-slate-600' },
    FREE: { label: 'FREE', className: 'bg-slate-100 text-slate-600' },
    GOLD: { label: 'GOLD', className: 'bg-amber-100 text-amber-700' },
    DIAMOND: { label: 'DIAMOND', className: 'bg-purple-100 text-purple-700' },
    USER: { label: 'Usuario', className: 'bg-slate-100 text-slate-600' },
    ADMIN: { label: 'Admin', className: 'bg-blue-100 text-blue-700' },
    SUPERADMIN: { label: 'SuperAdmin', className: 'bg-amber-100 text-amber-800' },
    PLAYER: { label: 'Jugador', className: 'bg-slate-100 text-slate-600' },
    MEMBER: { label: 'Miembro', className: 'bg-slate-100 text-slate-600' },
    PUBLIC: { label: 'Pública', className: 'bg-lime-100 text-lime-700' },
    PRIVATE: { label: 'Privada', className: 'bg-slate-100 text-slate-600' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
    const config = statusConfig[status] ?? {
        label: status,
        className: 'bg-slate-100 text-slate-600',
    };

    return (
        <span
            className={`inline-flex items-center font-bold uppercase tracking-wide rounded-full ${
                size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'
            } ${config.className}`}
        >
            {config.label}
        </span>
    );
};

export default StatusBadge;
