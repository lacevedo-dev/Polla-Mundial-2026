import React from 'react';

interface AdminStatCardProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    trend?: string;
    color?: 'amber' | 'lime' | 'blue' | 'rose' | 'purple';
}

const colorMap = {
    amber: { bg: 'bg-amber-50', icon: 'text-amber-500', value: 'text-amber-600', border: 'border-amber-100' },
    lime: { bg: 'bg-lime-50', icon: 'text-lime-500', value: 'text-lime-600', border: 'border-lime-100' },
    blue: { bg: 'bg-blue-50', icon: 'text-blue-500', value: 'text-blue-600', border: 'border-blue-100' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-500', value: 'text-rose-600', border: 'border-rose-100' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-500', value: 'text-purple-600', border: 'border-purple-100' },
};

const AdminStatCard: React.FC<AdminStatCardProps> = ({
    label,
    value,
    icon: Icon,
    trend,
    color = 'amber',
}) => {
    const colors = colorMap[color];

    return (
        <div className={`rounded-[1.75rem] border ${colors.border} bg-white p-5 shadow-sm`}>
            <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
                <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center`}>
                    <Icon size={16} className={colors.icon} />
                </div>
            </div>
            <p className={`text-xl lg:text-2xl font-black ${colors.value}`}>{value}</p>
            {trend && <p className="text-[11px] text-slate-400 mt-1">{trend}</p>}
        </div>
    );
};

export default AdminStatCard;
