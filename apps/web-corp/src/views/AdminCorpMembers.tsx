import React, { useEffect, useState } from 'react';
import { Users, Search, Crown, Shield, User, Mail, ChevronLeft, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CorpLayout } from '../layouts/CorpLayout';
import { request } from '../api';
import { useTenantStore } from '../stores/tenant.store';

interface Member {
    id: string;
    userId: string;
    name: string;
    email: string;
    username: string;
    avatar: string | null;
    role: 'OWNER' | 'ADMIN' | 'PLAYER';
    joinedAt: string;
}

const ROLE_CONFIG = {
    OWNER: { label: 'Propietario', icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50' },
    ADMIN: { label: 'Admin', icon: Shield, color: 'text-violet-600', bg: 'bg-violet-50' },
    PLAYER: { label: 'Jugador', icon: User, color: 'text-slate-500', bg: 'bg-slate-100' },
};

function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    return (
        <button onClick={handleCopy} className="ml-1 text-slate-300 hover:text-slate-500 transition-colors">
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
        </button>
    );
}

export default function AdminCorpMembers() {
    const tenant = useTenantStore((s) => s.tenant);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'la organización';

    useEffect(() => {
        request<Member[]>('/corp/members')
            .then(setMembers)
            .catch(() => setMembers([]))
            .finally(() => setLoading(false));
    }, []);

    const filtered = members.filter(
        (m) =>
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase()) ||
            m.username.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <CorpLayout>
            {/* Header */}
            <div className="mb-6">
                <Link to="/admin" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 font-semibold mb-3 transition-colors w-fit">
                    <ChevronLeft size={15} /> Panel admin
                </Link>
                <div className="flex items-center gap-2 mb-1">
                    <Users size={20} className="text-sky-600" />
                    <h1 className="text-2xl font-black text-slate-900">Miembros</h1>
                </div>
                <p className="text-slate-500 text-sm">
                    {loading ? 'Cargando...' : `${members.length} miembro${members.length !== 1 ? 's' : ''} en ${orgName}`}
                </p>
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre, email o usuario..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    style={{ '--tw-ring-color': 'var(--color-primary, #f59e0b)' } as React.CSSProperties}
                />
            </div>

            {/* Role summary */}
            {!loading && members.length > 0 && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {(Object.keys(ROLE_CONFIG) as Array<keyof typeof ROLE_CONFIG>).map((role) => {
                        const count = members.filter((m) => m.role === role).length;
                        if (!count) return null;
                        const cfg = ROLE_CONFIG[role];
                        return (
                            <span key={role} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.color}`}>
                                <cfg.icon size={11} />
                                {count} {cfg.label}{count !== 1 ? 's' : ''}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Members list */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center">
                        <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary, #f59e0b)', borderTopColor: 'transparent' }} />
                    </div>
                ) : !filtered.length ? (
                    <div className="p-10 text-center text-slate-400 text-sm">
                        {search ? 'Sin resultados para esa búsqueda.' : 'No hay miembros aún.'}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map((member) => {
                            const roleCfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.PLAYER;
                            const RoleIcon = roleCfg.icon;
                            return (
                                <div key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                                    {/* Avatar */}
                                    <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center">
                                        {member.avatar ? (
                                            <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-sm font-black text-slate-400">
                                                {member.name.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-slate-800 text-sm truncate">{member.name}</p>
                                            <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-full ${roleCfg.bg} ${roleCfg.color}`}>
                                                <RoleIcon size={9} />
                                                {roleCfg.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <Mail size={10} className="text-slate-300 shrink-0" />
                                            <span className="text-xs text-slate-400 truncate">{member.email}</span>
                                            <CopyButton value={member.email} />
                                        </div>
                                        {member.username && (
                                            <p className="text-[10px] text-slate-300 font-mono mt-0.5">@{member.username}</p>
                                        )}
                                    </div>

                                    {/* Joined date */}
                                    <div className="text-right shrink-0 hidden sm:block">
                                        <p className="text-[10px] text-slate-300 font-medium">
                                            {new Date(member.joinedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </CorpLayout>
    );
}
