import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Ban } from 'lucide-react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { useAdminLeaguesStore } from '../../stores/admin.leagues.store';
import StatusBadge from '../../components/admin/StatusBadge';
import ConfirmDialog from '../../components/admin/ConfirmDialog';

const STATUSES = ['SETUP', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED'];

const AdminLeagueDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { selectedLeague, members, isLoading, isSaving, fetchLeague, fetchLeagueMembers, updateLeague, banMember } = useAdminLeaguesStore();

    const [status, setStatus] = React.useState('');
    const [confirmBan, setConfirmBan] = React.useState<{ userId: string; name: string } | null>(null);
    const [isDirty, setIsDirty] = React.useState(false);

    React.useEffect(() => {
        if (id) {
            fetchLeague(id);
            fetchLeagueMembers(id);
        }
    }, [id, fetchLeague, fetchLeagueMembers]);

    React.useEffect(() => {
        if (selectedLeague) setStatus(selectedLeague.status);
    }, [selectedLeague]);

    const handleSave = async () => {
        if (!id) return;
        await updateLeague(id, { status });
        setIsDirty(false);
    };

    if (isLoading && !selectedLeague) {
        return <div className="text-center py-16 text-slate-400">Cargando...</div>;
    }

    if (!selectedLeague) {
        return <div className="text-center py-16 text-slate-400">Polla no encontrada</div>;
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
                <button
                    onClick={() => navigate('/admin/leagues')}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex-shrink-0"
                >
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">
                        {selectedLeague.name}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={selectedLeague.status} size="md" />
                        <StatusBadge status={selectedLeague.plan} size="md" />
                        <span className="text-xs text-slate-400 font-mono">{selectedLeague.code}</span>
                    </div>
                </div>
            </div>

            <TabsPrimitive.Root defaultValue="info">
                <TabsPrimitive.List className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-full sm:w-fit">
                    {['info', 'members'].map((tab) => (
                        <TabsPrimitive.Trigger
                            key={tab}
                            value={tab}
                            className="flex-1 sm:flex-none text-center px-4 py-2 text-sm font-bold rounded-lg text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all capitalize"
                        >
                            {tab === 'info' ? 'Información' : 'Miembros'}
                        </TabsPrimitive.Trigger>
                    ))}
                </TabsPrimitive.List>

                <TabsPrimitive.Content value="info">
                    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            {[
                                { label: 'Descripción', value: selectedLeague.description ?? '—' },
                                { label: 'Privacidad', value: <StatusBadge status={selectedLeague.privacy} size="md" /> },
                                { label: 'Moneda', value: selectedLeague.currency },
                                { label: 'Miembros', value: `${(selectedLeague as any)._count?.members ?? 0}` },
                                { label: 'Pronósticos', value: `${(selectedLeague as any)._count?.predictions ?? 0}` },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">{label}</p>
                                    <div className="text-sm font-bold text-slate-800">{value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Status edit */}
                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">Cambiar Estado</p>
                            <div className="flex gap-2 flex-wrap">
                                {STATUSES.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => { setStatus(s); setIsDirty(true); }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                            status === s
                                                ? 'bg-amber-400 border-amber-400 text-slate-950'
                                                : 'border-slate-200 text-slate-600 hover:border-amber-300'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            {isDirty && (
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="mt-3 px-5 py-2 bg-amber-400 text-slate-950 font-bold rounded-xl text-sm hover:bg-amber-500 disabled:opacity-60 transition-all"
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                            )}
                        </div>
                    </div>
                </TabsPrimitive.Content>

                <TabsPrimitive.Content value="members">
                    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="grid grid-cols-[2fr_1fr_auto] md:grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Miembro</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Rol</p>
                            <p className="hidden md:block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Acción</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {members.map((member) => (
                                <div key={member.id} className="grid grid-cols-[2fr_1fr_auto] md:grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 items-center">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <img
                                            src={member.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user.name)}&background=e2e8f0&color=64748b`}
                                            className="w-7 h-7 rounded-full flex-shrink-0"
                                            alt={member.user.name}
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{member.user.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={member.role} />
                                    <div className="hidden md:block"><StatusBadge status={member.status} /></div>
                                    <button
                                        onClick={() => setConfirmBan({ userId: member.user.id, name: member.user.name })}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
                                    >
                                        <Ban size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsPrimitive.Content>
            </TabsPrimitive.Root>

            <ConfirmDialog
                open={!!confirmBan}
                onOpenChange={(v) => { if (!v) setConfirmBan(null); }}
                title="Banear miembro"
                description={`¿Banear a "${confirmBan?.name}" de esta polla?`}
                confirmLabel="Banear"
                isLoading={isSaving}
                onConfirm={async () => {
                    if (id && confirmBan) {
                        await banMember(id, confirmBan.userId);
                        setConfirmBan(null);
                    }
                }}
            />
        </div>
    );
};

export default AdminLeagueDetail;
