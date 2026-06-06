import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Trophy, ArrowRight } from 'lucide-react';
import { useTenantStore } from '../stores/tenant.store';

const STEPS = [
    {
        icon: Building2,
        title: 'Portal listo',
        description: 'Tu portal corporativo está configurado y disponible para tu equipo.',
    },
    {
        icon: Users,
        title: 'Invita a tu equipo',
        description: 'Envía invitaciones a tus compañeros para que se unan al portal.',
    },
    {
        icon: Trophy,
        title: 'Crea pollas',
        description: 'El administrador puede crear pollas y el equipo puede participar.',
    },
];

export default function Onboarding() {
    const navigate = useNavigate();
    const tenant = useTenantStore((s) => s.tenant);
    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'tu organización';

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
            <div className="w-full max-w-md">
                <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Building2 size={32} className="text-slate-900" />
                </div>

                <h1 className="text-3xl font-black text-white mb-2">
                    ¡Bienvenido a {orgName}!
                </h1>
                <p className="text-slate-400 mb-8">Tu portal corporativo está listo. Aquí tienes lo que puedes hacer:</p>

                <div className="space-y-3 mb-8">
                    {STEPS.map(({ icon: Icon, title, description }, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start gap-4 text-left">
                            <div className="w-10 h-10 bg-amber-400/20 rounded-xl flex items-center justify-center shrink-0">
                                <Icon size={18} className="text-amber-400" />
                            </div>
                            <div>
                                <p className="font-black text-white text-sm">{title}</p>
                                <p className="text-slate-400 text-xs mt-0.5">{description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => navigate('/')}
                    className="w-full py-3.5 bg-amber-400 hover:bg-amber-500 text-slate-900 font-black rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                    Ir al dashboard <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
}
