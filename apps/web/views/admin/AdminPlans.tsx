import React from 'react';
import { Save, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useAdminPlansStore, type PlanConfig } from '../../stores/admin.plans.store';

const PLAN_NAMES = ['FREE', 'GOLD', 'DIAMOND'];

const PlanCard: React.FC<{
    planName: string;
    config: PlanConfig;
    onSave: (planName: string, config: PlanConfig) => void;
    isSaving: boolean;
}> = ({ planName, config, onSave, isSaving }) => {
    const [local, setLocal] = React.useState<PlanConfig>({ ...config });
    const [isDirty, setIsDirty] = React.useState(false);
    const [newFeature, setNewFeature] = React.useState('');

    const isGold = planName === 'GOLD';
    const isDiamond = planName === 'DIAMOND';

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

    const titleColor = isGold ? 'text-lime-400' : isDiamond ? 'text-cyan-500' : 'text-slate-900';
    const checkColor = isGold ? 'text-lime-400' : isDiamond ? 'text-cyan-500' : 'text-slate-300';
    const featureTextColor = isGold ? 'text-slate-300' : 'text-slate-500';
    const labelColor = isGold ? 'text-slate-400' : 'text-slate-400';
    const inputClasses = isGold
        ? 'w-full rounded-xl border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-lime-400'
        : 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400';
    const addInputClasses = isGold
        ? 'flex-1 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder:text-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400'
        : 'flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';
    const addBtnClasses = isGold
        ? 'w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 text-slate-300 hover:bg-lime-400 hover:text-slate-900 transition-all'
        : 'w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700 transition-all';
    const featureBgClass = isGold ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700';

    const cardClasses = isGold
        ? 'p-10 rounded-[3rem] bg-slate-900 text-white shadow-2xl scale-105 relative overflow-hidden space-y-6'
        : 'p-8 rounded-[2.5rem] bg-white border border-slate-200 space-y-6 shadow-sm';

    return (
        <div className={cardClasses}>
            {/* POPULAR badge for GOLD */}
            {isGold && (
                <div className="absolute top-0 right-0 p-4 bg-lime-400 text-black text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">
                    POPULAR
                </div>
            )}

            {/* Plan name & price */}
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <h2 className={`text-2xl font-black font-brand uppercase tracking-wider ${titleColor}`}>{planName}</h2>
                    {isDirty && (
                        <button
                            onClick={() => { onSave(planName, local); setIsDirty(false); }}
                            disabled={isSaving}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 ${isGold ? 'bg-lime-400 text-slate-900 hover:bg-lime-300' : 'bg-amber-400 text-slate-950 hover:bg-amber-500'}`}
                        >
                            <Save size={12} />
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                    )}
                </div>
                <div className={`text-4xl font-black font-brand ${isGold ? 'text-white' : 'text-slate-900'}`}>
                    ${local.price > 0 ? `${(local.price / 1000).toFixed(0)}k` : '0'}
                    <span className={`text-sm font-bold ml-1 ${isGold ? 'text-slate-500' : 'text-slate-400'}`}>
                        / {local.price > 0 ? 'ÚNICO' : 'SIEMPRE'}
                    </span>
                </div>
                {isGold && (
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Pago único por administrador</p>
                )}
            </div>

            {/* Config fields */}
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-[0.18em] block mb-1.5 ${labelColor}`}>Precio (COP)</label>
                        <input
                            type="number"
                            value={local.price}
                            onChange={(e) => update({ price: Number(e.target.value) })}
                            className={inputClasses}
                        />
                    </div>
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-[0.18em] block mb-1.5 ${labelColor}`}>Max Ligas</label>
                        <input
                            type="number"
                            value={local.maxLeagues}
                            onChange={(e) => update({ maxLeagues: Number(e.target.value) })}
                            className={inputClasses}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-[0.18em] block mb-1.5 ${labelColor}`}>Max Participantes</label>
                        <input
                            type="number"
                            value={local.maxParticipants}
                            onChange={(e) => update({ maxParticipants: Number(e.target.value) })}
                            className={inputClasses}
                        />
                    </div>
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-[0.18em] block mb-1.5 ${labelColor}`}>
                            Créditos IA
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={local.siCredits ?? 0}
                            onChange={(e) => update({ siCredits: Number(e.target.value) })}
                            className={inputClasses}
                        />
                    </div>
                </div>
                <p className={`-mt-1 text-[9px] ${isGold ? 'text-slate-500' : 'text-slate-400'}`}>
                    * Créditos IA = análisis Smart Insights disponibles por período por usuario
                </p>
            </div>

            {/* Features list */}
            <div>
                <label className={`text-[10px] font-black uppercase tracking-[0.18em] block mb-3 ${labelColor}`}>Características</label>
                <ul className={`space-y-${isGold ? '4' : '3'}`}>
                    {local.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 group">
                            <CheckCircle2 size={isGold ? 18 : 16} className={`flex-shrink-0 ${checkColor}`} />
                            <span className={`flex-1 text-sm font-bold ${featureTextColor}`}>{f}</span>
                            <button
                                onClick={() => removeFeature(i)}
                                className={`w-6 h-6 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all ${isGold ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}
                            >
                                <Trash2 size={12} />
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="flex gap-2 mt-3">
                    <input
                        value={newFeature}
                        onChange={(e) => setNewFeature(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                        placeholder="Nueva característica..."
                        className={addInputClasses}
                    />
                    <button onClick={addFeature} className={addBtnClasses}>
                        <Plus size={16} />
                    </button>
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
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">Planes</h1>
                    <p className="text-sm text-slate-500 mt-1">Configura las características y límites de cada plan</p>
                </div>
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 items-center">
                    {PLAN_NAMES.map((p) => (
                        <div key={p} className={`bg-slate-200 animate-pulse ${p === 'GOLD' ? 'h-96 rounded-[3rem]' : 'h-80 rounded-[2.5rem]'}`} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">Planes</h1>
                <p className="text-sm text-slate-500 mt-1">Configura las características y límites de cada plan</p>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 items-center">
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
