import React from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { useAdminPlansStore, type PlanConfig } from '../../stores/admin.plans.store';

const PLAN_NAMES = ['FREE', 'GOLD', 'DIAMOND'];

const planAccent: Record<string, string> = {
    FREE: 'border-slate-200 bg-white',
    GOLD: 'border-amber-200 bg-amber-50',
    DIAMOND: 'border-purple-200 bg-purple-50',
};

const planValueColor: Record<string, string> = {
    FREE: 'text-slate-700',
    GOLD: 'text-amber-700',
    DIAMOND: 'text-purple-700',
};

const PlanCard: React.FC<{
    planName: string;
    config: PlanConfig;
    onSave: (planName: string, config: PlanConfig) => void;
    isSaving: boolean;
}> = ({ planName, config, onSave, isSaving }) => {
    const [local, setLocal] = React.useState<PlanConfig>({ ...config });
    const [isDirty, setIsDirty] = React.useState(false);
    const [newFeature, setNewFeature] = React.useState('');

    const update = (patch: Partial<PlanConfig>) => {
        setLocal((prev) => ({ ...prev, ...patch }));
        setIsDirty(true);
    };

    const addFeature = () => {
        if (!newFeature.trim()) return;
        update({ features: [...local.features, newFeature.trim()] });
        setNewFeature('');
    };

    const removeFeature = (i: number) => {
        update({ features: local.features.filter((_, idx) => idx !== i) });
    };

    return (
        <div className={`rounded-[2rem] border p-6 shadow-sm ${planAccent[planName]}`}>
            <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-black uppercase tracking-wider ${planValueColor[planName]}`}>{planName}</h2>
                {isDirty && (
                    <button
                        onClick={() => { onSave(planName, local); setIsDirty(false); }}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 text-slate-950 rounded-xl text-xs font-bold hover:bg-amber-500 disabled:opacity-60 transition-all"
                    >
                        <Save size={12} />
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                )}
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Precio (COP)</label>
                        <input
                            type="number"
                            value={local.price}
                            onChange={(e) => update({ price: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Max Ligas</label>
                        <input
                            type="number"
                            value={local.maxLeagues}
                            onChange={(e) => update({ maxLeagues: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Max Participantes</label>
                    <input
                        type="number"
                        value={local.maxParticipants}
                        onChange={(e) => update({ maxParticipants: Number(e.target.value) })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-2">Características</label>
                    <div className="space-y-1.5">
                        {local.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 group">
                                <span className="flex-1 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5">{f}</span>
                                <button
                                    onClick={() => removeFeature(i)}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <input
                            value={newFeature}
                            onChange={(e) => setNewFeature(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                            placeholder="Nueva característica..."
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <button
                            onClick={addFeature}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700 transition-all"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AdminPlans: React.FC = () => {
    const { plans, isLoading, isSaving, fetchPlans, updatePlan } = useAdminPlansStore();

    React.useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {PLAN_NAMES.map((p) => (
                    <div key={p} className="h-72 bg-slate-200 rounded-[2rem] animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">Planes</h1>
                <p className="text-sm text-slate-500 mt-1">Configura las características y límites de cada plan</p>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {PLAN_NAMES.map((planName) => {
                    const config = plans[planName];
                    if (!config) return null;
                    return (
                        <PlanCard
                            key={planName}
                            planName={planName}
                            config={config}
                            onSave={updatePlan}
                            isSaving={isSaving}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default AdminPlans;
